import React from 'react';

interface MarkdownViewProps {
  content: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content }) => {
  // Simple markdown processor converting bold, italic, code blocks, bullet points, headers to HTML
  const formatMarkdown = (text: string) => {
    if (!text) return '';
    
    let html = text
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.*$)/gim, '<h4 class="text-sm font-bold text-slate-800 mt-3 mb-1.5">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 class="text-base font-bold text-slate-900 mt-4 mb-2">$1</h3>')
      .replace(/^# (.*$)/gim, '<h2 class="text-lg font-extrabold text-indigo-700 mt-5 mb-2.5">$1</h2>')
      // Code blocks
      .replace(/```([\s\S]*?)```/gm, '<pre class="bg-slate-50 text-slate-800 font-mono text-xs p-3 rounded-lg border border-slate-200 overflow-x-auto my-2">$1</pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-indigo-600 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-slate-950">$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
      // Bullets
      .replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc text-slate-600 mb-1">$1</li>')
      // Bullet wrapper
      .replace(/(<li class=".*">.*<\/li>)/g, '<ul class="my-2 space-y-1">$1</ul>')
      // Clean duplicate wrap
      .replace(/<\/ul>\s*<ul class="my-2 space-y-1">/g, '')
      // Paragraph support for normal lines
      .split('\n')
      .map(line => {
        if (!line.trim()) return '';
        if (line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<li') || line.startsWith('<pre')) return line;
        return `<p class="text-sm text-slate-600 leading-relaxed mb-2">${line}</p>`;
      })
      .join('\n');
      
    return html;
  };

  return (
    <div 
      className="prose prose-slate max-w-none text-slate-700"
      dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
    />
  );
};
