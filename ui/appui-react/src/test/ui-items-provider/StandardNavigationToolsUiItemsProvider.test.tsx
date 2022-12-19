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
import { DefaultNavigationTools, StandardNavigationToolsUiItemsProvider } from "../../appui-react";

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

describe("StandardNavigationToolsUiItemsProvider", () => {

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

  it("should register StandardNavigationToolsUiItemsProvider with defaults", () => {
    const provider = new StandardNavigationToolsUiItemsProvider();
    UiItemsManager.register(provider);

    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(6);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(3);

    UiItemsManager.unregister(provider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should register StandardNavigationToolsUiItemsProvider with no horizontal buttons", () => {
    const provider = new StandardNavigationToolsUiItemsProvider({
      horizontal: {
      },
      vertical: {
        walk: true,
        toggleCamera: true,
        setupWalkCamera: true,
      },
    });
    UiItemsManager.register(provider, { stageIds: ["test"] });
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(0);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(3);
    UiItemsManager.unregister(provider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should register StandardNavigationToolsUiItemsProvider with no vertical buttons", () => {
    const provider = new StandardNavigationToolsUiItemsProvider({
      horizontal: {
        rotateView: true,
        panView: true,
        fitView: true,
        windowArea: true,
        viewUndoRedo: true,
      },
      vertical: {
      },
    });
    UiItemsManager.register(provider, { stageIds: ["test"] });

    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(6);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(0);

    UiItemsManager.unregister(provider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should process all combinations of options", () => {
    const provider = new StandardNavigationToolsUiItemsProvider();
    UiItemsManager.register(provider);
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Horizontal, undefined);
    UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
      ToolbarOrientation.Vertical, undefined);

    UiItemsManager.unregister(provider.id);

    testToolsArray.forEach((defaultTools: DefaultNavigationTools) => {
      const local_provider = new StandardNavigationToolsUiItemsProvider(defaultTools);
      UiItemsManager.register(local_provider);
      expect(UiItemsManager.hasRegisteredProviders).to.be.true;
      UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
        ToolbarOrientation.Horizontal, undefined);
      UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ViewNavigation,
        ToolbarOrientation.Vertical, undefined);
      UiItemsManager.unregister(local_provider.id);
      expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    });
  });
});

