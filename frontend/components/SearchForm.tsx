'use client';

import { FormEvent, useState, useRef, useEffect } from 'react';
import { Search, Loader2, X, ChevronDown, Cpu, Wrench, BookOpen, Globe, FileSearch, Layers } from 'lucide-react';
import { useResearchStore, AVAILABLE_ENGINES, AVAILABLE_TOOLS } from '@/lib/store';
import { useStreamingSSE } from '@/hooks/useStreamingSSE';

// Dropdown component for compact selection
function Dropdown({ 
  label, 
  icon: Icon, 
  value, 
  options, 
  onChange, 
  disabled,
  color = 'accent'
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  options: { id: string; name: string; description?: string }[];
  onChange: (id: string) => void;
  disabled?: boolean;
  color?: 'accent' | 'purple' | 'blue';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const selectedOption = options.find(o => o.id === value);
  const colorClasses = {
    accent: 'text-accent-400 bg-accent-500/10 border-accent-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  };
  
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors
          ${open ? colorClasses[color] : 'bg-dark-800 border-dark-700 text-dark-300 hover:border-dark-600'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{label}:</span>
        <span className="font-medium">{selectedOption?.name || value}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] bg-dark-800 border border-dark-700 rounded-lg shadow-xl overflow-hidden">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
              className={`
                w-full px-3 py-2 text-left text-sm transition-colors
                ${value === option.id 
                  ? `${colorClasses[color]} font-medium` 
                  : 'text-dark-300 hover:bg-dark-700'
                }
              `}
            >
              <div className="font-medium">{option.name}</div>
              {option.description && (
                <div className="text-xs text-dark-500 mt-0.5">{option.description}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Tool toggle pill component
function ToolPill({ 
  id, 
  name, 
  isSelected, 
  onToggle, 
  disabled,
  icon: Icon,
  color = 'purple'
}: {
  id: string;
  name: string;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  icon?: React.ElementType;
  color?: 'purple' | 'blue';
}) {
  const colorClasses = {
    purple: {
      selected: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      unselected: 'bg-dark-800 text-dark-400 border-dark-700 hover:border-dark-600 hover:text-dark-300',
    },
    blue: {
      selected: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      unselected: 'bg-dark-800 text-dark-400 border-dark-700 hover:border-dark-600 hover:text-dark-300',
    },
  };
  
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`
        flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all
        ${isSelected ? colorClasses[color].selected : colorClasses[color].unselected}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {name}
      {isSelected && (
        <X className="w-3 h-3 ml-0.5 opacity-60 hover:opacity-100" />
      )}
    </button>
  );
}

// Map tool IDs to icons
const TOOL_ICONS: Record<string, React.ElementType> = {
  web_search: Globe,
  webpage_understanding: FileSearch,
  exa_search: Layers,
};

export function SearchForm() {
  const { 
    topic, 
    setTopic, 
    isLoading, 
    reset,
    selectedEngine,
    setSelectedEngine,
    selectedTools,
    toggleTool,
    includeArxiv,
    setIncludeArxiv,
  } = useResearchStore();
  
  const { startStream, stopStream } = useStreamingSSE();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (topic.trim() && !isLoading) {
      startStream({
        topic,
        engine: selectedEngine,
        tools: selectedTools,
        includeArxiv,
      });
    }
  };

  const handleCancel = () => {
    stopStream();
  };

  const handleClear = () => {
    stopStream();
    reset();
  };

  // Check if a tool can be toggled off
  const canToggleOff = (toolId: string) => {
    if (!selectedTools.includes(toolId)) return true; // Can always toggle on
    // Can toggle off if: more than 1 tool selected OR ArXiv is enabled
    return selectedTools.length > 1 || includeArxiv;
  };

  const handleToolToggle = (toolId: string) => {
    if (canToggleOff(toolId)) {
      toggleTool(toolId);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-3">
        {/* Main search input with button */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-dark-400" />
            </div>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter a research topic (e.g., 'attention mechanism in transformers')"
              className="input pl-12 pr-12 py-3 text-base w-full"
              disabled={isLoading}
            />
            {topic && !isLoading && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-dark-400 hover:text-dark-200"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          
          {/* Action buttons */}
          {isLoading ? (
            <button
              type="button"
              onClick={handleCancel}
              className="btn-secondary flex items-center gap-2 px-4"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Cancel</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!topic.trim()}
              className="btn-primary flex items-center gap-2 px-6"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Analyze</span>
            </button>
          )}
        </div>
        
        {/* Settings Row - Always visible, inline */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Engine Dropdown */}
          <Dropdown
            label="Engine"
            icon={Cpu}
            value={selectedEngine}
            options={AVAILABLE_ENGINES}
            onChange={setSelectedEngine}
            disabled={isLoading}
            color="accent"
          />
          
          {/* Divider */}
          <div className="h-4 w-px bg-dark-700 hidden sm:block" />
          
          {/* Tools label */}
          <div className="flex items-center gap-1.5 text-xs text-dark-500">
            <Wrench className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tools:</span>
          </div>
          
          {/* Tool Pills */}
          {AVAILABLE_TOOLS.map((tool) => (
            <ToolPill
              key={tool.id}
              id={tool.id}
              name={tool.name.replace(' Search', '').replace(' Understanding', '')}
              isSelected={selectedTools.includes(tool.id)}
              onToggle={() => handleToolToggle(tool.id)}
              disabled={isLoading || (!canToggleOff(tool.id) && selectedTools.includes(tool.id))}
              icon={TOOL_ICONS[tool.id]}
              color="purple"
            />
          ))}
          
          {/* ArXiv Toggle */}
          <ToolPill
            id="arxiv"
            name="ArXiv"
            isSelected={includeArxiv}
            onToggle={() => setIncludeArxiv(!includeArxiv)}
            disabled={isLoading}
            icon={BookOpen}
            color="blue"
          />
          
          {/* Tool count indicator */}
          <span className="text-xs text-dark-500 ml-auto hidden sm:inline">
            {selectedTools.length + (includeArxiv ? 1 : 0)} tool{selectedTools.length + (includeArxiv ? 1 : 0) !== 1 ? 's' : ''} active
          </span>
        </div>
        
        {/* Warning if no tools */}
        {selectedTools.length === 0 && !includeArxiv && (
          <div className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/20">
            ⚠️ At least one tool must be enabled for research
          </div>
        )}
      </div>
    </form>
  );
}
