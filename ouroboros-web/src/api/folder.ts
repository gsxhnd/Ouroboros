import { http } from "@/utils/http";
import { Folder } from "@type";

export const getFolders = async (target: string) => {
  if (target == "web") {
    return await http.get<Array<Folder>>("/api/v1/folder").then(({ data }) => {
      return data;
    });
  } else if ((target = "desktop")) {
    return window.electronAPI.getFolders();
  }
  return [];
};
