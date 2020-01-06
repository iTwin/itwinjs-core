/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";

import {
  AbstractStatusBarItemUtilities, StatusBarSection,
  CommonStatusBarItem, PluginUiProvider, ToolbarItemInsertSpec, ActionItemInsertSpec, ToolbarItemType, StageUsage, PluginUiManager,
} from "../../ui-abstract";

const testToolbarId = "testToolbarId";
const testStageUsage = StageUsage.General;

/** TestUiProvider that provides tools and status bar items */
class TestUiProvider implements PluginUiProvider {
  public readonly id = "TestUiProvider";
  public provideToolbarItems(toolBarId: string): ToolbarItemInsertSpec[] {
    // tslint:disable-next-line: no-console
    // console.log(`Requesting tools for toolbar ${toolBarId}`);

    if (testToolbarId === toolBarId) {
      const simpleActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        itemId: "simple-test-action-tool",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "simple-test-action-tool",
      };

      return [simpleActionSpec];
    }
    return [];
  }

  public static statusBarItemIsVisible = true;

  public provideStatusbarItems(_stageId: string, stageUsage: StageUsage): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];

    if (stageUsage === testStageUsage) {
      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem1", StatusBarSection.Center, 100, "icon-developer", "test status bar from plugin",
          () => {
            // tslint:disable-next-line: no-console
            console.log("Got Here!");
          }));

      statusBarItems.push(
        AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello"));
    }
    return statusBarItems;
  }
}

describe("PluginUiManager", () => {
  afterEach(() => sinon.restore());

  it("can't unregister if provider id is not registered", () => {
    const testUiProvider = new TestUiProvider();
    expect(PluginUiManager.hasRegisteredProviders).to.be.false;
    PluginUiManager.register(testUiProvider);
    expect(PluginUiManager.hasRegisteredProviders).to.be.true;
    PluginUiManager.unregister("dummy");
    expect(PluginUiManager.hasRegisteredProviders).to.be.true;
    PluginUiManager.unregister(testUiProvider.id);
    expect(PluginUiManager.hasRegisteredProviders).to.be.false;
  });

  it("if no unregistered providers no tools are available", () => {
    const toolSpecs = PluginUiManager.getToolbarItems(testToolbarId);
    expect(toolSpecs.length).to.be.eq(0);
    const statusbarItems = PluginUiManager.getStatusbarItems("", testStageUsage);
    expect(statusbarItems.length).to.be.eq(0);
  });

  it("register UiProvider should trigger callback", () => {
    const spy = sinon.spy();
    const testUiProvider = new TestUiProvider();
    PluginUiManager.onUiProviderRegisteredEvent.addListener(spy);
    spy.calledOnce.should.false;
    expect(PluginUiManager.hasRegisteredProviders).to.be.false;
    PluginUiManager.register(testUiProvider);
    spy.calledOnce.should.true;
    expect(PluginUiManager.hasRegisteredProviders).to.be.true;
    PluginUiManager.onUiProviderRegisteredEvent.removeListener(spy);
    PluginUiManager.unregister(testUiProvider.id);
    expect(PluginUiManager.hasRegisteredProviders).to.be.false;
  });

  it("don't register UiProvider with same id more than once", () => {
    const testUiProvider = new TestUiProvider();
    expect(PluginUiManager.hasRegisteredProviders).to.be.false;
    PluginUiManager.register(testUiProvider);
    expect(PluginUiManager.hasRegisteredProviders).to.be.true;
    PluginUiManager.register(testUiProvider);
    const providerIds = PluginUiManager.registeredProviderIds;
    expect(providerIds.length).to.eq(1);
    expect(providerIds[0]).to.eq(testUiProvider.id);
    PluginUiManager.unregister(testUiProvider.id);
    expect(PluginUiManager.hasRegisteredProviders).to.be.false;
  });

  it("Registered UiProvider should return items", () => {
    const testUiProvider = new TestUiProvider();
    PluginUiManager.register(testUiProvider);
    const toolSpecs = PluginUiManager.getToolbarItems(testToolbarId);
    expect(toolSpecs.length).to.be.eq(1);
    const statusbarItems = PluginUiManager.getStatusbarItems("", testStageUsage);
    expect(statusbarItems.length).to.be.eq(2);
    PluginUiManager.unregister(testUiProvider.id);
  });

});
