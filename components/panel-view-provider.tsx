"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface PanelViewValue {
  uiVisible: boolean;
  settingsOpen: boolean;
  layersOpen: boolean;
  setUiVisible: (visible: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setLayersOpen: (open: boolean) => void;
  toggleSettings: () => void;
  toggleLayers: () => void;
  toggleUi: () => void;
}

const PanelViewContext = createContext<PanelViewValue | null>(null);

export function PanelViewProvider({ children }: { children: React.ReactNode }) {
  const [uiVisible, setUiVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(true);

  const toggleSettings = useCallback(() => setSettingsOpen((v) => !v), []);
  const toggleLayers = useCallback(() => setLayersOpen((v) => !v), []);
  const toggleUi = useCallback(() => setUiVisible((v) => !v), []);

  const value = useMemo(
    () => ({
      uiVisible,
      settingsOpen,
      layersOpen,
      setUiVisible,
      setSettingsOpen,
      setLayersOpen,
      toggleSettings,
      toggleLayers,
      toggleUi,
    }),
    [
      uiVisible,
      settingsOpen,
      layersOpen,
      toggleSettings,
      toggleLayers,
      toggleUi,
    ]
  );

  return (
    <PanelViewContext.Provider value={value}>
      {children}
    </PanelViewContext.Provider>
  );
}

export function usePanelView(): PanelViewValue {
  const ctx = useContext(PanelViewContext);
  if (!ctx) {
    throw new Error("usePanelView must be used within PanelViewProvider");
  }
  return ctx;
}
