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
});
