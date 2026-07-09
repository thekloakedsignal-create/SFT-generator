import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

// The Augment route got mangled. Let's fix it manually.
const matchStr = `}

CORE TASK DESCRIPTION:
\${project.domainTask}
STYLE & FORMATTING GUIDE:
\${project.styleGuide}
ORIGINAL GOLDEN EXAMPLE TO AUGMENT:
\${formattedItem}

Generate exactly \${count} new diverse sibling examples matching this format.

JSON SCHEMA REQUIREMENT:
\${schemaInstruction}\`;`;

const correctStr = `}\`;

      const userPromptSuffix = \`CORE TASK DESCRIPTION:
\${project.domainTask}
STYLE & FORMATTING GUIDE:
\${project.styleGuide}
ORIGINAL GOLDEN EXAMPLE TO AUGMENT:
\${formattedItem}

Generate exactly \${count} new diverse sibling examples matching this format.

JSON SCHEMA REQUIREMENT:
\${schemaInstruction}\`;`;

content = content.replace(matchStr, correctStr);
content = content.replace("        userPrompt\n      });", "        userPrompt: userPrompt + '\\n\\n' + userPromptSuffix\n      });");

fs.writeFileSync('server.ts', content);
