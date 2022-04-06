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
import { DefaultContentTools, DefaultContentToolsAppData, StandardContentToolsUiItemsProvider } from "../../appui-react";

const testAppDataPropsArray: DefaultContentToolsAppData[] = [
  {
    defaultContentTools: {
      vertical: {
        selectElementGroupPriority: 100,
        measureGroupPriority: 200,
        selectionGroupPriority: 300,
      },
      horizontal: {
        clearSelectionGroupPriority: 100,
        overridesGroupPriority: 200,
      },
    },
  },
  {
    defaultContentTools: {
      vertical: {
        selectElementGroupPriority: 100,
        selectionGroupPriority: 300,
      },
      horizontal: {
        overridesGroupPriority: 200,
      },
    },
  },
  {
    defaultContentTools: {
      vertical: {
        selectElementGroupPriority: 100,
        selectionGroupPriority: 300,
      },
      horizontal: {
        overridesGroupPriority: 200,
      },
    },
  },
  {
    defaultContentTools: {
      vertical: {
        measureGroupPriority: 200,
      },
      horizontal: {
        clearSelectionGroupPriority: 100,
      },
    },
  },
  {
    defaultContentTools: {
      vertical: {
      },
      horizontal: {
        overridesGroupPriority: 200,
      },
    },
  },
  {
    defaultContentTools: {
      vertical: {
        measureGroupPriority: 200,
      },
      horizontal: {
      },
    },
  },
  {
    defaultContentTools: {
      horizontal: {
        overridesGroupPriority: 200,
      },
    },
  },
  {
    defaultContentTools: {
      vertical: {
        measureGroupPriority: 200,
      },
    },
  },
];

const testToolsArray: DefaultContentTools[] = [
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
      clearSelection: true,
      clearDisplayOverrides: true,
      hide: "group",  // "group" | "element"
      isolate: "group", // | "element",
      emphasize: "element",
    },
    vertical: {
      selectElement: true,
      measureGroup: true,
      sectionGroup: true,
    },
  },

  {
    horizontal: {
      clearSelection: true,
      clearDisplayOverrides: true,
      hide: "element",
      isolate: "element",
      emphasize: "element",
    },
    vertical: {
      selectElement: false,
      measureGroup: false,
      sectionGroup: false,
    },
  },

  {
    horizontal: {
      clearSelection: false,
      clearDisplayOverrides: false,
      hide: "element",
      isolate: "element",
      emphasize: "element",
    },
    vertical: {
    },
  },

  {
    horizontal: {
      clearDisplayOverrides: false,
    },
    vertical: {
    },
  },

];

describe("StandardContentToolsUiItemsProvider", () => {
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

  it("should register StandardContentToolsUiItemsProvider with defaults", () => {
    const provider = new StandardContentToolsUiItemsProvider();
    UiItemsManager.register(provider);
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(5);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(3);
    UiItemsManager.unregister(provider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should register StandardContentToolsUiItemsProvider with group buttons", () => {
    const provider = new StandardContentToolsUiItemsProvider({
      horizontal: {
        clearSelection: true,
        clearDisplayOverrides: true,
        hide: "group",
        isolate: "group",
        emphasize: "element",
      },
    });
    UiItemsManager.register(provider, { stageIds: ["test"] });

    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(5);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(3);
    UiItemsManager.unregister(provider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should register StandardContentToolsUiItemsProvider with no horizontal buttons", () => {
    const provider = new StandardContentToolsUiItemsProvider({ horizontal: {} });
    UiItemsManager.register(provider, { stageIds: ["test"] });

    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(0);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(3);
    UiItemsManager.unregister(provider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should register StandardContentToolsUiItemsProvider with no vertical buttons", () => {
    const provider = new StandardContentToolsUiItemsProvider({
      horizontal: {
        clearSelection: true,
        clearDisplayOverrides: true,
        hide: "group",
        isolate: "group",
        emphasize: "element",
      },
      vertical: {},
    });
    UiItemsManager.register(provider, { stageIds: ["test"] });

    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(5);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(0);

    UiItemsManager.unregister(provider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should process app data group options", () => {
    const provider = new StandardContentToolsUiItemsProvider({
      horizontal: {
        clearSelection: true,
        clearDisplayOverrides: true,
        hide: "group",
        isolate: "group",
        emphasize: "element",
      },
      vertical: {},
    });
    UiItemsManager.register(provider, { stageIds: ["test"] });
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;

    testAppDataPropsArray.forEach((testAppDataProps: DefaultContentToolsAppData) => {
      expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
        ToolbarOrientation.Horizontal, testAppDataProps).length).to.eq(5);
      expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
        ToolbarOrientation.Vertical, testAppDataProps).length).to.eq(0);
    });

    UiItemsManager.unregister(provider.id);
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;

  });

  it("should process all combinations of options", () => {
    const provider = new StandardContentToolsUiItemsProvider();
    UiItemsManager.register(provider);
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Horizontal, undefined);
    UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Vertical, undefined);
    UiItemsManager.getStatusBarItems("test", StageUsage.General);
    UiItemsManager.unregister(provider.id);

    testToolsArray.forEach((defaultTools: DefaultContentTools) => {
      const local_provider = new StandardContentToolsUiItemsProvider(defaultTools);
      UiItemsManager.register(local_provider);
      expect(UiItemsManager.hasRegisteredProviders).to.be.true;
      UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
        ToolbarOrientation.Horizontal, undefined);
      UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
        ToolbarOrientation.Vertical, undefined);
      UiItemsManager.getStatusBarItems("test", StageUsage.General);
      UiItemsManager.unregister(local_provider.id);
      expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    });
  });
});

