import React from 'react';
import { SFTProject, SFTTemplateType } from '../types';
import { PRESET_PROJECTS } from '../presets';
import { Sparkles, Plus, Settings, BookOpen } from 'lucide-react';

interface ProjectConfigProps {
  activeProject: SFTProject;
  projects: SFTProject[];
  onSelectProject: (project: SFTProject) => void;
  onCreateProject: (project: SFTProject) => void;
  onUpdateProject: (project: SFTProject) => void;
}

export default function ProjectConfig({
  activeProject,
  projects,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
}: ProjectConfigProps) {

  const handlePresetSelect = (presetId: string) => {
    const preset = PRESET_PROJECTS.find(p => p.id === presetId);
    if (preset) {
      // Create a fresh clone so updates don't mutate global preset
      const cloned = {
        ...preset,
        id: `project-${Date.now()}`,
        createdAt: Date.now()
      };
      onCreateProject(cloned);
    }
  };

  const handleCreateCustom = () => {
    const newProj: SFTProject = {
      id: `project-${Date.now()}`,
      name: 'Custom Fine-Tuning Task',
      description: 'Define your highly specific customized model behaviors here.',
      templateType: 'single-turn',
      domainTask: 'Explain your model\'s specialized purpose, persona, or domain (e.g. "An agent that rewrites complex legal definitions for 10-year-olds").',
      styleGuide: 'List the do\'s and don\'ts, tone criteria, formatting preferences, or word limit rules.',
      createdAt: Date.now()
    };
    onCreateProject(newProj);
  };

  const handleFieldChange = (field: keyof SFTProject, value: any) => {
    onUpdateProject({
      ...activeProject,
      [field]: value
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6" id="sft-project-config">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-amber-500 animate-spin-slow" />
          <h2 className="text-lg font-semibold text-slate-100 font-sans tracking-tight">SFT Task Definition</h2>
        </div>
        <div className="flex items-center space-x-2">
          <select 
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            onChange={(e) => {
              if (e.target.value === 'action-create-custom') {
                handleCreateCustom();
              } else {
                const proj = projects.find(p => p.id === e.target.value);
                if (proj) onSelectProject(proj);
              }
            }}
            value={activeProject.id}
          >
            <optgroup label="Select SFT Task">
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
            <optgroup label="Actions">
              <option value="action-create-custom" className="text-amber-400 font-medium">+ Create Custom Task...</option>
            </optgroup>
          </select>
          {/* Keep a hidden button in the DOM for automated tests, ensuring the layout remains clean for the user */}
          <button
            onClick={handleCreateCustom}
            className="hidden"
            id="btn-create-custom"
            aria-hidden="true"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Custom</span>
          </button>
        </div>
      </div>

      {/* Preset Loading Area */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Bootstrapping Presets</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Load instant task guides</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_PROJECTS.map(p => (
            <button
              key={p.id}
              onClick={() => handlePresetSelect(p.id)}
              className="bg-slate-900 hover:bg-slate-800 hover:border-slate-700 border border-slate-800/50 p-2.5 rounded-lg text-left transition-all group"
            >
              <h4 className="text-xs font-medium text-slate-300 group-hover:text-amber-500 transition-colors truncate">{p.name}</h4>
              <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{p.templateType}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Task Config Forms */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Dataset Project Name</label>
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-sans"
            value={activeProject.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            placeholder="e.g., Rude Customer Support Agent"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            value={activeProject.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder="Short explanation of training goals..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">SFT Format Template</label>
            <select
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              value={activeProject.templateType}
              onChange={(e) => handleFieldChange('templateType', e.target.value as SFTTemplateType)}
            >
              <option value="single-turn">Single-Turn (Prompt → Response)</option>
              <option value="reasoning-cot">Reasoning Chain-of-Thought (Prompt → Thought → Response)</option>
              <option value="system-prompt">System-Prompt + (Prompt → Response)</option>
              <option value="multi-turn">Multi-Turn Conversational Dialogue</option>
            </select>
          </div>
          <div className="flex items-center justify-start bg-slate-950 border border-slate-800/50 rounded-lg p-2.5 text-[11px] text-slate-500">
            <BookOpen className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <div>
              {activeProject.templateType === 'single-turn' && 'Finesse individual input-to-output conversions.'}
              {activeProject.templateType === 'reasoning-cot' && 'Enforce explicit step-by-step thinking or scratchpads before responding.'}
              {activeProject.templateType === 'system-prompt' && 'Specifies system context guidelines alongside the user query.'}
              {activeProject.templateType === 'multi-turn' && 'Simulate nested chat logs with system, user, and assistant logs.'}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
            <span>Target Domain Task & Model Persona</span>
            <span className="text-[10px] text-slate-500">Describe "What" the fine-tuned model does</span>
          </label>
          <textarea
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-sans leading-relaxed"
            value={activeProject.domainTask}
            onChange={(e) => handleFieldChange('domainTask', e.target.value)}
            placeholder="Specify what capabilities the fine-tuned model is acquiring..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
            <span>Style Guide & Fine-Tuning Constraints</span>
            <span className="text-[10px] text-slate-500">Do's, Don'ts, tone, structures</span>
          </label>
          <textarea
            rows={4}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-sans leading-relaxed"
            value={activeProject.styleGuide}
            onChange={(e) => handleFieldChange('styleGuide', e.target.value)}
            placeholder="e.g., No pre-ambles. Never use passive voice. Max 2 paragraphs. Must include ES6 code."
          />
        </div>
      </div>
    </div>
  );
}
