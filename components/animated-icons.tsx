'use client';

import { useEffect, useRef, type ComponentType, type HTMLAttributes, type RefAttributes } from 'react';
import { useReducedMotion } from 'motion/react';
import { ArrowUpRightIcon } from '@heroicons-animated/react/arrow-up-right';
import { ArrowRightIcon } from '@heroicons-animated/react/arrow-right';
import { ArrowLeftIcon } from '@heroicons-animated/react/arrow-left';
import { BookOpenIcon } from '@heroicons-animated/react/book-open';
import { UsersIcon } from '@heroicons-animated/react/users';
import { PlusIcon } from '@heroicons-animated/react/plus';
import { MagnifyingGlassIcon } from '@heroicons-animated/react/magnifying-glass';
import { DocumentTextIcon } from '@heroicons-animated/react/document-text';
import { Squares2X2Icon } from '@heroicons-animated/react/squares-2x2';
import { Cog6ToothIcon } from '@heroicons-animated/react/cog-6-tooth';
import { ArrowRightStartOnRectangleIcon } from '@heroicons-animated/react/arrow-right-start-on-rectangle';
import { CheckIcon } from '@heroicons-animated/react/check';
import { CheckCircleIcon } from '@heroicons-animated/react/check-circle';
import { ArrowDownTrayIcon } from '@heroicons-animated/react/arrow-down-tray';
import { ArrowUpTrayIcon } from '@heroicons-animated/react/arrow-up-tray';
import { AdjustmentsHorizontalIcon } from '@heroicons-animated/react/adjustments-horizontal';
import { SparklesIcon } from '@heroicons-animated/react/sparkles';
import { XMarkIcon } from '@heroicons-animated/react/x-mark';
import { AcademicCapIcon } from '@heroicons-animated/react/academic-cap';
import { ClockIcon } from '@heroicons-animated/react/clock';
import { FolderOpenIcon } from '@heroicons-animated/react/folder-open';
import { PrinterIcon } from '@heroicons-animated/react/printer';
import { ArrowPathIcon } from '@heroicons-animated/react/arrow-path';
import { Bars3Icon } from '@heroicons-animated/react/bars-3';
import { LightBulbIcon } from '@heroicons-animated/react/light-bulb';
import { ExclamationCircleIcon } from '@heroicons-animated/react/exclamation-circle';
import { PencilSquareIcon } from '@heroicons-animated/react/pencil-square';
import { TrashIcon } from '@heroicons-animated/react/trash';

type AnimationHandle = { startAnimation: () => void; stopAnimation: () => void };
type IconProps = HTMLAttributes<HTMLSpanElement> & { size?: number };
type LibraryIcon = ComponentType<HTMLAttributes<HTMLDivElement> & { size?: number } & RefAttributes<AnimationHandle>>;

function animatedIcon(Icon: LibraryIcon, name: string) {
  function AnimatedIcon({ size = 24, className = '', style, ...props }: IconProps) {
    const host = useRef<HTMLSpanElement>(null);
    const animation = useRef<AnimationHandle>(null);
    const reduceMotion = useReducedMotion();
    const spinning = className.split(/\s+/).includes('spin');
    useEffect(() => {
      const node = host.current;
      if (!node) return;
      const control = node.closest<HTMLElement>('button, a[href], .search, .field, .template-dropzone, .stats > div') || node;
      let hovered = false;
      let focused = false;
      let active = false;
      const sync = () => {
        const disabled = control.matches(':disabled, [aria-disabled="true"]') || Boolean(control.querySelector('input:disabled, select:disabled'));
        const next = !reduceMotion && !spinning && !disabled && (hovered || focused);
        if (next === active) return;
        active = next;
        if (next) animation.current?.startAnimation();
        else animation.current?.stopAnimation();
      };
      const enter = (event: PointerEvent) => { if (event.pointerType === 'mouse' || event.pointerType === 'pen') { hovered = true; sync(); } };
      const leave = () => { hovered = false; sync(); };
      const focus = () => { focused = true; sync(); };
      const blur = (event: FocusEvent) => {
        if (event.relatedTarget instanceof Node && control.contains(event.relatedTarget)) return;
        focused = false; sync();
      };
      control.addEventListener('pointerenter', enter);
      control.addEventListener('pointerleave', leave);
      control.addEventListener('focusin', focus);
      control.addEventListener('focusout', blur);
      return () => {
        control.removeEventListener('pointerenter', enter);
        control.removeEventListener('pointerleave', leave);
        control.removeEventListener('focusin', focus);
        control.removeEventListener('focusout', blur);
        if (active) animation.current?.stopAnimation();
      };
    }, [reduceMotion, spinning]);
    return <span ref={host} className={`app-icon ${className}`} style={{ width: size, height: size, ...style }}
      aria-hidden={props['aria-label'] ? undefined : true} {...props}>
      <Icon ref={animation} size={size} aria-hidden="true" />
    </span>;
  }
  AnimatedIcon.displayName = `Animated${name}`;
  return AnimatedIcon;
}

export const ArrowUpRight = animatedIcon(ArrowUpRightIcon, 'ArrowUpRight');
export const ArrowRight = animatedIcon(ArrowRightIcon, 'ArrowRight');
export const ArrowLeft = animatedIcon(ArrowLeftIcon, 'ArrowLeft');
export const BookOpen = animatedIcon(BookOpenIcon, 'BookOpen');
export const Users = animatedIcon(UsersIcon, 'Users');
export const Plus = animatedIcon(PlusIcon, 'Plus');
export const Search = animatedIcon(MagnifyingGlassIcon, 'MagnifyingGlass');
export const FileText = animatedIcon(DocumentTextIcon, 'DocumentText');
export const LayoutGrid = animatedIcon(Squares2X2Icon, 'Squares2X2');
export const Settings = animatedIcon(Cog6ToothIcon, 'Cog6Tooth');
export const LogOut = animatedIcon(ArrowRightStartOnRectangleIcon, 'ArrowRightStartOnRectangle');
export const Check = animatedIcon(CheckIcon, 'Check');
export const CheckCircle2 = animatedIcon(CheckCircleIcon, 'CheckCircle');
export const Download = animatedIcon(ArrowDownTrayIcon, 'ArrowDownTray');
export const Upload = animatedIcon(ArrowUpTrayIcon, 'ArrowUpTray');
export const SlidersHorizontal = animatedIcon(AdjustmentsHorizontalIcon, 'AdjustmentsHorizontal');
export const Sparkles = animatedIcon(SparklesIcon, 'Sparkles');
export const X = animatedIcon(XMarkIcon, 'XMark');
export const GraduationCap = animatedIcon(AcademicCapIcon, 'AcademicCap');
export const Clock = animatedIcon(ClockIcon, 'Clock');
export const FolderOpen = animatedIcon(FolderOpenIcon, 'FolderOpen');
export const Printer = animatedIcon(PrinterIcon, 'Printer');
export const Loader2 = animatedIcon(ArrowPathIcon, 'ArrowPath');
export const Menu = animatedIcon(Bars3Icon, 'Bars3');
export const Leaf = animatedIcon(LightBulbIcon, 'LightBulb');
export const AlertCircle = animatedIcon(ExclamationCircleIcon, 'ExclamationCircle');
export const Pencil = animatedIcon(PencilSquareIcon, 'PencilSquare');
export const Trash2 = animatedIcon(TrashIcon, 'Trash');

