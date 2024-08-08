import { http } from "@/utils/http";

export const getFolders = () => {
  return http.get("/api/v1/folder").json<any>();
};
