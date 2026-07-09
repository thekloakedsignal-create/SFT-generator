import React, { useState } from 'react';
import { Sparkles, Loader2, ArrowRight, Compass, ShieldAlert, Cpu } from 'lucide-react';
import { SFTProject } from '../types';

interface BatchGeneratorProps {
  activeProject: SFTProject;
  existingExamplesCount: number;
  existingExamplesSummary: string;
  onSynthesize: (params: {
    count: number;
    diversityFocus: string;
    customGuidelines: string;
    systemPrompt: string;
    modelName: string;
    category: string;
  }) => Promise<void>;
  isGenerating: boolean;
}

const DIVERSITY_PRESETS = [
  { label: 'Standard Mix', value: '', icon: Compass, desc: 'Even, standard SFT distributions' },
  { label: 'Edge Cases & Errors', value: 'Focus on rare scenarios, ambiguous user queries, grammatical errors, or highly specific niche edge-cases of the domain.', icon: ShieldAlert, desc: 'Noisy, weird, or tricky prompts' },
  { label: 'Complexity Boost', value: 'Synthesize highly advanced, multi-step, intellectually challenging prompts that push the reasoning limits of the task.', icon: Sparkles, desc: 'Hard, nested, reasoning problems' },
];

const LOADING_MESSAGES = [
  'Analyzing dataset guidelines...',
  'Sifting through existing seed examples for formatting compliance...',
  'Drafting unique prompt concepts and diverse scenarios...',
  'Synthesizing gold-standard expert responses...',
  'Refining language alignment and enforcing style rules...',
  'Wrapping structured JSON payload and validating syntax...',
];

export default function BatchGenerator({
  activeProject,
  existingExamplesCount,
  existingExamplesSummary,
  onSynthesize,
  isGenerating,
}: BatchGeneratorProps) {
  const [count, setCount] = useState<number>(5);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customFocus, setCustomFocus] = useState<string>('');
  const [customGuidelines, setCustomGuidelines] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [modelName, setModelName] = useState<string>('kimi-k2.6');
  const [category, setCategory] = useState<string>('General');
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // Cycle loading messages when generating
  React.useEffect(() => {
    let interval: any;
    if (isGenerating) {
      setLoadingMsgIdx(0);
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async () => {
    const focus = selectedPreset ? selectedPreset : customFocus;
    await onSynthesize({
      count,
      diversityFocus: focus,
      customGuidelines,
      systemPrompt,
      modelName,
      category: category.trim() || 'General',
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5" id="sft-batch-generator">
      <div className="flex items-center space-x-2">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-semibold text-slate-100 font-sans tracking-tight">Batch Synthesizer</h2>
      </div>

      {isGenerating ? (
        <div className="bg-slate-950/80 rounded-xl p-8 border border-slate-800 text-center space-y-4">
          <div className="relative inline-flex">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            <Sparkles className="w-4 h-4 text-amber-400 absolute top-0 right-0 animate-pulse" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-200">Generating {count} SFT Examples</p>
            <p className="text-xs text-slate-400 font-mono italic animate-pulse transition-all">
              "{LOADING_MESSAGES[loadingMsgIdx]}"
            </p>
          </div>
          <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden max-w-xs mx-auto">
            <div className="bg-amber-500 h-full rounded-full animate-progress" />
          </div>
          <p className="text-[10px] text-slate-500">
            This utilizes Gemini's high-fidelity schema reasoning to enforce your rules.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top Line parameters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Batch Count</label>
              <select
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                <option value={3}>3 Examples</option>
                <option value={5}>5 Examples (Recommended)</option>
                <option value={10}>10 Examples</option>
                <option value={15}>15 Examples (Heavier)</option>
                <option value={25}>25 Examples (Chunked Run)</option>
                <option value={50}>50 Examples (Chunked Run)</option>
                <option value={100}>100 Examples (Large Dataset Run)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center space-x-1">
                <Cpu className="w-3 h-3 text-amber-500" />
                <span>Synthesis Model</span>
              </label>
              <select
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
              >
                <option value="kimi-k2.6">kimi-k2.6 (Default)</option>
                <option value="deepseek-v4-flash">deepseek-v4-flash</option>
                <option value="deepseek-v4-pro">deepseek-v4-pro</option>
                <option value="glm-5-2">glm-5-2</option>
                <option value="nemotron-3-nano-omni">nemotron-3-nano-omni</option>
                <option value="nvidia-nemotron-3-super-120b">nvidia-nemotron-3-super-120b (Public Preview)</option>
                <option value="stable-diffusion-3-5-large">stable-diffusion-3-5-large</option>
              </select>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg text-[11px] text-amber-400 leading-normal">
            * All dataset generations are processed securely using DigitalOcean serverless GPU resources.
          </div>

          {/* Batch Category */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex justify-between">
              <span>Batch Category / Label</span>
              <span className="text-[10px] text-slate-500">e.g., "SQL queries"</span>
            </label>
            <input
              type="text"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Give this batch a category/label..."
            />
          </div>

          {/* Diversity presets */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400">Diversity Focus Presets</label>
            <div className="grid grid-cols-3 gap-2">
              {DIVERSITY_PRESETS.map((preset, idx) => {
                const Icon = preset.icon;
                const isSelected = selectedPreset === preset.value;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(preset.value);
                      if (preset.value !== '') setCustomFocus('');
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 border rounded-lg text-center transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                        : 'bg-slate-950 border-slate-800/80 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-medium block truncate w-full">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom diversity focus */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex justify-between">
              <span>Or Custom Topic/Sub-Focus</span>
              <span className="text-[10px] text-slate-500">e.g., "focus on SQL JOIN syntax"</span>
            </label>
            <input
              type="text"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
              value={customFocus}
              onChange={(e) => {
                setCustomFocus(e.target.value);
                setSelectedPreset('');
              }}
              placeholder="Inject a custom topical tilt for this batch..."
              disabled={selectedPreset !== ''}
            />
          </div>

          {/* System Prompt instructions */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex justify-between">
              <span>System Prompt</span>
              <span className="text-[10px] text-slate-500">(Optional)</span>
            </label>
            <textarea
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-sans"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Define the behavior/persona for the assistant..."
              rows={3}
            />
          </div>

          {/* Additional Generation instructions */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex justify-between">
              <span>Temporary Constraints for this batch</span>
              <span className="text-[10px] text-slate-500">(Optional)</span>
            </label>
            <input
              type="text"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
              value={customGuidelines}
              onChange={(e) => setCustomGuidelines(e.target.value)}
              placeholder="e.g. Include bad grammar in prompts, write responses under 50 words"
            />
          </div>

          {/* Current footprint tracker */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/40 flex justify-between items-center text-xs text-slate-400">
            <span>Workspace Size:</span>
            <span className="font-mono text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-semibold">
              {existingExamplesCount} items
            </span>
          </div>

          {/* Action button */}
          <button
            onClick={handleGenerate}
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-semibold py-2.5 px-4 rounded-lg shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 text-sm"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>Generate SFT Batch</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
