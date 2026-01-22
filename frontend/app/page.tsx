'use client';

/**
 * Research Paper Analyzer - Main Page
 * 
 * Features:
 * - Rich visual feedback during streaming phases
 * - Progress tracking during processing
 * - Answer display with Markdown rendering + reasoning tree after completion
 */

import { useResearchStore } from '@/lib/store';
import { Header } from '@/components/Header';
import { SearchForm } from '@/components/SearchForm';
import { ReasoningTree } from '@/components/ReasoningTree';
import { RawJsonView } from '@/components/RawJsonView';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ActivityLog } from '@/components/ActivityLog';
import { ExportButtons } from '@/components/ExportButtons';
import { StreamPhase } from '@/lib/types';
import { 
  FileText, 
  GitBranch, 
  Code, 
  Loader2, 
  AlertCircle,
  BookOpen,
  Lightbulb,
  Target,
  TrendingUp,
  Wifi,
  Search,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Globe,
  Database,
  Clock,
  Activity
} from 'lucide-react';

// Phase configuration for visual feedback
const PHASE_CONFIG: Record<StreamPhase, {
  icon: React.ReactNode;
  title: string;
  color: string;
  bgColor: string;
  animate?: boolean;
}> = {
  idle: {
    icon: <Search className="w-5 h-5" />,
    title: 'Ready',
    color: 'text-dark-400',
    bgColor: 'bg-dark-800',
  },
  init: {
    icon: <Sparkles className="w-5 h-5" />,
    title: 'Initializing',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    animate: true,
  },
  connecting: {
    icon: <Wifi className="w-5 h-5" />,
    title: 'Connecting',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    animate: true,
  },
  researching: {
    icon: <Globe className="w-5 h-5" />,
    title: 'Researching',
    color: 'text-accent-400',
    bgColor: 'bg-accent-500/10',
    animate: true,
  },
  retry: {
    icon: <Clock className="w-5 h-5" />,
    title: 'Warming Up',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    animate: true,
  },
  finalizing: {
    icon: <Database className="w-5 h-5" />,
    title: 'Finalizing',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    animate: true,
  },
  complete: {
    icon: <CheckCircle2 className="w-5 h-5" />,
    title: 'Complete',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
  },
  error: {
    icon: <AlertCircle className="w-5 h-5" />,
    title: 'Error',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
};

function PhaseIndicator() {
  const { phase, statusMessage, statusDetails, deltaCount, elapsedTime, isLoading, error } = useResearchStore();
  
  if (phase === 'idle' && !isLoading) return null;
  
  const config = PHASE_CONFIG[phase] || PHASE_CONFIG.idle;
  
  // Get descriptive message for each phase
  const getPhaseDescription = () => {
    switch (phase) {
      case 'init':
        return 'Setting up research agent and configuring tools...';
      case 'connecting':
        return 'Establishing secure connection to Subconscious API...';
      case 'researching':
        return 'Searching sources, analyzing content, and building insights...';
      case 'retry':
        return 'Engine is warming up. This may take 30-60 seconds on first use...';
      case 'finalizing':
        return 'Processing complete. Fetching and formatting results...';
      case 'complete':
        return 'Analysis complete! Results are ready.';
      case 'error':
        return statusMessage || 'An error occurred during analysis.';
      default:
        return statusMessage || 'Processing...';
    }
  };
  
  return (
    <div className={`
      rounded-lg border overflow-hidden
      ${phase === 'error' 
        ? 'bg-red-500/10 border-red-500/30' 
        : phase === 'complete'
          ? 'bg-green-500/10 border-green-500/30'
          : `${config.bgColor} border-dark-700`
      }
    `}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Icon */}
        <div className={`${config.color} ${config.animate ? 'animate-pulse' : ''}`}>
          {config.icon}
        </div>
        
        {/* Status text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm ${config.color}`}>
              {config.title}
            </span>
            {config.animate && (
              <Loader2 className="w-3 h-3 animate-spin text-dark-400" />
            )}
          </div>
          <p className="text-xs text-dark-400">
            {getPhaseDescription()}
          </p>
        </div>
        
        {/* Progress stats */}
        {(phase === 'researching' || phase === 'finalizing') && deltaCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-dark-500 bg-dark-700/50 px-2 py-1 rounded">
              <Activity className="w-3 h-3" />
              {deltaCount} chunks
            </div>
            {elapsedTime > 0 && (
              <div className="text-xs text-dark-500 bg-dark-700/50 px-2 py-1 rounded">
                {elapsedTime.toFixed(0)}s
              </div>
            )}
          </div>
        )}
        
        {/* Retry indicator */}
        {phase === 'retry' && (
          <div className="flex items-center gap-1 text-xs text-yellow-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Please wait...</span>
          </div>
        )}
        
        {/* Tools info */}
        {statusDetails?.tools && statusDetails.tools.length > 0 && phase !== 'error' && (
          <div className="hidden sm:flex items-center gap-1">
            {statusDetails.tools.slice(0, 3).map((tool, i) => (
              <span 
                key={i}
                className="text-xs bg-dark-700 text-dark-300 px-2 py-0.5 rounded"
              >
                {tool}
              </span>
            ))}
            {statusDetails.tools.length > 3 && (
              <span className="text-xs text-dark-500">
                +{statusDetails.tools.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Error details - shown below main status */}
      {phase === 'error' && error && (
        <div className="px-4 py-3 border-t border-red-500/20 bg-red-500/5">
          <p className="text-xs text-red-300 font-mono break-all">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}

function ResultsPanel() {
  const { 
    topic,
    answer, 
    reasoning, 
    isLoading,
    isStreaming, 
    phase,
    deltaCount,
    elapsedTime,
    error,
    viewMode,
    setViewMode 
  } = useResearchStore();

  const hasAnswer = answer !== null && answer !== undefined;
  const hasReasoning = reasoning && reasoning.length > 0;

  // Render the answer content
  const renderAnswer = () => {
    if (!answer) return null;
    
    // Handle string answer (plain text/markdown - no answerFormat)
    if (typeof answer === 'string') {
      return (
        <div className="prose prose-invert max-w-none">
          <MarkdownRenderer content={answer} />
        </div>
      );
    }
    
    // Handle object answer (with answerFormat)
    if (typeof answer === 'object') {
      const analysis = answer as any;
      
      // Check if it has our expected structured format
      const hasStructuredContent = analysis.summary || analysis.papers || analysis.themes || analysis.gaps || analysis.future_directions;
      
      // If it's not our expected structure, render as formatted text/JSON
      if (!hasStructuredContent) {
        return (
          <div className="prose prose-invert max-w-none">
            <pre className="text-dark-200 whitespace-pre-wrap leading-relaxed bg-dark-900/50 p-4 rounded-lg text-sm overflow-auto">
              {JSON.stringify(answer, null, 2)}
            </pre>
          </div>
        );
      }
      
      // Render structured content
      return (
        <div className="space-y-8">
          {/* Summary */}
          {analysis.summary && (
            <section>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-dark-100 mb-3">
                <FileText className="w-5 h-5 text-accent-500" />
                Summary
              </h3>
              <p className="text-dark-300 leading-relaxed">{analysis.summary}</p>
            </section>
          )}
          
          {/* Key Papers */}
          {analysis.papers && analysis.papers.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-dark-100 mb-3">
                <BookOpen className="w-5 h-5 text-blue-400" />
                Key Papers ({analysis.papers.length})
              </h3>
              <div className="space-y-4">
                {analysis.papers.map((paper: any, idx: number) => (
                  <div 
                    key={idx} 
                    className="p-4 bg-dark-800/50 rounded-lg border border-dark-700 hover:border-dark-600 transition-colors"
                  >
                    <h4 className="font-medium text-dark-100">
                      {paper.url ? (
                        <a 
                          href={paper.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-accent-400 transition-colors"
                        >
                          {paper.title}
                        </a>
                      ) : (
                        paper.title
                      )}
                    </h4>
                    <p className="text-xs text-dark-400 mt-1">
                      {paper.authors?.join(', ')} • {paper.source} {paper.year && paper.year > 0 && `(${paper.year})`}
                    </p>
                    <p className="text-sm text-dark-300 mt-2">{paper.summary}</p>
                    {paper.relevance && (
                      <p className="text-xs text-accent-400/80 mt-2">
                        <span className="font-medium">Relevance:</span> {paper.relevance}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          
          {/* Research Themes */}
          {analysis.themes && analysis.themes.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-dark-100 mb-3">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                Research Themes ({analysis.themes.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {analysis.themes.map((theme: any, idx: number) => (
                  <div 
                    key={idx}
                    className="p-4 bg-dark-800/50 rounded-lg border border-dark-700"
                  >
                    <h4 className="font-medium text-dark-100">{theme.name}</h4>
                    <p className="text-sm text-dark-300 mt-2">{theme.description}</p>
                    {theme.key_papers && theme.key_papers.length > 0 && (
                      <p className="text-xs text-dark-400 mt-2">
                        Key papers: {theme.key_papers.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          
          {/* Research Gaps */}
          {analysis.gaps && analysis.gaps.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-dark-100 mb-3">
                <Target className="w-5 h-5 text-red-400" />
                Research Gaps ({analysis.gaps.length})
              </h3>
              <div className="space-y-3">
                {analysis.gaps.map((gap: any, idx: number) => (
                  <div 
                    key={idx}
                    className="p-4 bg-dark-800/50 rounded-lg border border-dark-700"
                  >
                    <h4 className="font-medium text-dark-100">{gap.area}</h4>
                    <p className="text-sm text-dark-300 mt-2">{gap.description}</p>
                    {gap.potential_impact && (
                      <p className="text-xs text-green-400/80 mt-2">
                        <span className="font-medium">Potential Impact:</span> {gap.potential_impact}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          
          {/* Future Directions */}
          {analysis.future_directions && analysis.future_directions.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-dark-100 mb-3">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Future Directions
              </h3>
              <ul className="space-y-2">
                {analysis.future_directions.map((direction: string, idx: number) => (
                  <li 
                    key={idx}
                    className="flex items-start gap-2 text-dark-300"
                  >
                    <span className="text-accent-500 mt-1">•</span>
                    {direction}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      );
    }
    
    // Fallback for any other type
    return (
      <div className="prose prose-invert max-w-none">
        <p className="text-dark-200">{String(answer)}</p>
      </div>
    );
  };

  // Render loading state with phase info
  const renderLoadingState = () => {
    const config = PHASE_CONFIG[phase] || PHASE_CONFIG.init;
    
    return (
      <div className="flex flex-col items-center justify-center py-12">
        {/* Animated icon */}
        <div className="relative w-20 h-20 flex items-center justify-center mb-6">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-2 border-dark-700" />
          <div className="absolute inset-0 rounded-full border-2 border-t-accent-500 animate-spin" />
          
          {/* Inner icon */}
          <div className={`${config.color} transform scale-150`}>
            {config.icon}
          </div>
        </div>
        
        {/* Phase title */}
        <p className={`text-lg font-medium mb-2 ${config.color}`}>
          {config.title}
        </p>
        
        {/* Phase-specific messages */}
        <p className="text-sm text-dark-400 text-center max-w-md">
          {phase === 'init' && 'Setting up research agent with tools...'}
          {phase === 'connecting' && 'Establishing connection to Subconscious API...'}
          {phase === 'researching' && 'Searching sources, analyzing papers, and synthesizing insights...'}
          {phase === 'retry' && 'Engine is warming up. This can take 30-60 seconds...'}
          {phase === 'finalizing' && 'Fetching results from API...'}
        </p>
        
        {/* Progress stats */}
        {(phase === 'researching' || phase === 'finalizing') && deltaCount > 0 && (
          <div className="flex items-center gap-4 mt-4 text-sm text-dark-400">
            <div className="flex items-center gap-1">
              <Activity className="w-4 h-4" />
              <span>{deltaCount} chunks processed</span>
            </div>
            {elapsedTime > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{elapsedTime.toFixed(0)}s elapsed</span>
              </div>
            )}
          </div>
        )}
        
        {/* Progress dots */}
        <div className="flex items-center gap-1 mt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-accent-500 animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
        
        {/* Warmup notice for retry phase */}
        {phase === 'retry' && (
          <div className="mt-6 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg max-w-md">
            <p className="text-xs text-yellow-300 text-center">
              <strong>TIM engines require warmup on first use.</strong><br />
              Please be patient - this only happens once per session.
            </p>
          </div>
        )}
      </div>
    );
  };

  // Render error state
  const renderErrorState = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <p className="text-lg font-medium text-red-400 mb-2">Analysis Failed</p>
      <div className="max-w-lg w-full mt-4 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
        <p className="text-xs text-red-300 font-mono break-all text-center">
          {error}
        </p>
      </div>
      <p className="text-xs text-dark-500 mt-4">
        Try again or check the console for more details
      </p>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
      {/* Left Panel - Results */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="bg-dark-800 rounded-xl border border-dark-700 flex-1 flex flex-col overflow-hidden">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent-500" />
              <h2 className="font-semibold text-dark-100">Analysis Results</h2>
            </div>
            <div className="flex items-center gap-2">
              {phase === 'complete' && hasAnswer && (
                <>
                  <ExportButtons topic={topic} answer={answer} />
                  <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">
                    ✓ Complete
                  </span>
                </>
              )}
            </div>
          </div>
          
          {/* Panel Content */}
          <div className="flex-1 overflow-auto p-4">
            {error ? (
              renderErrorState()
            ) : isLoading ? (
              renderLoadingState()
            ) : hasAnswer ? (
              renderAnswer()
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-dark-400">
                <FileText className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Enter a topic to start research analysis</p>
                <p className="text-xs mt-2 text-dark-500">
                  The AI will search, analyze, and synthesize academic sources
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Right Panel - Reasoning Tree */}
      <div className="w-full lg:w-[450px] flex flex-col min-w-0 overflow-hidden">
        <div className="bg-dark-800 rounded-xl border border-dark-700 flex-1 flex flex-col overflow-hidden">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-purple-400" />
              <h2 className="font-semibold text-dark-100">Reasoning Trace</h2>
              {hasReasoning && (
                <span className="text-xs text-dark-400 bg-dark-700 px-2 py-0.5 rounded">
                  {reasoning.length} step{reasoning.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-dark-700/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode('tree')}
                className={`
                  px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5
                  ${viewMode === 'tree' 
                    ? 'bg-accent-500 text-white' 
                    : 'text-dark-300 hover:text-dark-100 hover:bg-dark-600'
                  }
                `}
              >
                <GitBranch className="w-3.5 h-3.5" />
                Tree
              </button>
              <button
                onClick={() => setViewMode('json')}
                className={`
                  px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5
                  ${viewMode === 'json' 
                    ? 'bg-accent-500 text-white' 
                    : 'text-dark-300 hover:text-dark-100 hover:bg-dark-600'
                  }
                `}
              >
                <Code className="w-3.5 h-3.5" />
                JSON
              </button>
            </div>
          </div>
          
          {/* Panel Content */}
          <div className="flex-1 overflow-auto p-4">
            {isLoading && !hasReasoning ? (
              <div className="flex flex-col items-center justify-center py-12 text-dark-400">
                <div className="relative w-12 h-12 mb-4">
                  <GitBranch className="w-12 h-12 opacity-30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  </div>
                </div>
                <p className="text-sm">Building reasoning tree...</p>
                <p className="text-xs mt-1 text-dark-500">
                  Available after analysis completes
                </p>
              </div>
            ) : viewMode === 'tree' ? (
              <ReasoningTree tasks={reasoning} />
            ) : (
              <RawJsonView data={reasoning} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-dark-950">
      <Header />
      
      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 gap-6 overflow-hidden">
        {/* Search Section */}
        <section className="flex-shrink-0 space-y-3">
          <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
            <SearchForm />
          </div>
          
          {/* Phase Indicator */}
          <PhaseIndicator />
          
          {/* Activity Log */}
          <ActivityLog />
        </section>
        
        {/* Results Section */}
        <section className="flex-1 min-h-0">
          <ResultsPanel />
        </section>
      </main>
      
      {/* Footer */}
      <footer className="flex-shrink-0 border-t border-dark-800 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-dark-500">
            Powered by{' '}
            <a 
              href="https://subconscious.dev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-accent-500 hover:text-accent-400"
            >
              Subconscious
            </a>
            {' '}• Research Paper Analyzer v2.0.0
          </p>
        </div>
      </footer>
    </div>
  );
}
