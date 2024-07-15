// import { equal } from "assert";
import { Watch } from "./watch";

describe("", () => {
  it("aaa", () => {
    let w = new Watch("./electron");

    setTimeout(() => {
      w.changeRootPath("./doc");
    }, 5000);

    w.events$.subscribe({
      next: (events) => {
        console.log("Received buffered events:", typeof events);
        console.log("Received buffered events:", events[0].path);
      },
      complete: () => console.log("Observer got a complete notification"),
    });
  });
});
