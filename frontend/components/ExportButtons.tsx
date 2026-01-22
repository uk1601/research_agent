'use client';

/**
 * Export buttons component for downloading analysis results.
 * Provides PDF and Markdown export options.
 */

import { useState } from 'react';
import { Download, FileText, FileCode, Loader2, Check } from 'lucide-react';
import { exportToPDF, exportToMarkdown, canExport } from '@/lib/export';
import { ResearchAnalysis } from '@/lib/types';

interface ExportButtonsProps {
  topic: string;
  answer: ResearchAnalysis | Record<string, any> | string | null;
  className?: string;
}

export function ExportButtons({ topic, answer, className = '' }: ExportButtonsProps) {
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingMD, setExportingMD] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [mdSuccess, setMdSuccess] = useState(false);

  const isExportable = canExport(answer);

  const handleExportPDF = async () => {
    if (!isExportable || exportingPDF) return;
    
    setExportingPDF(true);
    setPdfSuccess(false);
    
    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100));
      exportToPDF(topic, answer);
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 2000);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportMarkdown = async () => {
    if (!isExportable || exportingMD) return;
    
    setExportingMD(true);
    setMdSuccess(false);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      exportToMarkdown(topic, answer);
      setMdSuccess(true);
      setTimeout(() => setMdSuccess(false), 2000);
    } catch (error) {
      console.error('Markdown export failed:', error);
      alert('Failed to export Markdown. Please try again.');
    } finally {
      setExportingMD(false);
    }
  };

  if (!isExportable) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* PDF Export Button */}
      <button
        onClick={handleExportPDF}
        disabled={exportingPDF}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
          transition-all duration-200
          ${pdfSuccess 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'bg-dark-700 text-dark-300 border border-dark-600 hover:bg-dark-600 hover:text-dark-100 hover:border-dark-500'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        title="Download as PDF"
      >
        {exportingPDF ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : pdfSuccess ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <FileText className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">
          {pdfSuccess ? 'Downloaded!' : 'PDF'}
        </span>
      </button>

      {/* Markdown Export Button */}
      <button
        onClick={handleExportMarkdown}
        disabled={exportingMD}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
          transition-all duration-200
          ${mdSuccess 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'bg-dark-700 text-dark-300 border border-dark-600 hover:bg-dark-600 hover:text-dark-100 hover:border-dark-500'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        title="Download as Markdown"
      >
        {exportingMD ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : mdSuccess ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <FileCode className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">
          {mdSuccess ? 'Downloaded!' : 'Markdown'}
        </span>
      </button>
    </div>
  );
}

/**
 * Dropdown version of export buttons (alternative style)
 */
export function ExportDropdown({ topic, answer, className = '' }: ExportButtonsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'md' | null>(null);

  const isExportable = canExport(answer);

  const handleExport = async (format: 'pdf' | 'md') => {
    if (!isExportable || exporting) return;
    
    setExporting(format);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (format === 'pdf') {
        exportToPDF(topic, answer);
      } else {
        exportToMarkdown(topic, answer);
      }
    } catch (error) {
      console.error(`${format.toUpperCase()} export failed:`, error);
      alert(`Failed to export ${format.toUpperCase()}. Please try again.`);
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  if (!isExportable) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
          bg-dark-700 text-dark-300 border border-dark-600
          hover:bg-dark-600 hover:text-dark-100 hover:border-dark-500
          transition-all duration-200
        `}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Export</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-50 bg-dark-800 border border-dark-700 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting === 'pdf'}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-dark-300 hover:bg-dark-700 hover:text-dark-100 transition-colors disabled:opacity-50"
            >
              {exporting === 'pdf' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-red-400" />
              )}
              <span>Download PDF</span>
            </button>
            <button
              onClick={() => handleExport('md')}
              disabled={exporting === 'md'}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-dark-300 hover:bg-dark-700 hover:text-dark-100 transition-colors disabled:opacity-50"
            >
              {exporting === 'md' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileCode className="w-3.5 h-3.5 text-blue-400" />
              )}
              <span>Download Markdown</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
