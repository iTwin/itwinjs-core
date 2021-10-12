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
import { DefaultStatusbarItems, StandardStatusbarItemsProvider } from "../../appui-react/ui-items-provider/StandardStatusbarItemsProvider";

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

  // avoid problems due to no real localization resources by return dummy values for englishKeyin and keyin properties.
  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup({ localization: TestUtils.localization });
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
    sinon.reset();
  });

  it("should register StandardStatusbarItemsProvider with defaults", () => {
    StandardStatusbarItemsProvider.register();
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getStatusBarItems("test", StageUsage.General, undefined).length).to.eq(9);
    StandardStatusbarItemsProvider.unregister();
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should register StandardStatusbarItemsProvider with no separators", () => {
    StandardStatusbarItemsProvider.register({
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
    StandardStatusbarItemsProvider.unregister();
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should process all combinations of options", () => {
    StandardStatusbarItemsProvider.register(undefined, (_stageId: string, _stageUsage: string, _applicationData: any) => {
      return true;
    });
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getStatusBarItems("test", StageUsage.General, undefined).length).to.eq(9);
    StandardStatusbarItemsProvider.unregister();

    testArray.forEach((itemList: DefaultStatusbarItems) => {
      StandardStatusbarItemsProvider.register(itemList);
      expect(UiItemsManager.hasRegisteredProviders).to.be.true;
      UiItemsManager.getStatusBarItems("test", StageUsage.General);
      StandardStatusbarItemsProvider.unregister();
      expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    });
  });
});

