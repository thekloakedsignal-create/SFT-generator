import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');
content = content.replace("  MessageSquare,\n  Sparkles,\n  Loader2,\n  Check\n} from 'lucide-react';", "  MessageSquare,\n  Loader2,\n  Check\n} from 'lucide-react';");
fs.writeFileSync('src/App.tsx', content);
