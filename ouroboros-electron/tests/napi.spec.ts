// import * as napi from "../napi/index.node";
import { equal } from "assert";
import { add } from "../napi";

describe("file spec test", () => {
  test("1", async () => {
    console.log(add());
  });
});
