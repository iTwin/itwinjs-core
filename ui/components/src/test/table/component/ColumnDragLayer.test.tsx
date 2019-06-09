/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";

import { ColumnDragLayer } from "../../../ui-components/table/component/ColumnDragLayer";
import { DragSourceArguments, DropEffects, DropStatus } from "../../../ui-components/dragdrop/DragDropDef";

describe("ColumnDragLayer", () => {

  it("renders correctly with no props", async () => {
    const wrapper = mount(<ColumnDragLayer />);

    expect(wrapper.find(".components-column-drag-layer").length).to.eq(0);

    wrapper.unmount();
  });

  it("renders correctly with few props", async () => {
    const args: DragSourceArguments<any> = {
      dataObject: {},
      clientOffset: { x: 0, y: 0 },
      initialClientOffset: { x: 0, y: 0 },
      dropEffect: DropEffects.Copy | DropEffects.Move,
      dropStatus: DropStatus.Drop,
    };
    const wrapper = mount(<ColumnDragLayer args={args} />);

    expect(wrapper.find(".components-column-drag-layer").length).to.eq(1);

    wrapper.unmount();
  });

  it("renders correctly with all props", async () => {
    const args: DragSourceArguments<any> = {
      dataObject: { column: { width: 50, left: 100, name: "Test" } },
      clientOffset: { x: 0, y: 0 },
      initialClientOffset: { x: 0, y: 0 },
      sourceClientOffset: { x: 0, y: 0 },
      initialSourceClientOffset: { x: 0, y: 0 },
      dropEffect: DropEffects.Copy | DropEffects.Move,
      dropStatus: DropStatus.Drop,
    };
    const wrapper = mount(<ColumnDragLayer args={args} />);

    expect(wrapper.find(".components-column-drag-layer").length).to.eq(1);

    wrapper.unmount();
  });

});
