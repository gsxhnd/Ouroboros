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

export interface Preferences {
  os: string;
  libraries: Array<Libraries>;
  useLanguage: string;
}

export interface Folder {
  id: number;
  name: string;
  pid: number;
}

export interface File {}
export interface Tag {}
