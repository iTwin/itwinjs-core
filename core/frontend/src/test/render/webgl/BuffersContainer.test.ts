/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BuffersContainer, VAOContainer, VBOContainer } from "../../../render/webgl/AttributeBuffers";
import { IModelApp } from "../../../IModelApp";
import { EmptyLocalization } from "@itwin/core-common";

describe("BuffersContainer", () => {
  afterEach(async () => {
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("should use VAO if enabled", async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    const buffers = BuffersContainer.create();
    expect(buffers instanceof VAOContainer).to.be.true;
  });
});
