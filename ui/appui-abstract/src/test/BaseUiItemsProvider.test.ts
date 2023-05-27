/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import * as sinon from "sinon";
import {
  AbstractStatusBarItemUtilities, AbstractWidgetProps, BackstageItem, BackstageItemUtilities, BaseUiItemsProvider, CommonStatusBarItem, CommonToolbarItem,
  StagePanelLocation, StagePanelSection, StageUsage, StatusBarSection, ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage, UiItemsManager,
} from "../appui-abstract";

const testStageUsage = StageUsage.General;

/** TestDerivedUiItemsProvider that provides tools and status bar items */
class TestUiItemsProvider extends BaseUiItemsProvider {
  constructor(providerId: string, isSupportedStage?: ((stageId: string, stageUsage: string, stageAppData?: any) => boolean)) {
    super(providerId, isSupportedStage);
  }

  public override provideToolbarButtonItemsInternal(_stageId: string, _stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    if (toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      const simpleActionSpec = ToolbarItemUtilities.createActionButton("simple-test-action-tool", 200, "icon-developer", "simple-test-action-tool",
        (): void => {
          // eslint-disable-next-line no-console
          console.log("Got Here!");
        });
      return [simpleActionSpec];
    }
    return [];
  }

  public static statusBarItemIsVisible = true;
  public override provideStatusBarItemsInternal(_stageId: string, _stageUsage: string, _stageAppData?: any): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];

    statusBarItems.push(
      AbstractStatusBarItemUtilities.createActionItem("UiItemsProviderTest:StatusBarItem1", StatusBarSection.Center, 100, "icon-developer", "test status bar from extension",
        () => {
          // eslint-disable-next-line no-console
          console.log("Got Here!");
        }));

    statusBarItems.push(AbstractStatusBarItemUtilities.createLabelItem("UiItemsProviderTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello", undefined));
    return statusBarItems;
  }

  public static sampleStatusVisible = true;

  public override provideBackstageItems(): BackstageItem[] {
    return [
      BackstageItemUtilities.createActionItem("UiItemsProviderTest:backstage1", 500, 50, () => { }, "Dynamic Action", undefined, undefined, { isHidden: !TestUiItemsProvider.sampleStatusVisible }),
    ];
  }

  public override provideWidgetsInternal(_stageId: string, _stageUsage: string, _location: StagePanelLocation, _section?: StagePanelSection, _stageAppData?: any): AbstractWidgetProps[] {
    const widgets: AbstractWidgetProps[] = [];
    widgets.push({
      id: "test",
      getWidgetContent: () => "Hello World!",
    });

    return widgets;
  }
}

class TestUnregisterUiItemsProvider extends BaseUiItemsProvider {
  constructor(providerId: string, private _onUregisterFunc: () => void) {
    super(providerId);
  }

  public override onUnregister() {
    this._onUregisterFunc();
  }
}

