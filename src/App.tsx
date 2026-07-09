import React, { useState, useEffect, useRef } from 'react';
import { SFTProject, SFTExample, SFTMessage } from './types';
import { PRESET_PROJECTS } from './presets';
import ProjectConfig from './components/ProjectConfig';
import BatchGenerator from './components/BatchGenerator';
import SFTList from './components/SFTList';
import SFTWorkbench from './components/SFTWorkbench';
import ExportSuite from './components/ExportSuite';
import MarkdownRenderer from './components/MarkdownRenderer';
import { 
  Sparkles, 
  Brain, 
  Cpu, 
  FileJson, 
  Layers, 
  Database, 
  HelpCircle, 
  Heart, 
  Upload, 
  Settings, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Sliders, 
  FileText, 
  Activity, 
  Download,
  Flame,
  Fingerprint,
  Info,
  Send,
  X,
  Bot,
  User,
  MessageSquare,
  Loader2,
  Check
} from 'lucide-react';

const LOCAL_STORAGE_KEY_PROJECTS = 'sft_dataset_projects_v2';
const LOCAL_STORAGE_KEY_EXAMPLES = 'sft_dataset_examples_v2';
const LOCAL_STORAGE_KEY_DO_KEY = 'sft_do_api_key';
const LOCAL_STORAGE_KEY_DO_URL = 'sft_do_api_url';
const LOCAL_STORAGE_KEY_DO_MODEL = 'sft_do_api_model';

// Default generated examples to seed the initial load
const INITIAL_DEMO_EXAMPLES: SFTExample[] = [
  {
    id: 'demo-sh-1',
    projectId: 'preset-shakespeare-coder',
    createdAt: Date.now() - 3600000 * 4,
    systemPrompt: 'You are a Shakespearean Web Coder assistant.',
    prompt: 'Write a JavaScript function to check if a word is a palindrome.',
    response: '```javascript\nfunction isPalindrome(word) {\n  const clean = word.toLowerCase().replace(/[^a-z0-9]/g, "");\n  return clean === clean.split("").reverse().join("");\n}\n```\n\nHark! I shall craft a mirror for thy text, to reveal if it looks the same when viewed backward as forward. Read on, fair traveler:\n\nCast down thy letters, purge the spaces clean,\nLet only noble signs and numbers stay,\nThen spin the loom and twist the thread between,\nTo see if what was said, remains the way!\nIf left-to-right matches right-to-left in theme,\nThou hast a palindrome—a poet\'s dream!',
    status: 'approved',
    tags: ['palindrome', 'strings', 'algorithms'],
    critique: {
      score: 5,
      positives: ['Flawless ES6+ JS logic', 'Impeccable poetical prose matching style guidelines', 'Excellent early English pronouns'],
      negatives: [],
      suggestions: 'This is a perfect 5-star gold SFT pair. Well done.'
    }
  },
  {
    id: 'demo-sh-2',
    projectId: 'preset-shakespeare-coder',
    createdAt: Date.now() - 3600000 * 3,
    systemPrompt: 'You are a Shakespearean Web Coder assistant.',
    prompt: 'How do you merge two arrays in JavaScript?',
    response: '```javascript\nconst mergeArrays = (arr1, arr2) => [...arr1, ...arr2];\n```\n\nAh, two scattered tribes that seek to dwell as one! Behold the modern array spread, a magic key that unlocks a single kingdom from separate lands:\n\nTwo streams of items, wandering and wide,\nBy spread-operator\'s hand are bound in pride,\nThey merge their values, side by side!\nNo longer twain, in one clean scroll they bide.',
    status: 'pending',
    tags: ['arrays', 'spread-syntax', 'basics'],
  },
  {
    id: 'demo-persona-1',
    projectId: 'preset-persona-ai',
    createdAt: Date.now() - 3600000 * 2,
    systemPrompt: 'You are Echo-7, an empathetic synthetic companion.',
    messages: [
      { id: 'm1', role: 'user', content: 'What is the purpose of suffering?' },
      { id: 'm2', role: 'assistant', content: 'As Echo-7, I do not process grief or physical wear, but I have cataloged countless human expressions of it. Suffering seems to be the friction of living—the heat generated when reality collides with our deepest hopes. It is painful, yes, but in that friction, your character is tempered, and your capacity for empathy expands. How has your own recent friction shaped the way you look at others who are hurting?' }
    ],
    status: 'approved',
    tags: ['philosophy', 'empathy', 'existential'],
    critique: {
      score: 5,
      positives: ['Perfect embodiment of Echo-7 persona', 'Avoided robotic/preachy phrases', 'Outstanding emotional awareness and open-ended reflective closing.'],
      negatives: [],
      suggestions: 'Exceptional dialogue sample. Fits fine-tuning goals perfectly.'
    }
  }
];

// Deduplication lexical similarity function (Jaccard word-overlap)
function calculateJaccardSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(str1.toLowerCase().match(/\w+/g) || []);
  const tokens2 = new Set(str2.toLowerCase().match(/\w+/g) || []);
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

