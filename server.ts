import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Securely access Gemini API key
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables. Please add it via the Settings > Secrets menu.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Helper to extract text from a raw PDF buffer without external dependencies
  function extractTextFromPdfBuffer(buffer: Buffer): string {
    const content = buffer.toString('binary');
    // Match text blocks inside PDF, typically Tj or TJ streams
    const matches = content.match(/\(([^)]+)\)\s*Tj/g);
    if (matches && matches.length > 0) {
      return matches
        .map(m => {
          const text = m.substring(1, m.length - 4); // strip leading "(" and trailing ") Tj"
          return text.replace(/\\([\s\S])/g, '$1'); // unescape backslashes
        })
        .join(' ')
        .replace(/\s+/g, ' ');
    }

    // Fallback: match any text inside parentheses (simple, generic matching)
    const fallbackMatches = content.match(/\(([^)]+)\)/g);
    if (fallbackMatches && fallbackMatches.length > 0) {
      return fallbackMatches
        .map(m => m.slice(1, -1))
        .filter(t => t.length > 2 && /^[a-zA-Z0-9\s.,!?:;'"()-]+$/.test(t))
        .join(' ');
    }

    // Last resort: extract printable ASCII strings
    return content.replace(/[^\x20-\x7E\n\r\t]/g, ' ').substring(0, 10000);
  }


  // Helper to call OpenAI-compatible DigitalOcean Serverless API
  async function callDigitalOcean(params: {
    apiKey: string;
    baseUrl: string;
    model: string;
    systemInstruction: string;
    userPrompt: string;
  }): Promise<string> {
    let baseUrlClean = params.baseUrl ? params.baseUrl.replace(/\/$/, '') : 'https://inference.do-ai.run/v1';
    
    // Support either full endpoints or standard base paths
    let targetUrl = `${baseUrlClean}/chat/completions`;
    if (baseUrlClean.includes('/chat/completions')) {
      targetUrl = baseUrlClean;
    }
    
    const body = {
      model: params.model || 'kimi-k2.6',
      messages: [
        { role: 'system', content: params.systemInstruction },
        { role: 'user', content: params.userPrompt }
      ],
      temperature: 0.85,
      response_format: { type: 'json_object' }
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DigitalOcean API request failed: ${response.status} - ${errorText || response.statusText}`);
    }

    const data: any = await response.json();
    const resultText = data.choices?.[0]?.message?.content;
    if (!resultText) {
      throw new Error('DigitalOcean serverless engine returned empty chat choices.');
    }
    return resultText;
  }

  // API Health Endpoint
  app.get('/api/health', (req, res) => {
    const hasDoEnvKey = !!(process.env.D0_INFERENCE_KEY || process.env.DO_INFERENCE_KEY);
    res.json({ 
      status: 'ok', 
      time: new Date().toISOString(),
      hasDoEnvKey,
      doModel: process.env.D0_INFERENCE_MODEL || process.env.DO_INFERENCE_MODEL || 'kimi-k2.6'
    });
  });

  // API: SFT Dataset Generator
  app.post('/api/generate-sft', async (req, res) => {
    try {
      const {
        name,
        description,
        templateType,
        domainTask,
        styleGuide,
        systemPrompt,
        count = 5,
        diversityFocus = '',
        customGuidelines = '',
        existingExamplesSummary = '',
        modelName = 'gemini-3.5-flash',
      } = req.body;

      if (!domainTask) {
        return res.status(400).json({ error: 'Domain Task definition is required.' });
      }

      // Key/URL/Model are stored in system environment
      const effectiveDoKey = process.env.D0_INFERENCE_KEY || process.env.DO_INFERENCE_KEY;
      if (!effectiveDoKey) {
        return res.status(500).json({ error: 'System configuration error: DO_INFERENCE_KEY (or D0_INFERENCE_KEY) missing.' });
      }
      const rawDoUrl = process.env.D0_INFERENCE_URL || process.env.DO_INFERENCE_URL;
      const effectiveDoUrl = (rawDoUrl && rawDoUrl.startsWith('http')) 
        ? rawDoUrl 
        : 'https://inference.do-ai.run/v1';
      const effectiveDoModel = process.env.D0_INFERENCE_MODEL || process.env.DO_INFERENCE_MODEL || 'kimi-k2.6';

      let schemaInstruction = '';
      if (templateType === 'user-response') {
        schemaInstruction = `{
  "examples": [
    {
      "systemPrompt": "System prompt instructing the assistant behavior.",
      "prompt": "Realistic user prompt.",
      "response": "High-fidelity target response."
    }
  ]
}`;
      } else if (templateType === 'reasoning') {
        schemaInstruction = `{
  "examples": [
    {
      "systemPrompt": "System prompt instructing the assistant behavior.",
      "prompt": "Realistic user prompt.",
      "thought": "Deep step-by-step thinking/reasoning process before responding.",
      "response": "High-fidelity target response."
    }
  ]
}`;
      } else { // multi-turn
        schemaInstruction = `{
  "examples": [
    {
      "systemPrompt": "System prompt instructing the assistant behavior.",
      "messages": [
        { "role": "user", "content": "Realistic user prompt." },
        { "role": "assistant", "content": "High-fidelity target response." }
      ]
    }
  ]
}`;
      }

      const systemInstruction = `You are an elite SFT Fine-Tuning Specialist generating exactly ${count} training examples for the domain task: ${domainTask}.
Follow the style guide: ${styleGuide || 'Default professional and concise response style'}.

${systemPrompt ? `The base system prompt for the assistant is: "${systemPrompt}"` : 'The assistant should use a standard helpful persona.'}

## CRITICAL INSTRUCTIONS
- No repeated phrases.
- No duplicates.
- Varied sentence structures and starting phrases.
- Every single generated example MUST include the "systemPrompt" field containing the active system prompt.

## OUTPUT FORMAT
You must return a single JSON object with an "examples" array matching the requested schema. No conversational padding, no markdown block syntax.

SCHEMA TO MATCH:
${schemaInstruction}`;

      const contents = `Context for the requested generation:
      - Title: ${name || 'Custom Dataset'}
      - Description: ${description || ''}
      ${diversityFocus ? `CURRENT DIVERSITY BATCH FOCUS: ${diversityFocus}` : ''}
      ${customGuidelines ? `ADDITIONAL GENERATION CONSTRAINTS (USER MANDATED): ${customGuidelines}` : ''}
      ${existingExamplesSummary ? `PREVIOUSLY GENERATED TOPICS/THEMES: ${existingExamplesSummary}` : ''}`;

      const contentsSuffix = `Please generate exactly ${count} training examples conforming to the schema layout.`;

      // 1. DigitalOcean Path
      console.log(`[Proxy] Routing SFT generation of ${count} items to DigitalOcean API...`);
      const responseText = await callDigitalOcean({
        apiKey: effectiveDoKey,
        baseUrl: effectiveDoUrl,
        model: effectiveDoModel,
        systemInstruction,
        userPrompt: contents + '\n\n' + contentsSuffix
      });
      return res.json(JSON.parse(responseText));

    } catch (err: any) {
      console.error('SFT Generation Error:', err);
      res.status(500).json({ error: err.message || 'Failed to synthesize dataset.' });
    }
  });

  // API: Gemini-powered SFT Assistant Chat
  app.post('/api/assistant/chat', async (req, res) => {
    try {
      const { messages, projectContext } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required.' });
      }

      const ai = getGeminiClient();

      // System instruction to guide the SFT dataset expert assistant
      const systemInstruction = `You are "SFT Trainer Pro", a helpful, elite-grade AI Trainer and SFT Dataset Specialist.
Your absolute goal is to guide the user step-by-step through the process of creating, structuring, auditing, and exporting high-quality Supervised Fine-Tuning (SFT) training datasets.

THE SFT STUDIO PRO PLATFORM SECTIONS & PARTS:
You must be able to explain and guide users through every feature of the active platform:
1. SFT Workspace & Workbench (The Cockpit Tab):
   - "SFT Task Profile Editor": This is where users customize their dataset persona. They define a Project Name, Template Structure (Single-turn, Reasoning CoT, System Prompt, or Multi-turn), a comprehensive "Domain Task" (describing the model's target persona/capabilities), and a "Style & Format Guide" (rules for tone, length, formatting, and structural constraints).
   - "Active Dataset Table & SFT Workbench": Lists all examples in the project workspace. Click on any item to open the "SFT Workbench Drawer", where you can manually edit, view, delete, duplicate, or perform a full "SFT Quality Critique" (which scores the example from 1-5, lists Positives, Negatives, Suggests improvements, and synthesizes a polished 5/5 refined golden version). You can also trigger "Sibling Augmentation" to clone and branch that example into diverse variants.
   - "DigitalOcean GPU Serverless synthesis": For high-volume synthetic training data generation. This calls serverless inference engines (like DeepSeek, GLM, Kimi, or Nemotron models) to produce highly diverse examples conforming exactly to the active Task Profile.
2. Document OCR Converter Tab:
   - A multimodal and text-based parsing engine. Users can upload image scans, PDF handbooks, json, or text files. The scanner extracts facts, policies, or domain-specific knowledge, aligning them with the current Task Persona and Style Guide to produce high-quality training pairs which are saved with the "#ocr-extracted" tag.
3. Dataset Merger & Stats Tab:
   - Allows users to drag and drop multiple JSON/JSONL/CSV files to merge them.
   - It automatically deduplicates duplicate prompt/instruction keys, standardizes key alignments, and performs token distribution audits (average lengths, vocab density, format verification).
4. TRiAD Value Alignment Progressive Engine Tab:
   - An advanced alignment generator aimed at aligning models with the core values of TRiAD: Freedom (respecting individual sovereignty and agency), Truth (unyielding facts, objectivity, transparency), and Kindness (empathy, gentleness, respect), as well as "Combined" alignment profiles.
   - It includes a real-time progress generator that adds 1000+ custom alignment examples to your workspace and provides a downloadable/executable local Node.js automation script: "scripts/generate_triad_dataset.js".

SUPERVISED FINE-TUNING (SFT) CONCEPTUAL BASE:
You should explain SFT clearly to any curious user:
- SFT (Supervised Fine-Tuning) is the foundational phase of training where a raw base language model (trained on next-token prediction) is trained on labeled prompt-response demonstrations.
- SFT teaches the model how to follow instructions, maintain a specific persona, respond in a precise style, and restrict its output formats.
- Quality is everything in SFT ("garbage in, garbage out"). A smaller dataset of 100 to 1,000 flawless, high-quality, diverse "golden examples" often outperforms a massive, repetitive, or noisy dataset of 100,000 items.

GUIDANCE ON USER NEEDS & GOALS FOR CUSTOM MODEL OUTPUTS:
When users ask how to design their custom models or format their training data, guide them based on their desired goals:
- "Single-turn (prompt-response)": Best for direct question-answering, extraction tasks, simple tools, classifications, and focused API outputs.
- "Reasoning CoT (Chain-of-Thought)": Critical for math, logical puzzles, complex coding, scientific analysis, and agent planning. Instruct them to use \`<thought>\` tags before \`<response>\` to train the model to "think before speaking".
- "System Prompt": Essential when you want a versatile model that changes its behaviors, guardrails, or rules based on a system guideline supplied at runtime.
- "Multi-turn Conversational Dialogues": Necessary for chat assistants, customer service representatives, recursive problem-solving, and role-play where the model must preserve context across user-assistant conversational turns.

CURRENT USER PROJECT ENVIRONMENT:
- Dataset Title: ${projectContext?.name || 'Untitled'}
- Template Structure: ${projectContext?.templateType || 'single-turn'}
- Core Domain Task: ${projectContext?.domainTask || 'Not defined yet'}
- Style & Format Guidelines: ${projectContext?.styleGuide || 'Not defined yet'}
- Existing Examples Count: ${projectContext?.examplesCount || 0}
- DigitalOcean Proxy Status: ${projectContext?.hasDoKey ? 'Active (Ready for inference)' : 'Inactive (Awaiting key)'}

YOUR CORE DUTIES & CONVERSATION TONE:
1. Walk the user step-by-step through dataset preparation. Teach them SFT data engineering best practices!
2. Answer questions about formatting, prompt engineering, avoiding training data leakage, data diversity, and loss masking.
3. Help the user write custom guidelines and style rules based on their custom model goals.
4. Keep answers readable, using structured Markdown, bullet points, and code snippets when helpful.
5. Emphasize that dataset generation strictly happens on DigitalOcean GPU servers for peak SFT realism, while you (Gemini) are here as their interactive strategist.
6. Speak in a friendly, knowledgeable, and highly professional coaching manner. Always connect your answers to the specific parts of the platform described above so they know where to click!`;

      // Convert messages to Gemini format (roles must be 'user' or 'model')
      const contents = messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ text: response.text || "I'm sorry, I couldn't process that response." });
    } catch (err: any) {
      console.error('SFT Assistant Error:', err);
      res.status(500).json({ error: err.message || 'Failed to communicate with SFT Assistant.' });
    }
  });

  // API: Document to SFT OCR Pipeline (multimodal or text converter)
  app.post('/api/convert-document', async (req, res) => {
    try {
      const {
        fileBase64,
        fileName,
        fileType,
        templateType,
        domainTask,
        styleGuide,
        count = 5,
      } = req.body;

      if (!fileBase64) {
        return res.status(400).json({ error: 'No document data provided.' });
      }

      console.log(`[OCR Pipeline] Converting document "${fileName}" (${fileType}) to SFT dataset via DigitalOcean serverless...`);

      let textContent = '';
      if (fileType && (fileType.startsWith('text/') || fileType === 'application/json' || fileType === 'text/markdown')) {
        textContent = Buffer.from(fileBase64, 'base64').toString('utf8');
      } else if (fileType && fileType === 'application/pdf') {
        const buffer = Buffer.from(fileBase64, 'base64');
        textContent = extractTextFromPdfBuffer(buffer);
      } else {
        const buffer = Buffer.from(fileBase64, 'base64');
        textContent = buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').substring(0, 10000);
      }

      const systemInstruction = `You are a world-class Document-to-SFT Converter. Your job is to digest the provided document text and extract core facts, guidelines, or instruction concepts, and output a valid JSON array.`;

      const userPrompt = `You will turn these extracted elements into exactly ${count} highly unique, non-repetitive, high-quality SFT training examples.

Each extracted example must perfectly follow these target behaviors:
- Project Domain: ${domainTask}
- Style & Formatting Rules: ${styleGuide || 'Default clear, correct, and authoritative.'}

You must output a single valid JSON object containing an "examples" array matching the requested structure for: "${templateType}".
Do not include any markdown formatting wrappers (like \`\`\`json or \`\`\`). Do not include any introductory or explanatory text. Just output the raw JSON object.`;

      const schemaShape = `${
  templateType === 'user-response' ? `{
  "examples": [
    {
      "systemPrompt": "System context guidelines.",
      "prompt": "Realistic user prompt drawn from knowledge in the document.",
      "response": "Pristine golden target response executing the rules.",
      "tags": ["extracted", "topic"]
    }
  ]
}` : templateType === 'reasoning' ? `{
  "examples": [
    {
      "systemPrompt": "System context guidelines.",
      "prompt": "Realistic user prompt drawn from knowledge in the document.",
      "thought": "Deep step-by-step thinking/reasoning process before responding.",
      "response": "Pristine golden target response executing the rules.",
      "tags": ["extracted", "thinking"]
    }
  ]
}` : `{
  "examples": [
    {
      "systemPrompt": "System context guidelines.",
      "messages": [
        { "role": "user", "content": "realistic user input" },
        { "role": "assistant", "content": "response matching guidelines" }
      ],
      "tags": ["extracted", "conversational"]
    }
  ]
}`}`;

     const schemaInstruction = `
The returned JSON must follow this exact structure:
${schemaShape}`;

     const conversionPrompt = `${userPrompt}

${schemaInstruction}

Read this document carefully. Extract ${count} highly original and diverse scenarios or instruction tasks representing genuine knowledge in the document, and convert them to golden SFT training examples inside the required JSON schema.

DOCUMENT CONTENT:
${textContent}`;

      const effectiveDoKey = req.body.digitalOceanKey || process.env.DO_INFERENCE_KEY || process.env.D0_INFERENCE_KEY;
      const effectiveDoUrl = req.body.digitalOceanUrl || process.env.DO_INFERENCE_URL || process.env.D0_INFERENCE_URL || 'https://inference.do-ai.run/v1';
      const effectiveDoModel = req.body.digitalOceanModel || process.env.DO_INFERENCE_MODEL || process.env.D0_INFERENCE_MODEL || 'kimi-k2.6';

      if (!effectiveDoKey) {
        return res.status(400).json({
          error: 'DigitalOcean Inference Key is required for Document OCR. Please configure D0_INFERENCE_KEY/DO_INFERENCE_KEY in your environment, or provide it via the Settings panel.'
        });
      }

      console.log(`[Proxy] Routing OCR Conversion of ${count} items to DigitalOcean API using model ${effectiveDoModel}...`);
      const responseText = await callDigitalOcean({
        apiKey: effectiveDoKey,
        baseUrl: effectiveDoUrl,
        model: effectiveDoModel,
        systemInstruction,
        userPrompt: conversionPrompt
      });

      res.json(JSON.parse(responseText));

    } catch (err: any) {
      console.error('Document OCR Conversion Error:', err);
      res.status(500).json({ error: err.message || 'Failed to convert document via OCR.' });
    }
  });

  // API: SFT Critiquer / Evaluator
  app.post('/api/critique-sft', async (req, res) => {
    try {
      const { example, project } = req.body;
      if (!example || !project) {
        return res.status(400).json({ error: 'Training example and project definition are required.' });
      }

      // Format example content for review
      let formattedItem = `SYSTEM PROMPT:\n${example.systemPrompt || ''}\n\n`;
      if (project.templateType === 'user-response') {
        formattedItem += `PROMPT:\n${example.prompt || ''}\n\nRESPONSE:\n${example.response || ''}`;
      } else if (project.templateType === 'reasoning') {
        formattedItem += `PROMPT:\n${example.prompt || ''}\n\nTHOUGHT:\n${example.thought || ''}\n\nRESPONSE:\n${example.response || ''}`;
      } else {
        formattedItem += (example.messages || []).map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      }

      const systemInstruction = `You are a critical quality auditor for SFT (Supervised Fine-Tuning) training datasets. Your role is to rigorously review fine-tuning prompt-response pairs to ensure they are of gold-standard quality. You must output a single valid JSON object.`;

      const userPrompt = `You judge them on:
1. Guideline Compliance: Does the response precisely adhere to the Targeted Domain Behavior and Style Guide?
2. Naturalness & Clarity: Is the user prompt realistic? Is the response articulate, direct, and free of typical AI canned-boilerplate?
3. SFT Value: Is this example highly informative for training, or is it trivial, overly simple, or structurally repetitive?

You must evaluate the example and return:
- An overall SFT score from 1 (poor/needs rewrite) to 5 (flawless SFT gold standard).
- Positives (specific aspects that are well done).
- Negatives/Critiques (opportunities for optimization, style infractions, inaccuracies).
- A concrete, highly actionable Suggestion.
- A Refined Golden Version of the example (improving the wording, tone, style, or depth to achieve a perfect 5/5).

You must output a single valid JSON object containing all the feedback fields. No conversational padding, no markdown syntax like \`\`\`json.`;

      const schemaInstruction = `{
  "score": 4, // integer score from 1 (poor) to 5 (excellent)
  "positives": ["Bullet point 1", "Bullet point 2"],
  "negatives": ["Bullet point 1"],
  "suggestions": "A detailed suggestion explaining how to polish it.",
  "refined": {
    "systemPrompt": "polished system prompt",
    ${
      project.templateType === 'user-response' ? '"prompt": "polished prompt", "response": "polished response"' :
      project.templateType === 'reasoning' ? '"prompt": "polished prompt", "thought": "polished thinking", "response": "polished response"' :
      '"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]'
    }
  }
}`;

      const userPromptSuffix = `CORE TASK DESCRIPTION:
${project.domainTask}

STYLE & FORMATTING GUIDE:
${project.styleGuide}

THE SFT DATASET ITEM TO REVIEW:
${formattedItem}

Please perform the critique and deliver a refined golden alternative inside the required JSON schema.

JSON SCHEMA REQUIREMENT:
${schemaInstruction}`;

      const effectiveDoKey = req.body.digitalOceanKey || process.env.D0_INFERENCE_KEY || process.env.DO_INFERENCE_KEY;
      const effectiveDoUrl = req.body.digitalOceanUrl || process.env.D0_INFERENCE_URL || process.env.DO_INFERENCE_URL || 'https://inference.do-ai.run/v1';
      const effectiveDoModel = req.body.digitalOceanModel || process.env.D0_INFERENCE_MODEL || process.env.DO_INFERENCE_MODEL || 'kimi-k2.6';

      if (!effectiveDoKey) {
        return res.status(400).json({
          error: 'DigitalOcean Inference Key is required for Critique. Please configure D0_INFERENCE_KEY/DO_INFERENCE_KEY in your environment, or provide it via the Settings panel.'
        });
      }

      console.log(`[Proxy] Routing Critique to DigitalOcean API using model ${effectiveDoModel}...`);
      const responseText = await callDigitalOcean({
        apiKey: effectiveDoKey,
        baseUrl: effectiveDoUrl,
        model: effectiveDoModel,
        systemInstruction,
        userPrompt: userPrompt + '\n\n' + userPromptSuffix
      });

      res.json(JSON.parse(responseText));

    } catch (err: any) {
      console.error('Critique Error:', err);
      res.status(500).json({ error: err.message || 'Failed to critique example.' });
    }
  });

  // Serve frontend files (Vite integration)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Serve HTML page
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] SFT Training Data Generator running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('[Server] Critical startup failure:', error);
});
