'use client';

import { useEffect, useRef, useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Info,
  Loader2,
  Terminal,
  Wrench,
  Brain,
  Clock
} from 'lucide-react';
import { useResearchStore, ActivityLogEntry } from '@/lib/store';

function getEntryIcon(type: ActivityLogEntry['type']) {
  switch (type) {
    case 'status':
      return <Info className="w-3.5 h-3.5 text-blue-400" />;
    case 'delta':
      return <Activity className="w-3.5 h-3.5 text-accent-400" />;
    case 'tool':
      return <Wrench className="w-3.5 h-3.5 text-purple-400" />;
    case 'info':
      return <Brain className="w-3.5 h-3.5 text-cyan-400" />;
    case 'progress':
      return <Clock className="w-3.5 h-3.5 text-dark-500" />;
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
    default:
      return <Activity className="w-3.5 h-3.5 text-dark-400" />;
  }
}

function getEntryStyles(type: ActivityLogEntry['type']) {
  switch (type) {
    case 'status':
      return {
        text: 'text-blue-300',
        bg: 'bg-blue-500/5',
        border: 'border-l-blue-500/50',
      };
    case 'delta':
      return {
        text: 'text-dark-300',
        bg: 'bg-transparent',
        border: 'border-l-dark-600',
      };
    case 'tool':
      return {
        text: 'text-purple-300',
        bg: 'bg-purple-500/5',
        border: 'border-l-purple-500/50',
      };
    case 'info':
      return {
        text: 'text-cyan-300',
        bg: 'bg-cyan-500/5',
        border: 'border-l-cyan-500/50',
      };
    case 'progress':
      return {
        text: 'text-dark-500',
        bg: 'bg-transparent',
        border: 'border-l-dark-700',
      };
    case 'error':
      return {
        text: 'text-red-300',
        bg: 'bg-red-500/5',
        border: 'border-l-red-500/50',
      };
    default:
      return {
        text: 'text-dark-400',
        bg: 'bg-transparent',
        border: 'border-l-dark-700',
      };
  }
}

// Component for expandable long content
function ExpandableMessage({ message, type }: { message: string; type: ActivityLogEntry['type'] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const styles = getEntryStyles(type);
  
  // Threshold for showing expand button (characters)
  const EXPAND_THRESHOLD = 200;
  const isLong = message.length > EXPAND_THRESHOLD;
  
  // For non-long messages, just render normally
  if (!isLong) {
    return (
      <p className={`text-xs ${styles.text} whitespace-pre-wrap break-words`}>
        {message}
      </p>
    );
  }
  
  return (
    <div>
      <p className={`text-xs ${styles.text} whitespace-pre-wrap break-words`}>
        {isExpanded ? message : `${message.slice(0, EXPAND_THRESHOLD)}...`}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="mt-1 text-xs text-accent-400 hover:text-accent-300 flex items-center gap-1"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-3 h-3" />
            Show less
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" />
            Show more ({message.length} chars)
          </>
        )}
      </button>
    </div>
  );
}

function ActivityEntry({ entry }: { entry: ActivityLogEntry }) {
  const styles = getEntryStyles(entry.type);
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div 
      className={`
        px-3 py-2 flex items-start gap-2 border-l-2 
        ${styles.bg} ${styles.border}
        hover:bg-dark-800/30 transition-colors
      `}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getEntryIcon(entry.type)}
      </div>
      <div className="flex-1 min-w-0">
        <ExpandableMessage message={entry.message} type={entry.type} />
      </div>
      <div className="flex-shrink-0 text-xs text-dark-600 font-mono whitespace-nowrap">
        {formatTime(entry.timestamp)}
      </div>
    </div>
  );
}

export function ActivityLog() {
  const { 
    activityLog, 
    isActivityLogExpanded, 
    setActivityLogExpanded,
    isLoading,
    phase,
    deltaCount,
    elapsedTime,
  } = useResearchStore();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (scrollRef.current && isActivityLogExpanded && isLoading) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activityLog, isActivityLogExpanded, isLoading]);
  
  // Don't show if no activity and not loading
  if (activityLog.length === 0 && !isLoading) {
    return null;
  }
  
  // Count entries by type for summary
  const entryCounts = activityLog.reduce((acc, entry) => {
    acc[entry.type] = (acc[entry.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-dark-900 rounded-lg border border-dark-700 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setActivityLogExpanded(!isActivityLogExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-dark-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-accent-500" />
          <span className="text-sm font-medium text-dark-200">Activity Log</span>
          {isLoading && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-400" />
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Entry type counts */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {entryCounts.tool && entryCounts.tool > 0 && (
              <span className="flex items-center gap-1 text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                <Wrench className="w-3 h-3" />
                {entryCounts.tool}
              </span>
            )}
            {entryCounts.info && entryCounts.info > 0 && (
              <span className="flex items-center gap-1 text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                <Brain className="w-3 h-3" />
                {entryCounts.info}
              </span>
            )}
          </div>
          
          {/* Stats */}
          {(deltaCount > 0 || elapsedTime > 0) && (
            <div className="flex items-center gap-2 text-xs text-dark-500">
              {deltaCount > 0 && (
                <span className="bg-dark-700 px-2 py-0.5 rounded">
                  {deltaCount} chunks
                </span>
              )}
              {elapsedTime > 0 && (
                <span className="bg-dark-700 px-2 py-0.5 rounded">
                  {elapsedTime.toFixed(0)}s
                </span>
              )}
            </div>
          )}
          
          {/* Total count */}
          <span className="text-xs text-dark-500">
            {activityLog.length} entries
          </span>
          
          {isActivityLogExpanded ? (
            <ChevronUp className="w-4 h-4 text-dark-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-dark-400" />
          )}
        </div>
      </button>
      
      {/* Log content - Collapsible */}
      {isActivityLogExpanded && (
        <div 
          ref={scrollRef}
          className="max-h-64 overflow-y-auto border-t border-dark-700 bg-dark-950"
        >
          {activityLog.length === 0 ? (
            <div className="px-4 py-6 text-xs text-dark-500 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-dark-600" />
              Waiting for activity...
            </div>
          ) : (
            <div className="divide-y divide-dark-800/50">
              {activityLog.map((entry) => (
                <ActivityEntry key={entry.id} entry={entry} />
              ))}
            </div>
          )}
          
          {/* Loading indicator at bottom */}
          {isLoading && activityLog.length > 0 && (
            <div className="px-4 py-2 flex items-center gap-2 bg-dark-900/80 border-t border-dark-800 sticky bottom-0">
              <Loader2 className="w-3 h-3 animate-spin text-accent-400" />
              <span className="text-xs text-dark-400">
                Processing... {deltaCount > 0 && `(${deltaCount} chunks)`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
