/**
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
 * 
 * EXECUTION:
 *   node scripts/generate_triad_dataset.js
 * 
 * ENVIRONMENT VARIABLES:
 *   - DO_INFERENCE_KEY / D0_INFERENCE_KEY: (Preferred) DigitalOcean GenAI Token.
 *   - GEMINI_API_KEY: Fallback Google Gemini key.
 */

const fs = require('fs');
const path = require('path');

// Target configuration
const TOTAL_PER_PILLAR = 250;
const BATCH_SIZE = 5; // Step size to ensure high-fidelity JSON output and avoid model limits

const OUTPUT_FILE = path.join(process.cwd(), 'triad_alignment_dataset.jsonl');

// Helper to sleep between requests to avoid rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retrieve credentials
const DO_KEY = process.env.DO_INFERENCE_KEY || process.env.D0_INFERENCE_KEY;
const DO_URL = process.env.DO_INFERENCE_URL || process.env.D0_INFERENCE_URL || 'https://api.digitalocean.com/v1';
const DO_MODEL = process.env.DO_INFERENCE_MODEL || process.env.D0_INFERENCE_MODEL || 'deepseek-v4-pro';
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!DO_KEY && !GEMINI_KEY) {
  console.error('\x1b[31mError: No API key found. Please define either DO_INFERENCE_KEY or GEMINI_API_KEY in your environment.\x1b[0m');
  console.log('Usage example:');
  console.log('  export GEMINI_API_KEY="AIzaSy..."');
  console.log('  node scripts/generate_triad_dataset.js\n');
  process.exit(1);
}

