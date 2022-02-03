/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import type { DragSourceArguments} from "../../../components-react/table/component/dragdrop/DragDropDef";
import { DropEffects, DropStatus } from "../../../components-react/table/component/dragdrop/DragDropDef";
import { ColumnDragLayer } from "../../../components-react/table/component/ColumnDragLayer";

/* eslint-disable deprecation/deprecation */

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
