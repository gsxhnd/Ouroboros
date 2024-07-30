export const getPreferences = () => {
  return window.electronAPI.loadPreferences();
};
