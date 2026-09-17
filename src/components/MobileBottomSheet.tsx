import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children
}) => {
  // Prevent background scrolling when bottom sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Modal Container */}
      <div 
        className="relative w-full max-h-[85vh] bg-neutral-900 border-t border-neutral-800 rounded-t-3xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Grab Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-neutral-700" />
        </div>

        {/* Sheet Header */}
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sheet Content */}
        <div className="p-5 overflow-y-auto overscroll-contain flex-1 max-h-[calc(85vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
};
