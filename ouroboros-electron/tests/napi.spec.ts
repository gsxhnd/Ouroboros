import { equal } from "assert";
import { Database } from "../napi";
import { resolve } from "path";

describe("file spec test", () => {
  test("1", async () => {
    console.log(resolve("./data/.ouroboros/data.db"));
    let db = await Database.init(resolve("./data/.ouroboros/data.db"));
    await db.get().then((v) => {
      console.log(v);
    });
  });
});
