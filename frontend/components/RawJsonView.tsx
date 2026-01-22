'use client';

import { Task } from '@/lib/types';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface RawJsonViewProps {
  data: Task[] | any;
}

export function RawJsonView({ data }: RawJsonViewProps) {
  const [copied, setCopied] = useState(false);
  
  const jsonString = JSON.stringify(data, null, 2);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-2 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors text-dark-300 hover:text-dark-100"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
      
      <pre className="bg-dark-900 rounded-lg p-4 overflow-auto max-h-[600px] text-xs text-dark-300 font-mono">
        {jsonString}
      </pre>
    </div>
  );
}
