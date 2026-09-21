import { createContext, useState, useCallback, useContext, ReactNode } from 'react';

type AppSettings = {
  voiceGuidance: boolean;
  hazardAlerts: boolean;
};

type SettingsProviderState = AppSettings & {
  setVoiceGuidance: (value: boolean) => void;
  setHazardAlerts: (value: boolean) => void;
};

const SettingsProviderContext = createContext<SettingsProviderState>({
  voiceGuidance: true,
  hazardAlerts: true,
  setVoiceGuidance: () => {},
  setHazardAlerts: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [voiceGuidance, setVoiceGuidance] = useState(true);
  const [hazardAlerts, setHazardAlerts] = useState(true);

  const setVoice = useCallback((value: boolean) => setVoiceGuidance(value), []);
  const setAlerts = useCallback((value: boolean) => setHazardAlerts(value), []);

  return (
    <SettingsProviderContext.Provider value={{ voiceGuidance, hazardAlerts, setVoiceGuidance: setVoice, setHazardAlerts: setAlerts }}>
      {children}
    </SettingsProviderContext.Provider>
  );
}

export function useSettingsState() {
  return useContext(SettingsProviderContext);
}