describe("UiItemsManager", () => {
  afterEach(() => sinon.restore());

  it("can't unregister if provider id is not registered", () => {
    const testUiProvider = new TestUiItemsProvider("TestUiItemsProvider");
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    UiItemsManager.register(testUiProvider);
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.unregister("dummy");
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.unregister(testUiProvider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("can clear all providers", () => {
    const testUiProvider = new TestUiItemsProvider("TestUiItemsProvider");
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    UiItemsManager.register(testUiProvider);
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.clearAllProviders();
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("if no registered providers no tools are available", () => {
    const toolSpecs = UiItemsManager.getToolbarButtonItems("stage", testStageUsage, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
    expect(toolSpecs.length).to.be.eq(0);
    const statusbarItems = UiItemsManager.getStatusBarItems("", testStageUsage);
    expect(statusbarItems.length).to.be.eq(0);
    const backstageItems = UiItemsManager.getBackstageItems();
    expect(backstageItems.length).to.be.eq(0);
    const widgets = UiItemsManager.getWidgets("", testStageUsage, StagePanelLocation.Right);
    expect(widgets.length).to.be.eq(0);
  });

  it("register UiProvider should trigger callback", () => {
    const spy = sinon.spy();
    const testUiProvider = new TestUiItemsProvider("TestUiItemsProvider");
    UiItemsManager.onUiProviderRegisteredEvent.addListener(spy);
    expect(spy.calledOnce).to.false;
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    UiItemsManager.register(testUiProvider);
    expect(spy.calledOnce).to.true;
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.onUiProviderRegisteredEvent.removeListener(spy);
    UiItemsManager.unregister(testUiProvider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("register UiProvider should trigger callback", () => {
    const spy = sinon.spy();
    const testUiProvider = new TestUnregisterUiItemsProvider("TestUnregisterUiItemsProvider", spy);
    UiItemsManager.register(testUiProvider);
    expect(spy.calledOnce).to.false;

    const toolSpecs = UiItemsManager.getToolbarButtonItems("stage", testStageUsage, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
    expect(toolSpecs.length).to.be.eq(0);
    const statusbarItems = UiItemsManager.getStatusBarItems("stage", testStageUsage);
    expect(statusbarItems.length).to.be.eq(0);
    const widgets = UiItemsManager.getWidgets("", testStageUsage, StagePanelLocation.Right);
    expect(widgets.length).to.be.eq(0);
    // back stage items are independent of frontstage
    const backstageItems = UiItemsManager.getBackstageItems();
    expect(backstageItems.length).to.be.eq(0);

    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    testUiProvider.unregister();
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    expect(spy.calledOnce).to.true;
  });

  it("don't register UiProvider with same id more than once", () => {
    const testUiProvider = new TestUiItemsProvider("TestUiItemsProvider");
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    UiItemsManager.register(testUiProvider);
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.register(testUiProvider);
    const providerIds = UiItemsManager.registeredProviderIds;
    expect(providerIds.length).to.eq(1);
    expect(providerIds[0]).to.eq(testUiProvider.id);
    UiItemsManager.unregister(testUiProvider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("Registered UiProvider should return items since stage is supported ", () => {
    const testUiProvider = new TestUiItemsProvider("TestUiItemsProvider", (_, stageUsage) => stageUsage === StageUsage.General);
    UiItemsManager.register(testUiProvider);
    const toolSpecs = UiItemsManager.getToolbarButtonItems("stage", testStageUsage, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
    expect(toolSpecs.length).to.be.eq(1);
    const statusbarItems = UiItemsManager.getStatusBarItems("stage", testStageUsage);
    expect(statusbarItems.length).to.be.eq(2);
    const backstageItems = UiItemsManager.getBackstageItems();
    expect(backstageItems.length).to.be.eq(1);
    const widgets = UiItemsManager.getWidgets("", testStageUsage, StagePanelLocation.Right);
    expect(widgets.length).to.be.eq(1);
    UiItemsManager.unregister(testUiProvider.id);
  });

  it(`Registered UiProvider should return items since default usage of "General" is supported`, () => {
    const testUiProvider = new TestUiItemsProvider("TestUiItemsProvider");
    UiItemsManager.register(testUiProvider);
    const toolSpecs = UiItemsManager.getToolbarButtonItems("stage", testStageUsage, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
    expect(toolSpecs.length).to.be.eq(1);
    const statusbarItems = UiItemsManager.getStatusBarItems("stage", testStageUsage);
    expect(statusbarItems.length).to.be.eq(2);
    const backstageItems = UiItemsManager.getBackstageItems();
    expect(backstageItems.length).to.be.eq(1);
    const widgets = UiItemsManager.getWidgets("", testStageUsage, StagePanelLocation.Right);
    expect(widgets.length).to.be.eq(1);
    UiItemsManager.unregister(testUiProvider.id);
  });

  it("Registered UiProvider should NOT return items since stage is not supported ", () => {
    const testUiProvider = new TestUiItemsProvider("TestUiItemsProvider2", (_, stageUsage) => stageUsage === "no-support");
    UiItemsManager.register(testUiProvider);
    const toolSpecs = UiItemsManager.getToolbarButtonItems("stage", testStageUsage, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
    expect(toolSpecs.length).to.be.eq(0);
    const statusbarItems = UiItemsManager.getStatusBarItems("stage", testStageUsage);
    expect(statusbarItems.length).to.be.eq(0);
    const widgets = UiItemsManager.getWidgets("", testStageUsage, StagePanelLocation.Right);
    expect(widgets.length).to.be.eq(0);
    // back stage items are independent of frontstage
    const backstageItems = UiItemsManager.getBackstageItems();
    expect(backstageItems.length).to.be.eq(1);
    UiItemsManager.unregister(testUiProvider.id);
  });

});
