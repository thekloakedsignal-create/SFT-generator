import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace("  MessageSquare\n  Sparkles", "  MessageSquare,\n  Sparkles");
fs.writeFileSync('src/App.tsx', content);
