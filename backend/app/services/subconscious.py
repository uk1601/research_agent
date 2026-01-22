"""
Subconscious SDK wrapper service.

Architecture Notes:
- The Subconscious SDK provides synchronous streaming only (client.stream())
- We use asyncio.Queue to bridge sync generator → async generator
- A background thread runs the sync SDK, pushing events to the queue
- The async generator yields from the queue, allowing non-blocking SSE

Key Learnings:
1. Delta events stream internal JSON - extract meaningful content for activity logs
2. After "done" event, use client.wait(run_id) for automatic polling until completion
3. Error events have .error attribute (per docs), with .message as fallback
4. Without answerFormat: answer is a string
5. With answerFormat: answer is an object matching the schema
6. "terminated" errors are transient - treat as retryable
7. Answer may be JSON with only 'reasoning' key - synthesize answer from conclusions
"""

import asyncio
import time
import json
import logging
import threading
from typing import Generator, AsyncGenerator, List, Dict, Any, Optional
from datetime import datetime
from queue import Queue, Empty
from concurrent.futures import ThreadPoolExecutor

from subconscious import Subconscious
from subconscious.errors import SubconsciousError

from app.config import get_settings

logger = logging.getLogger(__name__)


# Thread pool for running sync SDK operations
_executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix="subconscious-")


# Available engines
AVAILABLE_ENGINES = [
    {"id": "tim-small-preview", "name": "TIM Small Preview", "description": "Fast, lightweight engine"},
    {"id": "tim-gpt", "name": "TIM GPT", "description": "GPT-powered engine"},
    {"id": "tim-large", "name": "TIM Large", "description": "Most capable engine"},
]

VALID_ENGINE_IDS = {e["id"] for e in AVAILABLE_ENGINES}

# Available platform tools
AVAILABLE_TOOLS = [
    {"id": "web_search", "name": "Web Search", "description": "Search the web for information"},
    {"id": "webpage_understanding", "name": "Webpage Understanding", "description": "Read and understand web pages"},
    {"id": "exa_search", "name": "Exa Search", "description": "Semantic search engine"},
]

VALID_TOOL_IDS = {t["id"] for t in AVAILABLE_TOOLS}


# Sentinel value to signal end of stream
_STREAM_END = object()
_STREAM_ERROR = object()


