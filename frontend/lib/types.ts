/**
 * TypeScript types matching Subconscious API response structures.
 */

// Tool call information
export interface ToolCall {
  tool_name: string;
  parameters?: Record<string, any>;
  tool_result?: any;
}

// Task in reasoning tree (recursive)
export interface Task {
  title?: string;
  thought?: string;
  tooluse?: ToolCall | ToolCall[];
  subtasks?: Task[];
  conclusion?: string;
}

// Structured analysis output (matches backend schema)
export interface Paper {
  title: string;
  authors?: string[];
  year?: number;
  source: string;
  url?: string;
  summary: string;
  relevance?: string;
}

export interface Theme {
  name: string;
  description: string;
  key_papers?: string[];
}

export interface ResearchGap {
  area: string;
  description: string;
  potential_impact?: string;
}

export interface ResearchAnalysis {
  summary: string;
  papers?: Paper[];
  themes?: Theme[];
  gaps?: ResearchGap[];
  future_directions?: string[];
}

// Run status
export type RunStatus = 
  | 'queued' 
  | 'running' 
  | 'succeeded' 
  | 'failed' 
  | 'canceled' 
  | 'timed_out';

// Stream phases for visual feedback
export type StreamPhase = 
  | 'idle'
  | 'init'
  | 'connecting'
  | 'researching'
  | 'retry'
  | 'finalizing'
  | 'complete'
  | 'error';

// SSE Event types
export interface StatusEvent {
  type: 'status';
  phase: StreamPhase;
  message: string;
  details?: {
    engine?: string;
    tools?: string[];
  };
}

export interface ProgressEvent {
  type: 'progress';
  delta_count: number;
  elapsed: number;
  message: string;
}

export interface ActivityEvent {
  type: 'activity';
  delta_count: number;
  elapsed: number;
  content?: string | null;
  content_type: 'delta' | 'tool' | 'info' | 'progress';
}

export interface DoneEvent {
  type: 'done';
  run_id: string;
  answer: ResearchAnalysis | Record<string, any> | string | null;
  reasoning: Task[];
  fetch_error?: string;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
}

export interface RunStartedEvent {
  type: 'run_started';
  run_id: string;
  message?: string;
}

export type StreamEvent = StatusEvent | ProgressEvent | ActivityEvent | DoneEvent | ErrorEvent | RunStartedEvent;

// View modes
export type ViewMode = 'tree' | 'json';
