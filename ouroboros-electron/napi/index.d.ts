/* tslint:disable */
/* eslint-disable */

/* auto-generated by NAPI-RS */

export interface File {
  id: number
  folderId: number
  name: string
  desc: string
  md5: string
  createdAt?: Date
  updatedAt?: Date
}
export interface Folder {
  id: number
  name: string
  pid: number
  coverFid?: number
  createdAt?: Date
  updatedAt?: Date
}
export interface Tag {
  id: number
  name: string
  pid: number
  createdAt?: Date
  updatedAt?: Date
}
export declare class Database {
  static init(dbPath: string): Promise<Database>
  get(): Promise<Array<Tag> | null>
  getTags(): Promise<Array<Tag> | null>
  getFolders(): Promise<Array<Folder> | null>
  getFilesByFolderIds(folderId: number): Promise<Array<File> | null>
  sync(dataPath: string): Promise<void>
}