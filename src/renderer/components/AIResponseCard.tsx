import React, { useState } from 'react';
import { AIResponse } from '../../shared/types';
import { Sparkles, Copy, Check, RefreshCw, Code, LayoutGrid, HeartHandshake, Zap } from 'lucide-react';

interface AIResponseCardProps {
  response: AIResponse | null;
  onRegenerate: () => void;
  onClear: () => void;
  fontSize?: 'sm' | 'base' | 'lg';
}

export const AIResponseCard: React.FC<AIResponseCardProps> = ({
  response,
  onRegenerate,
  onClear,
  fontSize = 'base',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (response?.content) {
      navigator.clipboard.writeText(response.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fontClass = fontSize === 'sm' ? 'text-xs' : fontSize === 'lg' ? 'text-base' : 'text-sm';

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case 'coding':
        return { label: 'LeetCode / Coding', icon: Code, color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
      case 'system-design':
        return { label: 'System Design', icon: LayoutGrid, color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' };
      case 'behavioral':
        return { label: 'Behavioral (STAR)', icon: HeartHandshake, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
      default:
        return { label: 'Quick Teleprompter', icon: Zap, color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' };
    }
  };

  if (!response) {
    return (
      <div className="mx-4 my-2 p-4 rounded-xl hud-glass-card border border-gray-700/30 text-center">
        <Sparkles className="w-5 h-5 mx-auto mb-2 text-indigo-400 opacity-60" />
        <p className="text-xs text-gray-400 font-medium">Ready to assist</p>
        <p className="text-[11px] text-gray-500 mt-0.5">
          AI triggers automatically when interviewer asks a question, or press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300 border border-gray-700 text-[10px]">Ctrl+Alt+Space</kbd>
        </p>
      </div>
    );
  }

  const badge = getModeBadge(response.mode);
  const BadgeIcon = badge.icon;

  // Simple formatting helper for markdown code blocks & bullets
  const renderFormattedContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const language = lines[0].match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : '';
        const code = language ? lines.slice(1).join('\n') : lines.join('\n');

        return (
          <div key={index} className="my-2 rounded-lg bg-black/60 border border-gray-800 p-2.5 overflow-x-auto text-xs font-mono text-emerald-300">
            {language && <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">{language}</div>}
            <pre className="select-text">{code}</pre>
          </div>
        );
      }

      return (
        <span key={index} className="whitespace-pre-wrap select-text">
          {part}
        </span>
      );
    });
  };

  return (
    <div className="mx-4 my-2 flex flex-col rounded-xl hud-glass-card border border-indigo-500/20 shadow-lg overflow-hidden transition-all">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-gray-800/80 bg-gray-900/40">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${badge.color}`}>
            <BadgeIcon className="w-3 h-3" />
            <span>{badge.label}</span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">{response.model}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Copy answer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onRegenerate}
            disabled={response.isStreaming}
            className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
            title="Regenerate answer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${response.isStreaming ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content body */}
      <div className={`p-3.5 overflow-y-auto max-h-[280px] ${fontClass} leading-relaxed text-gray-100`}>
        {renderFormattedContent(response.content)}
        {response.isStreaming && (
          <span className="inline-block w-2 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
};
