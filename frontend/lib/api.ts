/**
 * API client for communicating with the backend.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface AnalyzeRequest {
  topic: string;
  engine?: string;
  tools?: string[];
  include_arxiv?: boolean;
}

/**
 * Start streaming analysis.
 * Returns a ReadableStream that emits SSE events.
 */
export async function analyzeStream(request: AnalyzeRequest): Promise<Response> {
  const response = await fetch(`${API_URL}/api/research/analyze/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: request.topic,
      engine: request.engine || null,
      tools: request.tools || null,
      include_arxiv: request.include_arxiv ?? true,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Analysis failed: ${error}`);
  }
  
  return response;
}

/**
 * Get available engines.
 */
export async function getEngines() {
  const response = await fetch(`${API_URL}/api/research/engines`);
  if (!response.ok) {
    throw new Error('Failed to fetch engines');
  }
  return response.json();
}

/**
 * Get available tools.
 */
export async function getTools() {
  const response = await fetch(`${API_URL}/api/research/tools`);
  if (!response.ok) {
    throw new Error('Failed to fetch tools');
  }
  return response.json();
}

/**
 * Get the status of a run.
 */
export async function getRunStatus(runId: string) {
  const response = await fetch(`${API_URL}/api/research/status/${runId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Health check.
 */
export async function healthCheck() {
  const response = await fetch(`${API_URL}/health`);
  return response.json();
}
