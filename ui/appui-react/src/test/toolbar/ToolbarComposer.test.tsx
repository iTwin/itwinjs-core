/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import {
  BadgeType, CommonToolbarItem, ConditionalBooleanValue, CustomButtonDefinition, StageUsage, ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage,
  UiItemsManager, UiItemsProvider,
} from "@itwin/appui-abstract";
import { render, waitFor } from "@testing-library/react";
import {
  CommandItemDef, CustomItemDef, FrameworkVersion, FrontstageActivatedEventArgs, FrontstageDef, FrontstageManager, FrontstageProps, GroupItemDef,
  SyncUiEventDispatcher, ToolbarComposer, ToolbarHelper, ToolItemDef,
} from "../../appui-react";
import { CoreTools } from "../../appui-react/tools/CoreToolDefinitions";
import TestUtils from "../TestUtils";
import { UiFramework } from "../../appui-react/UiFramework";

class TestUiProvider implements UiItemsProvider {
  public readonly id = "ToolbarComposer-TestUiProvider";
  public readonly syncEventId = "syncvisibility";
  public hidden = false;
  private _isHiddenCondition = new ConditionalBooleanValue(() => this.hidden, [this.syncEventId]);

  public provideToolbarButtonItems(_stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      const groupChildSpec = ToolbarItemUtilities.createActionButton("simple-test-action-tool-in-group", 200, "icon-developer", "addon-tool-added-to-test-group", (): void => { }, { parentToolGroupId: "test.group" });
      const nestedGroupChildSpec = ToolbarItemUtilities.createActionButton("simple-test-action-tool-nested", 200, "icon-developer", "addon-tool-added-to-test-group-nested", (): void => { }, { parentToolGroupId: "test.group.nested" });
      const simpleActionSpec = ToolbarItemUtilities.createActionButton("simple-test-action-tool", 200, "icon-developer", "addon-tool-1", (): void => { });
      const childActionSpec = ToolbarItemUtilities.createActionButton("child-test-action-tool", 210, "icon-developer", "addon-group-child-tool-2", (): void => { });
      const addonActionSpec = ToolbarItemUtilities.createActionButton("addon-action-tool-2", 220, "icon-developer", "addon-tool-2", (): void => { });
      const groupSpec = ToolbarItemUtilities.createGroupButton("test-tool-group", 230, "icon-developer", "addon-group-1", [childActionSpec, simpleActionSpec], { badgeType: BadgeType.TechnicalPreview, parentToolGroupId: "tool-formatting-setting" });
      const visibilityTestActionSpec = ToolbarItemUtilities.createActionButton("visibility-test-action-tool", 240, "icon-developer", "visibility-test-tool", (): void => { }, { isHidden: this._isHiddenCondition });
      return [simpleActionSpec, addonActionSpec, groupSpec, groupChildSpec, nestedGroupChildSpec, visibilityTestActionSpec];
    }
    return [];
  }
}