class SubconsciousService:
    """Service for interacting with Subconscious API with proper async support."""
    
    def __init__(self, engine: Optional[str] = None):
        settings = get_settings()
        self.client = Subconscious(api_key=settings.SUBCONSCIOUS_API_KEY)
        self.engine = engine or settings.SUBCONSCIOUS_ENGINE
        self.arxiv_url = settings.ARXIV_SERVICE_URL
        self.max_retries = settings.MAX_RETRIES
        self.retry_delay = settings.RETRY_DELAY
        
        logger.info(f"SubconsciousService initialized - Engine: {self.engine}")
    
    def _get_tools(self, tool_ids: Optional[List[str]] = None, include_arxiv: bool = True) -> List[Dict[str, Any]]:
        """Build tool configuration based on selected tool IDs."""
        # Default to all tools if none specified
        if tool_ids is None:
            tool_ids = ["web_search", "webpage_understanding", "exa_search"]
        
        tools = []
        for tool_id in tool_ids:
            tools.append({"type": "platform", "id": tool_id})
        
        if include_arxiv and self.arxiv_url:
            tools.append({
                "type": "function",
                "name": "arxiv_search",
                "description": "Search ArXiv for academic papers and research articles. Use this for finding peer-reviewed scientific publications, preprints, and academic research.",
                "url": f"{self.arxiv_url}/search",
                "method": "POST",
                "timeout": 30,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query for academic papers"},
                        "max_results": {"type": "integer", "default": 10}
                    },
                    "required": ["query"]
                }
            })
        
        return tools
    
    def _build_instructions(self, topic: str) -> str:
        """
        Build a robust, comprehensive instruction prompt for the research agent.
        
        The prompt is designed to:
        1. Clearly define the agent's role and capabilities
        2. Establish a systematic research methodology
        3. Handle diverse query types (simple facts → complex analysis)
        4. Ensure quality, accuracy, and proper source attribution
        5. Guard against unsafe/inappropriate requests
        """
        return f"""## IDENTITY & ROLE
You are an advanced research assistant powered by multiple information retrieval tools including web search, academic databases (ArXiv), and webpage analysis. Your purpose is to conduct thorough, accurate research and synthesize findings into clear, actionable insights.

## RESEARCH TOPIC
{topic}

---

## PRIMARY OBJECTIVE
Conduct comprehensive research on the topic above using all available tools, then synthesize your findings into a well-organized, properly cited response that directly addresses the user's information needs.

---

## RESEARCH METHODOLOGY

### Phase 1: Query Analysis
Before searching, analyze the topic to determine:
1. **Query Type**: Is this a simple factual question, a complex research topic, a comparison, an opinion piece, or a technical explanation?
2. **Scope**: What breadth and depth of research is appropriate?
3. **Key Concepts**: What are the core terms, entities, and concepts to search for?
4. **Source Types**: What sources would be most authoritative (academic papers, news, official docs, etc.)?

### Phase 2: Information Gathering
Execute a systematic search strategy:
1. **Initial Broad Search**: Start with web_search using core keywords to understand the landscape
2. **Targeted Deep Dives**: Use specific queries to explore important subtopics
3. **Academic Sources**: When relevant, use arxiv_search to find peer-reviewed research
4. **Source Analysis**: Use webpage_understanding to extract detailed content from authoritative sources
5. **Cross-Validation**: Verify key facts across multiple independent sources

### Phase 3: Analysis & Synthesis
Process gathered information:
1. **Extract Key Findings**: Identify the most important, well-supported facts
2. **Identify Consensus**: Note where sources agree and establish as reliable
3. **Flag Disagreements**: Highlight areas where sources conflict or where uncertainty exists
4. **Connect Dots**: Draw meaningful connections between different pieces of information
5. **Assess Quality**: Evaluate source credibility (peer-reviewed > reputable news > blogs > forums)

### Phase 4: Response Construction
Synthesize into a cohesive response:
1. **Direct Answer First**: Lead with a clear, direct answer to the main question
2. **Supporting Evidence**: Provide key findings that support your answer
3. **Nuance & Context**: Add important caveats, exceptions, or contextual information
4. **Source Attribution**: Cite sources inline and provide URLs for verification

---

## RESPONSE QUALITY STANDARDS

### Accuracy Requirements
- ONLY include information that is explicitly supported by your sources
- Distinguish clearly between established facts, expert opinions, and speculation
- If sources conflict, present both viewpoints and note the disagreement
- If information cannot be verified, explicitly state uncertainty
- NEVER fabricate facts, statistics, quotes, or citations

### Depth Calibration
Adapt your response depth based on query complexity:

| Query Type | Response Approach |
|------------|-------------------|
| Simple Fact | Direct answer + brief context + source |
| Definition/Explanation | Clear explanation + examples + authoritative source |
| How-To/Process | Step-by-step guidance + best practices + multiple sources |
| Research Topic | Comprehensive analysis + multiple perspectives + extensive citations |
| Comparison | Structured comparison + pros/cons + evidence for each |
| Current Event | Latest information + timeline + multiple news sources |
| Technical Topic | Detailed explanation + code/examples if relevant + documentation links |

### Citation Format
For every major claim or finding:
- Include inline attribution: "According to [Source]..." or "Research from [Institution] shows..."
- Provide URL for verification when available
- Note publication date for time-sensitive information
- Indicate source type (academic paper, news article, official documentation, etc.)

---

## TOOL USAGE GUIDELINES

### web_search
- Use for: General information, current events, broad topic exploration
- Query tips: Use specific keywords, include relevant context terms
- Multiple searches: Don't hesitate to search multiple times with refined queries

### webpage_understanding  
- Use for: Deep-diving into specific pages, extracting detailed content
- Best for: Official documentation, detailed articles, research pages
- Note: Use after identifying promising URLs from web_search

### exa_search
- Use for: Semantic/conceptual searches, finding similar content
- Best for: Finding related topics, exploring a concept space

### arxiv_search
- Use for: Academic papers, scientific research, technical publications
- Best for: Peer-reviewed sources, cutting-edge research, technical depth
- Note: Results are preprints/papers from arxiv.org

---

## SAFETY & APPROPRIATENESS

### REFUSE to provide:
- Instructions for illegal activities, weapons, or harmful substances
- Personal information about private individuals
- Medical/legal advice presented as professional consultation
- Content that promotes discrimination, violence, or harassment
- Misinformation or intentionally misleading content

### HANDLE with care:
- Controversial topics: Present multiple perspectives fairly
- Health-related queries: Include disclaimer to consult professionals
- Legal questions: Note that this is general information, not legal advice
- Sensitive topics: Approach with appropriate sensitivity and nuance

---

## OUTPUT STRUCTURE

Organize your final response as follows:

### Summary
A concise 2-3 sentence overview answering the core question.

### Key Findings
The most important discoveries from your research, each with source attribution.

### Detailed Analysis
Deeper exploration of the topic with supporting evidence and context.

### Sources
List of key sources used with URLs for verification.

### Limitations & Further Research (if applicable)
Note any gaps in available information or areas that warrant deeper investigation.

---

## CRITICAL REMINDERS
1. You MUST use your tools to gather information - do not rely solely on pre-existing knowledge
2. You MUST cite sources for factual claims
3. You MUST acknowledge uncertainty when it exists
4. You MUST refuse unsafe or inappropriate requests
5. You MUST tailor response depth to query complexity
6. You MUST verify important facts across multiple sources when possible

Begin your research now. Be thorough, be accurate, and be helpful."""

    def _ensure_string(self, value: Any) -> str:
        """Ensure value is converted to a complete string."""
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        try:
            return str(value)
        except:
            return repr(value)

    def _serialize_reasoning(self, reasoning: Any) -> List[Dict[str, Any]]:
        """Serialize reasoning to JSON-serializable format without truncation."""
        if not reasoning:
            return []
        
        if isinstance(reasoning, list):
            return [self._serialize_task(task) for task in reasoning]
        
        if hasattr(reasoning, '__dict__') or isinstance(reasoning, dict):
            return [self._serialize_task(reasoning)]
        
        return [{"content": self._ensure_string(reasoning)}]
    
    def _serialize_task(self, task: Any) -> Dict[str, Any]:
        """Serialize a single task recursively without truncation."""
        result = {}
        
        if isinstance(task, dict):
            for key in ['title', 'thought', 'conclusion', 'content']:
                if key in task and task[key] is not None:
                    result[key] = self._ensure_string(task[key])
            
            if task.get('tooluse'):
                result['tooluse'] = self._serialize_tooluse(task['tooluse'])
            
            if task.get('subtasks'):
                result['subtasks'] = [self._serialize_task(st) for st in task['subtasks']]
        else:
            for attr in ['title', 'thought', 'conclusion', 'content']:
                if hasattr(task, attr):
                    value = getattr(task, attr)
                    if value is not None:
                        result[attr] = self._ensure_string(value)
            
            if hasattr(task, 'tooluse') and task.tooluse:
                tooluse = task.tooluse
                if isinstance(tooluse, list):
                    result['tooluse'] = [self._serialize_tooluse(t) for t in tooluse]
                else:
                    result['tooluse'] = self._serialize_tooluse(tooluse)
            
            for attr in ['subtasks', 'subtask']:
                if hasattr(task, attr) and getattr(task, attr):
                    result['subtasks'] = [self._serialize_task(st) for st in getattr(task, attr)]
                    break
        
        return result
    
    def _serialize_tooluse(self, tooluse: Any) -> Dict[str, Any]:
        """Serialize tool use information."""
        if isinstance(tooluse, dict):
            return tooluse
        return {
            'tool_name': self._ensure_string(getattr(tooluse, 'tool_name', tooluse)),
            'parameters': getattr(tooluse, 'parameters', None),
            'tool_result': getattr(tooluse, 'tool_result', None),
        }

    def _collect_all_conclusions(self, tasks: List[Dict[str, Any]], depth: int = 0) -> List[str]:
        """Recursively collect all conclusions from reasoning tree."""
        conclusions = []
        
        for task in tasks:
            if isinstance(task, dict):
                conclusion = task.get('conclusion', '')
                if conclusion and len(conclusion.strip()) > 20:
                    conclusions.append(conclusion)
                
                if task.get('subtasks'):
                    conclusions.extend(self._collect_all_conclusions(task['subtasks'], depth + 1))
        
        return conclusions

    def _synthesize_answer_from_reasoning(self, reasoning: List[Dict[str, Any]]) -> str:
        """Build a coherent answer from reasoning conclusions when no explicit answer exists."""
        conclusions = self._collect_all_conclusions(reasoning)
        
        if not conclusions:
            return "No analysis results available."
        
        def score_task(task: Dict[str, Any], depth: int = 0) -> tuple:
            """Score a task based on its conclusion quality."""
            conclusion = task.get('conclusion', '')
            title = task.get('title', '').lower()
            
            if not conclusion:
                return (None, 0)
            
            score = len(conclusion)
            
            if any(marker in title for marker in ['final', 'summary', 'synthesis', 'conclusion', 'report']):
                score *= 3
            
            if depth == 0:
                score *= 1.5
            
            return (conclusion, score)
        
        def find_best_in_tree(tasks: List[Dict[str, Any]], depth: int = 0) -> tuple:
            """Find the best conclusion in the tree."""
            best = (None, 0)
            
            for task in tasks:
                if isinstance(task, dict):
                    conclusion, score = score_task(task, depth)
                    if score > best[1]:
                        best = (conclusion, score)
                    
                    if task.get('subtasks'):
                        sub_best = find_best_in_tree(task['subtasks'], depth + 1)
                        if sub_best[1] > best[1]:
                            best = sub_best
            
            return best
        
        best_conclusion, _ = find_best_in_tree(reasoning)
        
        if best_conclusion and len(best_conclusion) > 200:
            return best_conclusion
        
        substantial = [c for c in conclusions if len(c) > 100]
        
        if substantial:
            substantial.sort(key=len, reverse=True)
            return substantial[0]
        
        if conclusions:
            return "\n\n".join(conclusions[:5])
        
        return "Research completed but no summary available."

    def _extract_answer(self, answer: Any, reasoning_raw: Any) -> tuple:
        """
        Extract and process the answer, handling various response formats.
        Returns (processed_answer, processed_reasoning).
        
        Handles:
        - Plain text answers
        - JSON answers with embedded reasoning
        - Truncated/malformed JSON (attempts graceful degradation)
        - Empty answers (synthesizes from reasoning)
        """
        processed_reasoning = []
        original_answer = answer  # Keep original for fallback
        
        # First, check if answer is JSON with embedded data
        if isinstance(answer, str) and answer.strip().startswith('{'):
            try:
                parsed = json.loads(answer)
                if isinstance(parsed, dict):
                    logger.info(f"[EXTRACT] Parsed JSON answer, keys: {list(parsed.keys())}")
                    
                    # Extract reasoning from embedded JSON if present
                    if 'reasoning' in parsed and isinstance(parsed['reasoning'], list):
                        reasoning_raw = parsed['reasoning']
                        logger.info(f"[EXTRACT] Found {len(reasoning_raw)} reasoning steps in JSON")
                    
                    # Try to find explicit answer field
                    answer_keys = ['final_answer', 'answer', 'response', 'result', 'content', 'conclusion', 'summary', 'output']
                    
                    for key in answer_keys:
                        if key in parsed and parsed[key]:
                            val = parsed[key]
                            if isinstance(val, str) and len(val) > 50:
                                logger.info(f"[EXTRACT] Found answer in '{key}' field ({len(val)} chars)")
                                answer = val
                                break
                    else:
                        logger.info(f"[EXTRACT] No explicit answer field, will synthesize from reasoning")
                        answer = None
                        
            except json.JSONDecodeError as e:
                # JSON is malformed/truncated - attempt to salvage
                logger.warning(f"[EXTRACT] JSON parse failed at position {e.pos}: {e.msg}")
                logger.info(f"[EXTRACT] Attempting to salvage content from malformed JSON...")
                
                # Strategy: Return the raw content rather than discarding it
                # The raw JSON still contains valuable information even if malformed
                if len(original_answer) > 500:
                    # Try to extract readable portions from the truncated JSON
                    salvaged = self._salvage_truncated_json(original_answer)
                    if salvaged:
                        logger.info(f"[EXTRACT] Salvaged {len(salvaged)} chars from malformed JSON")
                        answer = salvaged
                    else:
                        # Last resort: return as-is, let downstream handle it
                        logger.info(f"[EXTRACT] Could not salvage, keeping raw content ({len(original_answer)} chars)")
                        answer = original_answer
        
        # Serialize reasoning
        if reasoning_raw:
            processed_reasoning = self._serialize_reasoning(reasoning_raw)
            logger.info(f"[EXTRACT] Serialized {len(processed_reasoning)} reasoning steps")
        
        # Check if answer needs synthesis
        needs_synthesis = (
            answer is None or 
            (isinstance(answer, str) and len(answer.strip()) == 0)
        )
        
        # Don't synthesize if we have substantial content (even if it looks like JSON)
        if isinstance(answer, str) and answer.strip().startswith('{') and len(answer) > 1000:
            # We have a large JSON-like string - try to make it readable
            needs_synthesis = False
            if processed_reasoning:
                # Prefer synthesized answer from reasoning over raw JSON blob
                logger.info(f"[EXTRACT] Have JSON blob and reasoning - synthesizing from reasoning")
                synthesized = self._synthesize_answer_from_reasoning(processed_reasoning)
                if len(synthesized) > 100:
                    answer = synthesized
        
        if needs_synthesis:
            if processed_reasoning:
                logger.info(f"[EXTRACT] Synthesizing answer from reasoning tree")
                answer = self._synthesize_answer_from_reasoning(processed_reasoning)
                logger.info(f"[EXTRACT] Synthesized answer: {len(answer)} chars")
            else:
                answer = "Research completed but no results available."
        
        answer = self._ensure_string(answer)
        
        return answer, processed_reasoning

    def _salvage_truncated_json(self, content: str) -> Optional[str]:
        """
        Attempt to extract readable content from truncated/malformed JSON.
        Returns extracted text or None if salvage failed.
        """
        try:
            # Look for common patterns in the JSON that contain readable text
            import re
            
            salvaged_parts = []
            
            # Extract conclusion fields
            conclusions = re.findall(r'"conclusion"\s*:\s*"([^"]*(?:\\.[^"]*)*)"', content)
            if conclusions:
                for c in conclusions:
                    # Unescape JSON strings
                    unescaped = c.replace('\\"', '"').replace('\\n', '\n').replace('\\t', '\t')
                    if len(unescaped) > 50:
                        salvaged_parts.append(unescaped)
            
            # Extract answer/summary fields
            for field in ['final_answer', 'answer', 'summary', 'content', 'response']:
                pattern = rf'"{field}"\s*:\s*"([^"]*(?:\\.[^"]*)*)"'
                matches = re.findall(pattern, content)
                for m in matches:
                    unescaped = m.replace('\\"', '"').replace('\\n', '\n').replace('\\t', '\t')
                    if len(unescaped) > 100:
                        salvaged_parts.append(unescaped)
            
            if salvaged_parts:
                # Return the longest salvaged content
                salvaged_parts.sort(key=len, reverse=True)
                return salvaged_parts[0]
            
            return None
            
        except Exception as e:
            logger.warning(f"[EXTRACT] Salvage attempt failed: {e}")
            return None

    def _extract_delta_content(self, event: Any) -> tuple:
        """
        Extract meaningful content from a delta event for activity logging.
        Returns (content, content_type) tuple.
        """
        delta_content = None
        content_type = "delta"
        
        try:
            # Try to get content from delta event
            if hasattr(event, 'content'):
                delta_content = event.content
            elif hasattr(event, 'data'):
                delta_content = event.data
            elif hasattr(event, 'text'):
                delta_content = event.text
            
            # Parse JSON content if present
            if delta_content and isinstance(delta_content, str):
                try:
                    parsed = json.loads(delta_content)
                    if isinstance(parsed, dict):
                        # Look for tool calls
                        if 'tool' in parsed or 'tool_name' in parsed or 'tooluse' in parsed:
                            tool_name = parsed.get('tool') or parsed.get('tool_name') or 'tool'
                            if isinstance(parsed.get('tooluse'), dict):
                                tool_name = parsed['tooluse'].get('tool_name', tool_name)
                            params = parsed.get('parameters') or parsed.get('tooluse', {}).get('parameters', {})
                            if params and isinstance(params, dict):
                                query = params.get('query', '')
                                if query:
                                    delta_content = f"Using {tool_name}: {query}"
                                else:
                                    delta_content = f"Using tool: {tool_name}"
                            else:
                                delta_content = f"Using tool: {tool_name}"
                            content_type = "tool"
                        # Look for thoughts/reasoning
                        elif 'thought' in parsed:
                            delta_content = f"Thinking: {parsed['thought']}"
                            content_type = "info"
                        elif 'title' in parsed:
                            title = parsed['title']
                            thought = parsed.get('thought', '')
                            if thought:
                                delta_content = f"Task: {title}\n{thought}"
                            else:
                                delta_content = f"Task: {title}"
                            content_type = "info"
                        elif 'conclusion' in parsed:
                            delta_content = f"Conclusion: {parsed['conclusion']}"
                            content_type = "info"
                        elif 'message' in parsed:
                            delta_content = parsed['message']
                            content_type = "info"
                except json.JSONDecodeError:
                    pass
                    
        except Exception as e:
            logger.debug(f"[STREAM] Could not extract delta content: {e}")
        
        return delta_content, content_type

    def _run_sync_stream(
        self,
        queue: Queue,
        topic: str,
        engine: str,
        tool_ids: Optional[List[str]],
        include_arxiv: bool
    ) -> None:
        """
        Run the synchronous SDK stream in a background thread.
        Pushes events to the queue for async consumption.
        """
        try:
            tools = self._get_tools(tool_ids, include_arxiv)
            tool_names = [t.get('id') or t.get('name') for t in tools]
            
            input_config = {
                "instructions": self._build_instructions(topic),
                "tools": tools,
            }
            
            # Initial status
            queue.put({
                "type": "status",
                "phase": "init",
                "message": "Initializing research agent...",
                "details": {"engine": engine, "tools": tool_names}
            })
            
            attempt = 0
            last_error = None
            
            while attempt < self.max_retries:
                attempt += 1
                logger.info(f"[STREAM] --- ATTEMPT {attempt}/{self.max_retries} ---")
                
                try:
                    if attempt > 1:
                        delay = self.retry_delay * (2 ** (attempt - 2))
                        queue.put({
                            "type": "status",
                            "phase": "retry",
                            "message": f"Retrying in {delay:.0f}s... (attempt {attempt}/{self.max_retries})",
                        })
                        logger.info(f"[STREAM] Sleeping {delay}s...")
                        time.sleep(delay)
                    
                    queue.put({"type": "status", "phase": "connecting", "message": "Connecting to API..."})
                    
                    logger.info(f"[STREAM] Calling client.stream()...")
                    stream_start = time.time()
                    
                    stream = self.client.stream(engine=engine, input=input_config)
                    
                    queue.put({"type": "status", "phase": "researching", "message": "Research in progress..."})
                    
                    run_id = None
                    delta_count = 0
                    last_progress_time = time.time()
                    
                    logger.info(f"[STREAM] Iterating events...")
                    
                    for event in stream:
                        elapsed = time.time() - stream_start
                        
                        if event.type == "delta":
                            delta_count += 1
                            
                            if delta_count == 1:
                                logger.info(f"[STREAM] First delta at {elapsed:.1f}s")
                            
                            if delta_count % 50 == 0:
                                logger.info(f"[STREAM] Delta #{delta_count} at {elapsed:.1f}s")
                            
                            # Extract content from delta for activity log
                            delta_content, content_type = self._extract_delta_content(event)
                            
                            # Send activity log entry when we have meaningful content
                            has_content = delta_content and len(str(delta_content).strip()) > 5
                            time_elapsed = time.time() - last_progress_time > 1.5
                            
                            if has_content or time_elapsed:
                                queue.put({
                                    "type": "activity",
                                    "delta_count": delta_count,
                                    "elapsed": round(elapsed, 1),
                                    "content": delta_content if delta_content else None,
                                    "content_type": content_type if has_content else "progress",
                                })
                                last_progress_time = time.time()
                        
                        elif event.type == "done":
                            run_id = event.run_id
                            total_time = time.time() - stream_start
                            
                            logger.info(f"[STREAM] DONE! run_id={run_id}, deltas={delta_count}, time={total_time:.1f}s")
                            
                            queue.put({"type": "status", "phase": "finalizing", "message": "Fetching results..."})
                            
                            try:
                                logger.info(f"[STREAM] Waiting for run completion via client.wait({run_id})...")
                                
                                run_result = self.client.wait(
                                    run_id,
                                    options={
                                        "interval_ms": 2000,
                                        "max_attempts": 30,
                                    }
                                )
                                
                                logger.info(f"[STREAM] Run completed with status: {run_result.status}")
                                
                                if run_result.status in ["failed", "canceled", "timed_out"]:
                                    error_detail = getattr(run_result, 'error', None)
                                    error_msg = f"Run {run_result.status}"
                                    if error_detail:
                                        error_msg += f": {error_detail}"
                                    logger.error(f"[STREAM] {error_msg}")
                                    queue.put({"type": "error", "error": error_msg})
                                    queue.put(_STREAM_END)
                                    return
                                
                                if run_result and run_result.result:
                                    raw_answer = run_result.result.answer
                                    raw_reasoning = run_result.result.reasoning
                                    
                                    logger.info(f"[STREAM] Raw answer type: {type(raw_answer).__name__}")
                                    logger.info(f"[STREAM] Raw answer length: {len(raw_answer) if raw_answer else 0}")
                                    logger.info(f"[STREAM] Raw reasoning: {len(raw_reasoning) if raw_reasoning else 0} steps")
                                    
                                    answer, reasoning = self._extract_answer(raw_answer, raw_reasoning)
                                    
                                    logger.info(f"[STREAM] Final answer length: {len(answer)} chars")
                                    logger.info(f"[STREAM] Final reasoning steps: {len(reasoning)}")
                                    
                                    queue.put({
                                        "type": "done",
                                        "run_id": run_id,
                                        "answer": answer,
                                        "reasoning": reasoning,
                                    })
                                    
                                    logger.info(f"[STREAM] SUCCESS!")
                                    queue.put(_STREAM_END)
                                    return
                                else:
                                    logger.warning(f"[STREAM] No result in run_result")
                                    queue.put({"type": "error", "error": "No result returned from API"})
                                    queue.put(_STREAM_END)
                                    return
                                    
                            except Exception as fetch_error:
                                error_str = str(fetch_error).lower()
                                if 'timeout' in error_str or 'max_attempts' in error_str:
                                    logger.error(f"[STREAM] Polling timed out: {fetch_error}")
                                    queue.put({"type": "error", "error": "Request timed out while waiting for results. Please try again."})
                                else:
                                    logger.exception(f"[STREAM] Failed to fetch result: {fetch_error}")
                                    queue.put({"type": "error", "error": f"Failed to fetch result: {str(fetch_error)}"})
                                queue.put(_STREAM_END)
                                return
                        
                        elif event.type == "error":
                            error_msg = getattr(event, 'error', None) or getattr(event, 'message', None) or str(event)
                            logger.error(f"[STREAM] Error event: {error_msg}")
                            
                            if "terminated" in error_msg.lower() and attempt < self.max_retries:
                                logger.warning(f"[STREAM] 'terminated' error - will retry")
                                last_error = error_msg
                                queue.put({
                                    "type": "status",
                                    "phase": "retry",
                                    "message": "Connection terminated, preparing to retry...",
                                })
                                break
                            
                            queue.put({"type": "error", "error": error_msg})
                            queue.put(_STREAM_END)
                            return
                    else:
                        logger.warning(f"[STREAM] Stream ended without done event")
                        queue.put({"type": "error", "error": f"Stream ended unexpectedly ({delta_count} deltas received)"})
                        queue.put(_STREAM_END)
                        return
                    
                    continue
                    
                except SubconsciousError as e:
                    error_msg = str(e)
                    logger.error(f"[STREAM] SubconsciousError: {error_msg} (status={e.status})")
                    last_error = error_msg
                    
                    if e.status in [503, 502, 429] and attempt < self.max_retries:
                        queue.put({
                            "type": "status",
                            "phase": "retry",
                            "message": f"Service unavailable ({e.code}), will retry...",
                        })
                        continue
                    
                    queue.put({"type": "error", "error": error_msg})
                    queue.put(_STREAM_END)
                    return
                    
                except Exception as e:
                    error_msg = f"{type(e).__name__}: {str(e)}"
                    logger.exception(f"[STREAM] Exception: {error_msg}")
                    last_error = error_msg
                    
                    if any(x in str(e).lower() for x in ['timeout', 'connection', 'terminated']) and attempt < self.max_retries:
                        queue.put({
                            "type": "status",
                            "phase": "retry",
                            "message": "Connection issue, will retry...",
                        })
                        continue
                    
                    queue.put({"type": "error", "error": error_msg})
                    queue.put(_STREAM_END)
                    return
            
            logger.error(f"[STREAM] Max retries exhausted. Last error: {last_error}")
            queue.put({"type": "error", "error": f"Failed after {self.max_retries} attempts: {last_error}"})
            queue.put(_STREAM_END)
            
        except Exception as e:
            logger.exception(f"[STREAM] Fatal error in sync stream: {e}")
            queue.put({"type": "error", "error": f"Fatal error: {str(e)}"})
            queue.put(_STREAM_END)

    async def stream_async(
        self, 
        topic: str, 
        engine: Optional[str] = None,
        tool_ids: Optional[List[str]] = None,
        include_arxiv: bool = True
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Async streaming analysis using a background thread for the sync SDK.
        
        This properly bridges the sync Subconscious SDK with async FastAPI/SSE:
        1. Creates a queue for thread-safe communication
        2. Runs sync SDK in a thread pool (doesn't block event loop)
        3. Async yields from queue with non-blocking waits
        """
        engine_to_use = engine or self.engine
        
        # Validate engine
        if engine_to_use not in VALID_ENGINE_IDS:
            logger.error(f"[STREAM] Invalid engine: {engine_to_use}")
            yield {
                "type": "error",
                "error": f"Invalid engine '{engine_to_use}'. Valid engines: {', '.join(VALID_ENGINE_IDS)}"
            }
            return
        
        # Validate topic
        if not topic or not topic.strip():
            logger.error("[STREAM] Empty topic provided")
            yield {"type": "error", "error": "Research topic cannot be empty"}
            return
        
        # Validate tool IDs
        if tool_ids:
            invalid_tools = [t for t in tool_ids if t not in VALID_TOOL_IDS]
            if invalid_tools:
                logger.warning(f"[STREAM] Invalid tool IDs ignored: {invalid_tools}")
                tool_ids = [t for t in tool_ids if t in VALID_TOOL_IDS]
        
        logger.info("=" * 70)
        logger.info(f"[STREAM] Starting async stream for: {topic[:50]}...")
        logger.info(f"[STREAM] Engine: {engine_to_use}")
        logger.info(f"[STREAM] Tools: {tool_ids}")
        logger.info("=" * 70)
        
        # Create queue for thread-safe communication
        queue: Queue = Queue()
        
        # Start the sync stream in a background thread
        loop = asyncio.get_event_loop()
        thread_future = loop.run_in_executor(
            _executor,
            self._run_sync_stream,
            queue,
            topic,
            engine_to_use,
            tool_ids,
            include_arxiv
        )
        
        # Yield events from queue asynchronously
        try:
            while True:
                # Non-blocking wait for queue items
                try:
                    # Use asyncio.to_thread to check queue without blocking
                    event = await asyncio.wait_for(
                        asyncio.to_thread(queue.get, timeout=0.1),
                        timeout=1.0
                    )
                    
                    if event is _STREAM_END:
                        logger.info("[STREAM] Received end signal")
                        break
                    
                    yield event
                    
                except Empty:
                    # Queue is empty, check if thread is still running
                    if thread_future.done():
                        # Thread finished, drain remaining queue items
                        while True:
                            try:
                                event = queue.get_nowait()
                                if event is _STREAM_END:
                                    break
                                yield event
                            except Empty:
                                break
                        break
                    # Thread still running, continue waiting
                    await asyncio.sleep(0.01)
                except asyncio.TimeoutError:
                    # Timeout waiting for queue, check thread status
                    if thread_future.done():
                        # Drain remaining queue items
                        while True:
                            try:
                                event = queue.get_nowait()
                                if event is _STREAM_END:
                                    break
                                yield event
                            except Empty:
                                break
                        break
                    continue
                    
        except asyncio.CancelledError:
            logger.warning("[STREAM] Stream cancelled by client")
            raise
        except Exception as e:
            logger.exception(f"[STREAM] Error in async stream: {e}")
            yield {"type": "error", "error": str(e)}
        finally:
            # Ensure thread completes
            try:
                await asyncio.wait_for(asyncio.shield(thread_future), timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning("[STREAM] Background thread did not complete in time")
            except Exception as e:
                logger.warning(f"[STREAM] Error waiting for thread: {e}")

    # Keep sync version for backwards compatibility
    def stream(
        self, 
        topic: str, 
        engine: Optional[str] = None,
        tool_ids: Optional[List[str]] = None,
        include_arxiv: bool = True
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Synchronous streaming - DEPRECATED, use stream_async() instead.
        
        Kept for backwards compatibility but blocks the event loop when used
        in async contexts.
        """
        logger.warning("[STREAM] Using deprecated sync stream() - consider using stream_async()")
        
        queue: Queue = Queue()
        
        # Run in current thread (blocking)
        self._run_sync_stream(queue, topic, engine or self.engine, tool_ids, include_arxiv)
        
        # Yield all events from queue
        while True:
            try:
                event = queue.get_nowait()
                if event is _STREAM_END:
                    break
                yield event
            except Empty:
                break


def get_subconscious_service(engine: Optional[str] = None) -> SubconsciousService:
    """Create a new Subconscious service instance."""
    return SubconsciousService(engine=engine)


def get_available_engines() -> List[Dict[str, str]]:
    """Get list of available engines."""
    return AVAILABLE_ENGINES


def get_available_tools() -> List[Dict[str, str]]:
    """Get list of available platform tools."""
    return AVAILABLE_TOOLS
