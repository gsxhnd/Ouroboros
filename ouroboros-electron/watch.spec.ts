// import { equal } from "assert";
import { Watch } from "./watch";

describe("watch", () => {
  it("start watch success", () => {
    let w = new Watch("./electron");

    setTimeout(() => {
      w.changeRootPath("./doc");
    }, 3000);

    setTimeout(() => {
      w.close();
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
