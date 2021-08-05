/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { BeDragDropContext } from "@bentley/ui-components";
import { DragDropLayerManager, DragDropLayerRenderer } from "../../ui-framework";
import TestUtils, { mount } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("DragDropLayerManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("getType returns undefined when no type set", () => {
    expect(DragDropLayerManager.getType()).to.be.undefined;
  });

  it("getActiveLayer returns undefined when no type set", () => {
    expect(DragDropLayerManager.getActiveLayer()).to.be.undefined;
  });

  it("DragDropLayerRenderer should mount", () => {
    mount(
      <BeDragDropContext>
        <DragDropLayerRenderer />
      </BeDragDropContext>);
  });

  // NEEDSWORK: setType, registerTypeLayer, DragDropLayerRenderer

});
