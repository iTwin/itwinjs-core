import { expect } from "chai";
import { ObjectLoadingController } from "../../utils/ObjectLoadingController";

describe("ObjectLoadingController tests", () => {
  it("controller started and awaited, properties set correctly", async () => {
    const controller = new ObjectLoadingController();
    expect(controller.inProgress).to.be.false;
    expect(controller.isComplete).to.be.false;

    const loadSomething = async () => { return; };
    controller.start(loadSomething());

    expect(controller.inProgress).to.be.true;
    expect(controller.isComplete).to.be.false;

    await controller.wait();

    expect(controller.inProgress).to.be.false;
    expect(controller.isComplete).to.be.true;
  });

});