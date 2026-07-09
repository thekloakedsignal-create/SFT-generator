import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Update handleRunTriadGenerator
content = content.replace(/syncExamples\(\[\.\.\.parsedItems, \.\.\.examples\]\);/g, `
// syncExamples([...parsedItems, ...examples]);
`);
content = content.replace(/setTriadProgressCount\(totalSavedCount\);/g, `
setTriadProgressCount(totalSavedCount);
setPendingBatch(accumulatedSFTItems);
`);
fs.writeFileSync('src/App.tsx', content);
