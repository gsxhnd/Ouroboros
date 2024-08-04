import { http } from "@/utils/http";

export const getPreferencesEAPI = () => {
  return window.electronAPI.loadPreferences();
};

export const getPreferencesAPI = () => {
  return http.get("123");
};
