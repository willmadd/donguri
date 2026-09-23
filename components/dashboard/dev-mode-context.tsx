"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type DevModeContextValue = { enabled: boolean; toggle: () => void };

const DevModeContext = createContext<DevModeContextValue | null>(null);

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  return (
    <DevModeContext.Provider value={{ enabled, toggle: () => setEnabled((current) => !current) }}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode(): DevModeContextValue {
  const ctx = useContext(DevModeContext);
  if (!ctx) throw new Error("useDevMode must be used within DevModeProvider");
  return ctx;
}
