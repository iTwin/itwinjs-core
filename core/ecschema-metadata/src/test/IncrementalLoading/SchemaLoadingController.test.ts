/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { SchemaLoadingController } from "../../utils/SchemaLoadingController";

describe("SchemaLoadingController tests", () => {
  it("controller started and awaited, properties set correctly", async () => {
    const controller = new SchemaLoadingController();
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

  it("controller throws error if wait() called before start()", async () => {
    const controller = new SchemaLoadingController();
    await expect(controller.wait()).to.be.rejectedWith("LoadingController 'start' must be called before 'wait'");
  });
  it("controller handles promise rejection, sets properties correctly", async () => {
    const controller = new SchemaLoadingController();
    expect(controller.inProgress).to.be.false;
    expect(controller.isComplete).to.be.false;

    const loadSomethingThatFails = async () => {
      throw new Error("Load failed");
    };
    controller.start(loadSomethingThatFails());

    expect(controller.inProgress).to.be.true;
    expect(controller.isComplete).to.be.false;

    await expect(controller.wait()).to.be.rejectedWith("Load failed");

    expect(controller.inProgress).to.be.false;
    expect(controller.isComplete).to.be.false;
  });

  it("controller handles promise rejection without awaiting wait()", async () => {
    const controller = new SchemaLoadingController();

    const loadSomethingThatFails = async () => {
      throw new Error("Load failed");
    };
    controller.start(loadSomethingThatFails());

    expect(controller.inProgress).to.be.true;

    // Wait for the promise to settle
    await new Promise(resolve => setTimeout(resolve, 10));

    // After promise settles with error, inProgress should be false but isComplete should remain false
    expect(controller.inProgress).to.be.false;
    expect(controller.isComplete).to.be.false;
  });
});
