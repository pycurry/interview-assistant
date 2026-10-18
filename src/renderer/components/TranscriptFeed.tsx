import React, { useEffect, useRef } from 'react';
import { SpeakerTurn } from '../../shared/types';
import { User, Volume2 } from 'lucide-react';

interface TranscriptFeedProps {
  turns: SpeakerTurn[];
  fontSize?: 'sm' | 'base' | 'lg';
}

export const TranscriptFeed: React.FC<TranscriptFeedProps> = ({ turns, fontSize = 'base' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [turns]);

  const fontClass = fontSize === 'sm' ? 'text-xs' : fontSize === 'lg' ? 'text-base' : 'text-sm';

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-2 space-y-2.5 max-h-[220px] transition-all"
    >
      {turns.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-28 text-gray-500 text-xs italic">
          <Volume2 className="w-5 h-5 mb-1.5 opacity-40 animate-pulse-subtle" />
          Listening to conversation... (Interviewer speech loopback & Mic active)
        </div>
      ) : (
        turns.map((turn) => {
          const isInterviewer = turn.speaker === 'interviewer';
          return (
            <div
              key={turn.id}
              className={`flex items-start gap-2.5 transition-all ${
                isInterviewer ? 'justify-start' : 'justify-end'
              }`}
            >
              {isInterviewer && (
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5 border border-indigo-500/30">
                  <Volume2 className="w-3 h-3" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-3 py-1.5 ${fontClass} leading-relaxed shadow-sm ${
                  isInterviewer
                    ? 'bg-dark-card/90 text-gray-200 border border-gray-700/40 rounded-tl-none'
                    : 'bg-indigo-600/30 text-indigo-100 border border-indigo-500/30 rounded-tr-none'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={`text-[10px] font-semibold tracking-wider uppercase ${
                      isInterviewer ? 'text-indigo-400' : 'text-emerald-400'
                    }`}
                  >
                    {isInterviewer ? 'Interviewer' : 'You'}
                  </span>
                  <span className="text-[9px] text-gray-500">
                    {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap select-text">{turn.text}</p>
              </div>
              {!isInterviewer && (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5 border border-emerald-500/30">
                  <User className="w-3 h-3" />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
