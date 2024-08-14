import { constants } from "fs/promises";
import { mkdir, access } from "fs/promises";

export async function fileExist(path: string): Promise<boolean> {
  return await access(path, constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

export async function createDir(path: string) {
  return await mkdir(path, { recursive: true });
}
