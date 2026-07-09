export type SFTTemplateType = 'single-turn' | 'system-prompt' | 'multi-turn' | 'reasoning-cot';

export interface SFTMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SFTExample {
  id: string;
  projectId: string;
  createdAt: number;
  
  // Single-turn fields
  prompt?: string;
  response?: string;
  thought?: string;

  // System prompt + Prompt/Response fields
  systemPrompt?: string;
  userInput?: string;
  output?: string;

  // Multi-turn fields
  messages?: SFTMessage[];

  // Metadata / Curation fields
  status: 'pending' | 'approved' | 'rejected' | 'curated';
  tags: string[];
  notes?: string;
  batchId?: string; // Grouping ID for generated batches
  
  // AI Critique details
  critique?: {
    score: number; // 1 to 5
    positives: string[];
    negatives: string[];
    suggestions: string;
  };
}

export interface SFTProject {
  id: string;
  name: string;
  description: string;
  templateType: SFTTemplateType;
  
  // Guidelines / Fine-tuning requirements
  domainTask: string; // The overall behavior/personality/specialization
  styleGuide: string; // Formatting constraints, tone, do's & don'ts

  createdAt: number;
}

export interface SFTGenerationRequest {
  projectId: string;
  count: number;
  diversityFocus?: string;
  customGuidelines?: string;
  existingExamplesCount: number;
  modelName: string;
}

export interface AICritiqueRequest {
  example: SFTExample;
  project: SFTProject;
}
