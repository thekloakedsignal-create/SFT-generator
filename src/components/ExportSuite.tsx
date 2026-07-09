import React, { useRef, useState } from 'react';
import { SFTProject, SFTExample } from '../types';
import { 
  Download, 
  Upload, 
  FileJson, 
  FileCode, 
  Database, 
  Sparkles, 
  Layers,
  ChevronDown,
  Info
} from 'lucide-react';

interface ExportSuiteProps {
  project: SFTProject;
  examples: SFTExample[];
  onImportWorkspace: (project: SFTProject, examples: SFTExample[]) => void;
}

export default function ExportSuite({
  project,
  examples,
  onImportWorkspace,
}: ExportSuiteProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportFormat, setExportFormat] = useState<'jsonl' | 'alpaca' | 'sharegpt' | 'raw_json'>('jsonl');

  const approvedOnlyCount = examples.filter(e => e.status === 'approved').length;

  const handleExport = () => {
    let dataToExport: any[] = [];
    const itemsToProcess = examples.filter(e => e.status === 'approved' || e.status === 'pending');

    if (itemsToProcess.length === 0) {
      alert('You have no dataset examples to export. Try synthesizing a few first!');
      return;
    }

    if (exportFormat === 'alpaca') {
      // Alpaca Format: instruction, input, output
      dataToExport = itemsToProcess.map(ex => {
        if (project.templateType === 'single-turn') {
          return {
            instruction: project.domainTask,
            input: ex.prompt || '',
            output: ex.response || ''
          };
        } else if (project.templateType === 'reasoning-cot') {
          return {
            instruction: project.domainTask,
            input: ex.prompt || '',
            output: ex.thought ? `<thought>\n${ex.thought}\n</thought>\n\n${ex.response || ''}` : (ex.response || '')
          };
        } else if (project.templateType === 'system-prompt') {
          return {
            instruction: ex.systemPrompt || project.domainTask,
            input: ex.userInput || '',
            output: ex.output || ''
          };
        } else {
          // Multi-turn
          const promptMsg = ex.messages?.find(m => m.role === 'user')?.content || '';
          const responseMsg = ex.messages?.find(m => m.role === 'assistant')?.content || '';
          return {
            instruction: project.domainTask,
            input: promptMsg,
            output: responseMsg
          };
        }
      });
    } else if (exportFormat === 'sharegpt') {
      // ShareGPT format: conversations array
      dataToExport = itemsToProcess.map(ex => {
        let conversations: Array<{ from: 'human' | 'gpt' | 'system'; value: string }> = [];
        
        if (project.templateType === 'single-turn') {
          conversations = [
            { from: 'human', value: ex.prompt || '' },
            { from: 'gpt', value: ex.response || '' }
          ];
        } else if (project.templateType === 'reasoning-cot') {
          conversations = [
            { from: 'human', value: ex.prompt || '' },
            { from: 'gpt', value: ex.thought ? `<thought>\n${ex.thought}\n</thought>\n\n${ex.response || ''}` : (ex.response || '') }
          ];
        } else if (project.templateType === 'system-prompt') {
          conversations = [
            { from: 'system', value: ex.systemPrompt || '' },
            { from: 'human', value: ex.userInput || '' },
            { from: 'gpt', value: ex.output || '' }
          ];
        } else {
          conversations = (ex.messages || []).map(m => ({
            from: m.role === 'user' ? 'human' as const : m.role === 'assistant' ? 'gpt' as const : 'system' as const,
            value: m.content
          }));
        }

        return {
          id: ex.id,
          conversations
        };
      });
    } else if (exportFormat === 'jsonl') {
      // Llama / OpenAI JSONL format {"messages": [{"role": "system", "content": "..."}, ...]}
      dataToExport = itemsToProcess.map(ex => {
        if (project.templateType === 'single-turn') {
          return {
            messages: [
              { role: 'system', content: project.domainTask },
              { role: 'user', content: ex.prompt || '' },
              { role: 'assistant', content: ex.response || '' }
            ]
          };
        } else if (project.templateType === 'reasoning-cot') {
          return {
            messages: [
              { role: 'system', content: project.domainTask },
              { role: 'user', content: ex.prompt || '' },
              { role: 'assistant', content: ex.thought ? `<thought>\n${ex.thought}\n</thought>\n\n${ex.response || ''}` : (ex.response || '') }
            ]
          };
        } else if (project.templateType === 'system-prompt') {
          return {
            messages: [
              { role: 'system', content: ex.systemPrompt || project.domainTask },
              { role: 'user', content: ex.userInput || '' },
              { role: 'assistant', content: ex.output || '' }
            ]
          };
        } else {
          return {
            messages: (ex.messages || []).map(m => ({
              role: m.role,
              content: m.content
            }))
          };
        }
      });
    } else {
      // Raw workspace JSON format
      dataToExport = itemsToProcess;
    }

    // Trigger File Download
    let fileContent = '';
    let filename = `${project.name.toLowerCase().replace(/\s+/g, '_')}_dataset`;
    let mimeType = 'application/json';

    if (exportFormat === 'jsonl') {
      fileContent = dataToExport.map(item => JSON.stringify(item)).join('\n');
      filename += '.jsonl';
      mimeType = 'application/x-jsonlines';
    } else {
      fileContent = JSON.stringify(dataToExport, null, 2);
      filename += '.json';
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (parsed.id && parsed.name && parsed.templateType) {
          // This is a single workspace backup format
          const importedProj: SFTProject = {
            id: parsed.id,
            name: parsed.name,
            description: parsed.description || '',
            templateType: parsed.templateType,
            domainTask: parsed.domainTask || '',
            styleGuide: parsed.styleGuide || '',
            createdAt: parsed.createdAt || Date.now()
          };
          const importedEx: SFTExample[] = (parsed.examples || []).map((ex: any) => ({
            ...ex,
            projectId: importedProj.id
          }));

          onImportWorkspace(importedProj, importedEx);
          alert(`Workspace "${importedProj.name}" with ${importedEx.length} examples imported successfully!`);
        } else {
          alert('Incorrect format. Please upload a valid exported workspace JSON file containing "id" and "name" properties.');
        }
      } catch (err) {
        console.error(err);
        alert('Failed to parse uploaded backup JSON. Make sure it is valid JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4" id="sft-exporter-suite">
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <Layers className="w-5 h-5 text-amber-500" />
        <h2 className="text-md font-semibold text-slate-100 font-sans">Deployment & Export Suite</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Export Column */}
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/60 flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-300 flex items-center space-x-1">
              <Download className="w-3.5 h-3.5 text-amber-500" />
              <span>curated Dataset Exporter</span>
            </h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Download the curated examples as model-ready fine-tuning datasets matching target standard formats.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Export Format:</span>
              <span className="font-mono text-slate-300">{approvedOnlyCount} approved items</span>
            </div>
            <select
              value={exportFormat}
              onChange={(e: any) => setExportFormat(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none"
            >
              <option value="jsonl">Llama / OpenAI Chat (JSONL)</option>
              <option value="alpaca">Stanford Alpaca (JSON)</option>
              <option value="sharegpt">ShareGPT Dialects (JSON)</option>
              <option value="raw_json">Raw Workspace state (JSON)</option>
            </select>

            <button
              onClick={handleExport}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center space-x-1"
            >
              <Download className="w-3.5 h-3.5 text-slate-950" />
              <span>Download SFT File</span>
            </button>
          </div>
        </div>

        {/* Workspace Backup Column */}
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/60 flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-300 flex items-center space-x-1">
              <Upload className="w-3.5 h-3.5 text-amber-500" />
              <span>Workspace Restore</span>
            </h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Upload an existing workspace configuration backup JSON to resume active curation.
            </p>
          </div>

          <div className="space-y-2.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              className="hidden"
              accept=".json"
            />
            
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 flex items-start text-[10px] text-slate-500">
              <Info className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0 mt-0.5" />
              <span>Workspace restore expects a JSON output containing domain specifications, style guides, and seed rules.</span>
            </div>

            <button
              onClick={handleImportClick}
              className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center space-x-1"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>Upload Backup JSON</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
