/**
 * Custom hook for handling SSE streaming from the backend.
 * 
 * Uses @microsoft/fetch-event-source for proper SSE handling:
 * - Immediate event processing (no buffering delays)
 * - Proper reconnection handling
 * - Support for POST requests with body
 * 
 * Handles event types:
 * - status: Phase updates with visual feedback
 * - activity: Delta processing with content for activity log
 * - done: Analysis complete with answer and reasoning
 * - error: Error occurred
 */

import { useCallback, useRef } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useResearchStore } from '@/lib/store';
import { StreamEvent, StreamPhase } from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface StreamOptions {
  topic: string;
  engine?: string;
  tools?: string[];
  includeArxiv?: boolean;
}

// Custom error class to signal intentional stream termination
class FatalError extends Error {}

export function useStreamingSSE() {
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const { 
    startResearch, 
    setPhase,
    setProgress,
    addActivityLog,
    setResult, 
    setError,
    stopLoading,
  } = useResearchStore();

  const startStream = useCallback(async (options: StreamOptions) => {
    const { topic, engine, tools, includeArxiv = true } = options;
    
    // Cancel any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    // Reset state and start loading
    startResearch();
    
    console.log('[SSE] Starting stream:', { topic, engine, tools, includeArxiv });
    
    let eventCount = 0;
    let isComplete = false;
    
    try {
      await fetchEventSource(`${API_URL}/api/research/analyze/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          engine: engine || null,
          tools: tools || null,
          include_arxiv: includeArxiv,
        }),
        signal,
        
        // Called when connection opens
        onopen: async (response) => {
          if (response.ok) {
            console.log('[SSE] Connected successfully');
            return;
          }
          
          if (response.status >= 400 && response.status < 500) {
            const errorText = await response.text();
            throw new FatalError(`Client error: ${response.status} - ${errorText}`);
          }
          
          throw new Error(`Server error: ${response.status}`);
        },
        
        // Called for each SSE message - THIS IS WHERE REAL-TIME HAPPENS
        onmessage: (msg) => {
          const data = msg.data;
          
          // Check for end signal
          if (data === '[DONE]') {
            console.log('[SSE] Received [DONE] signal');
            isComplete = true;
            stopLoading();
            return;
          }
          
          // Parse and handle event
          try {
            const event = JSON.parse(data) as StreamEvent;
            eventCount++;
            
            switch (event.type) {
              case 'status':
                console.log(`[SSE] #${eventCount} Status (${event.phase}):`, event.message);
                setPhase(
                  event.phase as StreamPhase, 
                  event.message,
                  event.details
                );
                // Also add to activity log
                addActivityLog('status', `[${event.phase}] ${event.message}`);
                break;
                
              case 'progress':
                // Update progress counter
                const progressEvent = event as any;
                setProgress(progressEvent.delta_count, progressEvent.elapsed);
                break;
              
              case 'activity':
                // Activity log entry from delta processing
                const activityEvent = event as any;
                setProgress(activityEvent.delta_count, activityEvent.elapsed);
                
                // Determine the log type based on content_type from backend
                const logType = activityEvent.content_type || 'delta';
                
                if (activityEvent.content) {
                  // Log every 10th activity or all tool/info events
                  if (logType !== 'progress' || activityEvent.delta_count % 10 === 0) {
                    console.log(`[SSE] #${eventCount} Activity (${logType}):`, 
                      activityEvent.content.substring(0, 80) + (activityEvent.content.length > 80 ? '...' : '')
                    );
                  }
                  addActivityLog(logType as any, activityEvent.content);
                } else if (logType === 'progress') {
                  // Only log progress updates occasionally to avoid spam
                  if (activityEvent.delta_count % 50 === 0) {
                    addActivityLog('progress', `Processing... (${activityEvent.delta_count} chunks, ${activityEvent.elapsed}s)`);
                  }
                }
                break;
                
              case 'done':
                console.log('[SSE] Done event:', {
                  run_id: event.run_id,
                  answer_type: typeof event.answer,
                  answer_length: typeof event.answer === 'string' ? event.answer.length : JSON.stringify(event.answer).length,
                  reasoning_count: event.reasoning?.length || 0
                });
                addActivityLog('info', `✓ Research complete! Found ${event.reasoning?.length || 0} reasoning steps.`);
                setResult(
                  event.answer,
                  event.reasoning || [],
                  event.run_id || ''
                );
                isComplete = true;
                break;
                
              case 'error':
                console.error('[SSE] Error event:', event.error);
                addActivityLog('error', `Error: ${event.error}`);
                setError(event.error);
                isComplete = true;
                break;
                
              default:
                console.warn('[SSE] Unknown event type:', (event as any).type);
            }
          } catch (parseError) {
            // Ignore parse errors for malformed events
            console.debug('[SSE] Parse error (ignoring):', data?.substring(0, 100));
          }
        },
        
        // Called on connection close
        onclose: () => {
          console.log(`[SSE] Connection closed. Events received: ${eventCount}, Complete: ${isComplete}`);
          if (!isComplete) {
            // Unexpected close - set error so user knows what happened
            console.warn('[SSE] Connection closed unexpectedly');
            setError('Connection closed unexpectedly. Please try again.');
            stopLoading();
          }
        },
        
        // Called on error
        onerror: (err) => {
          console.error('[SSE] Connection error:', err);
          
          // If it's our intentional abort, don't retry
          if (signal.aborted) {
            throw err;
          }
          
          // If it's a fatal error, don't retry
          if (err instanceof FatalError) {
            setError(err.message);
            throw err;
          }
          
          // For other errors, let the library retry
          // Returning nothing allows retry
          console.log('[SSE] Will attempt to reconnect...');
        },
        
        // Disable automatic retry on close (we handle completion ourselves)
        openWhenHidden: true,
      });
      
    } catch (error) {
      if ((error as Error).name === 'AbortError' || signal.aborted) {
        console.log('[SSE] Stream aborted by user');
        return;
      }
      
      if (error instanceof FatalError) {
        console.error('[SSE] Fatal error:', error.message);
        return;
      }
      
      console.error('[SSE] Stream error:', error);
      setError((error as Error).message || 'Stream failed');
    }
  }, [startResearch, setPhase, setProgress, addActivityLog, setResult, setError, stopLoading]);

  const stopStream = useCallback(() => {
    console.log('[SSE] Stopping stream');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopLoading();
  }, [stopLoading]);

  return { startStream, stopStream };
}
