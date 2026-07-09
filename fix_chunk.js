import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace("const chunkSize = 5;", "const chunkSize = countRequested;");

fs.writeFileSync('src/App.tsx', content);
