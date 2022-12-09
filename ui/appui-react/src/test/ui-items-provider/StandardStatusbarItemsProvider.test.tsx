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
import { DefaultStatusbarItems, StandardStatusbarItemsProvider } from "../../appui-react";
import { EmptyLocalization } from "@itwin/core-common";

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

describe("StandardStatusbarItemsProvider", () => {
  const testProviderId = "testStatusItemsProvider";

  // avoid problems due to no real localization resources by return dummy values for englishKeyin and keyin properties.
  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup({ localization: new EmptyLocalization() });
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
    sinon.reset();
  });

  it("should register StandardStatusbarItemsProvider with defaults", () => {
    const provider = StandardStatusbarItemsProvider.register(testProviderId);
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    // Activity Item is not included by default
    expect(UiItemsManager.getStatusBarItems("test", StageUsage.General, undefined).length).to.eq(8);
    provider.unregister();
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should register StandardStatusbarItemsProvider with no separators", () => {
    const provider = StandardStatusbarItemsProvider.register(testProviderId, {
      messageCenter: true,
      toolAssistance: true,
      activityCenter: true,
      accuSnapModePicker: true,
      tileLoadIndicator: true,
      selectionScope: true,
      selectionInfo: true,
    });
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getStatusBarItems("test", StageUsage.General, undefined).length).to.eq(7);
    provider.unregister();
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should process all combinations of options", () => {
    const provider = StandardStatusbarItemsProvider.register(testProviderId, undefined, (_stageId: string, _stageUsage: string, _applicationData: any) => {
      return true;
    });
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    // Activity Item is not included by default
    expect(UiItemsManager.getStatusBarItems("test", StageUsage.General, undefined).length).to.eq(8);
    provider.unregister();

    testArray.forEach((itemList: DefaultStatusbarItems) => {
      const local_provider = StandardStatusbarItemsProvider.register(testProviderId, itemList);
      expect(UiItemsManager.hasRegisteredProviders).to.be.true;
      UiItemsManager.getStatusBarItems("test", StageUsage.General);
      local_provider.unregister();
      expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    });
  });
});

