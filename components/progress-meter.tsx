import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';

export function ProgressMeter({ percent, label, name }: { percent: number; label: string; name: string }) {
  const value = useMotionValue(percent);
  const reducedMotion = useReducedMotion();
  const number = useTransform(value, n => Math.round(n) + '%');
  const scaleX = useTransform(value, n => n / 100);
  useEffect(() => {
    if (reducedMotion) {
      value.set(percent);
      return;
    }
    const animation = animate(value, percent, { duration: 0.28, ease: 'easeOut' });
    return () => animation.stop();
  }, [percent, reducedMotion, value]);

  return <div className="download-meter" role="progressbar" aria-label={name}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}% · ${label}`}>
    <div className="download-meter-caption"><span>{label}</span><motion.strong>{number}</motion.strong></div>
    <div className="download-meter-track"><motion.span style={{ scaleX }} /></div>
  </div>;
}
