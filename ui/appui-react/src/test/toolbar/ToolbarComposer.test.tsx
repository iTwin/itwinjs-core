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
  CommandItemDef, ConfigurableUiManager, CustomItemDef, FrameworkVersion, Frontstage, FrontstageActivatedEventArgs, FrontstageDef, FrontstageManager, FrontstageProps, FrontstageProvider, GroupItemDef,
  SyncUiEventDispatcher, ToolbarComposer, ToolbarHelper, ToolItemDef,
} from "../../appui-react";
import { CoreTools } from "../../appui-react/tools/CoreToolDefinitions";
import TestUtils from "../TestUtils";
import { UiFramework } from "../../appui-react/UiFramework";
import { Provider } from "react-redux";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";

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
    label: "Tool_2A",
    iconSpec: "icon-placeholder",
    isDisabled: false,
  });

  const tool1b = new ToolItemDef({
    toolId: "test.tool1_b",
    label: "Tool_1B",
    iconSpec: "icon-placeholder",
    isHidden: true,
  });

  const tool2b = new ToolItemDef({
    toolId: "test.tool2_b",
    label: "Tool_2B",
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

  const tool1e = new CommandItemDef({
    commandId: "test.tool1_e",
    label: "Tool_1E",
    iconSpec: "icon-placeholder",
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

  class DuplicatesUiProvider implements UiItemsProvider {
    public readonly id = "ToolbarComposer-DuplicatesUiProvider";

    public provideToolbarButtonItems(_stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
      if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
        return ToolbarHelper.createToolbarItemsFromItemDefs([tool2, group1, custom1, tool1e]);
      }
      return [];
    }
  }

  class Frontstage1 extends FrontstageProvider {
    public static stageId = "Test1";
    public get id(): string {
      return Frontstage1.stageId;
    }

    public get frontstage(): React.ReactElement<FrontstageProps> {
      return (
        <Frontstage
          id={this.id}
          defaultTool={CoreTools.selectElementCommand}
          contentGroup={TestUtils.TestContentGroup1}
        />
      );
    }
  }

  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initializeUiFramework();
    ConfigurableUiManager.addFrontstageProvider(new Frontstage1());
    const frontstageDef = await FrontstageManager.getFrontstageDef("Test1");
    expect(frontstageDef).to.not.be.undefined;
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
  });

  after(async () => {
    await IModelApp.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("should not be able to create node for bad CustomButtonDefinition", () => {
    const badItem: CustomButtonDefinition = {
      id: "bad-no-itemdef", itemPriority: 10,
      isCustom: true,
    };
    expect(ToolbarHelper.createNodeForToolbarItem(badItem)).to.be.null;
  });

  describe("<UI 2.0 />", async () => {
    const sandbox = sinon.createSandbox();

    before(async () => {
      UiFramework.setUiVersion("2");
      await TestUtils.flushAsyncOperations();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should render with specified items", async () => {
      const renderedComponent = render(
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2, group1, custom1])} />
          </FrameworkVersion>
        </Provider>);

      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.container.querySelector("div.components-toolbar-overflow-sizer.components-horizontal")).to.not.be.null;
      expect(UiFramework.uiVersion).to.eql("2");
    });

    it("should render with updated items", async () => {
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 1000 });
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });

      const renderedComponent = render(
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={ToolbarHelper.createToolbarItemsFromItemDefs([tool2, group1, custom1])} />
          </FrameworkVersion>
        </Provider>);
      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.queryByTitle("Tool_2")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Tool_Group")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Popup Test")).not.to.be.null;

      renderedComponent.rerender(
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={ToolbarHelper.createToolbarItemsFromItemDefs([tool2a, tool2b])} />
          </FrameworkVersion>
        </Provider>);
      expect(renderedComponent.queryByTitle("Tool_2")).to.be.null;
      expect(renderedComponent.queryByTitle("Tool_2A")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Tool_2B")).not.to.be.null;
    });

    it("should not try to render duplicate items", async () => {
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 1600 });
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });

      const duplicateToolsUiProvider = new DuplicatesUiProvider();
      UiItemsManager.register(duplicateToolsUiProvider);
      await TestUtils.flushAsyncOperations();

      const renderedComponent = render(
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={ToolbarHelper.createToolbarItemsFromItemDefs([tool2, group1, custom1, tool2, group1, custom1])} />
          </FrameworkVersion>
        </Provider>);
      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.queryByTitle("Tool_2")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Tool_Group")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Popup Test")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Tool_1E")).not.to.be.null;

      UiItemsManager.unregister(duplicateToolsUiProvider.id);
      await TestUtils.flushAsyncOperations();
    });
  });

  describe("<UI 1.0 />", async () => {
    before(async () => {
      UiFramework.setUiVersion("1");
      await TestUtils.flushAsyncOperations();
    });

    after(async () => {
      // restore to default "2" setting
      UiFramework.setUiVersion("2");
      await TestUtils.flushAsyncOperations();
    });

    it("should render with specified items", async () => {
      const renderedComponent = render(
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2, group1, custom1])} />
          </FrameworkVersion>
        </Provider>);
      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.container.querySelector("div.nz-toolbar-toolbar.nz-direction-bottom.nz-horizontal.nz-panel-alignment-start")).to.not.be.null;
      expect(UiFramework.uiVersion).to.eql("1");
    });

    it("should render", async () => {
      const renderedComponent = render(
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2])} />
          </FrameworkVersion>
        </Provider>);
      expect(renderedComponent).not.to.be.undefined;
    });

    it("should render with specified items", async () => {
      const renderedComponent = render(
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2, group1, custom1])} />
          </FrameworkVersion>
        </Provider>);
      expect(renderedComponent).not.to.be.undefined;
    });

    it("should render with updated items", async () => {
      const renderedComponent = render(
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2, group1, custom1])} />
          </FrameworkVersion>
        </Provider>);
      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.queryByTitle("Tool_2")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Tool_Group")).not.to.be.null;
      renderedComponent.rerender(
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, group1])} />
          </FrameworkVersion>
        </Provider>);
      expect(renderedComponent.queryByTitle("Tool_2")).to.be.null;
      expect(renderedComponent.queryByTitle("Tool_Group")).not.to.be.null;
    });

    it("sync event should not refresh if no items updated", () => {
      const renderedComponent = render(
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2])} />
          </FrameworkVersion>
        </Provider>);
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
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={items} />
          </FrameworkVersion>
        </Provider>);

      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.queryByTitle("Tool_2B")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Tool_Group_2")).to.be.null;

      visibleState = true;
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testItemEventId);
      expect(renderedComponent.queryByTitle("Tool_2B")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Tool_Group_2")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Tool_1C")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Tool_1D")).not.to.be.null;
    });

    it("should add tools from UiItemsManager", async () => {
      const fakeTimers = sinon.useFakeTimers();
      const renderedComponent = render(
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={ToolbarHelper.createToolbarItemsFromItemDefs([tool1, tool2, group1])} />
          </FrameworkVersion>
        </Provider>);
      expect(renderedComponent).not.to.be.undefined;

      const testUiProvider = new TestUiProvider();
      UiItemsManager.register(testUiProvider);
      fakeTimers.tick(500);
      fakeTimers.restore();
      await TestUtils.flushAsyncOperations();
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
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={items} />
          </FrameworkVersion>
        </Provider>);

      expect(renderedComponent).not.to.be.undefined;
      let buttonElement = await waitFor(() => renderedComponent.queryByTitle("Tool_2B"));
      expect(buttonElement).to.exist;
      expect(buttonElement?.classList.contains("nz-active")).to.be.false;

      FrontstageManager.onToolActivatedEvent.emit({ toolId: "test.tool2_b" });
      buttonElement = await waitFor(() => renderedComponent.queryByTitle("Tool_2B"));
      expect(buttonElement).to.exist;
      expect(buttonElement?.classList.contains("nz-active")).to.be.true;

      FrontstageManager.onToolActivatedEvent.emit({ toolId: "tool-added-to-group" });
    });

    it("should update items from an external provider's visibility properly", () => {
      const fakeTimers = sinon.useFakeTimers();
      const testUiProvider = new TestUiProvider();
      UiItemsManager.register(testUiProvider);

      const renderedComponent = render(
        <Provider store={TestUtils.store}>
          <FrameworkVersion>
            <ToolbarComposer usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Horizontal}
              items={[]} />
          </FrameworkVersion>
        </Provider>);

      expect(renderedComponent.queryByTitle("visibility-test-tool")).not.to.be.null;

      testUiProvider.hidden = true;
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testUiProvider.syncEventId);
      fakeTimers.tick(500);
      fakeTimers.restore();

      expect(renderedComponent.queryByTitle("visibility-test-tool")).to.be.null;
      UiItemsManager.unregister(testUiProvider.id);
    });
  });
});
