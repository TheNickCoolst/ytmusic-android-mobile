import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBackClose } from '../services/ui';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** custom top area (e.g. a track preview) instead of a plain title */
  header?: React.ReactNode;
  children: React.ReactNode;
}

// React events bubble through portals to the component that rendered the sheet
// (e.g. a track row with its own tap / swipe handlers) -> stop them at the sheet root.
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Bottom sheet for menus and pickers: tap outside, swipe down or the back button closes it. */
export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, header, children }) => {
  useBackClose(open, onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ y: number; active: boolean } | null>(null);
  const [drag, setDrag] = useState(0);

  if (!open || typeof document === 'undefined') return null;

  const onTouchStart = (e: React.TouchEvent) => {
    dragRef.current = { y: e.touches[0].clientY, active: (panelRef.current?.scrollTop || 0) <= 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = dragRef.current;
    if (!d?.active) return;
    const dy = e.touches[0].clientY - d.y;
    setDrag(dy > 0 ? dy : 0);
  };
  const onTouchEnd = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.active && drag > 90) onClose();
    setDrag(0);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center"
      onClick={stop}
      onTouchStart={stop}
      onTouchMove={stop}
      onTouchEnd={stop}
      onContextMenu={stop}
      onMouseDown={stop}
    >
      <div
        className="absolute inset-0 bg-black/60 animate-in fade-in duration-200"
        style={drag ? { opacity: Math.max(0.2, 1 - drag / 400) } : undefined}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto overscroll-contain bg-surface-2 rounded-t-[1.75rem] border-t border-white/[0.08] shadow-sheet pb-safe animate-in slide-in-from-bottom"
        style={
          drag
            ? { transform: `translate3d(0, ${drag}px, 0)`, transition: 'none' }
            : { transition: 'transform 0.25s var(--ease-out)' }
        }
      >
        <div className="sticky top-0 z-10 bg-surface-2 rounded-t-[1.75rem]">
          <div className="flex justify-center pt-2.5 pb-1.5">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
          {header}
          {!header && title && (
            <div className="px-5 pt-1 pb-3 text-base font-bold text-white">{title}</div>
          )}
        </div>
        <div className="px-2 pb-2">{children}</div>
      </div>
    </div>,
    document.body
  );
};

interface SheetItemProps {
  icon: React.ElementType;
  label: React.ReactNode;
  onClick: () => void;
  hint?: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

export const SheetItem: React.FC<SheetItemProps> = ({ icon: Icon, label, onClick, hint, active, danger, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full min-h-[3.25rem] px-3 flex items-center text-left rounded-2xl transition-colors active:bg-white/[0.08] hover:bg-white/[0.05] disabled:opacity-40 ${
      danger ? 'text-red-400' : 'text-zinc-100'
    }`}
  >
    <span
      className={`w-9 h-9 mr-3 rounded-full flex items-center justify-center flex-shrink-0 ${
        active ? 'bg-red-500/15 text-red-400' : danger ? 'bg-red-500/10' : 'bg-white/[0.06] text-zinc-300'
      }`}
    >
      <Icon className={`w-[1.125rem] h-[1.125rem] ${active ? 'fill-current' : ''}`} />
    </span>
    <span className="flex-1 min-w-0 truncate text-[0.9375rem] font-medium">{label}</span>
    {hint && <span className="ml-3 text-xs text-zinc-500 flex-shrink-0">{hint}</span>}
  </button>
);
