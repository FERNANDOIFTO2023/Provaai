'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const MotionContext = createContext({ enabled: false });

export function MotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(preference.matches);
    sync();
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  return (
    <MotionContext.Provider value={{ enabled: !reduced }}>
      <div className="motion-root" data-motion={!reduced ? 'on' : 'off'}>
        {children}
      </div>
    </MotionContext.Provider>
  );
}

export const useMotion = () => useContext(MotionContext);

export function BloubMood({
  mood = 'curioso',
  className = '',
}: {
  mood?:
    | 'curioso'
    | 'feliz'
    | 'timido'
    | 'sonolento'
    | 'frustrado'
    | 'carinhoso';
  className?: string;
}) {
  const { enabled } = useMotion();
  return (
    <img
      className={`bloub-mood ${className}`}
      src={`/bloub/${enabled ? 'animated' : 'static'}/bloub-${mood}.svg`}
      width="160"
      height="160"
      alt=""
      aria-hidden="true"
    />
  );
}
