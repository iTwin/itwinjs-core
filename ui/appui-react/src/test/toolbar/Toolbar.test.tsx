/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { Orientation } from "@itwin/core-react";
import { Direction, ToolbarPanelAlignment } from "@itwin/appui-layout-react";
import { render } from "@testing-library/react";
import type { BaseItemState} from "../../appui-react";
import { CommandItemDef, CustomItemDef, GroupItemDef, PopupButton, SyncUiEventDispatcher, Toolbar } from "../../appui-react";
import { ItemList } from "../../appui-react/shared/ItemMap";
import TestUtils from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<Toolbar  />", async () => {

  const testItemEventId = "test-event";
  const testItemStateFunc = (currentState: Readonly<BaseItemState>): BaseItemState => {
    const returnState: BaseItemState = { ...currentState };
    returnState.isEnabled = true;
    return returnState;
  };

  const tool1 = new CommandItemDef({
    commandId: "test.tool1",
    label: "Tool_1",
    iconSpec: "icon-placeholder",
    isEnabled: false,
  });

  const tool2 = new CommandItemDef({
    commandId: "test.tool2",
    label: "Tool_2",
    iconSpec: "icon-placeholder",
    isEnabled: true,
  });

  const tool1a = new CommandItemDef({
    commandId: "test.tool1_a",
    label: "Tool_1",
    iconSpec: "icon-placeholder",
    isEnabled: false,
  });

  const tool2a = new CommandItemDef({
    commandId: "test.tool2_a",
    label: "Tool_2",
    iconSpec: "icon-placeholder",
    isEnabled: true,
  });

  const tool1b = new CommandItemDef({
    commandId: "test.tool1_b",
    label: "Tool_1",
    iconSpec: "icon-placeholder",
    isEnabled: false,
  });

  const tool2b = new CommandItemDef({
    commandId: "test.tool2_b",
    label: "Tool_2",
    iconSpec: "icon-placeholder",
    isEnabled: true,
  });

  const tool1c = new CommandItemDef({
    commandId: "test.tool1_c",
    label: "Tool_1",
    iconSpec: "icon-placeholder",
    isEnabled: false,
    stateSyncIds: [testItemEventId],
    stateFunc: testItemStateFunc,
  });

  const tool1d = new CommandItemDef({
    commandId: "test.tool1_d",
    label: "Tool_1",
    iconSpec: "icon-placeholder",
    isEnabled: false,
    stateSyncIds: [testItemEventId],
    stateFunc: testItemStateFunc,
  });

  const group1 = new GroupItemDef({
    groupId: "test.group",
    label: "Tool_Group",
    iconSpec: "icon-placeholder",
    items: [tool1a, tool2a, tool1c],
    itemsInColumn: 4,
  });

  const custom1 = new CustomItemDef({
    customId: "test.custom",
    reactElement: (
      <PopupButton iconSpec="icon-arrow-down" label="Popup Test">
        <div style={{ width: "200px", height: "100px" }}>
          hello world!
        </div>
      </PopupButton>
    ),
  });

  const group2 = new GroupItemDef({
    groupId: "test.group2",
    label: "Tool_Group_2",
    iconSpec: "icon-placeholder",
    isEnabled: false,
    items: [tool1d],
    stateSyncIds: [testItemEventId],
    stateFunc: testItemStateFunc,
  });

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render", async () => {
    const renderedComponent = render(
      <Toolbar orientation={Orientation.Horizontal}
        items={new ItemList([
          tool1,
          tool2,
        ])} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("should render all props", async () => {
    const renderedComponent = render(
      <Toolbar
        orientation={Orientation.Vertical}
        expandsTo={Direction.Right}
        panelAlignment={ToolbarPanelAlignment.End}
        items={new ItemList([
          tool1,
          tool2,
          group1,
          custom1,
        ])}
      />);
    expect(renderedComponent).not.to.be.undefined;
    expect(renderedComponent.queryByTitle("Tool_1")).not.to.be.null;
    renderedComponent.rerender(
      <Toolbar
        orientation={Orientation.Vertical}
        expandsTo={Direction.Right}
        panelAlignment={ToolbarPanelAlignment.End}
        items={new ItemList([
          tool2,
          group1,
        ])}
      />);
    expect(renderedComponent.queryByTitle("Tool_1")).to.be.null;
  });

  it("should render with only items", async () => {
    const renderedComponent = render(
      <Toolbar
        orientation={Orientation.Horizontal}
        items={new ItemList([
          tool1,
          tool2,
          group1,
          custom1,
        ])} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("sync event should not refresh if no items updated", () => {
    const renderedComponent = render(
      <Toolbar
        orientation={Orientation.Horizontal}
        items={new ItemList([
          tool1,
          tool2,
        ])}
      />);
    expect(renderedComponent).not.to.be.undefined;

    expect(tool1.isEnabled).to.be.false;
    expect(tool2.isEnabled).to.be.true;

    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testItemEventId);

    expect(tool1.isEnabled).to.be.false;
    expect(tool2.isEnabled).to.be.true;
  });

  it("sync event should refresh updated items", () => {
    const renderedComponent = render(
      <Toolbar
        orientation={Orientation.Horizontal}
        items={new ItemList([
          tool1b,
          tool2b,
          group2,
          tool1c,
          tool1d,
        ])}
      />);
    expect(renderedComponent).not.to.be.undefined;

    expect(tool1b.isEnabled).to.be.false;
    expect(tool2b.isEnabled).to.be.true;

    expect(group2.isEnabled).to.be.false;
    expect(tool1c.isEnabled).to.be.false;
    expect(tool1d.isEnabled).to.be.false;

    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testItemEventId);

    expect(tool1b.isEnabled).to.be.false;
    expect(tool2b.isEnabled).to.be.true;

    expect(group2.isEnabled).to.be.true;
    expect(tool1c.isEnabled).to.be.true;
    expect(tool1d.isEnabled).to.be.true;
  });

});
