import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

// Fix duplicate userPrompt in Critique
content = content.replace("const userPrompt = `CORE TASK DESCRIPTION:", "const userPromptSuffix = `CORE TASK DESCRIPTION:");
content = content.replace("userPrompt\n      });", "userPrompt: userPrompt + '\\n\\n' + userPromptSuffix\n      });");

// Fix duplicate userPrompt in Augment route just in case
content = content.replace("const userPrompt = `CORE TASK DESCRIPTION:", "const userPromptSuffix = `CORE TASK DESCRIPTION:");
// We need to be careful with the second replacement because there might be multiple.
content = content.replace("userPrompt\n      });", "userPrompt: userPrompt + '\\n\\n' + userPromptSuffix\n      });");

fs.writeFileSync('server.ts', content);