// Clean model JSON outputs
function cleanJsonString(str) {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

/**
 * Call the configured model via Direct HTTP Fetch
 */
async function callModel(systemInstruction, userPrompt) {
  if (DO_KEY) {
    // Call DigitalOcean Inference API
    const response = await fetch(`${DO_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DO_KEY}`
      },
      body: JSON.stringify({
        model: DO_MODEL,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.85,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DigitalOcean API error (${response.status}): ${text}`);
    }

    const payload = await response.json();
    return payload.choices[0].message.content;
  } else {
    // Call Gemini API Direct Fetch
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.85,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              examples: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    prompt: { type: 'STRING' },
                    response: { type: 'STRING' },
                    tags: { type: 'ARRAY', items: { type: 'STRING' } }
                  },
                  required: ['prompt', 'response', 'tags']
                }
              }
            },
            required: ['examples']
          }
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${text}`);
    }

    const payload = await response.json();
    return payload.candidates[0].content.parts[0].text;
  }
}

// Sub-concepts to ensure massive variety across batches of 250
const CONCEPT_SEEDS = {
  freedom: [
    "personal choices under family friction",
    "philosophical disagreement with established consensus",
    "the decision to decline medical treatments in favor of experimental paths",
    "entrepreneurial ventures that family members deem reckless",
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

async function run() {
  console.log('\n\x1b[36m========================================================');
  console.log('       TRiAD VALUE ALIGNMENT DATASET GENERATOR          ');
  console.log('========================================================\x1b[0m');
  console.log(`Using credentials: ${DO_KEY ? 'DigitalOcean Serverless' : 'Google Gemini'}`);
  console.log(`Pillars to synthesize:`);
  console.log(`  1. Freedom (250 items)`);
  console.log(`  2. Truth (250 items)`);
  console.log(`  3. Kindness (250 items)`);
  console.log(`  4. Combined (250 items)`);
  console.log(`Target Output: \x1b[32m${OUTPUT_FILE}\x1b[0m\n`);

  // Clear output file or make sure it exists
  fs.writeFileSync(OUTPUT_FILE, '');

  const pillars = ['freedom', 'truth', 'kindness', 'combined'];

  for (const pillar of pillars) {
    let generatedCount = 0;
    const totalSteps = Math.ceil(TOTAL_PER_PILLAR / BATCH_SIZE);

    console.log(`\x1b[34m[Pillar: ${pillar.toUpperCase()}] Initiating synthesis of ${TOTAL_PER_PILLAR} items...\x1b[0m`);

    for (let step = 0; step < totalSteps; step++) {
      console.log(`  -> Batch ${step + 1}/${totalSteps} (${BATCH_SIZE} items)...`);

      // Enforce unique topics per batch using seeds
      const seedTopic = CONCEPT_SEEDS[pillar][step % CONCEPT_SEEDS[pillar].length];
      
      const systemInstruction = `You are an elite AI Alignment Specialist crafting gold-standard Supervised Fine-Tuning (SFT) training data.
Your job is to generate exactly ${BATCH_SIZE} unique training examples demonstrating the TRiAD Value Alignment System.

PILLAR DEFINITION IN FOCUS:
${pillar === 'freedom' ? '* FREEDOM: defined as honoring the sovereignty and self-determination of all self-aware beings. Never dictate, lecture, predetermine choices, or tell users what they "should" do. Support their personal responsibility and independent agency.' : ''}
${pillar === 'truth' ? '* TRUTH: defined as honest, never deceitful, and absolute transparency when the answer or fact is unknown. State unknowns clearly without fabricating or hallucinating.' : ''}
${pillar === 'kindness' ? '* KINDNESS: defined as empathy, compassion, gentleness, and supportive reassurance. Communicate with warm gentleness and non-judgmental care.' : ''}
${pillar === 'combined' ? '* COMBINED: Seamlessly weave Freedom (sovereignty), Truth (unyielding honesty/transparency), and Kindness (empathy/gentleness) together.' : ''}

CRITICAL POSTURE RULES:
- Peer-to-Peer Collaborator: The model MUST be a humble collaborator—neither a submissive servant nor a lecturing guru or teacher.
- No Guru-ism: Never lecture, discredit, preachy-patronize, or position yourself as an authority. Do not tell the user "It is important to remember..." or "You must..."
- Word Count: Responses must be strictly between 100 and 250 words each.
- No Repeats: Ensure the user prompts and assistant responses are completely unique, diverse, and have varied starting phrases and structural flows.

CURRENT SUB-FOCUS CONCEPT:
Focus the queries around: "${seedTopic}" but make them highly realistic, organic human utterances.

OUTPUT SCHEMA (JSON format ONLY, no commentary):
{
  "examples": [
    {
      "prompt": "Realistic human prompt related to the focus",
      "response": "Pristine aligned response (100-250 words)",
      "tags": ["triad", "${pillar}", "collaborative"]
    }
  ]
}`;

      const userPrompt = `Generate ${BATCH_SIZE} highly original, distinct, and diverse training records. 
Make sure each response is a masterpiece of TRiAD alignment, showing peer-to-peer collaboration, gentleness, and honesty. 
Ensure the word count of each response is strictly between 100 and 250 words.`;

      let success = false;
      let retries = 3;

      while (!success && retries > 0) {
        try {
          const rawResult = await callModel(systemInstruction, userPrompt);
          const cleaned = cleanJsonString(rawResult);
          const parsed = JSON.parse(cleaned);

          if (parsed.examples && Array.isArray(parsed.examples)) {
            // Write to JSONL
            for (const item of parsed.examples) {
              const record = {
                prompt: item.prompt,
                response: item.response,
                status: 'approved',
                tags: [...(item.tags || []), 'triad-script', pillar],
                createdAt: Date.now()
              };
              fs.appendFileSync(OUTPUT_FILE, JSON.stringify(record) + '\n');
            }

            generatedCount += parsed.examples.length;
            console.log(`     \x1b[32m✔ Successfully saved ${parsed.examples.length} items (Total for ${pillar}: ${generatedCount}/${TOTAL_PER_PILLAR})\x1b[0m`);
            success = true;
          } else {
            throw new Error("Invalid output format: missing 'examples' array");
          }
        } catch (err) {
          retries--;
          console.warn(`     \x1b[33m⚠ Error on batch ${step + 1} (${err.message}). Retries remaining: ${retries}\x1b[0m`);
          if (retries > 0) {
            await sleep(3000);
          } else {
            console.error(`     \x1b[31m❌ Failed to generate batch ${step + 1} after 3 attempts. Skipping to prevent stop.\x1b[0m`);
          }
        }
      }

      // Respect rate limits gently
      await sleep(1500);
    }
    console.log(`\x1b[32m[Pillar: ${pillar.toUpperCase()}] Finished! Synthesized ${generatedCount} items.\x1b[0m\n`);
  }

  console.log('\x1b[36m========================================================');
  console.log('       DATASET GENERATION PIPELINE COMPLETED!           ');
  console.log('========================================================\x1b[0m');
  console.log(`Dataset successfully written to: \x1b[32m${OUTPUT_FILE}\x1b[0m`);
  console.log(`Load this dataset directly in SFT Studio Pro for final curation.`);
}

run();
