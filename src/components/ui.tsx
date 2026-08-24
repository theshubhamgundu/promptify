import { useState, useEffect, useRef } from 'react';
import { CheckIcon, AlertTriangleIcon, XCircleIcon, LockIcon, XIcon } from './icons';

// ── Badge ─────────────────────────────────────────────────────────────
type BadgeVariant = 'upcoming' | 'live' | 'completed' | 'locked' | 'warning' | 'info' | 'success' | 'error' | 'ai' | 'orange';

const badgeStyles: Record<BadgeVariant, string> = {
  upcoming:  'bg-amber-100 text-amber-700 border border-amber-200',
  live:      'bg-green-100 text-green-700 border border-green-200',
  completed: 'bg-blue-100 text-blue-700 border border-blue-200',
  locked:    'bg-gray-100 text-gray-500 border border-gray-200',
  warning:   'bg-amber-50 text-amber-700 border border-amber-200',
  info:      'bg-blue-50 text-blue-700 border border-blue-200',
  success:   'bg-green-50 text-green-700 border border-green-200',
  error:     'bg-red-50 text-red-700 border border-red-200',
  ai:        'bg-violet-50 text-violet-700 border border-violet-200',
  orange:    'bg-orange-100 text-orange-700 border border-orange-200',
};

export function Badge({ variant, children, className = '' }: { variant: BadgeVariant; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide font-heading ${badgeStyles[variant]} ${className}`}>
      {variant === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-dot flex-shrink-0" />}
      {children}
    </span>
  );
}

// ── Card ─────────────────────────────────────────────────────────────
export function Card({ className = '', children, onClick, lift = false }: {
  className?: string; children: React.ReactNode; onClick?: () => void; lift?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-2xl border border-gray-100 shadow-sm
        ${onClick ? 'cursor-pointer' : ''}
        ${lift || onClick ? 'card-lift' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';

const btnStyles: Record<BtnVariant, string> = {
  primary:   'bg-orange-500 hover:bg-orange-600 text-white btn-glow',
  secondary: 'bg-gray-900 hover:bg-gray-800 text-white',
  outline:   'border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-700',
  ghost:     'hover:bg-gray-100 text-gray-600',
  danger:    'bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-200',
  success:   'bg-green-500 hover:bg-green-600 text-white shadow-sm shadow-green-200',
};

export function Button({
  variant = 'primary', className = '', children, onClick, disabled, type = 'button',
}: {
  variant?: BtnVariant; className?: string; children: React.ReactNode;
  onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold
        transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
        disabled:transform-none font-heading select-none
        ${btnStyles[variant]} ${className}
      `}
    >
      {children}
    </button>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = 'orange', className = '', animate = true }: {
  value: number; max?: number; color?: string; className?: string; animate?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  const colorMap: Record<string, string> = {
    orange: 'bg-orange-500', green: 'bg-green-500', blue: 'bg-blue-500',
    violet: 'bg-violet-500', amber: 'bg-amber-400', red: 'bg-red-500',
  };
  return (
    <div className={`h-2 bg-gray-100 rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full ${colorMap[color] || 'bg-orange-500'} ${animate ? 'progress-fill' : ''} transition-[width] duration-700`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Animated Counter ──────────────────────────────────────────────────
export function AnimatedNumber({ to, duration = 800 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(ease * to));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [to, duration]);

  return <>{val}</>;
}

// ── Toast ─────────────────────────────────────────────────────────────
export function Toast({ message, type = 'success', onClose }: { message: string; type?: 'success' | 'error' | 'warning'; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setLeaving(true); setTimeout(onClose, 200); }, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const styles = {
    success: 'bg-white border-green-200 shadow-green-50',
    error:   'bg-white border-red-200 shadow-red-50',
    warning: 'bg-white border-amber-200 shadow-amber-50',
  };
  const iconCol = { success: 'text-green-500', error: 'text-red-500', warning: 'text-amber-500' };

  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl min-w-[280px] ${styles[type]} ${leaving ? 'toast-out' : 'toast-in'}`}>
      <div className={`w-8 h-8 rounded-full ${type === 'success' ? 'bg-green-50' : type === 'error' ? 'bg-red-50' : 'bg-amber-50'} flex items-center justify-center flex-shrink-0`}>
        {type === 'success' && <CheckIcon className={`w-4 h-4 ${iconCol[type]}`} />}
        {type === 'error'   && <XCircleIcon className={`w-4 h-4 ${iconCol[type]}`} />}
        {type === 'warning' && <AlertTriangleIcon className={`w-4 h-4 ${iconCol[type]}`} />}
      </div>
      <span className="text-sm font-medium text-gray-800 flex-1">{message}</span>
      <button onClick={() => { setLeaving(true); setTimeout(onClose, 200); }} className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────
export function Modal({ title, children, onClose, footer, size = 'md' }: {
  title: string; children: React.ReactNode; onClose: () => void; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }[size];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full ${sizeClass} animate-scale-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h3 className="text-base font-bold text-gray-900 font-heading">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-50 flex justify-end gap-2.5">{footer}</div>
        )}
      </div>
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────────────
export function SectionHeader({ icon, title, action }: { icon?: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-orange-500">{icon}</span>}
        <h2 className="text-[11px] font-black text-orange-500 uppercase tracking-[0.12em] font-heading">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────
export function EmptyState({ icon, title, desc }: { icon?: React.ReactNode; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {icon && <div className="text-gray-200 mb-3 animate-pop-in">{icon}</div>}
      <div className="text-gray-500 font-bold font-heading">{title}</div>
      {desc && <div className="text-sm text-gray-400 mt-1 max-w-xs">{desc}</div>}
    </div>
  );
}

// ── Locked State ──────────────────────────────────────────────────────
export function LockedState({ reason }: { reason: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4 animate-pop-in">
        <LockIcon className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 font-heading mb-2">Round Locked</h3>
      <p className="text-sm text-gray-500 max-w-xs">{reason}</p>
    </div>
  );
}

// ── Timer Display ─────────────────────────────────────────────────────
export function TimerDisplay({ hours, minutes, seconds, label = 'Time Remaining', urgent = false }: {
  hours?: string; minutes: string; seconds: string; label?: string; urgent?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5 font-heading">{label}</div>
      <div className={`font-mono font-bold tabular-nums leading-none transition-colors duration-500 ${urgent ? 'text-red-500' : 'text-gray-900'}`}>
        <span className="text-2xl">
          {hours && <><span>{hours}</span><span className="opacity-25 mx-0.5 text-xl">:</span></>}
          <span>{minutes}</span>
          <span className="opacity-25 mx-0.5 text-xl">:</span>
          <span>{seconds}</span>
        </span>
      </div>
    </div>
  );
}

// ── Attempt Indicator ─────────────────────────────────────────────────
export function AttemptIndicator({ used, total }: { used: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full border-2 transition-all duration-300 ${
            i < used ? 'bg-orange-500 border-orange-500' : 'border-gray-300 bg-white'
          }`}
        />
      ))}
      <span className="text-xs text-gray-500 ml-1 font-heading font-semibold">{total - used} left</span>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon, accent = false, animate = false }: {
  label: string; value: number | string; sub?: string; icon?: React.ReactNode; accent?: boolean; animate?: boolean;
}) {
  return (
    <Card className={`p-4 flex items-center gap-3 ${accent ? 'bg-orange-50 border-orange-100' : ''}`} lift>
      {icon && (
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent ? 'bg-orange-100' : 'bg-gray-50'}`}>
          {icon}
        </div>
      )}
      <div>
        <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wide font-heading">{label}</div>
        <div className={`text-2xl font-black font-heading ${accent ? 'text-orange-600' : 'text-gray-900'}`}>
          {animate && typeof value === 'number' ? <AnimatedNumber to={value} /> : value}
        </div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </Card>
  );
}

// ── Chip/Tag ──────────────────────────────────────────────────────────
export function Chip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-bold font-heading transition-all duration-150 ${
        active ? 'bg-orange-500 text-white shadow-sm shadow-orange-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

// ── Session Alert ─────────────────────────────────────────────────────
export function SessionAlert({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-amber-900/20 backdrop-blur-sm animate-fade-in" />
      <div className="relative bg-white rounded-2xl shadow-2xl border-2 border-amber-300 w-full max-w-md animate-scale-in">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangleIcon className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-black text-gray-900 font-heading text-lg">Session Alert</h3>
              <div className="text-xs text-amber-600 font-semibold">Coordinator Review Required</div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800">
            Your activity requires coordinator review. This may be due to unusual navigation patterns or device behavior.
            <strong> No action is required from your side.</strong>
          </div>
          <div className="text-sm text-gray-600 space-y-1.5">
            <div className="flex items-center gap-2"><span className="text-green-500">✓</span> Your work is safe and saved</div>
            <div className="flex items-center gap-2"><span className="text-green-500">✓</span> Competition access remains active</div>
            <div className="flex items-center gap-2"><span className="text-amber-500">⏳</span> A coordinator will review shortly</div>
          </div>
        </div>
        <div className="px-6 pb-5">
          <p className="text-xs text-gray-400 mb-3 text-center">
            Do not attempt to navigate away or reload the page.
          </p>
          <Button onClick={onClose} variant="outline" className="w-full">I Understand</Button>
        </div>
      </div>
    </div>
  );
}
