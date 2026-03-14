import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface InfoButtonContextType {
  hasInteracted: boolean;
  markInteracted: () => void;
}

const InfoButtonContext = createContext<InfoButtonContextType | undefined>(undefined);

export const InfoButtonProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [hasInteracted, setHasInteracted] = useState(true); // Default true until mounted

  useEffect(() => {
    const stored = sessionStorage.getItem('nms_info_interacted');
    if (!stored) {
      setHasInteracted(false);
    }
  }, []);

  const markInteracted = () => {
    if (!hasInteracted) {
      sessionStorage.setItem('nms_info_interacted', 'true');
      setHasInteracted(true);
    }
  };

  return (
    <InfoButtonContext.Provider value={{ hasInteracted, markInteracted }}>
      {children}
    </InfoButtonContext.Provider>
  );
};

export const useInfoButtonContext = () => {
  const context = useContext(InfoButtonContext);
  if (context === undefined) {
    throw new Error('useInfoButtonContext must be used within an InfoButtonProvider');
  }
  return context;
};
