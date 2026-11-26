import React from 'react';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export function LoadingScreen({
  message,
  subMessage,
}: LoadingScreenProps = {}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/15 backdrop-blur-[2.5px] animate-in fade-in duration-300 select-none">
      <style>{`
        @keyframes gentlePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.88; }
        }
      `}</style>
      <div className="relative flex items-center justify-center">
        {/* Outer Soft Glow */}
        <div className="absolute inset-[-10px] rounded-full bg-red-500/10 blur-xl pointer-events-none" />

        {/* Spinning Gradient Ring */}
        <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full border-[3px] border-white/60 border-t-red-600 border-r-rose-400 animate-spin" />

        {/* Center Flower Card with Light Gentle Pulse Effect */}
        <div className="absolute inset-3 sm:inset-3.5 rounded-full bg-white/95 shadow-xl flex items-center justify-center p-2.5 sm:p-3 border border-white">
          <img
            src="/logo-flower.png"
            alt="Lilium & Loft"
            className="h-14 w-14 sm:h-16 sm:w-16 object-contain transition-all drop-shadow-sm"
            style={{
              animation: 'gentlePulse 2.4s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {(message || subMessage) && (
        <div className="mt-5 px-5 py-2.5 rounded-2xl bg-white/95 border border-white shadow-lg text-center max-w-xs sm:max-w-sm mx-4">
          {message && (
            <p className="text-sm sm:text-[15px] font-semibold text-slate-900">
              {message}
            </p>
          )}
          {subMessage && (
            <p className="text-xs text-slate-500 mt-0.5">
              {subMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
