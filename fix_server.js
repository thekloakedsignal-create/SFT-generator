import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

// Fix 1: "const contents = " duplicated.
content = content.replace("const contents = `Please generate exactly ${count} training examples.", "const contentsSuffix = `Please generate exactly ${count} training examples.");
content = content.replace("userPrompt: contents", "userPrompt: contents + '\\n\\n' + contentsSuffix");
content = content.replace("const contents = `TARGET TRAINING PROFILE & USER INSTRUCTIONS:\nTARGET TRAINING PROFILE & USER INSTRUCTIONS:", "const contents = `TARGET TRAINING PROFILE & USER INSTRUCTIONS:");

// Fix 2: CORE TASK DESCRIPTION: missing backtick
content = content.replace("}\`\n\nCORE TASK DESCRIPTION:", "}\`;\n\n      const userPrompt = \`CORE TASK DESCRIPTION:");

fs.writeFileSync('server.ts', content);
