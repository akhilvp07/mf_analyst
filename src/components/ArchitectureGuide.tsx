import React, { useState } from 'react';
import { CODE_SNIPPETS } from '../data/mockData';
import { CodeSnippet } from '../types';
import { 
  FileCode, 
  Copy, 
  Check, 
  Sparkles, 
  CheckCircle2, 
  BookOpen, 
  Terminal,
  FolderGit2,
  ChevronRight,
  Lightbulb
} from 'lucide-react';

export function ArchitectureGuide() {
  const [selectedSnippetId, setSelectedSnippetId] = useState<string>(CODE_SNIPPETS[0].id);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = ['ALL', 'Frontend Virtualization', 'API & Cursor Pagination', 'Database Indexing', 'Advanced Timescale & Partitioning'];

  const filteredSnippets = activeCategory === 'ALL'
    ? CODE_SNIPPETS
    : CODE_SNIPPETS.filter(s => s.category === activeCategory);

  const activeSnippet = CODE_SNIPPETS.find(s => s.id === selectedSnippetId) || CODE_SNIPPETS[0];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-neutral-900 rounded-2xl p-6 text-white shadow-sm border border-indigo-900">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-2">
            <BookOpen className="w-3.5 h-3.5 text-indigo-300" />
            Engineering Blueprints & Code Recipes
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            End-to-End MFTracker Performance Architecture
          </h2>
          <p className="text-sm text-indigo-100/90 mt-1 leading-relaxed">
            Ready-to-integrate code snippets for frontend virtualization, Keyset cursor APIs, PostgreSQL composite covering indexes, and non-blocking materialized views.
          </p>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Snippet Explorer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Nav List */}
        <div className="lg:col-span-4 space-y-2">
          {filteredSnippets.map((snippet) => (
            <button
              key={snippet.id}
              onClick={() => setSelectedSnippetId(snippet.id)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                selectedSnippetId === snippet.id
                  ? 'bg-indigo-50/80 border-indigo-500 shadow-xs ring-1 ring-indigo-500'
                  : 'bg-white border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
                <span className="font-mono">{snippet.filename}</span>
                <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 uppercase text-[9px] font-bold">
                  {snippet.language}
                </span>
              </div>
              <h4 className="text-xs font-bold text-neutral-900">
                {snippet.title}
              </h4>
              <p className="text-[11px] text-neutral-600 line-clamp-2 mt-1">
                {snippet.explanation}
              </p>
            </button>
          ))}
        </div>

        {/* Right Code Display Card */}
        <div className="lg:col-span-8 bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-neutral-200">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono">
                  {activeSnippet.filename}
                </span>
                <span className="text-xs text-neutral-500">({activeSnippet.language})</span>
              </div>
              <h3 className="text-base font-bold text-neutral-900 mt-1">
                {activeSnippet.title}
              </h3>
            </div>

            <button
              onClick={() => handleCopy(activeSnippet.id, activeSnippet.code)}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors self-start sm:self-auto"
            >
              {copiedId === activeSnippet.id ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy Code
                </>
              )}
            </button>
          </div>

          {/* Explanation Callout */}
          <div className="bg-neutral-50 p-3.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{activeSnippet.explanation}</p>
            </div>
          </div>

          {/* Key Architectural Benefits */}
          <div className="space-y-1.5">
            <h5 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Key Benefits for MFTracker:</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {activeSnippet.keyBenefits.map((b, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Code Block */}
          <div className="relative">
            <div className="bg-neutral-950 text-neutral-100 rounded-xl p-4 font-mono text-xs overflow-x-auto leading-relaxed border border-neutral-800 max-h-[500px]">
              <pre>{activeSnippet.code}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
