export type AppConfig = {
  libraries: Array<Libraries> | null;
};

export type Libraries = {
  path: string;
  use: boolean;
};
