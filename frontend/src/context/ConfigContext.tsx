import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { IS_REAL_BACKEND, apiRequest } from '../services/apiClient';

/**
 * White-label institution profile. The backend serves it at GET /api/v1/config so one build can be
 * deployed for any school, college, university, or open community. The defaults below are used in
 * browser-only mock mode and while the config is loading or if it cannot be reached.
 */
export interface InstitutionConfig {
  appName: string;
  networkLabel: string;
  tagline: string;
  programLabel: string;
  programs: string[];
  years: string[];
  sections: string[];
  emailPolicy: 'edu' | 'domains' | 'open';
  emailPlaceholder: string;
  emailHint: string;
}

export const DEFAULT_INSTITUTION: InstitutionConfig = {
  appName: 'Quad',
  networkLabel: 'Engineering Campus Network',
  tagline: 'Connect with verified peers across your engineering department and batch.',
  programLabel: 'Department',
  programs: [
    'Information Technology',
    'Computer Science & Engineering - Computer Science',
    'Computer Science & Engineering - Data Science',
    'Computer Science & Engineering - Artificial Intelligence & Machine Learning',
    'Computer Science & Engineering - Internet of Things',
    'Civil Engineering',
    'Mechanical Engineering',
    'Electrical & Electronics Engineering',
    'Electronics & Communication Engineering',
  ],
  years: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
  sections: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  emailPolicy: 'edu',
  emailPlaceholder: 'student@btech.college.edu.in',
  emailHint:
    'Strictly verified college email (.edu or campus domain). Never displayed to peers on feeds or profiles.',
};

const ConfigContext = createContext<InstitutionConfig>(DEFAULT_INSTITUTION);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<InstitutionConfig>(DEFAULT_INSTITUTION);

  useEffect(() => {
    if (!IS_REAL_BACKEND) return undefined;
    let cancelled = false;
    apiRequest<Partial<InstitutionConfig>>('/config')
      .then((remote) => {
        if (!cancelled && remote && Array.isArray(remote.programs) && remote.programs.length > 0) {
          setConfig({ ...DEFAULT_INSTITUTION, ...remote });
        }
      })
      .catch(() => {
        // Keep defaults if the config endpoint is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.title = `${config.appName} — ${config.networkLabel}`;
  }, [config.appName, config.networkLabel]);

  const value = useMemo(() => config, [config]);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInstitution(): InstitutionConfig {
  return useContext(ConfigContext);
}
