import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface BlurDigitProps {
  value: string;
  className?: string;
  springStiffness?: number;
  springDamping?: number;
  springMass?: number;
}

/**
 * Individual digit with SwiftUI-inspired spring physics and blur-in/blur-out transition.
 */
export function BlurAnimatedDigit({
  value,
  className = '',
  springStiffness = 320,
  springDamping = 24,
  springMass = 0.7,
}: BlurDigitProps) {
  return (
    <span className={`inline-block relative overflow-hidden text-center tabular-nums leading-none select-none ${className}`}>
      {/* Ghost character to guarantee exact bounding width without layout shift */}
      <span className="invisible pointer-events-none select-none opacity-0">
        {value}
      </span>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{
            opacity: 0,
            filter: 'blur(10px)',
            y: -14,
            scale: 0.94,
          }}
          animate={{
            opacity: 1,
            filter: 'blur(0px)',
            y: 0,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            filter: 'blur(10px)',
            y: 14,
            scale: 0.94,
          }}
          transition={{
            type: 'spring',
            stiffness: springStiffness,
            damping: springDamping,
            mass: springMass,
          }}
          className="absolute inset-0 flex items-center justify-center will-change-transform will-change-filter"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface BlurAnimatedTimerProps {
  minutes: number;
  seconds: number;
  isUrgent?: boolean;
  isCritical?: boolean;
  isFinished?: boolean;
  sizeClass?: string;
  textShadow?: string;
  className?: string;
  isLightText?: boolean;
}

/**
 * Complete SwiftUI-inspired Blur Countdown Timer Display
 * Cycles through individual digits with fluid blur morphing and spring physics.
 */
export function BlurAnimatedTimer({
  minutes,
  seconds,
  isUrgent = false,
  isCritical = false,
  isFinished = false,
  sizeClass = 'text-[6rem] sm:text-[8rem] md:text-[10rem] lg:text-[12rem]',
  textShadow,
  className = '',
  isLightText = false,
}: BlurAnimatedTimerProps) {
  const mStr = String(Math.max(0, minutes)).padStart(2, '0');
  const sStr = String(Math.max(0, seconds)).padStart(2, '0');

  const m1 = isFinished ? '0' : mStr[0];
  const m2 = isFinished ? '0' : mStr[1];
  const s1 = isFinished ? '0' : sStr[0];
  const s2 = isFinished ? '0' : sStr[1];

  const colorClass = isFinished || isCritical
    ? 'text-red-500'
    : isUrgent
    ? 'text-orange-500'
    : isLightText
    ? 'text-white'
    : 'text-slate-900';

  const defaultShadow = isFinished
    ? '0 0 80px rgba(220,38,38,0.5), 0 6px 12px rgba(0,0,0,0.4)'
    : isCritical
    ? '0 0 60px rgba(220,38,38,0.4), 0 6px 12px rgba(0,0,0,0.3)'
    : isUrgent
    ? '0 0 40px rgba(234,88,12,0.3), 0 6px 12px rgba(0,0,0,0.2)'
    : isLightText
    ? '0 4px 16px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.4)'
    : '0 6px 12px rgba(0,0,0,0.08)';

  return (
    <div
      className={`font-timer font-black leading-none inline-flex items-center justify-center tracking-tight select-none transition-colors duration-300 ${colorClass} ${sizeClass} ${className} ${
        isFinished || isCritical ? 'animate-pulse' : ''
      }`}
      style={{
        textShadow: textShadow || defaultShadow,
        letterSpacing: '-0.02em',
      }}
    >
      {/* Tens of minutes */}
      <BlurAnimatedDigit value={m1} />
      {/* Units of minutes */}
      <BlurAnimatedDigit value={m2} />

      {/* Colon separator (steady, no blink) */}
      <span className="inline-block mx-[0.04em] pb-[0.08em] select-none">
        :
      </span>

      {/* Tens of seconds */}
      <BlurAnimatedDigit value={s1} />
      {/* Units of seconds */}
      <BlurAnimatedDigit value={s2} />
    </div>
  );
}

export default BlurAnimatedTimer;
