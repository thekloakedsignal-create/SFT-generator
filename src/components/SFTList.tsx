import React, { useState, useMemo } from 'react';
import { SFTExample, SFTTemplateType } from '../types';
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Check, 
  Clock, 
  Sparkles, 
  FileText, 
  Sliders,
  Award,
  Download,
  Upload
} from 'lucide-react';

interface SFTListProps {
  examples: SFTExample[];
  templateType: SFTTemplateType;
  onSelectExample: (example: SFTExample) => void;
  onDeleteExample: (id: string) => void;
  onUpdateStatus: (id: string, status: SFTExample['status']) => void;
  onApproveAll: () => void;
  onClearAll: () => void;
}

export default function SFTList({
  examples,
  templateType,
  onSelectExample,
  onDeleteExample,
  onUpdateStatus,
  onApproveAll,
  onClearAll,
}: SFTListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [tagFilter, setTagFilter] = useState('all');

  // Collect all unique tags in the current project
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    examples.forEach(ex => {
      if (ex.tags) {
        ex.tags.forEach(t => tagsSet.add(t));
      }
    });
    return ['all', ...Array.from(tagsSet)];
  }, [examples]);

  // Filtered examples
  const filteredExamples = useMemo(() => {
    return examples.filter(ex => {
      // 1. Status Filter
      if (statusFilter !== 'all' && ex.status !== statusFilter) return false;

      // 2. Tag Filter
      if (tagFilter !== 'all' && (!ex.tags || !ex.tags.includes(tagFilter))) return false;

      // 3. Search text
      if (search.trim() !== '') {
        const query = search.toLowerCase();
        const promptText = (ex.prompt || ex.userInput || '').toLowerCase();
        const responseText = (ex.response || ex.output || '').toLowerCase();
        const thoughtText = (ex.thought || '').toLowerCase();
        const dialogueText = ex.messages 
          ? ex.messages.map(m => m.content).join(' ').toLowerCase() 
          : '';
        const tagsText = (ex.tags || []).join(' ').toLowerCase();

        return (
          promptText.includes(query) || 
          responseText.includes(query) || 
          thoughtText.includes(query) || 
          dialogueText.includes(query) || 
          tagsText.includes(query)
        );
      }

      return true;
    });
  }, [examples, search, statusFilter, tagFilter]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4" id="sft-examples-list-panel">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-amber-500" />
          <h2 className="text-md font-semibold text-slate-100 font-sans">Dataset Registry ({filteredExamples.length})</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onApproveAll}
            disabled={examples.length === 0}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Approve All</span>
          </button>
          <button
            onClick={onClearAll}
            disabled={examples.length === 0}
            className="bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 border border-red-500/20 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 text-xs rounded-lg pl-8 pr-3 py-2 text-slate-300 focus:outline-none focus:border-amber-500"
            placeholder="Search examples..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-1">
          <Sliders className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <select
            className="w-full bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-2 text-slate-300 focus:outline-none"
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <select
          className="w-full bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-2 text-slate-300 focus:outline-none"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="all">All Tags ({allTags.length - 1})</option>
          {allTags.filter(t => t !== 'all').map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Examples Grid / List */}
      <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
        {filteredExamples.length === 0 ? (
          <div className="bg-slate-950 rounded-xl p-12 text-center border border-slate-800/60">
            <p className="text-xs text-slate-500 font-sans">
              {examples.length === 0 
                ? 'No synthesized SFT items in this task yet. Use the Batch Synthesizer above, convert uploaded documents, or add custom examples.'
                : 'No examples match your current search/filter settings.'}
            </p>
          </div>
        ) : (
          (() => {
            const groups: { [key: string]: SFTExample[] } = {};
            filteredExamples.forEach(ex => {
              const bId = ex.batchId || 'ungrouped';
              if (!groups[bId]) groups[bId] = [];
              groups[bId].push(ex);
            });

            return Object.entries(groups).map(([batchId, batchExamples]) => (
              <div key={batchId} className="space-y-2">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider pt-2 border-t border-slate-800">
                  {batchId === 'ungrouped' ? 'Ungrouped' : `Batch: ${batchId}`}
                </div>
                {batchExamples.map((ex, index) => {
                  let titleText = '';
                  let bodyText = '';
                  
                  if (templateType === 'single-turn') {
                    titleText = ex.prompt || '';
                    bodyText = ex.response || '';
                  } else if (templateType === 'reasoning-cot') {
                    titleText = ex.prompt || '';
                    bodyText = ex.thought ? `[THOUGHT] ${ex.thought} \n\n[RESPONSE] ${ex.response}` : (ex.response || '');
                  } else if (templateType === 'system-prompt') {
                    titleText = ex.userInput || '';
                    bodyText = ex.output || '';
                  } else {
                    // Multi-turn
                    const userMsgs = ex.messages?.filter(m => m.role === 'user') || [];
                    const asstMsgs = ex.messages?.filter(m => m.role === 'assistant') || [];
                    titleText = userMsgs[0]?.content || 'Multi-turn Exchange';
                    bodyText = asstMsgs[asstMsgs.length - 1]?.content || '';
                  }

                  return (
                    <div 
                      key={ex.id}
                      className={`bg-slate-950 p-3.5 rounded-lg border border-slate-800/80 hover:border-slate-700/80 transition-all flex items-start gap-3 relative group cursor-pointer ${
                        ex.status === 'approved' ? 'border-l-2 border-l-emerald-500' :
                        ex.status === 'rejected' ? 'border-l-2 border-l-red-500' :
                        'border-l-2 border-l-amber-500'
                      }`}
                      onClick={() => onSelectExample(ex)}
                    >
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-500">
                            SFT Example #{examples.length - examples.indexOf(ex)}
                          </span>
                          <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                            {ex.critique && (
                              <div className="flex items-center text-amber-400 mr-2 bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px]">
                                <Award className="w-3 h-3 mr-0.5" />
                                <span>{ex.critique.score}/5</span>
                              </div>
                            )}
                            
                            <button
                              onClick={() => onUpdateStatus(ex.id, ex.status === 'approved' ? 'pending' : 'approved')}
                              className={`p-1 rounded transition-colors ${
                                ex.status === 'approved' 
                                  ? 'text-emerald-400 bg-emerald-500/10' 
                                  : 'text-slate-500 hover:text-emerald-400 hover:bg-slate-900'
                              }`}
                              title="Toggle Approve"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
      
                            <button
                              onClick={() => onDeleteExample(ex.id)}
                              className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-900 transition-colors"
                              title="Delete SFT Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
      
                        <h3 className="text-xs font-semibold text-slate-200 line-clamp-1 font-sans">
                          {titleText}
                        </h3>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {bodyText}
                        </p>
      
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono ${
                            ex.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' :
                            ex.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/10' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                          }`}>
                            {ex.status.toUpperCase()}
                          </span>
                          {ex.tags && ex.tags.map(tag => (
                            <span key={tag} className="bg-slate-900 border border-slate-800 text-slate-500 text-[9px] px-1.5 py-0.5 rounded-md">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ));
          })()
        )}
      </div>
    </div>
  );
}
