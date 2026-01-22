'use client';

/**
 * Markdown Renderer Component
 * 
 * Renders markdown content with proper styling for the dark theme.
 * Uses react-markdown with remark-gfm for GitHub Flavored Markdown support.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-dark-100 mt-6 mb-4 pb-2 border-b border-dark-700">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-dark-100 mt-5 mb-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-dark-200 mt-4 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-medium text-dark-200 mt-3 mb-2">
              {children}
            </h4>
          ),
          
          // Paragraphs
          p: ({ children }) => (
            <p className="text-dark-300 leading-relaxed mb-4">
              {children}
            </p>
          ),
          
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-6 mb-4 space-y-2 text-dark-300">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-6 mb-4 space-y-2 text-dark-300">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-dark-300 leading-relaxed">
              {children}
            </li>
          ),
          
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-400 hover:text-accent-300 underline underline-offset-2 transition-colors"
            >
              {children}
            </a>
          ),
          
          // Code
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-dark-700 text-accent-400 rounded text-sm font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className={`${className} font-mono`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-dark-900 border border-dark-700 rounded-lg p-4 overflow-x-auto mb-4 text-sm">
              {children}
            </pre>
          ),
          
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-accent-500 pl-4 py-1 my-4 bg-dark-800/50 rounded-r-lg">
              {children}
            </blockquote>
          ),
          
          // Horizontal rule
          hr: () => (
            <hr className="border-dark-700 my-6" />
          ),
          
          // Strong/Bold
          strong: ({ children }) => (
            <strong className="font-semibold text-dark-100">
              {children}
            </strong>
          ),
          
          // Emphasis/Italic
          em: ({ children }) => (
            <em className="italic text-dark-200">
              {children}
            </em>
          ),
          
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-dark-700 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-dark-800">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-dark-700">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-dark-800/50 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-sm font-semibold text-dark-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-sm text-dark-300">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