describe("<ToolbarComposer  />", async () => {
  const testItemEventId = "test-event";
  let visibleState = false;
  const testIsHiddenFunc = () => !visibleState;

  const tool1 = new CommandItemDef({
    commandId: "test.tool1",
    label: "Tool_1",
    iconSpec: "icon-placeholder",
    isHidden: true,
  });

  const tool2 = new CommandItemDef({
    commandId: "test.tool2",
    label: "Tool_2",
    iconSpec: "icon-placeholder",
    isHidden: false,
  });

  const tool1a = new CommandItemDef({
    commandId: "test.tool1_a",
    label: "Tool_1",
    iconSpec: "icon-placeholder",
    isDisabled: true,
  });

  const tool2a = new CommandItemDef({
    commandId: "test.tool2_a",
    label: "Tool_2",
    iconSpec: "icon-placeholder",
    isDisabled: false,
  });

  const tool1b = new ToolItemDef({
    toolId: "test.tool1_b",
    label: "Tool_1",
    iconSpec: "icon-placeholder",
    isHidden: true,
  });

  const tool2b = new ToolItemDef({
    toolId: "test.tool2_b",
    label: "Tool_2",
    iconSpec: "icon-placeholder",
  });

  const isHiddenCondition = new ConditionalBooleanValue(testIsHiddenFunc, [testItemEventId]);

  const tool1c = new CommandItemDef({
    commandId: "test.tool1_c",
    label: "Tool_1C",
    iconSpec: "icon-placeholder",
    isHidden: isHiddenCondition,
  });

  const tool1d = new CommandItemDef({
    commandId: "test.tool1_d",
    label: "Tool_1D",
    iconSpec: "icon-placeholder",
    isHidden: isHiddenCondition,
  });

  const groupNested = new GroupItemDef({
    groupId: "test.group.nested",
    label: "Tool_Group_Nested",
    iconSpec: "icon-placeholder",
    items: [tool1c],
    itemsInColumn: 4,
  });

  const group1 = new GroupItemDef({
    groupId: "test.group",
    label: "Tool_Group",
    iconSpec: "icon-placeholder",
    items: [tool1a, tool2a, groupNested],
    itemsInColumn: 4,
  });

  const custom1 = new CustomItemDef({
    customId: "test.custom",
    iconSpec: "icon-arrow-down",
    label: "Popup Test",
    popupPanelNode:
      <div style={{ width: "200px", height: "100px" }}>
        <span>hello world!</span>
      </div>,
  });

  const group2 = new GroupItemDef({
    groupId: "test.group2",
    label: "Tool_Group_2",
    iconSpec: "icon-placeholder",
    items: [tool1d],
    isHidden: isHiddenCondition,
  });

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render", async () => {
    const renderedComponent = render(
      <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
        orientation={ToolbarOrientation.Horizontal}
        items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2])} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("should not be able to create node for bad CustomButtonDefinition", () => {
    const badItem: CustomButtonDefinition = {
      id: "bad-no-itemdef", itemPriority: 10,
      isCustom: true,
    };
    expect(ToolbarHelper.createNodeForToolbarItem(badItem)).to.be.null;
  });

  it("should render with specified items", async () => {
    const renderedComponent = render(
      <FrameworkVersion version="2">
        <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
          orientation={ToolbarOrientation.Horizontal}
          items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2, group1, custom1])} />
      </FrameworkVersion>);
    expect(renderedComponent).not.to.be.undefined;
    expect(renderedComponent.container.querySelector("div.components-toolbar-overflow-sizer.components-horizontal")).to.not.be.null;
    expect(UiFramework.uiVersion).to.eql("2");
  });

  it("should render with specified items", async () => {
    const renderedComponent = render(
      <FrameworkVersion version="1">
        <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
          orientation={ToolbarOrientation.Horizontal}
          items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2, group1, custom1])} />
      </FrameworkVersion>);
    expect(renderedComponent).not.to.be.undefined;
    expect(renderedComponent.container.querySelector("div.nz-toolbar-toolbar.nz-direction-bottom.nz-horizontal.nz-panel-alignment-start")).to.not.be.null;
    expect(UiFramework.uiVersion).to.eql("1");
  });

  it("should render with specified items", async () => {
    const renderedComponent = render(
      <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
        orientation={ToolbarOrientation.Horizontal}
        items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2, group1, custom1])} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("should render with updated items", async () => {
    const renderedComponent = render(
      <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
        orientation={ToolbarOrientation.Horizontal}
        items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2, group1, custom1])} />);
    expect(renderedComponent).not.to.be.undefined;
    expect(renderedComponent.queryByTitle("Tool_2")).not.to.be.null;
    expect(renderedComponent.queryByTitle("Tool_Group")).not.to.be.null;
    renderedComponent.rerender(<ToolbarComposer usage={ToolbarUsage.ContentManipulation}
      orientation={ToolbarOrientation.Horizontal}
      items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, group1])} />);
    expect(renderedComponent.queryByTitle("Tool_2")).to.be.null;
    expect(renderedComponent.queryByTitle("Tool_Group")).not.to.be.null;
  });

  it("sync event should not refresh if no items updated", () => {
    const renderedComponent = render(
      <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
        orientation={ToolbarOrientation.Horizontal}
        items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2])} />);
    expect(renderedComponent).not.to.be.undefined;

    expect(renderedComponent.queryByTitle("Tool_1")).to.be.null;
    expect(renderedComponent.queryByTitle("Tool_2")).not.to.be.null;
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testItemEventId);
    expect(renderedComponent.queryByTitle("Tool_1")).to.be.null;
    expect(renderedComponent.queryByTitle("Tool_2")).not.to.be.null;
  });

  it("sync event should refresh updated items", () => {
    visibleState = false;
    const items = ToolbarHelper.createToolbarItemsFromItemDefs([tool1b, tool2b, group2, tool1c, tool1d]);

    const renderedComponent = render(
      <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
        orientation={ToolbarOrientation.Horizontal}
        items={items} />);

    expect(renderedComponent).not.to.be.undefined;
    expect(renderedComponent.queryByTitle("Tool_2")).not.to.be.null;
    expect(renderedComponent.queryByTitle("Tool_Group_2")).to.be.null;

    visibleState = true;
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testItemEventId);
    expect(renderedComponent.queryByTitle("Tool_2")).not.to.be.null;
    expect(renderedComponent.queryByTitle("Tool_Group_2")).not.to.be.null;
    expect(renderedComponent.queryByTitle("Tool_1C")).not.to.be.null;
    expect(renderedComponent.queryByTitle("Tool_1D")).not.to.be.null;
  });

  it("should add tools from UiItemsManager", async () => {
    const fakeTimers = sinon.useFakeTimers();
    const renderedComponent = render(
      <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
        orientation={ToolbarOrientation.Horizontal}
        items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2, group1])} />);
    expect(renderedComponent).not.to.be.undefined;

    const testUiProvider = new TestUiProvider();
    UiItemsManager.register(testUiProvider);
    fakeTimers.tick(500);
    fakeTimers.restore();

    expect(await waitFor(() => renderedComponent.queryByTitle("addon-tool-1"))).to.exist;
    expect(await waitFor(() => renderedComponent.queryByTitle("addon-tool-2"))).to.exist;
    expect(await waitFor(() => renderedComponent.queryByTitle("addon-group-1"))).to.exist;

    // new frontstage should trigger refresh

    /** Id for the Frontstage */
    const oldProps: FrontstageProps = { id: "old", defaultTool: CoreTools.selectElementCommand, contentGroup: TestUtils.TestContentGroup2 };
    const oldStageDef = new FrontstageDef();
    await oldStageDef.initializeFromProps(oldProps);

    const newProps: FrontstageProps = { id: "new", defaultTool: CoreTools.selectElementCommand, contentGroup: TestUtils.TestContentGroup2 };
    const newStageDef = new FrontstageDef();
    await newStageDef.initializeFromProps(newProps);

    FrontstageManager.onFrontstageActivatedEvent.emit({ deactivatedFrontstageDef: oldStageDef, activatedFrontstageDef: newStageDef } as FrontstageActivatedEventArgs);

    expect(await waitFor(() => renderedComponent.queryByTitle("addon-tool-1"))).to.exist;

    UiItemsManager.unregister(testUiProvider.id);
  });

  it("should update active item to toolid is set", async () => {
    visibleState = false;
    const items = ToolbarHelper.createToolbarItemsFromItemDefs([tool1b, tool2b, group2, tool1c, tool1d]);
    const groupChildSpec = ToolbarItemUtilities.createActionButton("tool-in-group", 200, "icon-developer", "tool-added-to-group", (): void => { }, { parentToolGroupId: "test.group2" });
    items.push(groupChildSpec);

    const renderedComponent = render(
      <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
        orientation={ToolbarOrientation.Horizontal}
        items={items} />);

    expect(renderedComponent).not.to.be.undefined;
    let buttonElement = await waitFor(() => renderedComponent.queryByTitle("Tool_2"));
    expect(buttonElement).to.exist;
    expect(buttonElement?.classList.contains("nz-active")).to.be.false;

    FrontstageManager.onToolActivatedEvent.emit({ toolId: "test.tool2_b" });
    buttonElement = await waitFor(() => renderedComponent.queryByTitle("Tool_2"));
    expect(buttonElement).to.exist;
    expect(buttonElement?.classList.contains("nz-active")).to.be.true;

    FrontstageManager.onToolActivatedEvent.emit({ toolId: "tool-added-to-group" });
    // expect(renderedComponent.queryByTitle("tool-added-to-group")).not.to.be.null;
  });

  it("should update items from an external provider's visibility properly", () => {
    const fakeTimers = sinon.useFakeTimers();
    const testUiProvider = new TestUiProvider();
    UiItemsManager.register(testUiProvider);

    const renderedComponent = render(
      <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
        orientation={ToolbarOrientation.Horizontal}
        items={[]} />);

    expect(renderedComponent.queryByTitle("visibility-test-tool")).not.to.be.null;

    testUiProvider.hidden = true;
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testUiProvider.syncEventId);
    fakeTimers.tick(500);
    fakeTimers.restore();

    expect(renderedComponent.queryByTitle("visibility-test-tool")).to.be.null;
    UiItemsManager.unregister(testUiProvider.id);
  });
});
