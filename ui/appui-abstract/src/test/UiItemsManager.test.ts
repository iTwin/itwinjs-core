/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import {
  AbstractStatusBarItemUtilities, AbstractWidgetProps, BackstageItem, BackstageItemUtilities, CommonStatusBarItem, CommonToolbarItem,
  StagePanelLocation, StagePanelSection, StageUsage, StatusBarSection, ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage, UiItemsManager,
  UiItemsProvider,
} from "../appui-abstract";

const testStageUsage = StageUsage.General;

/** TestUiItemsProvider that provides tools and status bar items */
class TestUiItemsProvider implements UiItemsProvider {
  public readonly id = "TestUiItemsProvider";

  public provideToolbarButtonItems(_stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
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
  public provideStatusBarItems(_stageId: string, stageUsage: string): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];

    if (stageUsage === StageUsage.General) {
      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("UiItemsProviderTest:StatusBarItem1", StatusBarSection.Center, 100, "icon-developer", "test status bar from extension",
          () => {
            // eslint-disable-next-line no-console
            console.log("Got Here!");
          }));

      statusBarItems.push(AbstractStatusBarItemUtilities.createLabelItem("UiItemsProviderTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello", undefined));
    }
    return statusBarItems;
  }

  public static sampleStatusVisible = true;

  public provideBackstageItems(): BackstageItem[] {
    return [
      BackstageItemUtilities.createActionItem("UiItemsProviderTest:backstage1", 500, 50, () => { }, "Dynamic Action", undefined, undefined, { isHidden: !TestUiItemsProvider.sampleStatusVisible }),
    ];
  }

  public provideWidgets(_stageId: string, stageUsage: string, _location: StagePanelLocation, _section?: StagePanelSection | undefined): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];

    if (stageUsage === testStageUsage) {
      widgets.push({
        id: "test",
        getWidgetContent: () => "Hello World!",
      });
    }

    return widgets;
  }
}

class TestUnregisterUiItemsProvider implements UiItemsProvider {
  public readonly id = "TestUnregisterUiItemsProvider";
  constructor(private _onUregisterFunc: () => void) {

  }
  public onUnregister() {
    this._onUregisterFunc();
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
    spy.calledOnce.should.false;
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    UiItemsManager.register(testUiProvider);
    spy.calledOnce.should.true;
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.onUiProviderRegisteredEvent.removeListener(spy);
    UiItemsManager.unregister(testUiProvider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("register UiProvider should trigger callback", () => {
    const spy = sinon.spy();
    const testUiProvider = new TestUnregisterUiItemsProvider(spy);
    UiItemsManager.register(testUiProvider);
    spy.calledOnce.should.false;
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.unregister(testUiProvider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    spy.calledOnce.should.true;
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

  it("Registered UiProvider should return items", () => {
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

});
