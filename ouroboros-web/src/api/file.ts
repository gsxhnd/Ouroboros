import { http } from "@/utils/http";

interface File {
  id: number;
  name: string;
  size: number;
}

export const getFiles = async (target: string, folderId: number) => {
  if (target == "web") {
    return await http
      .get<Array<File>>(`/api/v1/file?folder_id=${folderId}`)
      .then(({ data }) => {
        return data;
      });
  } else if ((target = "desktop")) {
    return window.electronAPI.getFiles(folderId);
  }
  return [];
};
