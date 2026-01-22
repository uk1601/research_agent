'use client';

import { Sparkles } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-dark-700 bg-dark-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-dark-100">
                Research Analyzer
              </h1>
              <p className="text-xs text-dark-400">
                Powered by Subconscious
              </p>
            </div>
          </div>
          
          {/* Right side - could add settings, auth, etc. */}
          <div className="flex items-center gap-4">
            <a 
              href="https://docs.subconscious.dev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-dark-400 hover:text-accent-500 transition-colors"
            >
              Docs
            </a>
            <a 
              href="https://subconscious.dev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-dark-400 hover:text-accent-500 transition-colors"
            >
              Platform
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
