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
    <div className="flex flex-col bg-slate-900 border-b border-slate-800">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center space-x-4">
          <div className="px-3 py-1 bg-slate-800 text-slate-300 rounded-md text-sm font-medium border border-slate-700">
            Round 5
          </div>
          <h1 className="text-xl font-bold text-white">{challengeName}</h1>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 text-amber-400 bg-slate-800 px-3 py-1.5 rounded border border-slate-700">
            <Trophy className="w-4 h-4" />
            <span className="font-mono font-medium">{score} pts</span>
          </div>

          <div className={`flex items-center space-x-2 px-4 py-1.5 rounded border ${
            percent < 10 
              ? 'bg-red-500/10 border-red-500/50 text-red-500' 
              : percent < 25
              ? 'bg-amber-500/10 border-amber-500/50 text-amber-500'
              : 'bg-slate-800 border-slate-700 text-cyan-400'
          }`}>
            <Timer className="w-5 h-5" />
            <span className="text-xl font-mono font-bold">
              {minutes}:{seconds}
            </span>
          </div>
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
