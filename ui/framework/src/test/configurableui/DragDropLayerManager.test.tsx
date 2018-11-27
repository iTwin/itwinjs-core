/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { DragDropLayerManager, DragDropLayerRenderer } from "../../index";
import { BeDragDropContext } from "@bentley/ui-components";

describe("DragDropLayerManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("getType returns undefined when no type set", () => {
    expect(DragDropLayerManager.getType()).to.be.undefined;
  });

  it("getActiveLayer returns undefined when no type set", () => {
    expect(DragDropLayerManager.getActiveLayer()).to.be.undefined;
  });

  it("DragDropLayerRenderer should render", () => {
    const wrapper = mount(
      <BeDragDropContext>
        <DragDropLayerRenderer />
      </BeDragDropContext>);
    wrapper.unmount();
  });

  it("DragDropLayerRenderer renders correctly", () => {
    shallow(
      <BeDragDropContext>
        <DragDropLayerRenderer />
      </BeDragDropContext>).should.matchSnapshot();
  });

  // NEEDSWORK: setType, registerTypeLayer, DragDropLayerRenderer

});
