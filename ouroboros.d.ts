interface Preferences {
  os: string;
  appConfig: AppConfig;
}

interface Libraries {
  path: string;
  use: boolean;
}

interface AppConfig {
  libraries: Array<Libraries>;
  language: string;
}
