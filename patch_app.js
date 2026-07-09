import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Add states
const stateAddition = `
  const [showSettings, setShowSettings] = useState(false);
  const [pendingBatch, setPendingBatch] = useState<SFTExample[] | null>(null);
  const [isCheckingAssistant, setIsCheckingAssistant] = useState(false);
  const [assistantReviewFeedback, setAssistantReviewFeedback] = useState('');
`;
content = content.replace('const [showSettings, setShowSettings] = useState(false);', stateAddition);

// Update handleSynthesizeBatch
content = content.replace(/syncExamples\(\[\.\.\.parsedItems, \.\.\.examples\]\);/g, `
// syncExamples([...parsedItems, ...examples]);
`);
content = content.replace(/setProgressStatus\(\`Pipeline completed successfully! Curated \$\{countRequested\} items\.\`\);\s+setTimeout\(\(\) => setProgressStatus\(''\), 3000\);/g, `
      setProgressStatus(\`Pipeline completed successfully! Curated \$\{countRequested\} items.\`);
      setPendingBatch(accumulatedSFTItems);
      setTimeout(() => setProgressStatus(''), 3000);
`);

// Add Batch Review Modal rendering at the end of the return statement
const reviewModal = `
      {pendingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                Review Generated Batch
              </h2>
              <span className="bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-xs font-semibold">
                {pendingBatch.length} items
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              {assistantReviewFeedback && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Gemini AI Quality Review
                  </h3>
                  <div className="text-sm text-blue-900 whitespace-pre-wrap">
                    {assistantReviewFeedback}
                  </div>
                </div>
              )}
              <div className="space-y-6">
                {pendingBatch.map((ex, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Example {idx + 1}</h3>
                    {ex.systemPrompt && (
                      <div className="mb-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">System Prompt</span>
                        <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-100 whitespace-pre-wrap">
                          {ex.systemPrompt}
                        </div>
                      </div>
                    )}
                    {ex.prompt && (
                      <div className="mb-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">User Prompt</span>
                        <div className="text-sm text-gray-700 bg-blue-50/50 p-3 rounded-md border border-blue-100/50 whitespace-pre-wrap">
                          {ex.prompt}
                        </div>
                      </div>
                    )}
                    {ex.thought && (
                      <div className="mb-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Thought Process</span>
                        <div className="text-sm text-gray-700 bg-purple-50/50 p-3 rounded-md border border-purple-100/50 whitespace-pre-wrap">
                          {ex.thought}
                        </div>
                      </div>
                    )}
                    {ex.response && (
                      <div className="mb-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Assistant Response</span>
                        <div className="text-sm text-gray-700 bg-emerald-50/50 p-3 rounded-md border border-emerald-100/50 whitespace-pre-wrap">
                          {ex.response}
                        </div>
                      </div>
                    )}
                    {ex.messages && ex.messages.length > 0 && (
                      <div className="space-y-3 mt-4">
                        {ex.messages.map((m, mIdx) => (
                          <div key={mIdx} className={\`p-3 rounded-lg text-sm whitespace-pre-wrap \${m.role === 'user' ? 'bg-blue-50/50 text-blue-900 border border-blue-100/50 ml-8' : m.role === 'assistant' ? 'bg-emerald-50/50 text-emerald-900 border border-emerald-100/50 mr-8' : 'bg-gray-100 text-gray-700'}\`}>
                            <span className="font-semibold block mb-1 uppercase tracking-wider text-[10px] opacity-50">{m.role}</span>
                            {m.content}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end gap-3 items-center">
              <button 
                onClick={() => {
                  setPendingBatch(null);
                  setAssistantReviewFeedback('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors mr-auto"
              >
                Discard Batch
              </button>
              
              <button
                onClick={async () => {
                  setIsCheckingAssistant(true);
                  try {
                    const batchContent = pendingBatch.map((ex, i) => \`Example \${i + 1}:\n\${ex.prompt ? 'User: ' + ex.prompt : ''}\n\${ex.response ? 'Assistant: ' + ex.response : ''}\n\${ex.messages ? JSON.stringify(ex.messages) : ''}\`).join('\\n\\n');
                    const res = await fetch('/api/assistant/chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        messages: [{ role: 'user', content: \`Please review this generated batch of examples for quality and diversity. Give a highly critical, concise review.\\n\\n\${batchContent}\` }],
                        projectContext: activeProject
                      })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setAssistantReviewFeedback(data.reply);
                    } else {
                      setAssistantReviewFeedback('Failed to get assistant review.');
                    }
                  } catch (e) {
                    setAssistantReviewFeedback('Error communicating with assistant.');
                  } finally {
                    setIsCheckingAssistant(false);
                  }
                }}
                disabled={isCheckingAssistant}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isCheckingAssistant ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Check with Assistant
              </button>

              <button
                onClick={() => {
                  syncExamples([...pendingBatch, ...examples]);
                  setPendingBatch(null);
                  setAssistantReviewFeedback('');
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white hover:bg-black rounded-lg text-sm font-medium transition-colors"
              >
                <Check className="w-4 h-4" />
                Approve Document
              </button>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace('{showSettings && (', reviewModal + '\n      {showSettings && (');

fs.writeFileSync('src/App.tsx', content);
