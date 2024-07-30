import fs, { constants } from "fs/promises";

export async function fileExist(path: string): Promise<boolean> {
  return await fs
    .access(path, constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

export async function createDir(path: string) {
  return await fs.mkdir(path, { recursive: true });
}
