"""
JSON Schema for structured output.
Manual schema to ensure Subconscious compatibility.

IMPORTANT: 
- No 'anyOf', 'oneOf', or '$defs' - Subconscious doesn't support these
- Keep schema flat and simple
- Use basic JSON Schema types only
"""


def get_analysis_schema() -> dict:
    """
    Get JSON Schema for research analysis output.
    
    This is a manual schema to ensure compatibility with Subconscious API.
    Pydantic's auto-generated schemas use '$defs' which may cause issues.
    """
    return {
        "type": "object",
        "title": "ResearchAnalysis",
        "description": "Structured research analysis output",
        "properties": {
            "summary": {
                "type": "string",
                "description": "Executive summary of the research landscape"
            },
            "papers": {
                "type": "array",
                "description": "Key papers found during research",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "description": "Paper title"
                        },
                        "authors": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of authors"
                        },
                        "year": {
                            "type": "integer",
                            "description": "Publication year"
                        },
                        "source": {
                            "type": "string",
                            "description": "Source (e.g., ArXiv, journal name)"
                        },
                        "url": {
                            "type": "string",
                            "description": "Link to the paper"
                        },
                        "summary": {
                            "type": "string",
                            "description": "Brief summary of the paper's contribution"
                        },
                        "relevance": {
                            "type": "string",
                            "description": "Why this paper is relevant"
                        }
                    },
                    "required": ["title", "source", "summary"]
                }
            },
            "themes": {
                "type": "array",
                "description": "Major research themes identified",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Theme name"
                        },
                        "description": {
                            "type": "string",
                            "description": "Description of this research theme"
                        },
                        "key_papers": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Key papers contributing to this theme"
                        }
                    },
                    "required": ["name", "description"]
                }
            },
            "gaps": {
                "type": "array",
                "description": "Research gaps identified",
                "items": {
                    "type": "object",
                    "properties": {
                        "area": {
                            "type": "string",
                            "description": "Area where the gap exists"
                        },
                        "description": {
                            "type": "string",
                            "description": "What's missing or unexplored"
                        },
                        "potential_impact": {
                            "type": "string",
                            "description": "Potential impact of addressing this gap"
                        }
                    },
                    "required": ["area", "description"]
                }
            },
            "future_directions": {
                "type": "array",
                "description": "Suggested future research directions",
                "items": {"type": "string"}
            }
        },
        "required": ["summary"]
    }
