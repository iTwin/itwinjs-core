/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { SchemaLoadingController } from "../../utils/SchemaLoadingController";

describe("SchemaLoadingController tests", () => {
  it("controller started and awaited, properties set correctly", async () => {
    const controller = new SchemaLoadingController();
    expect(controller.inProgress).toBe(false);
    expect(controller.isComplete).toBe(false);

    const loadSomething = async () => { return; };
    controller.start(loadSomething());

    expect(controller.inProgress).toBe(true);
    expect(controller.isComplete).toBe(false);

    await controller.wait();

    expect(controller.inProgress).toBe(false);
    expect(controller.isComplete).toBe(true);
  });
});
