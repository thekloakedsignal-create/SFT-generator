import React, { useState } from 'react';
import { SFTExample, SFTProject, SFTMessage } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { 
  X, 
  Save, 
  Trash2, 
  Plus, 
  Sparkles, 
  CheckCircle, 
  XCircle, 
  Cpu, 
  Star, 
  AlertCircle,
  Copy,
  PlusSquare,
  Activity
} from 'lucide-react';

interface SFTWorkbenchProps {
  example: SFTExample;
  project: SFTProject;
  onClose: () => void;
  onSave: (example: SFTExample) => void;
  onDelete: (id: string) => void;
  onAugment: (example: SFTExample, count: number) => Promise<void>;
}

export default function SFTWorkbench({
  example,
  project,
  onClose,
  onSave,
  onDelete,
  onAugment,
}: SFTWorkbenchProps) {
  // Local state for edits
  const [workTab, setWorkTab] = useState<'edit' | 'preview'>('edit');
  const [prompt, setPrompt] = useState(example.prompt || '');
  const [response, setResponse] = useState(example.response || '');
  const [thought, setThought] = useState(example.thought || '');
  const [systemPrompt, setSystemPrompt] = useState(example.systemPrompt || '');
  const [userInput, setUserInput] = useState(example.userInput || '');
  const [output, setOutput] = useState(example.output || '');
  const [messages, setMessages] = useState<SFTMessage[]>(example.messages || []);
  const [tags, setTags] = useState<string>(example.tags?.join(', ') || '');
  const [status, setStatus] = useState<SFTExample['status']>(example.status);

  // Critiquer state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(example.critique || null);
  const [isAugmenting, setIsAugmenting] = useState(false);

  // Handle saving edits
  const handleLocalSave = () => {
    const updated: SFTExample = {
      ...example,
      status,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      prompt,
      response,
      thought: project.templateType === 'reasoning-cot' ? thought : undefined,
      systemPrompt,
      userInput,
      output,
      messages: project.templateType === 'multi-turn' ? messages : undefined,
      critique: auditResult || undefined
    };
    onSave(updated);
    onClose();
  };

  // Trigger server-side SFT quality critique
  const handleAiAudit = async () => {
    setIsAuditing(true);
    try {
      const payloadItem = {
        ...example,
        prompt,
        response,
        thought: project.templateType === 'reasoning-cot' ? thought : undefined,
        systemPrompt,
        userInput,
        output,
        messages: project.templateType === 'multi-turn' ? messages : undefined
      };

      const res = await fetch('/api/critique-sft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ example: payloadItem, project }),
      });

      if (!res.ok) {
        throw new Error('Audit API failed');
      }

      const result = await res.json();
      setAuditResult(result);
    } catch (err: any) {
      console.error(err);
      alert('Failed to audit item: ' + (err.message || err));
    } finally {
      setIsAuditing(false);
    }
  };

  // Auto-apply the refined golden version recommended by the AI
  const handleApplyRefined = () => {
    if (!auditResult || !auditResult.refined) return;
    const ref = auditResult.refined;
    if (project.templateType === 'single-turn') {
      if (ref.prompt) setPrompt(ref.prompt);
      if (ref.response) setResponse(ref.response);
    } else if (project.templateType === 'reasoning-cot') {
      if (ref.prompt) setPrompt(ref.prompt);
      if (ref.thought) setThought(ref.thought);
      if (ref.response) setResponse(ref.response);
    } else if (project.templateType === 'system-prompt') {
      if (ref.systemPrompt) setSystemPrompt(ref.systemPrompt);
      if (ref.userInput) setUserInput(ref.userInput);
      if (ref.output) setOutput(ref.output);
    } else {
      if (ref.messages) setMessages(ref.messages);
    }
    // Boost status to approved if they applied refined
    setStatus('approved');
  };

  // Generate distinct sibling copies
  const handleLocalAugment = async () => {
    setIsAugmenting(true);
    try {
      const currentItem = {
        ...example,
        prompt,
        response,
        thought: project.templateType === 'reasoning-cot' ? thought : undefined,
        systemPrompt,
        userInput,
        output,
        messages: project.templateType === 'multi-turn' ? messages : undefined
      };
      await onAugment(currentItem, 2);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsAugmenting(false);
    }
  };

  // Multi-turn message controls
  const handleUpdateMessage = (index: number, content: string) => {
    const updated = [...messages];
    updated[index] = { ...updated[index], content };
    setMessages(updated);
  };

  const handleAddTurn = () => {
    const lastRole = messages[messages.length - 1]?.role;
    const nextRole = lastRole === 'user' ? 'assistant' : 'user';
    setMessages([
      ...messages,
      { id: `turn-${Date.now()}`, role: nextRole, content: '' }
    ]);
  };

  const handleRemoveTurn = (index: number) => {
    setMessages(messages.filter((_, idx) => idx !== index));
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 rounded-t-2xl">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100 font-sans">SFT Item Curation & Refinement</h2>
              <p className="text-[10px] text-slate-500">Edit elements or trigger semantic quality checks</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Workspace body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* Main Editors (7 Cols) */}
          <div className="md:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center space-x-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800/60">
                <button
                  onClick={() => setWorkTab('edit')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                    workTab === 'edit'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Edit Raw Text
                </button>
                <button
                  onClick={() => setWorkTab('preview')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                    workTab === 'preview'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Rich Markdown Preview
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500">Status:</span>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className={`text-xs px-2 py-0.5 rounded border focus:outline-none ${
                    status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                    status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  <option value="pending" className="bg-slate-900 text-slate-200">Pending</option>
                  <option value="approved" className="bg-slate-900 text-slate-200">Approved</option>
                  <option value="rejected" className="bg-slate-900 text-slate-200">Rejected</option>
                </select>
              </div>
            </div>

            {workTab === 'edit' ? (
              <div className="space-y-4">
                {project.templateType === 'single-turn' && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1">User Prompt / Input</label>
                      <textarea
                        rows={4}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1">Target Response / Output</label>
                      <textarea
                        rows={7}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-sans leading-relaxed"
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {project.templateType === 'reasoning-cot' && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1">User Prompt / Input</label>
                      <textarea
                        rows={3}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1">Reasoning Thought (Chain-of-Thought)</label>
                      <textarea
                        rows={5}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                        value={thought}
                        onChange={(e) => setThought(e.target.value)}
                        placeholder="Step-by-step thinking process..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1">Target Response / Output</label>
                      <textarea
                        rows={6}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-sans leading-relaxed"
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {project.templateType === 'system-prompt' && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1">System Prompt Context</label>
                      <textarea
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1">User Input / Query</label>
                      <textarea
                        rows={3}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1">Pristine Output Response</label>
                      <textarea
                        rows={6}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-sans leading-relaxed"
                        value={output}
                        onChange={(e) => setOutput(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {project.templateType === 'multi-turn' && (
                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                    {messages.map((msg, index) => (
                      <div key={index} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 relative group">
                        <div className="flex items-center justify-between mb-1.5 border-b border-slate-900 pb-1">
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                            msg.role === 'system' ? 'bg-indigo-500/10 text-indigo-400' :
                            msg.role === 'user' ? 'bg-blue-500/10 text-blue-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>
                            {msg.role}
                          </span>
                          {messages.length > 2 && (
                            <button
                              onClick={() => handleRemoveTurn(index)}
                              className="text-slate-500 hover:text-red-400 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={2}
                          className="w-full bg-transparent border-0 text-xs text-slate-300 focus:outline-none"
                          value={msg.content}
                          onChange={(e) => handleUpdateMessage(index, e.target.value)}
                        />
                      </div>
                    ))}
                    <button
                      onClick={handleAddTurn}
                      className="w-full py-2 border border-dashed border-slate-800 text-slate-500 hover:text-slate-300 rounded-lg text-xs font-medium hover:border-slate-700 transition-all flex items-center justify-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Turn / Message</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {project.templateType === 'single-turn' && (
                  <div className="space-y-4">
                    <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                      <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider block mb-2 border-b border-slate-900 pb-1">User Prompt / Input</span>
                      {prompt.trim() ? <MarkdownRenderer content={prompt} /> : <p className="text-xs text-slate-600 italic">No prompt entered yet.</p>}
                    </div>
                    <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                      <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block mb-2 border-b border-slate-900 pb-1">Target Response / Output</span>
                      {response.trim() ? <MarkdownRenderer content={response} /> : <p className="text-xs text-slate-600 italic">No response entered yet.</p>}
                    </div>
                  </div>
                )}

                {project.templateType === 'reasoning-cot' && (
                  <div className="space-y-4">
                    <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                      <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider block mb-2 border-b border-slate-900 pb-1">User Prompt / Input</span>
                      {prompt.trim() ? <MarkdownRenderer content={prompt} /> : <p className="text-xs text-slate-600 italic">No prompt entered yet.</p>}
                    </div>
                    <div className="bg-amber-500/[0.02] border border-amber-500/20 rounded-xl p-4">
                      <span className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-wider block mb-2 border-b border-amber-500/10 pb-1">Reasoning Thought (Chain-of-Thought)</span>
                      {thought.trim() ? <MarkdownRenderer content={thought} /> : <p className="text-xs text-slate-600 italic">No CoT thought entered yet.</p>}
                    </div>
                    <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                      <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block mb-2 border-b border-slate-900 pb-1">Target Response / Output</span>
                      {response.trim() ? <MarkdownRenderer content={response} /> : <p className="text-xs text-slate-600 italic">No response entered yet.</p>}
                    </div>
                  </div>
                )}

                {project.templateType === 'system-prompt' && (
                  <div className="space-y-4">
                    <div className="bg-indigo-500/[0.02] border border-indigo-500/20 rounded-xl p-4">
                      <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider block mb-2 border-b border-indigo-500/10 pb-1">System Prompt Context</span>
                      {systemPrompt.trim() ? <MarkdownRenderer content={systemPrompt} /> : <p className="text-xs text-slate-600 italic">No system prompt entered yet.</p>}
                    </div>
                    <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                      <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider block mb-2 border-b border-slate-900 pb-1">User Input / Query</span>
                      {userInput.trim() ? <MarkdownRenderer content={userInput} /> : <p className="text-xs text-slate-600 italic">No input entered yet.</p>}
                    </div>
                    <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block mb-2 border-b border-slate-900 pb-1">Pristine Output Response</span>
                      {output.trim() ? <MarkdownRenderer content={output} /> : <p className="text-xs text-slate-600 italic">No output entered yet.</p>}
                    </div>
                  </div>
                )}

                {project.templateType === 'multi-turn' && (
                  <div className="space-y-3">
                    {messages.map((msg, index) => (
                      <div 
                        key={index} 
                        className={`rounded-xl p-4 border ${
                          msg.role === 'system' ? 'bg-indigo-500/5 border-indigo-500/20' :
                          msg.role === 'user' ? 'bg-blue-500/5 border-blue-500/20' :
                          'bg-amber-500/5 border-amber-500/20'
                        }`}
                      >
                        <span className={`text-[10px] font-mono font-bold uppercase block mb-1.5 border-b pb-1 ${
                          msg.role === 'system' ? 'text-indigo-400 border-indigo-500/10' :
                          msg.role === 'user' ? 'text-blue-400 border-blue-500/10' :
                          'text-amber-400 border-amber-500/10'
                        }`}>
                          {msg.role}
                        </span>
                        {msg.content.trim() ? <MarkdownRenderer content={msg.content} /> : <p className="text-xs text-slate-600 italic">Empty turn message.</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1">Tags (comma separated)</label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. trauma, acute, diagnosis"
              />
            </div>
          </div>

          {/* AI Auditor & Critiquer Panel (5 Cols) */}
          <div className="md:col-span-5 bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between space-y-4">
            
            {/* Top Quality audit */}
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-[11px] font-semibold text-amber-500 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Real-Time Quality Auditor</span>
                </span>
                <span className="text-[10px] text-slate-500">Gemini-backed audit</span>
              </div>

              {isAuditing ? (
                <div className="py-12 text-center space-y-3">
                  <Activity className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Auditing syntax, style rules, and persona fidelity...</p>
                </div>
              ) : auditResult ? (
                <div className="space-y-3 text-xs leading-relaxed max-h-[300px] overflow-y-auto pr-1">
                  
                  {/* Score */}
                  <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400">SFT Quality Score:</span>
                    <div className="flex items-center space-x-0.5">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star 
                          key={idx} 
                          className={`w-3.5 h-3.5 ${
                            idx < auditResult.score 
                              ? 'text-amber-400 fill-amber-400' 
                              : 'text-slate-700'
                          }`} 
                        />
                      ))}
                      <span className="text-[11px] font-bold text-slate-200 ml-1">({auditResult.score}/5)</span>
                    </div>
                  </div>

                  {/* Strengths */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-emerald-400 font-bold block">✓ Strengths / Positives:</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-300 text-[11px]">
                      {auditResult.positives?.map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>

                  {/* Weaknesses */}
                  {auditResult.negatives && auditResult.negatives.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-red-400 font-bold block">✗ Critical Issues / Infractions:</span>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-300 text-[11px]">
                        {auditResult.negatives.map((n: string, i: number) => <li key={i}>{n}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Suggestion */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                    <strong className="text-slate-300">Suggestion:</strong> {auditResult.suggestions}
                  </div>

                  {/* Golden Refine action */}
                  {auditResult.refined && (
                    <div className="pt-2 border-t border-slate-800/60">
                      <button
                        onClick={handleApplyRefined}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold py-1.5 rounded text-[11px] transition-all flex items-center justify-center space-x-1"
                      >
                        <Sparkles className="w-3 h-3 text-slate-950" />
                        <span>Apply Golden AI Refactoring</span>
                      </button>
                    </div>
                  )}

                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 space-y-2">
                  <AlertCircle className="w-6 h-6 text-slate-600 mx-auto" />
                  <p className="text-[11px] max-w-xs mx-auto">
                    Evaluate formatting accuracy, prompt clarity, and style guide violations in one click.
                  </p>
                  <button
                    onClick={handleAiAudit}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] transition-colors"
                  >
                    Run Quality Audit
                  </button>
                </div>
              )}
            </div>

            {/* Sibling Augmentation Panel */}
            <div className="pt-3 border-t border-slate-800 space-y-2 shrink-0">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Expand Dataset from here</span>
              <button
                onClick={handleLocalAugment}
                disabled={isAugmenting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
              >
                {isAugmenting ? (
                  <Activity className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                ) : (
                  <PlusSquare className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>Generate 2 Sibling Augmentations</span>
              </button>
            </div>

          </div>

        </div>

        {/* Footer controls */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950 rounded-b-2xl">
          <button
            onClick={() => {
              if (confirm('Delete this example?')) {
                onDelete(example.id);
                onClose();
              }
            }}
            className="text-red-400 hover:text-red-300 px-3 py-2 rounded-lg text-xs font-medium flex items-center space-x-1 hover:bg-slate-900 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Item</span>
          </button>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLocalSave}
              className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 hover:from-amber-600 hover:to-yellow-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
