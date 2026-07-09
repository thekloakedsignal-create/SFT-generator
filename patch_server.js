import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

// First replace for generate-sft
let target1 = `      // Compose the prompt instruction set
      const systemInstruction = \`You are "SFT-Engine-Ultra", a world-class, expert-level Supervised Fine-Tuning (SFT) training data generator. Your job is to synthesize high-quality, pristine, and diverse SFT training dataset examples.

You must adhere strictly to raw syntax and structural requirements to ensure flawless JSON serialization.`;

let replacement1 = `      // Compose the prompt instruction set
      const systemInstruction = \`You are "SFT-Engine-Ultra", a world-class, expert-level Supervised Fine-Tuning (SFT) training data generator. Your job is to synthesize high-quality, pristine, and diverse SFT training dataset examples. You must adhere strictly to raw syntax and structural requirements to ensure flawless JSON serialization.\`;

      const contents = \`TARGET TRAINING PROFILE & USER INSTRUCTIONS:`;

content = content.replace(target1, replacement1);


let target2 = `      ],
      "tags": ["topic", "conversational"]
    }
  ]
}\`}\`;

      const contents = \`Please generate exactly \${count} training examples.
      Perform the generation and output the array inside a JSON object conforming to the schema.\`;`;

let replacement2 = `      ],
      "tags": ["topic", "conversational"]
    }
  ]
}\`}

Please generate exactly \${count} training examples.
Perform the generation and output the array inside a JSON object conforming to the schema.\`;`;

content = content.replace(target2, replacement2);


// Replace OCR route
let target3 = `      const systemInstruction = \`You are a world-class Document-to-SFT Converter.
Your job is to digest the provided document text and extract core facts, guidelines, or instruction concepts.
You will turn these extracted elements into exactly \${count} highly unique, non-repetitive, high-quality SFT training examples.

Each extracted example must perfectly follow these target behaviors:
- Project Domain: \${domainTask}`;

let replacement3 = `      const systemInstruction = \`You are a world-class Document-to-SFT Converter. Your job is to digest the provided document text and extract core facts, guidelines, or instruction concepts, and output a valid JSON array.\`;

      const userPrompt = \`You will turn these extracted elements into exactly \${count} highly unique, non-repetitive, high-quality SFT training examples.

Each extracted example must perfectly follow these target behaviors:
- Project Domain: \${domainTask}`;

content = content.replace(target3, replacement3);


let target4 = `      "tags": ["extracted", "conversational"]
    }
  ]
}\`}\`;

      const userPrompt = \`Read this document carefully. Extract \${count} highly original and diverse scenarios or instruction tasks representing genuine knowledge in the document, and convert them to golden SFT training examples inside the required JSON schema.`;

let replacement4 = `      "tags": ["extracted", "conversational"]
    }
  ]
}\`}

Read this document carefully. Extract \${count} highly original and diverse scenarios or instruction tasks representing genuine knowledge in the document, and convert them to golden SFT training examples inside the required JSON schema.`;

content = content.replace(target4, replacement4);


// Replace Critique route
let target5 = `      const systemInstruction = \`You are a critical quality auditor for SFT (Supervised Fine-Tuning) training datasets.
Your role is to rigorously review fine-tuning prompt-response pairs to ensure they are of gold-standard quality.

You judge them on:`;

let replacement5 = `      const systemInstruction = \`You are a critical quality auditor for SFT (Supervised Fine-Tuning) training datasets. Your role is to rigorously review fine-tuning prompt-response pairs to ensure they are of gold-standard quality. You must output a single valid JSON object.\`;

      const userPrompt = \`You judge them on:`;

content = content.replace(target5, replacement5);

let target6 = `  }
}\`;

      const userPrompt = \`CORE TASK DESCRIPTION:`;

let replacement6 = `  }
}\`

CORE TASK DESCRIPTION:`;

content = content.replace(target6, replacement6);


// Replace Augment route
let target7 = `      const systemInstruction = \`You are an SFT Data Augmenter.
Your job is to take an existing EXCELLENT "golden" training example, and synthesize \${count} sibling examples.

A sibling example:`;

let replacement7 = `      const systemInstruction = \`You are an SFT Data Augmenter. Your job is to take an existing EXCELLENT "golden" training example, and synthesize \${count} sibling examples. You must output a single valid JSON object containing an "examples" array.\`;

      const userPrompt = \`A sibling example:`;

content = content.replace(target7, replacement7);

let target8 = `      "tags": ["sibling", "conversational"]
    }
  ]
}\`}\`;

      const userPrompt = \`CORE TASK DESCRIPTION:`;

let replacement8 = `      "tags": ["sibling", "conversational"]
    }
  ]
}\`}

CORE TASK DESCRIPTION:`;

content = content.replace(target8, replacement8);

fs.writeFileSync('server.ts', content);
