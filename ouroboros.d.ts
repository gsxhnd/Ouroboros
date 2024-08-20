export interface PreferencesData {
  os: string;
  appConfig: AppConfig;
}

export interface Libraries {
  name: string;
  path: string;
  use: boolean;
}

export interface AppConfig {
  libraries: Array<Libraries>;
  useLanguage: string;
}

export interface Folder {}
export interface File {}
export interface Tag {}
