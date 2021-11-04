/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import {
  StageUsage, ToolbarOrientation, ToolbarUsage, UiItemsManager,
} from "@itwin/appui-abstract";
import TestUtils from "../TestUtils";
import { MockRender } from "@itwin/core-frontend";
import { DefaultNavigationTools, StandardNavigationToolsProvider } from "../../appui-react/ui-items-provider/StandardNavigationToolsProvider";

const testToolsArray: DefaultNavigationTools[] = [
  {
  },

  {
    horizontal: {
    },
  },

  {
    vertical: {
    },
  },
  {
    horizontal: {
      rotateView: true,
      panView: true,
      fitView: true,
      windowArea: true,
      viewUndoRedo: true,
    },
    vertical: {
      walk: true,
      toggleCamera: true,
    },
  },
  {
    horizontal: {
      rotateView: true,
    },
    vertical: {
      walk: true,
    },
  },
  {
    horizontal: {
      panView: true,
      fitView: true,
      windowArea: true,
      viewUndoRedo: true,
    },
    vertical: {
      toggleCamera: true,
    },
  },
];

describe("StandardNavigationToolsProvider", () => {
  const testToolProviderId = "ui2-standardNavigationTools";

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

  it("should register StandardNavigationToolsProvider with defaults", () => {
    StandardNavigationToolsProvider.register(testToolProviderId);
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(6);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(2);
    StandardNavigationToolsProvider.unregister(testToolProviderId);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should register StandardNavigationToolsProvider with no horizontal buttons", () => {
    StandardNavigationToolsProvider.register(testToolProviderId, {
      horizontal: {
      },
      vertical: {
        walk: true,
        toggleCamera: true,
      },
    }, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return "test" === stageId;
    });
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(0);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(2);
    StandardNavigationToolsProvider.unregister(testToolProviderId);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should register StandardNavigationToolsProvider with no vertical buttons", () => {
    StandardNavigationToolsProvider.register(testToolProviderId, {
      horizontal: {
        rotateView: true,
        panView: true,
        fitView: true,
        windowArea: true,
        viewUndoRedo: true,
      },
      vertical: {
      },
    }, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return "test" === stageId;
    });
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(6);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(0);

    StandardNavigationToolsProvider.unregister(testToolProviderId);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should process all combinations of options", () => {
    StandardNavigationToolsProvider.register(testToolProviderId, undefined, (_stageId: string, _stageUsage: string, _applicationData: any) => {
      return true;
    });
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Horizontal, undefined);
    UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Vertical, undefined);

    StandardNavigationToolsProvider.unregister(testToolProviderId);

    testToolsArray.forEach((defaultTools: DefaultNavigationTools) => {
      StandardNavigationToolsProvider.register(testToolProviderId, defaultTools);
      expect(UiItemsManager.hasRegisteredProviders).to.be.true;
      UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
        ToolbarOrientation.Horizontal, undefined);
      UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
        ToolbarOrientation.Vertical, undefined);
      StandardNavigationToolsProvider.unregister(testToolProviderId);
      expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    });
  });
});

