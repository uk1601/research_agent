'use client';

import { useState } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Search, 
  FileText, 
  CheckCircle,
  Brain,
  Wrench,
  Globe,
  BookOpen,
  ChevronUp
} from 'lucide-react';
import { Task, ToolCall } from '@/lib/types';

interface ReasoningTreeProps {
  tasks: Task[];
}

interface TaskNodeProps {
  task: Task;
  depth?: number;
  isLast?: boolean;
}

function getToolIcon(toolName?: string) {
  if (!toolName) return <Wrench className="w-4 h-4" />;
  
  const name = toolName.toLowerCase();
  if (name.includes('search') || name.includes('web')) {
    return <Globe className="w-4 h-4" />;
  }
  if (name.includes('arxiv') || name.includes('paper')) {
    return <BookOpen className="w-4 h-4" />;
  }
  return <Search className="w-4 h-4" />;
}

function ToolCallDisplay({ tooluse }: { tooluse: ToolCall }) {
  const [showResult, setShowResult] = useState(false);
  
  return (
    <div className="mt-2 space-y-2">
      <div 
        className="flex items-center gap-2 text-xs bg-accent-500/10 text-accent-400 px-3 py-2 rounded-lg cursor-pointer hover:bg-accent-500/20 transition-colors"
        onClick={() => setShowResult(!showResult)}
      >
        {getToolIcon(tooluse.tool_name)}
        <span className="font-medium">{tooluse.tool_name}</span>
        <ChevronRight className={`w-3 h-3 ml-auto transition-transform ${showResult ? 'rotate-90' : ''}`} />
      </div>
      
      {showResult && tooluse.tool_result && (
        <div className="ml-4 p-3 bg-dark-900 rounded-lg border border-dark-700 text-xs">
          <pre className="whitespace-pre-wrap overflow-auto max-h-48 text-dark-300">
            {typeof tooluse.tool_result === 'string' 
              ? tooluse.tool_result 
              : JSON.stringify(tooluse.tool_result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Expandable text component for long content
function ExpandableText({ 
  text, 
  maxLength = 200,
  className = "",
  expandedClassName = ""
}: { 
  text: string; 
  maxLength?: number;
  className?: string;
  expandedClassName?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text.length > maxLength;
  
  if (!isLong) {
    return <span className={className}>{text}</span>;
  }
  
  return (
    <span className={className}>
      <span className={isExpanded ? expandedClassName : ""}>
        {isExpanded ? text : `${text.slice(0, maxLength)}...`}
      </span>
      <button
        onClick={(e) => { 
          e.stopPropagation(); 
          setIsExpanded(!isExpanded); 
        }}
        className="ml-2 text-accent-400 hover:text-accent-300 text-xs font-medium inline-flex items-center gap-0.5"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-3 h-3" />
            less
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" />
            more
          </>
        )}
      </button>
    </span>
  );
}

function TaskNode({ task, depth = 0, isLast = false }: TaskNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const hasContent = task.thought || task.tooluse || task.conclusion;
  
  return (
    <div className="relative">
      {/* Vertical line from parent */}
      {depth > 0 && (
        <div 
          className="absolute w-px bg-dark-600"
          style={{ 
            left: `${(depth - 1) * 24 + 12}px`,
            top: 0,
            bottom: isLast ? '50%' : 0
          }}
        />
      )}
      
      {/* Horizontal connector */}
      {depth > 0 && (
        <div 
          className="absolute h-px bg-dark-600"
          style={{ 
            left: `${(depth - 1) * 24 + 12}px`,
            width: '12px',
            top: '20px'
          }}
        />
      )}
      
      <div 
        className={`
          reasoning-node flex items-start gap-2 py-2 px-3 rounded-lg cursor-pointer
          ${hasContent ? 'hover:bg-dark-700/50' : ''}
        `}
        style={{ marginLeft: `${depth * 24}px` }}
        onClick={() => hasSubtasks && setIsExpanded(!isExpanded)}
      >
        {/* Expand/Collapse icon */}
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
          {hasSubtasks ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-accent-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-accent-500" />
            )
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-dark-500" />
          )}
        </div>
        
        {/* Icon based on task type */}
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
          {task.tooluse ? (
            <div className="text-blue-400">
              {getToolIcon(task.tooluse.tool_name)}
            </div>
          ) : task.conclusion ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : task.thought ? (
            <Brain className="w-4 h-4 text-purple-400" />
          ) : (
            <FileText className="w-4 h-4 text-dark-400" />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {task.title && (
            <div className="font-medium text-dark-100 text-sm leading-tight">
              {task.title}
            </div>
          )}
          
          {task.thought && (
            <div className="mt-1 text-xs text-dark-400">
              <ExpandableText 
                text={task.thought} 
                maxLength={300}
              />
            </div>
          )}
          
          {task.tooluse && (
            <ToolCallDisplay tooluse={task.tooluse} />
          )}
          
          {task.conclusion && (
            <div className="mt-2 text-xs text-green-400/80 bg-green-500/10 px-3 py-2 rounded-lg">
              <span className="font-medium">Conclusion: </span>
              <ExpandableText 
                text={task.conclusion} 
                maxLength={400}
                className="text-green-300/90"
              />
            </div>
          )}
          
          {hasSubtasks && (
            <div className="text-xs text-dark-500 mt-1">
              {task.subtasks!.length} subtask{task.subtasks!.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
      
      {/* Subtasks */}
      {isExpanded && hasSubtasks && (
        <div>
          {task.subtasks!.map((subtask, index) => (
            <TaskNode 
              key={index} 
              task={subtask} 
              depth={depth + 1}
              isLast={index === task.subtasks!.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ReasoningTree({ tasks }: ReasoningTreeProps) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-dark-400">
        <Brain className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm">No reasoning trace available</p>
        <p className="text-xs mt-1">Start an analysis to see the agent's thought process</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tasks.map((task, index) => (
        <TaskNode 
          key={index} 
          task={task}
          isLast={index === tasks.length - 1}
        />
      ))}
    </div>
  );
}