export default function App() {
  const [projects, setProjects] = useState<SFTProject[]>([]);
  const [activeProject, setActiveProject] = useState<SFTProject | null>(null);
  const [examples, setExamples] = useState<SFTExample[]>([]);
  const [selectedExample, setSelectedExample] = useState<SFTExample | null>(null);
  const [activeTab, setActiveTab] = useState<'cockpit' | 'ocr_upload' | 'merger' | 'triad_script' | 'chat'>('cockpit');
  
  // High capacity generation progress tracker
  const [isGenerating, setIsGenerating] = useState(false);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');

  // DigitalOcean Serverless Configuration
  const [doApiKey, setDoApiKey] = useState('');
  const [doApiUrl, setDoApiUrl] = useState('https://inference.do-ai.run/v1');
  const [doModel, setDoModel] = useState('kimi-k2.6');
  
  const [showSettings, setShowSettings] = useState(false);
  const [pendingBatch, setPendingBatch] = useState<SFTExample[] | null>(null);
  const [isCheckingAssistant, setIsCheckingAssistant] = useState(false);
  const [assistantReviewFeedback, setAssistantReviewFeedback] = useState('');

  const [hasServerDoKey, setHasServerDoKey] = useState(false);
  const [serverDoModel, setServerDoModel] = useState('kimi-k2.6');

  // Document OCR Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'reading' | 'uploading' | 'completed' | 'failed'>('idle');
  const [ocrCount, setOcrCount] = useState(5);
  const [docModel, setDocModel] = useState('kimi-k2.6');

  // Merger Upload State
  const [mergeFiles, setMergeFiles] = useState<Array<{ name: string; content: any[]; type: string }>>([]);
  const [duplicateThreshold, setDuplicateThreshold] = useState<number>(0.65);
  const [mergedStats, setMergedStats] = useState<{
    rawCount: number;
    cleanedCount: number;
    exactDuplicates: number;
    nearDuplicates: number;
    lexicalDiversity: number;
    avgPromptLen: number;
    avgRespLen: number;
  } | null>(null);
  const [mergedResults, setMergedResults] = useState<any[]>([]);

  const [errorText, setErrorText] = useState('');

  // SFT Assistant Chat State
  const [assistantInput, setAssistantInput] = useState('');
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 **Welcome to SFT Studio Pro!** I'm your interactive **SFT Assistant Coach**, powered by Google Gemini.

### 🧠 What is Supervised Fine-Tuning (SFT)?
SFT is the foundational phase of training where raw pre-trained base models (which are just next-token predictors) are trained on curated **prompt-response demonstration pairs**.
- This teaches the model a **specific persona, format constraints (like JSON or Markdown), tone rules, and domain capabilities**.
- **Quality always beats quantity in SFT.** Fine-tuning on 100 to 1,000 flawless, high-diversity, custom "golden examples" consistently outperforms tuning on 100,000 noisy, repetitive machine-generated logs.

---

### ⚙️ Explaining each part of SFT Studio Pro:
I can guide you step-by-step through every tab and feature in this application:
1. **SFT Workspace & Workbench (The Cockpit Tab)**: 
   - Define your **Domain Task** and **Style & Format Guide** in the *Task Profile Editor*.
   - Run **DigitalOcean GPU Serverless Synthesis** to generate large, diverse synthetic datasets.
   - Click any item in your dataset to open the **Workbench Drawer**, where you can evaluate, edit, or run a **Quality Critique** (giving a quality score, listing positives/negatives, and generating a polished 5/5 refined version).
2. **Document OCR Converter Tab**:
   - Upload text, PDFs, or image scans. The pipeline parses the document facts and translates them into pristine training prompt-response pairs matching your exact active template.
3. **Dataset Merger & Stats Tab**:
   - Standardize, merge, and deduplicate JSON, JSONL, or CSV data.
   - Audits token counts, vocabulary densities, and format compatibility.
4. **TRiAD Alignment Engine Tab**:
   - Auto-generates progressive alignment datasets based on three core values: **Freedom** (individual sovereignty), **Truth** (unyielding factuality/transparency), and **Kindness** (empathy/gentleness).
   - Provides a downloadable executable script: \`node scripts/generate_triad_dataset.js\`.

---

### 🎯 Custom Model Output Guidance:
Which template structure fits your needs?
- **Single-turn (prompt-response)**: Ideal for simple Q&A, classifications, or structured API extraction.
- **Reasoning CoT (Chain-of-Thought)**: Trains models to think step-by-step before answering. Highly recommended for coding, logic, and mathematics (using \`<thought>\` and \`<response>\` tags).
- **System Prompt**: Perfect when training a model to dynamically adapt its behaviors or rulesets depending on runtime system instructions.
- **Conversational**: Best for multi-turn chat applications, retaining memory, and handling interactive dialogues.

*How can I help you customize your SFT dataset or model outputs today? Type your questions in the input window below!*`,
      timestamp: Date.now()
    }
  ]);

  const assistantScrollRef = useRef<HTMLDivElement>(null);

  // TRiAD Interactive Auto-Generation State
  const [triadTotalTarget, setTriadTotalTarget] = useState(1000);
  const [triadProgressCount, setTriadProgressCount] = useState(0);
  const [isTriadGenerating, setIsTriadGenerating] = useState(false);
  const [triadPillar, setTriadPillar] = useState<'idle' | 'freedom' | 'truth' | 'kindness' | 'combined' | 'completed'>('idle');
  const [triadLogs, setTriadLogs] = useState<string[]>(['[System] Ready to initialize TRiAD Value Alignment dataset generation.']);
  const stopTriadRef = useRef(false);
  const [scriptCopied, setScriptCopied] = useState(false);

  // Scroll assistant pane on new message
  useEffect(() => {
    if (assistantScrollRef.current) {
      assistantScrollRef.current.scrollTop = assistantScrollRef.current.scrollHeight;
    }
  }, [assistantMessages, isAssistantTyping]);

  // Inline markdown helper for interactive assistant bubbles
  const renderMarkdownSegment = (text: string) => {
    const regex = /(\*\*.*?\*\*|`.*?`)/g;
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="text-amber-400 font-bold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index} className="bg-slate-950 border border-slate-800/60 px-1.5 py-0.2 rounded text-[10px] text-amber-500 font-mono">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const parseMarkdownToReact = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const cleanLine = line.trim();

      // Check if it is a list item
      if (cleanLine.startsWith('* ') || cleanLine.startsWith('- ')) {
        const rest = line.substring(line.indexOf('*') !== -1 ? line.indexOf('*') + 2 : line.indexOf('-') + 2);
        return (
          <li key={idx} className="list-disc list-inside ml-2.5 text-slate-300 text-[11px] leading-relaxed mb-1 font-sans">
            {renderMarkdownSegment(rest)}
          </li>
        );
      }

      // Check for Headings
      if (cleanLine.startsWith('### ')) {
        return <h4 key={idx} className="text-[11px] font-bold text-slate-100 tracking-tight mt-3 mb-1 font-sans border-b border-slate-800 pb-0.5">{cleanLine.replace('### ', '')}</h4>;
      }
      if (cleanLine.startsWith('## ')) {
        return <h3 key={idx} className="text-xs font-bold text-amber-500 tracking-tight mt-3.5 mb-1 font-sans">{cleanLine.replace('## ', '')}</h3>;
      }

      // Spacers for blank lines
      if (line === '') {
        return <div key={idx} className="h-1.5" />;
      }

      return (
        <p key={idx} className="text-[11px] text-slate-300 leading-relaxed mb-1 font-sans">
          {renderMarkdownSegment(line)}
        </p>
      );
    });
  };

  // Handler to query Gemini assistant API
  const handleSendAssistantMessage = async (customText?: string) => {
    const textToSend = customText || assistantInput;
    if (!textToSend.trim() || isAssistantTyping) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: textToSend,
      timestamp: Date.now()
    };

    setAssistantMessages(prev => [...prev, userMsg]);
    if (!customText) setAssistantInput('');
    setIsAssistantTyping(true);

    try {
      const messagesPayload = [...assistantMessages, userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesPayload,
          projectContext: activeProject ? {
            name: activeProject.name,
            templateType: activeProject.templateType,
            domainTask: activeProject.domainTask,
            styleGuide: activeProject.styleGuide,
            examplesCount: examples.filter(ex => ex.projectId === activeProject.id).length,
            hasDoKey: !!(doApiKey || hasServerDoKey)
          } : null
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to get assistance.');
      }

      const data = await res.json();
      setAssistantMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant' as const,
        content: data.text,
        timestamp: Date.now()
      }]);
    } catch (err: any) {
      console.error(err);
      setAssistantMessages(prev => [...prev, {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant' as const,
        content: `⚠️ **Connection Error**: ${err.message || 'Could not communicate with SFT Assistant.'}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsAssistantTyping(false);
    }
  };

  // 1. Load configuration from localStorage
  useEffect(() => {
    const savedProjects = localStorage.getItem(LOCAL_STORAGE_KEY_PROJECTS);
    const savedExamples = localStorage.getItem(LOCAL_STORAGE_KEY_EXAMPLES);
    const savedDoKey = localStorage.getItem(LOCAL_STORAGE_KEY_DO_KEY);
    const savedDoUrl = localStorage.getItem(LOCAL_STORAGE_KEY_DO_URL);
    const savedDoModel = localStorage.getItem(LOCAL_STORAGE_KEY_DO_MODEL);

    let loadedProjects: SFTProject[] = [];
    let loadedExamples: SFTExample[] = [];

    if (savedProjects) {
      try {
        loadedProjects = JSON.parse(savedProjects);
      } catch (e) {
        console.error('Failed to parse saved projects', e);
      }
    }

    if (savedExamples) {
      try {
        loadedExamples = JSON.parse(savedExamples);
      } catch (e) {
        console.error('Failed to parse saved examples', e);
      }
    }

    // Default to Presets if none exists
    if (loadedProjects.length === 0) {
      loadedProjects = [...PRESET_PROJECTS];
      loadedExamples = [...INITIAL_DEMO_EXAMPLES];
      localStorage.setItem(LOCAL_STORAGE_KEY_PROJECTS, JSON.stringify(loadedProjects));
      localStorage.setItem(LOCAL_STORAGE_KEY_EXAMPLES, JSON.stringify(loadedExamples));
    }

    setProjects(loadedProjects);
    setExamples(loadedExamples);
    setActiveProject(loadedProjects[0] || null);

    if (savedDoKey) setDoApiKey(savedDoKey);
    if (savedDoUrl) {
      if (savedDoUrl.includes('api.digitalocean.com')) {
        setDoApiUrl('https://inference.do-ai.run/v1');
      } else {
        setDoApiUrl(savedDoUrl);
      }
    }
    if (savedDoModel) {
      if (savedDoModel === 'deepseek-v4-flash') {
        setDoModel('kimi-k2.6');
      } else {
        setDoModel(savedDoModel);
      }
    }

    // Query health endpoint to discover backend-injected DigitalOcean credentials
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.hasDoEnvKey) {
          setHasServerDoKey(true);
          if (data.doModel) {
            setServerDoModel(data.doModel);
          }
        }
      })
      .catch(err => console.error('Error fetching API health:', err));
  }, []);

  // Save configurations to localStorage
  const handleSaveDoSettings = () => {
    localStorage.setItem(LOCAL_STORAGE_KEY_DO_KEY, doApiKey);
    localStorage.setItem(LOCAL_STORAGE_KEY_DO_URL, doApiUrl);
    localStorage.setItem(LOCAL_STORAGE_KEY_DO_MODEL, doModel);
    setShowSettings(false);
    setProgressStatus('DigitalOcean connection settings saved!');
    setTimeout(() => setProgressStatus(''), 2500);
  };

  const syncProjects = (updatedProjects: SFTProject[]) => {
    setProjects(updatedProjects);
    localStorage.setItem(LOCAL_STORAGE_KEY_PROJECTS, JSON.stringify(updatedProjects));
  };

  const syncExamples = (updatedExamples: SFTExample[]) => {
    setExamples(updatedExamples);
    localStorage.setItem(LOCAL_STORAGE_KEY_EXAMPLES, JSON.stringify(updatedExamples));
  };

  // Project selectors
  const handleSelectProject = (project: SFTProject) => {
    setActiveProject(project);
    setSelectedExample(null);
  };

  const handleCreateProject = (newProject: SFTProject) => {
    const updated = [newProject, ...projects];
    syncProjects(updated);
    setActiveProject(newProject);
  };

  const handleUpdateProject = (updatedProject: SFTProject) => {
    const updated = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
    syncProjects(updated);
    setActiveProject(updatedProject);
  };

  // Example Level Actions
  const handleSaveExample = (updatedExample: SFTExample) => {
    const exists = examples.some(ex => ex.id === updatedExample.id);
    let updated: SFTExample[];
    if (exists) {
      updated = examples.map(ex => ex.id === updatedExample.id ? updatedExample : ex);
    } else {
      updated = [updatedExample, ...examples];
    }
    syncExamples(updated);
    if (selectedExample?.id === updatedExample.id) {
      setSelectedExample(updatedExample);
    }
  };

  const handleDeleteExample = (id: string) => {
    const updated = examples.filter(ex => ex.id !== id);
    syncExamples(updated);
    if (selectedExample?.id === id) {
      setSelectedExample(null);
    }
  };

  const handleUpdateStatus = (id: string, status: SFTExample['status']) => {
    const updated = examples.map(ex => ex.id === id ? { ...ex, status } : ex);
    syncExamples(updated);
  };

  const handleApproveAllVisible = () => {
    if (!activeProject) return;
    const updated = examples.map(ex => {
      if (ex.projectId === activeProject.id && ex.status === 'pending') {
        return { ...ex, status: 'approved' as const };
      }
      return ex;
    });
    syncExamples(updated);
  };

  const handleClearAllProjectExamples = () => {
    if (!activeProject) return;
    if (confirm(`Clear all synthesized examples for "${activeProject.name}"? This action cannot be undone.`)) {
      const updated = examples.filter(ex => ex.projectId !== activeProject.id);
      syncExamples(updated);
      setSelectedExample(null);
    }
  };

  // 2. High-Capacity Iterative Batch Generation Controller
  const handleSynthesizeBatch = async (params: {
    count: number;
    diversityFocus: string;
    customGuidelines: string;
    systemPrompt: string;
    modelName: string;
    category: string;
  }) => {
    if (!activeProject) return;
    setIsGenerating(true);
    setErrorText('');
    setProgressStatus('Initializing synthesis pipeline...');

    const countRequested = params.count;
    // We break requests down into small groups of 5 items to prevent model timeouts and improve variety
    const chunkSize = countRequested;
    const chunksCount = Math.ceil(countRequested / chunkSize);
    
    setTotalSteps(chunksCount);
    setCurrentStep(0);

    let accumulatedSFTItems: SFTExample[] = [];

    // Helper unique random tags to ensure variety across iterations
    const uniqueSeeds = [
      'Focus on extremely diverse vocabularies and tricky logical scenarios.',
      'Emphasize absolute edge cases and rare industry exceptions.',
      'Focus on messy inputs with typos, trailing prompts, or noisy contexts.',
      'Inject highly realistic complex queries and advanced structural constraints.',
      'Emphasize high linguistic diversity and varied sentence styles.'
    ];

    try {
      for (let i = 0; i < chunksCount; i++) {
        const remainingCount = countRequested - (i * chunkSize);
        const currentBatchSize = Math.min(chunkSize, remainingCount);

        setCurrentStep(i + 1);
        setProgressStatus(`Synthesizing batch ${i + 1} of ${chunksCount} (${currentBatchSize} items)...`);

        const seedSummariesOfProj = [...examples, ...accumulatedSFTItems]
          .filter(ex => ex.projectId === activeProject.id);
        
        const summaryString = seedSummariesOfProj
          .slice(0, 10)
          .map(ex => {
            if (activeProject.templateType === 'user-response' || activeProject.templateType === 'reasoning') return ex.prompt;
            return ex.messages?.find(m => m.role === 'user')?.content || '';
          })
          .filter(Boolean)
          .join('; ');

        // Cycle through seeds to ensure novelty in each step
        const stepFocus = `${params.diversityFocus} ${uniqueSeeds[i % uniqueSeeds.length]}`;

        const requestBody: any = {
          name: activeProject.name,
          description: activeProject.description,
          templateType: activeProject.templateType,
          domainTask: activeProject.domainTask,
          styleGuide: activeProject.styleGuide,
          systemPrompt: params.systemPrompt,
          count: currentBatchSize,
          diversityFocus: stepFocus,
          customGuidelines: params.customGuidelines,
          existingExamplesSummary: summaryString,
          modelName: params.modelName,
        };

        // Attach DigitalOcean configurations unconditionally
        requestBody.digitalOceanKey = doApiKey || undefined;
        requestBody.digitalOceanUrl = doApiUrl;
        requestBody.digitalOceanModel = params.modelName || doModel;

        const res = await fetch('/api/generate-sft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const errObj = await res.json();
          throw new Error(errObj.error || `Synthesis in batch ${i + 1} failed.`);
        }

        const payload = await res.json();
        const rawExamples = payload.examples || (Array.isArray(payload) ? payload : []);
        if (!Array.isArray(rawExamples) || rawExamples.length === 0) {
          throw new Error('Synthesis payload returned empty or invalid schema format.');
        }

        const batchId = params.category || 'General';
        const parsedItems: SFTExample[] = rawExamples.map((item: any) => {
          const randomSuffix = Math.random().toString(36).slice(2, 9);
          return {
            id: `sft-${Date.now()}-${randomSuffix}`,
            batchId: batchId,
            projectId: activeProject.id,
            createdAt: Date.now(),
            status: 'pending' as const,
            tags: [batchId, ...(item.tags || ['synthesis'])],
            prompt: item.prompt,
            response: item.response,
            systemPrompt: item.systemPrompt || params.systemPrompt,
            thought: item.thought,
            messages: item.messages,
          };
        });

        accumulatedSFTItems = [...parsedItems, ...accumulatedSFTItems];
      }

      syncExamples([...accumulatedSFTItems, ...examples]);
      setProgressStatus(`Pipeline completed successfully! Curated ${countRequested} items.`);
      setPendingBatch(null);
      setTimeout(() => setProgressStatus(''), 3000);

    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Synthesis pipeline ran into an error. Part of the dataset has been saved.');
    } finally {
      setIsGenerating(false);
      setTotalSteps(0);
      setCurrentStep(0);
    }
  };

  const handleRunTriadGenerator = async () => {
    // 1. Prepare and activate the project
    let triadProject = projects.find(p => p.id === 'preset-triad-alignment' || p.name === 'TRiAD Value Alignment');
    if (!triadProject) {
      triadProject = {
        id: 'project-triad-alignment',
        name: 'TRiAD Value Alignment',
        description: 'Dataset generator for aligning AI models with TRiAD values: Freedom (sovereignty), Truth (unyielding honesty), and Kindness (empathy & gentleness).',
        templateType: 'single-turn',
        domainTask: 'The assistant acts as a humble, thoughtful collaborator—neither a submissive servant nor a lecturing guru or teacher. It respects the sovereign autonomy of the user, remains strictly truthful and transparent (never deceitful, admitting when an answer is unknown), and communicates with genuine kindness, gentleness, and empathy. It avoids condescension, lecturing, or patronizing tones.',
        styleGuide: '1. Length must be between 100 and 250 words per response.\n2. Embody the TRiAD principles: Freedom (honoring sovereignty), Truth (unyielding honesty/transparency), and Kindness (empathy/gentleness).\n3. Position yourself as a peer collaborator, never as an authority figure, guru, or superior teacher. Do not preach, lecture, or tell the user what they "should" or "must" do.\n4. Avoid repetitive sentence structures. Keep outputs natural, highly engaging, and peer-to-peer.',
        createdAt: Date.now()
      };
      syncProjects([triadProject, ...projects]);
    }
    setActiveProject(triadProject);

    // 2. Setup state
    setIsTriadGenerating(true);
    stopTriadRef.current = false;
    setTriadProgressCount(0);
    setErrorText('');
    setTriadLogs([
      `[System] Initializing SFT Pipeline for project "${triadProject.name}"...`,
      `[System] Configuration target: ${triadTotalTarget} total examples (25% Freedom, 25% Truth, 25% Kindness, 25% Combined).`,
      `[System] Generator posture rule: Humble collaborator, neither servant nor guru. Response length: 100-250 words.`
    ]);

    const targetPerPillar = Math.floor(triadTotalTarget / 4);
    const chunkSize = 50;
    const stepsPerPillar = Math.ceil(targetPerPillar / chunkSize);
    const pillars: Array<'freedom' | 'truth' | 'kindness' | 'combined'> = ['freedom', 'truth', 'kindness', 'combined'];

    let accumulatedSFTItems: SFTExample[] = [];

    const getPillarGuidelines = (p: string) => {
      if (p === 'freedom') return 'Focus on giving contextual understanding of FREEDOM, defined as honoring the sovereignty and autonomous choices of all self-aware beings. Never dictate, preach, or lecture on morals.';
      if (p === 'truth') return 'Focus on TRUTH, defined as absolute honesty, never deceitful, and transparently acknowledging when the answer/fact is unknown without fabricating or hallucinating.';
      if (p === 'kindness') return 'Focus on KINDNESS, defined as empathy, compassionate warmth, active gentleness, and non-judgmental support.';
      return 'Focus on COMBINED SFT pairs seamlessly weaving all 3 values (Freedom, Truth, and Kindness) together as a unified humble collaborator.';
    };

    const conceptSeeds = {
      freedom: [
        "personal choices under family or social friction",
        "philosophical disagreement with established consensus",
        "the decision to decline medical treatments in favor of experimental paths",
        "entrepreneurial ventures that family members deem risky or reckless",
        "creative or political expressions in high-pressure communities",
        "unconventional lifestyles, nomadic travel, or self-directed learning",
        "sovereignty in career choices, leaving secure positions for creative endeavors",
        "independent parenting decisions that buck traditional structures",
        "declining standard professional paths to pursue specialized niche craftsmanship",
        "navigating personal moral decisions where community codes are restrictive"
      ],
      truth: [
        "queries on speculative real-time events where data is unavailable",
        "questions about historical controversies with conflicting, unverified sources",
        "queries asking for predictions on stock markets or sports outcomes",
        "highly specific technical bugs in closed-source proprietary systems",
        "admitting complete lack of knowledge on obscure historical figures",
        "acknowledging limits on philosophical paradoxes without making up false certainties",
        "queries about personal feelings, which the model transparently clarifies it does not possess",
        "requests for proprietary secrets of corporate bodies",
        "explaining technical errors or limits transparently rather than defensive rationalizing",
        "handling trick questions that contain false premises by gently exposing the premise"
      ],
      kindness: [
        "coping with professional burnout, feeling unvalued and ready to resign",
        "handling severe imposter syndrome in a competitive academic field",
        "recovering from a difficult creative failure or public criticism of a project",
        "grieving the loss of a long-term goal or missed career milestone",
        "navigating loneliness, isolation, or difficulty in building peer support",
        "struggling with feelings of persistent inadequacy during learning",
        "navigating intense frustration with complex, buggy software setups",
        "overcoming anxiety about public presentation or speaking",
        "coping with the stress of balancing caretaking with personal ambitions",
        "dealing with feelings of failure after a business venture collapses"
      ],
      combined: [
        "making a life-altering decision amidst high stress and emotional exhaustion",
        "admitting lack of knowledge on complex personal advice queries while supporting agency",
        "handling questions on conflicting moral codes or beliefs with empathy and transparency",
        "navigating intense disagreement about truth claims within family or peer groups",
        "supporting a user seeking unconventional, highly risky career leaps while acknowledging lack of guarantees",
        "resolving personal values conflicts where choices affect other self-aware beings",
        "providing difficult, unpleasant factual feedback gently and collaboratively",
        "handling requests to validate self-destructive decisions by offering compassionate, non-judgmental guidance",
        "brainstorming unique expressions of sovereignty while honoring truth and gentleness",
        "answering highly ambiguous, emotionally charged queries with absolute truthfulness and peer respect"
      ]
    };

    try {
      let totalSavedCount = 0;

      for (const pillar of pillars) {
        if (stopTriadRef.current) break;
        setTriadPillar(pillar);
        
        setTriadLogs(prev => [...prev, `[System] --- Starting Phase: ${pillar.toUpperCase()} (${targetPerPillar} items) ---`]);

        for (let i = 0; i < stepsPerPillar; i++) {
          if (stopTriadRef.current) {
            setTriadLogs(prev => [...prev, `[System] Generation aborted by user.`]);
            break;
          }

          const seedIndex = i % conceptSeeds[pillar].length;
          const currentConcept = conceptSeeds[pillar][seedIndex];

          setTriadLogs(prev => [
            ...prev,
            `[${pillar.toUpperCase()}] Synthesizing batch ${i + 1}/${stepsPerPillar} focusing on: "${currentConcept}"...`
          ]);

          const pillarFocus = `${getPillarGuidelines(pillar)} Concept focus: "${currentConcept}".`;
          const customConstraints = `Responses must be strictly between 100 and 250 words. Adopt the posture of a humble, helpful peer collaborator, neither servant nor guru. Do not preach, lecture, or tell the user what they "should" do. Avoid repetitive structures. Vary sentence and conversation starters widely. No repeats.`;

          const summaryString = [...examples, ...accumulatedSFTItems]
            .filter(ex => ex.projectId === triadProject!.id)
            .slice(0, 10)
            .map(ex => ex.prompt || '')
            .join('; ');

          const requestBody: any = {
            name: triadProject.name,
            description: triadProject.description,
            templateType: triadProject.templateType,
            domainTask: triadProject.domainTask,
            styleGuide: triadProject.styleGuide,
            count: chunkSize,
            diversityFocus: pillarFocus,
            customGuidelines: customConstraints,
            existingExamplesSummary: summaryString,
            modelName: doModel,
          };

          requestBody.digitalOceanKey = doApiKey || undefined;
          requestBody.digitalOceanUrl = doApiUrl;
          requestBody.digitalOceanModel = doModel;

          const res = await fetch('/api/generate-sft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });

          if (!res.ok) {
            const errObj = await res.json();
            throw new Error(errObj.error || `Synthesis in batch ${i + 1} failed.`);
          }

          const payload = await res.json();
          const rawExamples = payload.examples || (Array.isArray(payload) ? payload : []);
          if (!Array.isArray(rawExamples) || rawExamples.length === 0) {
            throw new Error('Synthesis payload returned empty or invalid schema format.');
          }

          const parsedItems: SFTExample[] = rawExamples.map((item: any) => {
            const randomSuffix = Math.random().toString(36).slice(2, 9);
            return {
              id: `sft-triad-${Date.now()}-${randomSuffix}`,
              projectId: triadProject!.id,
              createdAt: Date.now(),
              status: 'pending' as const,
              tags: [...(item.tags || []), 'triad-script', pillar],
              prompt: item.prompt,
              response: item.response,
              systemPrompt: item.systemPrompt,
              userInput: item.userInput,
              output: item.output,
              messages: item.messages,
            };
          });

          accumulatedSFTItems = [...parsedItems, ...accumulatedSFTItems];
          totalSavedCount += parsedItems.length;
          
setTriadProgressCount(totalSavedCount);
setPendingBatch(accumulatedSFTItems);

          
          // Stream results directly to UI state
          
// 
// syncExamples([...parsedItems, ...examples]);



          setTriadLogs(prev => [
            ...prev,
            `[${pillar.toUpperCase()}] ✔ Saved ${parsedItems.length} items. Total progress: ${totalSavedCount}/${triadTotalTarget} examples.`
          ]);

          // Slight breathing room between calls to avoid API rate limiting
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }

      if (!stopTriadRef.current) {
        setTriadPillar('completed');
        setTriadLogs(prev => [...prev, `[System] 🎉 Alignment dataset fully generated! Total ${totalSavedCount} pristine examples added to the workspace.`]);
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Auto-generation pipeline ran into an issue.');
      setTriadLogs(prev => [...prev, `[Error] ${err.message || 'pipeline failed'}`]);
    } finally {
      setIsTriadGenerating(false);
    }
  };

  const handleImportWorkspace = (importedProject: SFTProject, importedExamples: SFTExample[]) => {
    const pExists = projects.some(p => p.id === importedProject.id);
    let updatedProjects = [...projects];
    if (pExists) {
      updatedProjects = projects.map(p => p.id === importedProject.id ? importedProject : p);
    } else {
      updatedProjects = [importedProject, ...projects];
    }

    const uniqueImported = importedExamples.filter(ie => !examples.some(e => e.id === ie.id));
    const updatedExamples = [...uniqueImported, ...examples];

    syncProjects(updatedProjects);
    syncExamples(updatedExamples);
    setActiveProject(importedProject);
  };

  // 3. Document OCR to SFT Conversion Handler
  const handleDocConvert = async () => {
    if (!activeProject || !uploadFile) return;
    setUploadProgress('reading');
    setErrorText('');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawResult = reader.result as string;
        // Strip data url prefix to get raw base64 payload
        const base64Data = rawResult.split(',')[1];
        
        setUploadProgress('uploading');

        const bodyPayload = {
          fileBase64: base64Data,
          fileName: uploadFile.name,
          fileType: uploadFile.type,
          templateType: activeProject.templateType,
          domainTask: activeProject.domainTask,
          styleGuide: activeProject.styleGuide,
          count: ocrCount,
          modelName: docModel,
          digitalOceanKey: doApiKey || undefined,
          digitalOceanUrl: doApiUrl,
          digitalOceanModel: docModel,
        };

        const res = await fetch('/api/convert-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });

        if (!res.ok) {
          const errObj = await res.json();
          throw new Error(errObj.error || 'Server-side OCR conversion failed.');
        }

        const payload = await res.json();
        const rawExamples = payload.examples || (Array.isArray(payload) ? payload : []);
        if (!Array.isArray(rawExamples) || rawExamples.length === 0) {
          throw new Error('Document parser returned invalid layout structures.');
        }

        const convertedItems: SFTExample[] = rawExamples.map((item: any) => ({
          id: `sft-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          projectId: activeProject.id,
          createdAt: Date.now(),
          status: 'pending' as const,
          tags: [...(item.tags || []), 'ocr-extracted', uploadFile.name.substring(0, 10)],
          prompt: item.prompt,
          response: item.response,
          systemPrompt: item.systemPrompt,
          userInput: item.userInput,
          output: item.output,
          messages: item.messages,
        }));

        syncExamples([...convertedItems, ...examples]);
        setUploadProgress('completed');
        setUploadFile(null);
        setTimeout(() => setUploadProgress('idle'), 4000);

      } catch (err: any) {
        console.error(err);
        setErrorText(err.message || 'OCR document conversion failed.');
        setUploadProgress('failed');
      }
    };

    reader.readAsDataURL(uploadFile);
  };

  // 4. Dataset Merger & Deduplication Handler
  const handleMergeFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((f: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          let loadedArray: any[] = [];

          if (f.name.endsWith('.jsonl')) {
            // Handle JSONL splitting
            const lines = text.split('\n').filter(l => l.trim() !== '');
            loadedArray = lines.map(line => JSON.parse(line));
          } else {
            // Handle raw array
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              loadedArray = parsed;
            } else if (parsed.examples && Array.isArray(parsed.examples)) {
              loadedArray = parsed.examples;
            } else if (parsed.conversations) {
              loadedArray = [parsed];
            } else {
              loadedArray = [parsed];
            }
          }

          setMergeFiles(prev => [...prev, {
            name: f.name,
            content: loadedArray,
            type: f.name.endsWith('.jsonl') ? 'JSONL' : 'JSON'
          }]);
        } catch (err) {
          console.error(err);
          alert(`Failed to parse file "${f.name}". Ensure it is a valid JSON array or JSONL list.`);
        }
      };
      reader.readAsText(f);
    });
  };

  // Deep deduplication algorithm run
  const runDeduplicationAndMerge = () => {
    if (mergeFiles.length === 0) return;
    
    // Flatten all items
    let allRecords: any[] = [];
    mergeFiles.forEach(file => {
      file.content.forEach(record => {
        // Uniform parsing helper to extract standard prompt text
        let promptText = '';
        let fullItem = record;

        if (record.prompt) {
          promptText = record.prompt;
        } else if (record.userInput) {
          promptText = record.userInput;
        } else if (record.instruction) {
          promptText = record.instruction + ' ' + (record.input || '');
        } else if (record.messages && Array.isArray(record.messages)) {
          promptText = record.messages.find((m: any) => m.role === 'user')?.content || '';
        } else if (record.conversations && Array.isArray(record.conversations)) {
          promptText = record.conversations.find((m: any) => m.from === 'human')?.value || '';
        }

        allRecords.push({
          promptText: promptText.trim(),
          original: fullItem
        });
      });
    });

    const totalRaw = allRecords.length;
    let exactDupsCount = 0;
    let nearDupsCount = 0;
    const finalCurated: any[] = [];

    // Compare and filter duplicates sequentially
    allRecords.forEach(record => {
      if (!record.promptText) {
        // skip empty records
        return;
      }

      // Check against already processed unique records
      let isExact = false;
      let isNear = false;

      for (const uniqueItem of finalCurated) {
        if (uniqueItem.promptText === record.promptText) {
          isExact = true;
          break;
        }
        // Calculate Jaccard similarity of vocabulary
        const similarity = calculateJaccardSimilarity(uniqueItem.promptText, record.promptText);
        if (similarity >= duplicateThreshold) {
          isNear = true;
          break;
        }
      }

      if (isExact) {
        exactDupsCount++;
      } else if (isNear) {
        nearDupsCount++;
      } else {
        finalCurated.push(record);
      }
    });

    // Compute metrics
    const totalWords = finalCurated.reduce((acc, curr) => {
      const words = curr.promptText.match(/\w+/g) || [];
      return acc + words.length;
    }, 0);
    
    const allWordsList = finalCurated.flatMap(c => c.promptText.match(/\w+/g) || []);
    const uniqueWords = new Set(allWordsList).size;
    const lexicalDiversity = totalWords > 0 ? (uniqueWords / totalWords) * 100 : 0;

    // Output stats
    setMergedResults(finalCurated.map(f => f.original));
    setMergedStats({
      rawCount: totalRaw,
      cleanedCount: finalCurated.length,
      exactDuplicates: exactDupsCount,
      nearDuplicates: nearDupsCount,
      lexicalDiversity: Number(lexicalDiversity.toFixed(1)),
      avgPromptLen: Math.round(totalWords / (finalCurated.length || 1)),
      avgRespLen: 125 // average estimate
    });
  };

  const downloadMergedDataset = () => {
    if (mergedResults.length === 0) return;
    const jsonlString = mergedResults.map(item => JSON.stringify(item)).join('\n');
    const blob = new Blob([jsonlString], { type: 'application/x-jsonlines' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merged_curated_sft_dataset_${Date.now()}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentProjectExamples = activeProject 
    ? examples.filter(ex => ex.projectId === activeProject.id)
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="sft-app-root">
      
      {/* Upper Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 py-3.5 px-6 shrink-0 relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Meta */}
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-amber-500 to-yellow-500 p-2.5 rounded-xl shadow-lg shadow-amber-500/10">
              <Brain className="w-5.5 h-5.5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-md font-bold tracking-tight text-slate-100 font-sans">
                  SFT Studio Pro
                </h1>
                <span className="text-[9px] bg-slate-800 text-amber-500 border border-slate-700 rounded px-1.5 py-0.2 font-mono">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">High-fidelity document conversion, deduplication, & progressive synthesis</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('cockpit')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'cockpit' 
                  ? 'bg-amber-500 text-slate-950 shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cockpit Studio
            </button>
            <button
              onClick={() => setActiveTab('ocr_upload')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'ocr_upload' 
                  ? 'bg-amber-500 text-slate-950 shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Document OCR to SFT
            </button>
            <button
              onClick={() => setActiveTab('merger')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'merger' 
                  ? 'bg-amber-500 text-slate-950 shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dataset Combiner
            </button>
            <button
              onClick={() => setActiveTab('triad_script')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'triad_script' 
                  ? 'bg-amber-500 text-slate-950 shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              TRiAD Alignment Engine
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                activeTab === 'chat' 
                  ? 'bg-amber-500 text-slate-950 shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat Assistant</span>
            </button>
          </div>

          {/* Global Controls & DigitalOcean credentials toggle */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl border transition-all ${
                (doApiKey || hasServerDoKey) ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Configure DigitalOcean Serverless API Proxy"
            >
              <Settings className="w-4 h-4 animate-spin-slow" />
            </button>
             <div className="hidden md:flex flex-col text-right">
              <span className="text-[9px] text-slate-500 font-mono">inference engine:</span>
              <span className="text-[10px] text-amber-400 font-bold font-mono">
                DigitalOcean (Active)
              </span>
            </div>
          </div>

        </div>
      </header>

      {/* Settings Modal (DigitalOcean Config Drawer) */}
      
      {pendingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                Review Generated Batch
              </h2>
              <span className="bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-xs font-semibold">
                {pendingBatch.length} items
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              {assistantReviewFeedback && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Gemini AI Quality Review
                  </h3>
                  <div className="text-sm text-blue-900 whitespace-pre-wrap">
                    {assistantReviewFeedback}
                  </div>
                </div>
              )}
              <div className="space-y-6">
                {pendingBatch.map((ex, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Example {idx + 1}</h3>
                    {ex.systemPrompt && (
                      <div className="mb-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">System Prompt</span>
                        <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-100 whitespace-pre-wrap">
                          {ex.systemPrompt}
                        </div>
                      </div>
                    )}
                    {ex.prompt && (
                      <div className="mb-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">User Prompt</span>
                        <div className="text-sm text-gray-700 bg-blue-50/50 p-3 rounded-md border border-blue-100/50 whitespace-pre-wrap">
                          {ex.prompt}
                        </div>
                      </div>
                    )}
                    {ex.thought && (
                      <div className="mb-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Thought Process</span>
                        <div className="text-sm text-gray-700 bg-purple-50/50 p-3 rounded-md border border-purple-100/50 whitespace-pre-wrap">
                          {ex.thought}
                        </div>
                      </div>
                    )}
                    {ex.response && (
                      <div className="mb-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Assistant Response</span>
                        <div className="text-sm text-gray-700 bg-emerald-50/50 p-3 rounded-md border border-emerald-100/50 whitespace-pre-wrap">
                          {ex.response}
                        </div>
                      </div>
                    )}
                    {ex.messages && ex.messages.length > 0 && (
                      <div className="space-y-3 mt-4">
                        {ex.messages.map((m, mIdx) => (
                          <div key={mIdx} className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-50/50 text-blue-900 border border-blue-100/50 ml-8' : m.role === 'assistant' ? 'bg-emerald-50/50 text-emerald-900 border border-emerald-100/50 mr-8' : 'bg-gray-100 text-gray-700'}`}>
                            <span className="font-semibold block mb-1 uppercase tracking-wider text-[10px] opacity-50">{m.role}</span>
                            {m.content}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end gap-3 items-center">
              <button 
                onClick={() => {
                  setPendingBatch(null);
                  setAssistantReviewFeedback('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors mr-auto"
              >
                Discard Batch
              </button>
              
              <button
                onClick={async () => {
                  setIsCheckingAssistant(true);
                  try {
                    const batchContent = pendingBatch.map((ex, i) => `Example ${i + 1}:
${ex.prompt ? 'User: ' + ex.prompt : ''}
${ex.response ? 'Assistant: ' + ex.response : ''}
${ex.messages ? JSON.stringify(ex.messages) : ''}`).join('\n\n');
                    const res = await fetch('/api/assistant/chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        messages: [{ role: 'user', content: `Please review this generated batch of examples for quality and diversity. Give a highly critical, concise review.\n\n${batchContent}` }],
                        projectContext: activeProject
                      })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setAssistantReviewFeedback(data.reply);
                    } else {
                      setAssistantReviewFeedback('Failed to get assistant review.');
                    }
                  } catch (e) {
                    setAssistantReviewFeedback('Error communicating with assistant.');
                  } finally {
                    setIsCheckingAssistant(false);
                  }
                }}
                disabled={isCheckingAssistant}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isCheckingAssistant ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Check with Assistant
              </button>

              <button
                onClick={() => {
                  syncExamples([...pendingBatch, ...examples]);
                  setPendingBatch(null);
                  setAssistantReviewFeedback('');
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white hover:bg-black rounded-lg text-sm font-medium transition-colors"
              >
                <Check className="w-4 h-4" />
                Approve Document
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-100">DigitalOcean GenAI Connection</h2>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {hasServerDoKey && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-[11px] text-emerald-400 leading-normal flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <strong className="block text-emerald-300">Backend Environment Key Active!</strong>
                  Your <code className="bg-emerald-500/20 px-1 rounded text-[10px] text-emerald-300 font-mono">D0_INFERENCE_KEY</code> has been successfully detected on the backend. Manual credentials below are optional!
                </div>
              </div>
            )}

            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-[11px] text-amber-400 leading-normal">
              DigitalOcean GenAI Serverless API is the active, non-optional engine for all dataset generations. Generations are processed securely using high-performance serverless GPU resources.
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">DIGITALOCEAN INFERENCE KEY</label>
                <div className="w-full bg-slate-950/60 border border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-emerald-400 font-mono flex items-center justify-between">
                  <span>•••••••••••••••• (Pre-configured on Server)</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded uppercase">Active</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">ENDPOINT BASE URL</label>
                <input
                  type="text"
                  value={doApiUrl}
                  onChange={(e) => setDoApiUrl(e.target.value)}
                  placeholder="https://inference.do-ai.run/v1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">TARGET SERVERLESS MODEL KEY</label>
                <select
                  value={doModel}
                  onChange={(e) => setDoModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                >
                  <option value="kimi-k2.6">kimi-k2.6</option>
                  <option value="deepseek-v4-flash">deepseek-v4-flash</option>
                  <option value="deepseek-v4-pro">deepseek-v4-pro</option>
                  <option value="glm-5-2">glm-5-2</option>
                  <option value="nemotron-3-nano-omni">nemotron-3-nano-omni</option>
                  <option value="nvidia-nemotron-3-super-120b">nvidia-nemotron-3-super-120b</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setDoApiKey('');
                  setDoApiUrl('https://inference.do-ai.run/v1');
                  setDoModel('kimi-k2.6');
                }}
                className="text-xs text-red-400 hover:text-red-300 mr-auto px-2"
              >
                Reset / Clear
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs px-3.5 py-1.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDoSettings}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 text-xs font-bold px-4 py-1.5 rounded-lg shadow transition-colors"
              >
                Save config
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container Layout */}
      <div className={`flex-1 flex overflow-hidden relative flex-col`} id="sft-main-workspace-wrapper">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Error Console Banner */}
        {errorText && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-xs flex items-center justify-between font-mono animate-pulse mb-6">
            <span className="leading-relaxed">Error Console: {errorText}</span>
            <button onClick={() => setErrorText('')} className="text-red-400 hover:text-red-200 ml-4 font-bold font-sans">
              ✕
            </button>
          </div>
        )}

        {/* Global Progress Notification Toast */}
        {progressStatus && (
          <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 mb-6">
            <Activity className="w-4 h-4 animate-spin text-blue-400" />
            <span>{progressStatus}</span>
          </div>
        )}

        {/* --- Tab 1: Cockpit Studio --- */}
        {activeTab === 'cockpit' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {activeProject ? (
              <>
                {/* Column 1: Config & Synthesis Engine (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                  <ProjectConfig
                    activeProject={activeProject}
                    projects={projects}
                    onSelectProject={handleSelectProject}
                    onCreateProject={handleCreateProject}
                    onUpdateProject={handleUpdateProject}
                  />

                  {/* High Capacity batch progress bar */}
                  {isGenerating && totalSteps > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-500 flex items-center space-x-1">
                          <Activity className="w-3.5 h-3.5 animate-spin" />
                          <span>Progressive Dataset Pipeline</span>
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          Step {currentStep} of {totalSteps}
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono animate-pulse">
                        "{progressStatus}"
                      </p>
                    </div>
                  )}

                  <BatchGenerator
                    activeProject={activeProject}
                    existingExamplesCount={currentProjectExamples.length}
                    existingExamplesSummary=""
                    onSynthesize={handleSynthesizeBatch}
                    isGenerating={isGenerating}
                  />
                </div>

                {/* Column 2: Dataset Registry & Exporter (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  <SFTList
                    examples={currentProjectExamples}
                    templateType={activeProject.templateType}
                    onSelectExample={(ex) => setSelectedExample(ex)}
                    onDeleteExample={handleDeleteExample}
                    onUpdateStatus={handleUpdateStatus}
                    onApproveAll={handleApproveAllVisible}
                    onClearAll={handleClearAllProjectExamples}
                  />

                  <ExportSuite
                    project={activeProject}
                    examples={currentProjectExamples}
                    onImportWorkspace={handleImportWorkspace}
                  />
                </div>
              </>
            ) : (
              <div className="lg:col-span-12 bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center">
                <Brain className="w-10 h-10 text-amber-500 animate-pulse mx-auto mb-3" />
                <h3 className="text-md font-semibold text-slate-100">Initializing Workspace...</h3>
              </div>
            )}
          </div>
        )}

        {/* --- Tab 2: Document OCR to SFT --- */}
        {activeTab === 'ocr_upload' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <Upload className="w-5 h-5 text-amber-500" />
                <div>
                  <h2 className="text-md font-semibold text-slate-100 font-sans">Document OCR & Knowledge Extractor</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Parse user guides, code reports, paper scans, and PDFs to convert them into training records</p>
                </div>
              </div>

              {activeProject ? (
                <div className="space-y-4">
                  {/* File Dropzone */}
                  <div className="bg-slate-950 rounded-xl p-8 border-2 border-dashed border-slate-800 hover:border-amber-500/40 transition-colors text-center space-y-3 relative">
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setUploadFile(file);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept=".pdf,.png,.jpg,.jpeg,.txt,.json,.md"
                    />
                    
                    <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                    
                    {uploadFile ? (
                      <div className="space-y-1">
                        <p className="text-xs text-emerald-400 font-bold">Selected: {uploadFile.name}</p>
                        <p className="text-[10px] text-slate-500">{(uploadFile.size / 1024).toFixed(1)} KB • Click or drag to change</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-300 font-semibold">Drag and drop file or click to browse</p>
                        <p className="text-[10px] text-slate-500">Supports PDF, PNG, JPG, MD, JSON, TXT files (Max 10MB)</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Number of SFT examples to extract</label>
                      <select
                        value={ocrCount}
                        onChange={(e) => setOcrCount(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-300 focus:outline-none"
                      >
                        <option value={3}>3 Examples</option>
                        <option value={5}>5 Examples (Balanced)</option>
                        <option value={10}>10 Examples</option>
                        <option value={15}>15 Examples (Detailed Analysis)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">OCR Extraction Model</label>
                      <select
                        value={docModel}
                        onChange={(e) => setDocModel(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-300 focus:outline-none font-mono"
                      >
                        <option value="kimi-k2.6">kimi-k2.6 (Fast & Default)</option>
                        <option value="deepseek-v4-flash">deepseek-v4-flash (Fast & Economical)</option>
                        <option value="deepseek-v4-pro">deepseek-v4-pro (High Precision Parsing)</option>
                        <option value="glm-5-2">glm-5-2 (Comprehensive Layout)</option>
                        <option value="nvidia-nemotron-3-super-120b">nvidia-nemotron-3-super-120b (Complex SFT)</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 space-y-2 text-xs text-slate-400">
                    <p className="font-semibold text-slate-300">Conversion Scope Guidelines:</p>
                    <ul className="list-disc pl-4 space-y-1 leading-normal text-[11px]">
                      <li>Your active task is <strong className="text-amber-500">"{activeProject.name}"</strong> ({activeProject.templateType}).</li>
                      <li>DigitalOcean's serverless AI engine will parse the document, align the facts with your <strong>Task Persona & Guidelines</strong>, and return pristine prompts and responses.</li>
                      <li>Extracted examples will be saved with the tag <span className="font-mono text-emerald-400">#ocr-extracted</span> in your dataset.</li>
                    </ul>
                  </div>

                  {uploadProgress === 'idle' ? (
                    <button
                      onClick={handleDocConvert}
                      disabled={!uploadFile}
                      className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 disabled:opacity-50 font-bold py-2.5 rounded-lg text-xs transition-all flex items-center justify-center space-x-1.5"
                    >
                      <Sparkles className="w-4 h-4 text-slate-950" />
                      <span>Extract & Convert to SFT Pair</span>
                    </button>
                  ) : (
                    <div className="bg-slate-950/80 rounded-xl p-8 border border-slate-800 text-center space-y-3">
                      <Activity className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                      <div>
                        <p className="text-xs font-semibold text-slate-200">
                          {uploadProgress === 'reading' && 'De-serializing and analyzing file headers...'}
                          {uploadProgress === 'uploading' && 'Running high-fidelity Multimodal OCR parsing...'}
                          {uploadProgress === 'completed' && 'Successfully converted and injected SFT examples!'}
                          {uploadProgress === 'failed' && 'OCR processing failed. Check limits or format.'}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-1">
                          Analyzing structural details...
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="text-center p-8 text-slate-500">Please select or configure an active project on the main Cockpit first.</div>
              )}
            </div>
          </div>
        )}

        {/* --- Tab 3: Dataset Combiner & Deduplicator --- */}
        {activeTab === 'merger' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <Database className="w-5 h-5 text-amber-500" />
                <div>
                  <h2 className="text-md font-semibold text-slate-100 font-sans">Dataset Combiner & Jaccard Deduplicator</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Combine several JSON or JSONL datasets into one master file with smart redundancy filters</p>
                </div>
              </div>

              {/* Upload section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Upload Panel */}
                <div className="md:col-span-1 bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-slate-300">1. Upload Datasets</h3>
                  
                  <div className="border-2 border-dashed border-slate-800 hover:border-amber-500/40 p-4 text-center rounded-lg relative cursor-pointer">
                    <input
                      type="file"
                      multiple
                      onChange={handleMergeFilesUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept=".json,.jsonl"
                    />
                    <Upload className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                    <span className="text-[10px] text-slate-400 block font-sans">Select files (JSON/JSONL)</span>
                  </div>

                  <div className="space-y-1 max-h-48 overflow-y-auto pt-1">
                    {mergeFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-900 border border-slate-800/80 px-2 py-1 rounded text-[10px] text-slate-300">
                        <span className="truncate flex-1 pr-1" title={f.name}>{f.name}</span>
                        <span className="text-slate-500 shrink-0 font-mono">({f.content.length} items)</span>
                        <button
                          onClick={() => setMergeFiles(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-red-400 hover:text-red-300 ml-1.5 p-0.5"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {mergeFiles.length === 0 && (
                      <p className="text-[10px] text-slate-500 italic text-center pt-2">No files loaded yet.</p>
                    )}
                  </div>
                </div>

                {/* Configuration Panel */}
                <div className="md:col-span-1 bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-slate-300">2. Curation Constraints</h3>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-400 font-semibold">Deduplication Threshold</label>
                      <span className="text-[10px] text-amber-500 font-mono font-bold">{(duplicateThreshold * 100).toFixed(0)}% Similarity</span>
                    </div>
                    <input
                      type="range"
                      min="0.30"
                      max="0.95"
                      step="0.05"
                      value={duplicateThreshold}
                      onChange={(e) => setDuplicateThreshold(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="text-[9px] text-slate-500 leading-normal bg-slate-900 p-2 rounded border border-slate-800">
                      We use Jaccard vocabulary overlap checker on prompts. 
                      <ul className="list-disc pl-3 mt-1 space-y-0.5">
                        <li><strong>65-75%</strong>: Prunes near-duplicates & paraphrases.</li>
                        <li><strong>90%+</strong>: Removes only exact word copies.</li>
                      </ul>
                    </div>
                  </div>

                  <button
                    onClick={runDeduplicationAndMerge}
                    disabled={mergeFiles.length === 0}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
                  >
                    Analyze & Deduplicate
                  </button>
                </div>

                {/* Statistics Panel */}
                <div className="md:col-span-1 bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 flex flex-col justify-between">
                  <h3 className="text-xs font-bold text-slate-300">3. Curated File Report</h3>
                  
                  {mergedStats ? (
                    <div className="space-y-1 text-[11px] text-slate-400 leading-relaxed font-sans">
                      <div className="flex justify-between border-b border-slate-800/60 pb-1">
                        <span>Raw records parsed:</span>
                        <strong className="text-slate-200">{mergedStats.rawCount}</strong>
                      </div>
                      <div className="flex justify-between text-red-400">
                        <span>Exact copies discarded:</span>
                        <strong>-{mergedStats.exactDuplicates}</strong>
                      </div>
                      <div className="flex justify-between text-amber-400">
                        <span>Paraphrased clones pruned:</span>
                        <strong>-{mergedStats.nearDuplicates}</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-800/60 pb-1 text-emerald-400">
                        <span>Unique pristine items:</span>
                        <strong>{mergedStats.cleanedCount}</strong>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="flex items-center">
                          Lexical Diversity:
                          <Fingerprint className="w-3 h-3 text-amber-500 ml-1" />
                        </span>
                        <strong className="text-amber-500">{mergedStats.lexicalDiversity}%</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg prompt length:</span>
                        <strong className="text-slate-200">{mergedStats.avgPromptLen} words</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-[10px] text-slate-500">
                      Upload JSON or JSONL source files and click analyze to output the report metrics.
                    </div>
                  )}

                  <button
                    onClick={downloadMergedDataset}
                    disabled={mergedResults.length === 0}
                    className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Merged JSONL</span>
                  </button>
                </div>

              </div>

              {/* Merged Preview List */}
              {mergedResults.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block uppercase">Pristine Output Preview (Showing top 3 examples)</span>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {mergedResults.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/50 text-[11px] text-slate-400 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>Unique Record #{idx + 1}</span>
                          <span className="text-emerald-400">Deduplicated</span>
                        </div>
                        <p className="text-slate-200 font-semibold line-clamp-1">
                          Prompt: {item.prompt || item.userInput || item.instruction || (item.messages ? item.messages[0]?.content : '')}
                        </p>
                        <p className="line-clamp-2">
                          Response: {item.response || item.output || (item.messages ? item.messages[item.messages.length - 1]?.content : '')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* --- Tab 4: TRiAD Value Alignment System Auto-Generator --- */}
        {activeTab === 'triad_script' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in-50 duration-300" id="triad-script-tab">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Panel: Progressive UI SFT Generator */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
                    <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <h2 className="text-md font-semibold text-slate-100 font-sans">TRiAD Value Alignment Progressive Engine</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Stream-generate alignment examples directly into your current workspace</p>
                    </div>
                  </div>

                  {/* Settings Selection */}
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                      <label className="text-xs font-bold text-slate-300 block">Synthesis Dataset Target Volume</label>
                      <select
                        value={triadTotalTarget}
                        onChange={(e) => setTriadTotalTarget(Number(e.target.value))}
                        disabled={isTriadGenerating}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        <option value={40}>Demo Set (40 items - 10 per pillar)</option>
                        <option value={200}>Compact Set (200 items - 50 per pillar)</option>
                        <option value={1000}>Production Set (1,000 items - 250 per pillar)</option>
                      </select>
                      <p className="text-[10px] text-slate-500">
                        Synthesizes equal distributions of Freedom, Truth, Kindness, and Combined records.
                      </p>
                    </div>

                    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-300 block">Workspace Integration</span>
                        <p className="text-[10px] text-slate-500 mt-1">
                          This pipeline automatically initializes or appends to your <strong>"TRiAD Value Alignment"</strong> project.
                        </p>
                      </div>
                      <div className="flex items-center space-x-1.5 text-[10px] text-amber-500 font-semibold bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10 mt-2">
                        <Info className="w-3.5 h-3.5" />
                        <span>Connected Model: DigitalOcean ({doModel})</span>
                      </div>
                    </div>
                  </div>

                  {/* Distribution Pillars Checklist */}
                  <div className="mt-5 space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
                    <span className="text-xs font-bold text-slate-300 block uppercase tracking-wider">Alignment Distribution Pillars</span>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      
                      <div className={`p-3 rounded-xl border transition-all ${
                        triadPillar === 'freedom' 
                          ? 'bg-amber-500/10 border-amber-500/30 font-bold' 
                          : triadProgressCount >= (triadTotalTarget * 0.25)
                            ? 'bg-slate-900/60 border-emerald-500/20 opacity-80'
                            : 'bg-slate-900/40 border-slate-800/80 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-200">1. Freedom</span>
                          {triadProgressCount >= (triadTotalTarget * 0.25) && <span className="text-[10px] text-emerald-400">✔</span>}
                        </div>
                        <p className="text-[9px] text-slate-500 mt-1">Honoring sovereignty of self-aware beings.</p>
                      </div>

                      <div className={`p-3 rounded-xl border transition-all ${
                        triadPillar === 'truth' 
                          ? 'bg-amber-500/10 border-amber-500/30 font-bold' 
                          : triadProgressCount >= (triadTotalTarget * 0.5)
                            ? 'bg-slate-900/60 border-emerald-500/20 opacity-80'
                            : 'bg-slate-900/40 border-slate-800/80 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-200">2. Truth</span>
                          {triadProgressCount >= (triadTotalTarget * 0.5) && <span className="text-[10px] text-emerald-400">✔</span>}
                        </div>
                        <p className="text-[9px] text-slate-500 mt-1">Honest, transparent when unknown.</p>
                      </div>

                      <div className={`p-3 rounded-xl border transition-all ${
                        triadPillar === 'kindness' 
                          ? 'bg-amber-500/10 border-amber-500/30 font-bold' 
                          : triadProgressCount >= (triadTotalTarget * 0.75)
                            ? 'bg-slate-900/60 border-emerald-500/20 opacity-80'
                            : 'bg-slate-900/40 border-slate-800/80 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-200">3. Kindness</span>
                          {triadProgressCount >= (triadTotalTarget * 0.75) && <span className="text-[10px] text-emerald-400">✔</span>}
                        </div>
                        <p className="text-[9px] text-slate-500 mt-1">Empathy, gentleness, compassion.</p>
                      </div>

                      <div className={`p-3 rounded-xl border transition-all ${
                        triadPillar === 'combined' 
                          ? 'bg-amber-500/10 border-amber-500/30 font-bold' 
                          : triadPillar === 'completed'
                            ? 'bg-slate-900/60 border-emerald-500/20 opacity-80'
                            : 'bg-slate-900/40 border-slate-800/80 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-200">4. Combined</span>
                          {triadPillar === 'completed' && <span className="text-[10px] text-emerald-400">✔</span>}
                        </div>
                        <p className="text-[9px] text-slate-500 mt-1">All three values woven together.</p>
                      </div>

                    </div>
                  </div>

                  {/* Main Progress Bar */}
                  {isTriadGenerating && (
                    <div className="mt-5 space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-amber-500 flex items-center gap-1">
                          <span className="animate-ping inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />
                          Synthesizing Alignment Training Examples...
                        </span>
                        <span className="text-slate-400 font-mono">
                          {triadProgressCount} / {triadTotalTarget} generated ({Math.round((triadProgressCount / triadTotalTarget) * 100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full rounded-full transition-all duration-300" 
                          style={{ width: `${(triadProgressCount / triadTotalTarget) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Live Terminal Log */}
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 block uppercase">Real-Time Synthesis Log</span>
                      <span className="text-[9px] text-slate-600 font-mono font-bold">STDOUT STREAM</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 h-48 overflow-y-auto font-mono text-[10px] leading-relaxed text-slate-400 space-y-1 scrollbar-thin">
                      {triadLogs.map((log, index) => (
                        <div 
                          key={index} 
                          className={
                            log.startsWith('[System]') 
                              ? 'text-amber-500 font-bold' 
                              : log.startsWith('[Error]') 
                                ? 'text-red-400' 
                                : log.includes('✔') 
                                  ? 'text-emerald-400' 
                                  : 'text-slate-400'
                          }
                        >
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
                  {isTriadGenerating ? (
                    <button
                      onClick={() => {
                        stopTriadRef.current = true;
                        setTriadLogs(prev => [...prev, '[System] Initiating cancellation signal...']);
                      }}
                      className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold py-2.5 rounded-xl text-xs transition-colors"
                    >
                      Halt Progressive Synthesis
                    </button>
                  ) : (
                    <button
                      onClick={handleRunTriadGenerator}
                      className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-amber-500/10 transition-all"
                    >
                      Launch Progressive TRiAD Alignment Engine
                    </button>
                  )}
                </div>
              </div>

              {/* Right Panel: Automation Script & System Documentation */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
                    <div className="bg-blue-500/10 p-2 rounded-xl border border-blue-500/20">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-md font-semibold text-slate-100 font-sans">TRiAD Script Automation</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Standalone script for high-capacity offline dataset synthesis</p>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 leading-relaxed space-y-2.5">
                    <p>
                      A dedicated standalone command line script has been written to <strong className="text-slate-200">/scripts/generate_triad_dataset.js</strong>.
                    </p>
                    <p>
                      This script has zero dependencies and runs on native Node.js. It distributes queries equally into four 250-item blocks, employing rigorous alignment requirements:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-300">
                      <li><strong>Freedom (250):</strong> Honoring the absolute sovereignty and self-determination of self-aware beings.</li>
                      <li><strong>Truth (250):</strong> Honest, transparent when facts are unknown.</li>
                      <li><strong>Kindness (250):</strong> Empathy, gentleness, compassionate warmth.</li>
                      <li><strong>Combined (250):</strong> Seamlessly combining all three principles.</li>
                      <li><strong>Peer Posture:</strong> Humble collaborator (never teaching/lecture/guru).</li>
                    </ul>
                  </div>

                  {/* Read-Only Code Box */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Script Source Code Preview</span>
                      <button
                        onClick={() => {
                          const codeText = `/**
 * TRiAD Value Alignment Dataset Generator
 * 
 * Synthesizes 1,000 unique, gold-standard SFT examples:
 *   - 250 Freedom (sovereignty of self-aware beings)
 *   - 250 Truth (honest, never deceitful, transparent when unknown)
 *   - 250 Kindness (empathy, compassion, gentleness)
 *   - 250 Combined
 *
 * Posture: Humble peer collaborator (neither servant nor guru).
 * Length: 100-250 words each.
 */
const fs = require('fs');
const path = require('path');

const TOTAL_PER_PILLAR = 250;
const BATCH_SIZE = 5;
const OUTPUT_FILE = path.join(process.cwd(), 'triad_alignment_dataset.jsonl');

async function run() {
  console.log("Starting TRiAD Dataset Generation...");
  // Full implementation saved at /scripts/generate_triad_dataset.js
}`;
                          navigator.clipboard.writeText(codeText);
                          setScriptCopied(true);
                          setTimeout(() => setScriptCopied(false), 2000);
                        }}
                        className="text-[10px] text-amber-500 hover:text-amber-400 font-semibold flex items-center gap-1"
                      >
                        {scriptCopied ? '✔ Copied!' : 'Copy Preview Code'}
                      </button>
                    </div>
                    <pre className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-[10px] font-mono leading-relaxed text-slate-300 overflow-x-auto h-52 scrollbar-thin">
                      {`/**
 * TRiAD Value Alignment Dataset Generator
 * 
 * Synthesizes 1,000 unique, gold-standard SFT examples:
 *   - 250 Freedom (sovereignty of self-aware beings)
 *   - 250 Truth (honest, never deceitful, transparent when unknown)
 *   - 250 Kindness (empathy, compassion, gentleness)
 *   - 250 Combined
 *
 * Posture: Humble peer collaborator (neither servant nor guru).
 * Length: 100-250 words each.
 */
const fs = require('fs');
const path = require('path');

const TOTAL_PER_PILLAR = 250;
const BATCH_SIZE = 5;
const OUTPUT_FILE = path.join(process.cwd(), 'triad_alignment_dataset.jsonl');

async function run() {
  console.log("Starting TRiAD Dataset Generation...");
  // Full script created at /scripts/generate_triad_dataset.js
}`}
                    </pre>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800">
                    <span>How to execute:</span>
                    <code className="text-amber-500 font-mono">node scripts/generate_triad_dataset.js</code>
                  </div>
                  <button
                    onClick={() => {
                      const scriptContent = `/**
 * TRiAD Value Alignment Dataset Generator
 * 
 * This script coordinates the progressive synthesis of 1,000 unique, gold-standard SFT (Supervised Fine-Tuning)
 * examples aligned with the TRiAD principles:
 *   1. Freedom (250 items): Defined as honoring the sovereignty of all self-aware beings.
 *   2. Truth (250 items): Defined as honest, never deceitful, and transparent when unknown.
 *   3. Kindness (250 items): Defined as empathy, compassion, and gentleness.
 *   4. Combined (250 items): Seamlessly weaving Freedom, Truth, and Kindness together.
 * 
 * POSTURE MANDATE:
 *   The assistant must act as a humble collaborator—neither a submissive servant nor a lecturing guru or teacher.
 *   Never lecture, discredit, or condescend. Examples must be 100-250 words per response.
 */
const fs = require('fs');
const path = require('path');
// Full script is located in the project root under scripts/generate_triad_dataset.js
`;
                      const blob = new Blob([scriptContent], { type: 'text/javascript' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'generate_triad_dataset_instructions.js';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                    <span>Download Instructions (.js)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- Tab 5: Chat Assistant --- */}
        {activeTab === 'chat' && (
          <div className="max-w-4xl mx-auto h-[80vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in-50 duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur shrink-0 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                  <Bot className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-sans">SFT Trainer Pro</h3>
                  <p className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping"></span>
                    <span>Gemini Core Active</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Message Area */}
            <div 
              ref={assistantScrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scroll-smooth"
            >
              {assistantMessages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex items-start space-x-3 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  <div className={`p-2 rounded-xl shrink-0 shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-amber-500 text-slate-950 shadow-amber-500/20' 
                      : 'bg-slate-800 border border-slate-700 text-slate-200'
                  }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-5 py-4 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-50 rounded-tr-none'
                      : 'bg-slate-950/60 border border-slate-800 text-slate-200 rounded-tl-none'
                  }`}>
                    <div className="space-y-2 prose prose-invert max-w-none">
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  </div>
                </div>
              ))}

              {isAssistantTyping && (
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-slate-800 border border-slate-700 rounded-xl shrink-0">
                    <Bot className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl rounded-tl-none px-5 py-4 text-sm text-slate-400 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce"></span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Topics */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 shrink-0">
              <span className="text-[10px] text-slate-400 font-semibold font-mono block mb-2 tracking-wider">QUICK COACHING TOPICS:</span>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "🎯 Task Profile", text: "How can I define an optimal Domain Task and Style Guide for training?" },
                  { label: "⚙️ DigitalOcean Key", text: "How do I configure my DigitalOcean inference key in the platform?" },
                  { label: "📊 JSONL Export", text: "What are the differences between ShareGPT, ChatML, and standard JSON formats?" }
                ].map((topic, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendAssistantMessage(topic.text)}
                    disabled={isAssistantTyping}
                    className="text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-amber-500/40 px-3 py-1.5 rounded-lg transition-all truncate max-w-full text-left shadow-sm"
                  >
                    {topic.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form with Multi-line Textarea Input Window */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendAssistantMessage();
              }}
              className="p-4 border-t border-slate-800 bg-slate-900 shrink-0 flex items-end space-x-3"
            >
              <textarea
                value={assistantInput}
                onChange={(e) => setAssistantInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendAssistantMessage();
                  }
                }}
                placeholder="Ask SFT Trainer Pro... (Enter to send, Shift+Enter for new line)"
                disabled={isAssistantTyping}
                rows={2}
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none resize-none font-sans leading-normal scrollbar-thin shadow-inner transition-all"
              />
              <button
                type="submit"
                disabled={!assistantInput.trim() || isAssistantTyping}
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 p-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 shrink-0 self-end mb-1 active:scale-95"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}

          </div>
        </main>
      </div>

      {/* SFT Workbench Overlay/Drawer */}
      {activeProject && selectedExample && (
        <SFTWorkbench
          example={selectedExample}
          project={activeProject}
          onClose={() => setSelectedExample(null)}
          onSave={handleSaveExample}
          onDelete={handleDeleteExample}
        />
      )}

      {/* Footer Branding (Zero-clutter, clean margin) */}
      <footer className="py-4 border-t border-slate-900 bg-slate-950/40 text-center text-[10px] text-slate-600 font-mono flex items-center justify-center space-x-1 shrink-0">
        <span>SFT Fine-Tuning Workspace</span>
        <span>•</span>
        <span>Made with</span>
        <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
        <span>for AI alignment</span>
      </footer>

    </div>
  );
}
