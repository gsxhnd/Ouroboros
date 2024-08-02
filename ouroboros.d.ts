interface PreferencesData {
  os: string;
  appConfig: AppConfig;
}

interface Libraries {
  name: string;
  path: string;
  use: boolean;
}

interface AppConfig {
  libraries: Array<Libraries>;
  useLanguage: string;
}
