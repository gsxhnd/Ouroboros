import { fileExist, createDir } from "./file";
import { equal } from "assert";
// import { describe } from "mocha";

describe("file spec test", () => {
  it("filets exist success", async () => {
    await fileExist("./electron").then((exist) => {
      equal(exist, true);
    });
  });

  it("filets exist fail", async () => {
    await fileExist("./electron1").then((exist) => {
      equal(exist, false);
    });
  });

  it("create dir", async () => {
    const s = await createDir("test/123/123");
    console.log(s);
  });
});
