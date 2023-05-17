/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import * as sinon from "sinon";
import {
  AbstractStatusBarItemUtilities, AbstractWidgetProps, BackstageItem, BackstageItemUtilities, CommonStatusBarItem, CommonToolbarItem,
  StagePanelLocation, StagePanelSection, StageUsage, StatusBarSection, ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage,
  UiItemsManager, UiItemsProvider,
} from "../appui-abstract";

const testStageUsage = StageUsage.General;

/** TestUiItemsProvider that provides tools and status bar items */
class TestUiItemsProvider implements UiItemsProvider {
  public get id(): string { return "unitTest:TestUiItemsProvider"; }

  public provideToolbarButtonItems(_stageId: string, _stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
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
  public provideStatusBarItems(_stageId: string, _stageUsage: string, _stageAppData?: any): CommonStatusBarItem[] {
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

  public provideBackstageItems(): BackstageItem[] {
    return [
      BackstageItemUtilities.createActionItem("UiItemsProviderTest:backstage1", 500, 50, () => { }, "Dynamic Action", undefined, undefined, { isHidden: !TestUiItemsProvider.sampleStatusVisible }),
    ];
  }

  public provideWidgets(_stageId: string, _stageUsage: string, _location: StagePanelLocation, _section?: StagePanelSection, _stageAppData?: any): AbstractWidgetProps[] {
    const widgets: AbstractWidgetProps[] = [];
    widgets.push({
      id: "test",
      getWidgetContent: () => "Hello World!",
    });

    return widgets;
  }
}

describe("UiItemsManager", () => {
  afterEach(() => sinon.restore());

  it("can't unregister if provider id is not registered", () => {
    const testUiProvider = new TestUiItemsProvider();
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    UiItemsManager.register(testUiProvider);
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.unregister("dummy");
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.unregister(testUiProvider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("can clear all providers", () => {
    const testUiProvider = new TestUiItemsProvider();
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
    const testUiProvider = new TestUiItemsProvider();
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

  it("don't register UiProvider with same id more than once", () => {
    const testUiProvider = new TestUiItemsProvider();
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

  it("can register UiProvider twice if alternate id is used", () => {
    const testUiProvider = new TestUiItemsProvider();
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    UiItemsManager.register(testUiProvider);
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.register(testUiProvider, {providerId: "secondInstance", stageIds: ["test"]});
    const providerIds = UiItemsManager.registeredProviderIds;
    expect(providerIds.length).to.eq(2);
    expect(providerIds[0]).to.eq(testUiProvider.id);
    expect(providerIds[1]).to.eq("secondInstance");
    UiItemsManager.unregister(testUiProvider.id);
    UiItemsManager.unregister("secondInstance");
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it(`Registered UiProvider should return items since default usage of "General" is supported`, () => {
    const testUiProvider = new TestUiItemsProvider();
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

  it("Registered UiProvider should return items since stage is supported ", () => {
    const testUiProvider = new TestUiItemsProvider();
    UiItemsManager.register(testUiProvider, {stageIds: ["stage"]});
    const toolSpecs = UiItemsManager.getToolbarButtonItems("stage", testStageUsage, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
    expect(toolSpecs.length).to.be.eq(1);
    const statusbarItems = UiItemsManager.getStatusBarItems("stage", testStageUsage);
    expect(statusbarItems.length).to.be.eq(2);
    const backstageItems = UiItemsManager.getBackstageItems();
    expect(backstageItems.length).to.be.eq(1);
    const widgets = UiItemsManager.getWidgets("stage", testStageUsage, StagePanelLocation.Right);
    expect(widgets.length).to.be.eq(1);
    UiItemsManager.unregister(testUiProvider.id);
  });

  it("Registered UiProvider should return items since stage usage is supported ", () => {
    const testUiProvider = new TestUiItemsProvider();
    UiItemsManager.register(testUiProvider, {stageUsages: ["private"]});
    const toolSpecs = UiItemsManager.getToolbarButtonItems("stage", "private", ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
    expect(toolSpecs.length).to.be.eq(1);
    const statusbarItems = UiItemsManager.getStatusBarItems("stage", "private");
    expect(statusbarItems.length).to.be.eq(2);
    const backstageItems = UiItemsManager.getBackstageItems();
    expect(backstageItems.length).to.be.eq(1);
    const widgets = UiItemsManager.getWidgets("stage", "private", StagePanelLocation.Right);
    expect(widgets.length).to.be.eq(1);
    UiItemsManager.unregister(testUiProvider.id);
  });

  it("Registered UiProvider should NOT return items since stage usage does not match allowed", () => {
    const testUiProvider = new TestUiItemsProvider();
    UiItemsManager.register(testUiProvider, {stageUsages: ["private"]});
    const toolSpecs = UiItemsManager.getToolbarButtonItems("stage", testStageUsage, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
    expect(toolSpecs.length).to.be.eq(0);
    const statusbarItems = UiItemsManager.getStatusBarItems("stage", testStageUsage);
    expect(statusbarItems.length).to.be.eq(0);
    // backstage items are not stage specific
    const backstageItems = UiItemsManager.getBackstageItems();
    expect(backstageItems.length).to.be.eq(1);
    const widgets = UiItemsManager.getWidgets("stage", testStageUsage, StagePanelLocation.Right);
    expect(widgets.length).to.be.eq(0);
    UiItemsManager.unregister(testUiProvider.id);
  });

  it("Should return provider specific items per stage ", () => {
    const testUiProvider = new TestUiItemsProvider();
    UiItemsManager.register(testUiProvider, {stageIds: ["stage"]});
    UiItemsManager.register(testUiProvider, {providerId: "stage2:testProvider", stageIds: ["stage2"]});
    const toolSpecs = UiItemsManager.getToolbarButtonItems("stage", testStageUsage, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
    expect(toolSpecs.length).to.be.eq(1);
    const statusbarItems = UiItemsManager.getStatusBarItems("stage", testStageUsage);
    expect(statusbarItems.length).to.be.eq(2);
    const backstageItems = UiItemsManager.getBackstageItems();
    expect(backstageItems.length).to.be.eq(1);
    const widgets = UiItemsManager.getWidgets("stage", testStageUsage, StagePanelLocation.Right);
    expect(widgets.length).to.be.eq(1);

    const toolSpecs2 = UiItemsManager.getToolbarButtonItems("stage2", testStageUsage, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
    expect(toolSpecs2.length).to.be.eq(1);
    const statusbarItems2 = UiItemsManager.getStatusBarItems("stage2", testStageUsage);
    expect(statusbarItems2.length).to.be.eq(2);
    const backstageItems2 = UiItemsManager.getBackstageItems();
    expect(backstageItems2.length).to.be.eq(1);
    const widgets2 = UiItemsManager.getWidgets("stage2", testStageUsage, StagePanelLocation.Right);
    expect(widgets2.length).to.be.eq(1);

    UiItemsManager.unregister(testUiProvider.id);
    UiItemsManager.unregister("stage2:testProvider");
  });

  it("Should return provider specific items per stage and avoid duplicate", () => {
    const testUiProvider = new TestUiItemsProvider();
    UiItemsManager.register(testUiProvider, {stageIds: ["stage"]});
    UiItemsManager.register(testUiProvider, {providerId: "stage:testProvider", stageIds: ["stage"]}); // alternate provider but wrongly targets same stage
    const toolSpecs = UiItemsManager.getToolbarButtonItems("stage", testStageUsage, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
    expect(toolSpecs.length).to.be.eq(1);
    const statusbarItems = UiItemsManager.getStatusBarItems("stage", testStageUsage);
    expect(statusbarItems.length).to.be.eq(2);
    const backstageItems = UiItemsManager.getBackstageItems();
    expect(backstageItems.length).to.be.eq(1);
    const widgets = UiItemsManager.getWidgets("stage", testStageUsage, StagePanelLocation.Right);
    expect(widgets.length).to.be.eq(1);

    UiItemsManager.unregister(testUiProvider.id);
    UiItemsManager.unregister("stage:testProvider");
  });

  it("Registered UiProvider should  NOT return items since stage is NOT in supported list", () => {
    const testUiProvider = new TestUiItemsProvider();
    UiItemsManager.register(testUiProvider, {stageIds: ["stage2"]});
    const toolSpecs = UiItemsManager.getToolbarButtonItems("stage", testStageUsage, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
    expect(toolSpecs.length).to.be.eq(0);
    const statusbarItems = UiItemsManager.getStatusBarItems("stage", testStageUsage);
    expect(statusbarItems.length).to.be.eq(0);
    // NOTE: backstage items are not "stage" specific
    const backstageItems = UiItemsManager.getBackstageItems();
    expect(backstageItems.length).to.be.eq(1);
    const widgets = UiItemsManager.getWidgets("", testStageUsage, StagePanelLocation.Right);
    expect(widgets.length).to.be.eq(0);
    UiItemsManager.unregister(testUiProvider.id);
  });

});
