import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language: string;
  key?: React.Key | number | string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950 shadow-inner">
      <div className="flex items-center justify-between bg-slate-900/90 px-3.5 py-1.5 border-b border-slate-800">
        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="text-slate-400 hover:text-amber-400 transition-colors p-1 rounded hover:bg-slate-800"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[10.5px] font-mono leading-relaxed text-slate-300 scrollbar-thin">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInlineMarkdown(text: string): React.ReactNode {
  // Matches bold (**bold** or __bold__), italics (*italic* or _italic_), and inline code (`code`)
  const regex = /(\*\*.*?\*\*|__.*?__|`.*?`|\*.*?\*|_.*?_)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return (
        <strong key={index} className="text-amber-400 font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return (
        <em key={index} className="text-slate-300 italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="bg-slate-950 border border-slate-800/60 px-1.5 py-0.2 rounded text-[10px] text-amber-500 font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderNormalBlocks(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = (key: number) => {
    if (!currentList) return;
    const ListTag = currentList.type === 'ul' ? 'ul' : 'ol';
    const listStyle = currentList.type === 'ul' 
      ? 'list-disc pl-5 space-y-1.5 my-2 text-slate-300' 
      : 'list-decimal pl-5 space-y-1.5 my-2 text-slate-300';
    
    elements.push(
      <ListTag key={`list-${key}`} className={listStyle}>
        {currentList.items.map((item, idx) => (
          <li key={idx} className="text-xs leading-relaxed font-sans">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ListTag>
    );
    currentList = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for unordered list item
    const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
    if (ulMatch) {
      if (currentList && currentList.type !== 'ul') {
        flushList(i);
      }
      if (!currentList) {
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(ulMatch[3]);
      continue;
    }

    // Check for ordered list item
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (currentList && currentList.type !== 'ol') {
        flushList(i);
      }
      if (!currentList) {
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(olMatch[3]);
      continue;
    }

    // Flush any list on non-list line
    if (currentList) {
      flushList(i);
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-sm font-bold text-slate-100 tracking-tight mt-4 mb-2 font-sans border-b border-slate-800 pb-1">
          {renderInlineMarkdown(trimmed.substring(2))}
        </h1>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-xs font-bold text-amber-500 tracking-tight mt-3 mb-1.5 font-sans">
          {renderInlineMarkdown(trimmed.substring(3))}
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-[11px] font-bold text-slate-200 tracking-tight mt-3 mb-1 font-sans">
          {renderInlineMarkdown(trimmed.substring(4))}
        </h3>
      );
    } else if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4 key={i} className="text-[10px] font-bold text-slate-300 tracking-tight mt-2 mb-1 font-sans">
          {renderInlineMarkdown(trimmed.substring(5))}
        </h4>
      );
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-amber-500/40 bg-slate-950/40 pl-3 py-1.5 my-2 rounded-r italic text-slate-400 text-xs">
          {renderInlineMarkdown(trimmed.substring(2))}
        </blockquote>
      );
    } else if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={i} className="border-slate-800 my-3" />);
    } else if (trimmed === '') {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(
        <p key={i} className="text-xs text-slate-300 leading-relaxed mb-1.5 font-sans">
          {renderInlineMarkdown(line)}
        </p>
      );
    }
  }

  if (currentList) {
    flushList(lines.length);
  }

  return <>{elements}</>;
}

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  // Split by code blocks (```)
  const parts = content.split(/```/g);

  return (
    <div className="markdown-body space-y-1 text-slate-300 text-xs">
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          // Odd indices are code blocks
          const lines = part.split('\n');
          const firstLine = lines[0].trim();
          const language = firstLine || 'code';
          const codeContent = lines.slice(1).join('\n');
          
          return (
            <CodeBlock 
              key={index} 
              code={codeContent.replace(/\s+$/, '')} 
              language={language} 
            />
          );
        } else {
          // Even indices are ordinary text block elements
          return <React.Fragment key={index}>{renderNormalBlocks(part)}</React.Fragment>;
        }
      })}
    </div>
  );
}
