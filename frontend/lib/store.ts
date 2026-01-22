/**
 * Zustand store for research state management.
 */

import { create } from 'zustand';
import { Task, ResearchAnalysis, ViewMode, StreamPhase } from './types';

// Available engines
export const AVAILABLE_ENGINES = [
  { id: 'tim-small-preview', name: 'TIM Small Preview', description: 'Fast, lightweight engine' },
  { id: 'tim-gpt', name: 'TIM GPT', description: 'GPT-powered engine' },
  { id: 'tim-large', name: 'TIM Large', description: 'Most capable engine' },
];

// Available tools
export const AVAILABLE_TOOLS = [
  { id: 'web_search', name: 'Web Search', description: 'Search the web' },
  { id: 'webpage_understanding', name: 'Webpage Understanding', description: 'Read web pages' },
  { id: 'exa_search', name: 'Exa Search', description: 'Semantic search' },
];

// Activity log entry type
export interface ActivityLogEntry {
  id: number;
  timestamp: Date;
  type: 'status' | 'delta' | 'tool' | 'info' | 'progress' | 'error';
  message: string;
}

interface ResearchState {
  // Input
  topic: string;
  
  // Model and tools selection
  selectedEngine: string;
  selectedTools: string[];
  includeArxiv: boolean;
  
  // Loading states
  isLoading: boolean;
  isStreaming: boolean;
  
  // Phase tracking for visual feedback
  phase: StreamPhase;
  statusMessage: string;
  statusDetails: {
    engine?: string;
    tools?: string[];
  } | null;
  
  // Progress tracking (instead of raw content)
  deltaCount: number;
  elapsedTime: number;
  
  // Activity log for streaming feedback
  activityLog: ActivityLogEntry[];
  isActivityLogExpanded: boolean;
  
  // Final results
  answer: ResearchAnalysis | Record<string, any> | string | null;
  reasoning: Task[];
  runId: string | null;
  
  // Error state
  error: string | null;
  
  // UI state
  viewMode: ViewMode;
  selectedTaskIndex: number | null;
  
  // Actions
  setTopic: (topic: string) => void;
  setSelectedEngine: (engine: string) => void;
  setSelectedTools: (tools: string[]) => void;
  toggleTool: (toolId: string) => void;
  setIncludeArxiv: (include: boolean) => void;
  startResearch: () => void;
  setPhase: (phase: StreamPhase, message: string, details?: { engine?: string; tools?: string[] }) => void;
  setProgress: (deltaCount: number, elapsed: number) => void;
  addActivityLog: (type: ActivityLogEntry['type'], message: string) => void;
  setActivityLogExpanded: (expanded: boolean) => void;
  setResult: (answer: ResearchAnalysis | Record<string, any> | string | null, reasoning: Task[], runId: string) => void;
  setError: (error: string) => void;
  reset: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedTaskIndex: (index: number | null) => void;
  stopLoading: () => void;
}

let activityLogId = 0;

export const useResearchStore = create<ResearchState>((set) => ({
  // Initial state
  topic: '',
  selectedEngine: 'tim-gpt',
  selectedTools: ['web_search', 'webpage_understanding', 'exa_search'],
  includeArxiv: true,
  isLoading: false,
  isStreaming: false,
  phase: 'idle',
  statusMessage: '',
  statusDetails: null,
  deltaCount: 0,
  elapsedTime: 0,
  activityLog: [],
  isActivityLogExpanded: true,
  answer: null,
  reasoning: [],
  runId: null,
  error: null,
  viewMode: 'tree',
  selectedTaskIndex: null,
  
  // Actions
  setTopic: (topic) => set({ topic }),
  
  setSelectedEngine: (selectedEngine) => set({ selectedEngine }),
  
  setSelectedTools: (selectedTools) => set({ selectedTools }),
  
  toggleTool: (toolId) => set((state) => {
    const isSelected = state.selectedTools.includes(toolId);
    if (isSelected) {
      // Removing a tool: allow if there are other platform tools OR ArXiv is enabled
      const willHaveOtherTools = state.selectedTools.length > 1;
      const arxivEnabled = state.includeArxiv;
      
      if (willHaveOtherTools || arxivEnabled) {
        return { selectedTools: state.selectedTools.filter(id => id !== toolId) };
      }
      // Can't remove - it's the only tool and ArXiv is disabled
      return state;
    } else {
      // Adding a tool - always allowed
      return { selectedTools: [...state.selectedTools, toolId] };
    }
  }),
  
  setIncludeArxiv: (includeArxiv) => set((state) => {
    // Prevent disabling ArXiv if it's the only tool left
    if (!includeArxiv && state.selectedTools.length === 0) {
      return state; // Can't disable - no platform tools selected
    }
    return { includeArxiv };
  }),
  
  startResearch: () => {
    activityLogId = 0; // Reset ID counter
    return set({ 
      isLoading: true, 
      isStreaming: true, 
      phase: 'init',
      statusMessage: 'Starting research...',
      statusDetails: null,
      deltaCount: 0,
      elapsedTime: 0,
      activityLog: [],
      isActivityLogExpanded: true,
      answer: null,
      reasoning: [],
      error: null,
      runId: null,
    });
  },
  
  setPhase: (phase, statusMessage, statusDetails) => set({ 
    phase, 
    statusMessage,
    statusDetails: statusDetails ?? null,
  }),
  
  setProgress: (deltaCount, elapsedTime) => set({ 
    deltaCount,
    elapsedTime,
  }),
  
  addActivityLog: (type, message) => set((state) => {
    const newEntry: ActivityLogEntry = {
      id: ++activityLogId,
      timestamp: new Date(),
      type,
      message,
    };
    // Keep last 100 entries to prevent memory issues
    const newLog = [...state.activityLog, newEntry].slice(-100);
    return { activityLog: newLog };
  }),
  
  setActivityLogExpanded: (isActivityLogExpanded) => set({ isActivityLogExpanded }),
  
  setResult: (answer, reasoning, runId) => set({ 
    answer, 
    reasoning, 
    runId, 
    isLoading: false, 
    isStreaming: false,
    phase: 'complete',
    statusMessage: 'Analysis complete!',
    isActivityLogExpanded: false, // Auto-collapse on complete
  }),
  
  setError: (error) => set({ 
    error, 
    isLoading: false, 
    isStreaming: false,
    phase: 'error',
    statusMessage: '',
    isActivityLogExpanded: false, // Auto-collapse on error
  }),
  
  reset: () => set({ 
    topic: '', 
    isLoading: false, 
    isStreaming: false,
    phase: 'idle',
    statusMessage: '',
    statusDetails: null,
    deltaCount: 0,
    elapsedTime: 0,
    activityLog: [],
    isActivityLogExpanded: true,
    answer: null, 
    reasoning: [], 
    error: null, 
    runId: null,
    selectedTaskIndex: null,
  }),
  
  setViewMode: (viewMode) => set({ viewMode }),
  
  setSelectedTaskIndex: (selectedTaskIndex) => set({ selectedTaskIndex }),
  
  stopLoading: () => set({
    isLoading: false,
    isStreaming: false,
  }),
}));
