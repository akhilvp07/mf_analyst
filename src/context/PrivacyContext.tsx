import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PrivacyContextType {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  setPrivacyMode: (val: boolean) => void;
  formatMaskedValue: (formattedText: string, maskPattern?: string) => string;
}

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivacyMode: false,
  togglePrivacyMode: () => {},
  setPrivacyMode: () => {},
  formatMaskedValue: (val) => val
});

const STORAGE_KEY_PRIVACY = 'mftracker_privacy_mode_v1';

export const PrivacyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_PRIVACY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRIVACY, String(isPrivacyMode));
    } catch {}
  }, [isPrivacyMode]);

  const togglePrivacyMode = () => {
    setIsPrivacyMode(prev => !prev);
  };

  const setPrivacyMode = (val: boolean) => {
    setIsPrivacyMode(val);
  };

  const formatMaskedValue = (formattedText: string, maskPattern: string = '₹ ••••••'): string => {
    if (!isPrivacyMode) return formattedText;
    if (formattedText.startsWith('-')) {
      return `-${maskPattern}`;
    }
    if (formattedText.startsWith('+')) {
      return `+${maskPattern}`;
    }
    return maskPattern;
  };

  return (
    <PrivacyContext.Provider value={{ isPrivacyMode, togglePrivacyMode, setPrivacyMode, formatMaskedValue }}>
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = (): PrivacyContextType => useContext(PrivacyContext);

/**
 * Privacy-aware value display helper component
 */
export const PrivacyValue: React.FC<{
  value: string | number;
  mask?: string;
  className?: string;
}> = ({ value, mask = '₹ ••••••', className = '' }) => {
  const { isPrivacyMode } = usePrivacy();

  if (isPrivacyMode) {
    return (
      <span className={`tracking-wider select-none font-mono text-neutral-400 opacity-90 ${className}`}>
        {mask}
      </span>
    );
  }

  return <span className={className}>{value}</span>;
};
