export const DialogNewLibPath = (libPath: string) => {
  return window.electronAPI.newAssetLibPath(libPath);
};

export const DialogSelectLibPath = (): Promise<string> => {
  return window.electronAPI.selectAssetLibPath();
};
