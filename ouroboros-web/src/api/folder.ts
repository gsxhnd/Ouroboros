import { http } from "@/utils/http";

interface Folder {
  id: number;
  name: string;
  parent_id: number;
}

export const getFolders = async () => {
  return await http.get<Array<Folder>>("/api/v1/folder").then(({ data }) => {
    return data;
  });
};
