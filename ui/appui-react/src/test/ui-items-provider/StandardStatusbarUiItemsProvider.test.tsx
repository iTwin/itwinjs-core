/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import {
  StageUsage, UiItemsManager,
} from "@itwin/appui-abstract";
import TestUtils from "../TestUtils";
import { MockRender } from "@itwin/core-frontend";
import { DefaultStatusbarItems, StandardStatusbarUiItemsProvider } from "../../appui-react";
const testArray: DefaultStatusbarItems[] = [
  {
  },

  {
    messageCenter: true,
    preToolAssistanceSeparator: true,
    toolAssistance: true,
    postToolAssistanceSeparator: true,
    activityCenter: true,
    accuSnapModePicker: true,
    tileLoadIndicator: true,
    selectionScope: true,
    selectionInfo: true,
  },

  {
    messageCenter: true,
  },

  {
    preToolAssistanceSeparator: true,
    toolAssistance: true,
    postToolAssistanceSeparator: true,
    activityCenter: true,
    accuSnapModePicker: true,
    tileLoadIndicator: true,
    selectionScope: true,
    selectionInfo: true,
  },

  {
    messageCenter: true,
    toolAssistance: true,
    activityCenter: true,
    accuSnapModePicker: true,
    tileLoadIndicator: true,
    selectionScope: true,
    selectionInfo: true,
  },

];

describe("StandardStatusbarUiItemsProvider", () => {

  // avoid problems due to no real localization resources by return dummy values for englishKeyin and keyin properties.
  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
    sinon.reset();
  });

  it("should register StandardStatusbarUiItemsProvider with defaults", () => {
    const provider = new StandardStatusbarUiItemsProvider();
    UiItemsManager.register(provider);

    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    // Activity Item is not included by default
    expect(UiItemsManager.getStatusBarItems("test", StageUsage.General, undefined).length).to.eq(8);
    UiItemsManager.unregister(provider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should register StandardStatusbarUiItemsProvider with no separators", () => {
    const provider = new StandardStatusbarUiItemsProvider({
      messageCenter: true,
      toolAssistance: true,
      activityCenter: true,
      accuSnapModePicker: true,
      tileLoadIndicator: true,
      selectionScope: true,
      selectionInfo: true,
    });
    UiItemsManager.register(provider);

    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getStatusBarItems("test", StageUsage.General, undefined).length).to.eq(7);
    UiItemsManager.unregister(provider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should process all combinations of options", () => {
    const provider = new StandardStatusbarUiItemsProvider();
    UiItemsManager.register(provider);

    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    // Activity Item is not included by default
    expect(UiItemsManager.getStatusBarItems("test", StageUsage.General).length).to.eq(8);
    UiItemsManager.unregister(provider.id);

    testArray.forEach((itemList: DefaultStatusbarItems) => {
      const local_provider = new StandardStatusbarUiItemsProvider(itemList);
      UiItemsManager.register(provider);
      expect(UiItemsManager.hasRegisteredProviders).to.be.true;
      UiItemsManager.getStatusBarItems("test", StageUsage.General);
      UiItemsManager.unregister(local_provider.id);
      expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    });
  });
});

