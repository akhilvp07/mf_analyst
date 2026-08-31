import React, { useState } from 'react';
import { 
  Cloud, 
  Cpu, 
  Database, 
  FileCode, 
  Activity, 
  Sparkles,
  Server
} from 'lucide-react';
import { GoogleHostingGuide } from './GoogleHostingGuide';
import { LazyLoadingStudio } from './LazyLoadingStudio';
import { DatabaseIndexingStudio } from './DatabaseIndexingStudio';
import { ArchitectureGuide } from './ArchitectureGuide';
import { PerformanceAuditTool } from './PerformanceAuditTool';

export const GoogleHostingAndPerf: React.FC = () => {
  const [subTab, setSubTab] = useState<'hosting' | 'virtualization' | 'indexing' | 'architecture' | 'audit'>('hosting');

  return (
    <div className="space-y-6">
      {/* Subtab Navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-neutral-800">
        <button
          onClick={() => setSubTab('hosting')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            subTab === 'hosting'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Google Drive & Cloud Deployment</span>
        </button>

        <button
          onClick={() => setSubTab('virtualization')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            subTab === 'virtualization'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Virtualization Benchmark Lab</span>
        </button>

        <button
          onClick={() => setSubTab('indexing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            subTab === 'indexing'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Query Indexing Simulation</span>
        </button>

        <button
          onClick={() => setSubTab('architecture')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            subTab === 'architecture'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Architecture Blueprints</span>
        </button>

        <button
          onClick={() => setSubTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            subTab === 'audit'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Performance ROI Audit</span>
        </button>
      </div>

      {/* Subtab Content */}
      <div>
        {subTab === 'hosting' && <GoogleHostingGuide />}
        {subTab === 'virtualization' && <LazyLoadingStudio />}
        {subTab === 'indexing' && <DatabaseIndexingStudio />}
        {subTab === 'architecture' && <ArchitectureGuide />}
        {subTab === 'audit' && <PerformanceAuditTool />}
      </div>
    </div>
  );
};
