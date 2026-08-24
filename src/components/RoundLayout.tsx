import { ReactNode } from 'react';
import { Card } from './ui';
import { TargetIcon } from './icons';

interface RoundLayoutProps {
  title: string;
  subtitle?: string;
  headerChildren?: ReactNode;
  children: ReactNode;
}

export function RoundLayout({ title, subtitle, headerChildren, children }: RoundLayoutProps) {
  return (
    <div className="p-6 h-full flex flex-col">
      <Card className="mb-6 border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="p-6 flex items-start gap-5 relative overflow-hidden">
          <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-orange-100 flex items-center justify-center flex-shrink-0 relative z-10">
            <TargetIcon className="w-7 h-7 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0 relative z-10 pt-1">
            <h2 className="text-2xl font-bold text-gray-900 font-heading tracking-tight leading-tight mb-1">{title}</h2>
            {subtitle && <p className="text-gray-600 text-sm max-w-2xl leading-relaxed">{subtitle}</p>}
          </div>
          {headerChildren && (
            <div className="relative z-10 flex-shrink-0">
              {headerChildren}
            </div>
          )}
          {/* Decorative shapes */}
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-20 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        </div>
      </Card>

      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
