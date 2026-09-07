import React, { ReactNode } from 'react';
import { ChallengeHeader } from './ChallengeHeader';
import { PromptSheet } from './PromptSheet';

interface Round5LayoutProps {
  header: ReactNode;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  promptSheet: ReactNode;
}

export function Round5Layout({ header, leftPanel, rightPanel, promptSheet }: Round5LayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-white text-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex-none">
        {header}
      </div>

      {/* Main Content Area - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Challenge Specific Content */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-slate-200 relative bg-white">
          {leftPanel}
        </div>

        {/* Right Panel - AI Workspace */}
        <div className="w-[450px] flex-none flex flex-col bg-slate-50 border-r border-slate-200">
          {rightPanel}
        </div>
      </div>

      {/* Bottom Panel - Prompt Sheet (Collapsible) */}
      <div className="flex-none border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {promptSheet}
      </div>
    </div>
  );
}
