import React from 'react';
import { Timer, Trophy } from 'lucide-react';
import { useServerCountdown } from '../../hooks/useServerTimer';

interface ChallengeHeaderProps {
  challengeName: string;
  challengeIndex: number;
  totalChallenges: number;
  deadlineAt: string | null;
  totalSeconds: number;
  score: number;
  onTimeEnd?: () => void;
}

export function ChallengeHeader({
  challengeName,
  challengeIndex,
  totalChallenges,
  deadlineAt,
  totalSeconds,
  score,
  onTimeEnd
}: ChallengeHeaderProps) {
  const { minutes, seconds, percent } = useServerCountdown(deadlineAt, totalSeconds, onTimeEnd);

  // Generate progress segments
  const segments = Array.from({ length: totalChallenges }, (_, i) => {
    if (i < challengeIndex) return 'bg-cyan-500'; // Completed
    if (i === challengeIndex) return 'bg-cyan-400 animate-pulse'; // Current
    return 'bg-slate-700'; // Pending
  });

  return (
    <div className="flex flex-col bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center space-x-4">
          <div className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-sm font-medium border border-slate-200">
            Round 5
          </div>
          <h1 className="text-xl font-bold text-slate-900">{challengeName}</h1>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
            <Trophy className="w-4 h-4" />
            <span className="font-mono font-medium">{score} pts</span>
          </div>

          <div className={`flex items-center space-x-2 px-4 py-1.5 rounded border ${
            percent < 10 
              ? 'bg-red-50 border-red-200 text-red-600' 
              : percent < 25
              ? 'bg-amber-50 border-amber-200 text-amber-600'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <Timer className="w-5 h-5" />
            <span className="text-xl font-mono font-bold">
              {minutes}:{seconds}
            </span>
          </div>
          
          <button 
            onClick={onTimeEnd}
            className="ml-4 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded shadow-sm transition-colors"
          >
            Submit Challenge
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 flex w-full">
        {segments.map((color, i) => (
          <div key={i} className={`flex-1 h-full ${color} ${i > 0 ? 'border-l border-slate-900' : ''}`} />
        ))}
      </div>
    </div>
  );
}
