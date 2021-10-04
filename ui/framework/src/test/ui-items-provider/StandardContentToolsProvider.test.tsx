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
import { DefaultContentTools, DefaultContentToolsAppData, StandardContentToolsProvider } from "../../appui-react/ui-items-provider/StandardContentToolsProvider";

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

describe("StandardContentToolsProvider", () => {

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

  it("should register StandardContentToolsProvider with defaults", () => {
    StandardContentToolsProvider.register();
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(5);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(3);
    StandardContentToolsProvider.unregister();
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should register StandardContentToolsProvider with group buttons", () => {
    StandardContentToolsProvider.register({
      horizontal: {
        clearSelection: true,
        clearDisplayOverrides: true,
        hide: "group",
        isolate: "group",
        emphasize: "element",
      },
    }, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return "test" === stageId;
    });
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(5);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(3);
    StandardContentToolsProvider.unregister();
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should register StandardContentToolsProvider with no horizontal buttons", () => {
    StandardContentToolsProvider.register({
      horizontal: {},
    }, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return "test" === stageId;
    });
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(0);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(3);
    StandardContentToolsProvider.unregister();
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should register StandardContentToolsProvider with no vertical buttons", () => {
    StandardContentToolsProvider.register({
      horizontal: {
        clearSelection: true,
        clearDisplayOverrides: true,
        hide: "group",
        isolate: "group",
        emphasize: "element",
      },
      vertical: {},
    }, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return "test" === stageId;
    });
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Horizontal, undefined).length).to.eq(5);
    expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Vertical, undefined).length).to.eq(0);

    StandardContentToolsProvider.unregister();
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;
  });

  it("should process app data group options", () => {
    StandardContentToolsProvider.register({
      horizontal: {
        clearSelection: true,
        clearDisplayOverrides: true,
        hide: "group",
        isolate: "group",
        emphasize: "element",
      },
      vertical: {},
    }, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return "test" === stageId;
    });

    expect(UiItemsManager.hasRegisteredProviders).to.be.true;

    testAppDataPropsArray.forEach((testAppDataProps: DefaultContentToolsAppData) => {
      expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
        ToolbarOrientation.Horizontal, testAppDataProps).length).to.eq(5);
      expect(UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
        ToolbarOrientation.Vertical, testAppDataProps).length).to.eq(0);
    });

    StandardContentToolsProvider.unregister();
    expect(UiItemsManager.hasRegisteredProviders).to.be.false;

  });

  it("should process all combinations of options", () => {
    StandardContentToolsProvider.register(undefined, (_stageId: string, _stageUsage: string, _applicationData: any) => {
      return true;
    });
    expect(UiItemsManager.hasRegisteredProviders).to.be.true;
    UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Horizontal, undefined);
    UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
      ToolbarOrientation.Vertical, undefined);
    UiItemsManager.getStatusBarItems("test", StageUsage.General);

    StandardContentToolsProvider.unregister();

    testToolsArray.forEach((defaultTools: DefaultContentTools) => {
      StandardContentToolsProvider.register(defaultTools);
      expect(UiItemsManager.hasRegisteredProviders).to.be.true;
      UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
        ToolbarOrientation.Horizontal, undefined);
      UiItemsManager.getToolbarButtonItems("test", StageUsage.General, ToolbarUsage.ContentManipulation,
        ToolbarOrientation.Vertical, undefined);
      UiItemsManager.getStatusBarItems("test", StageUsage.General);
      StandardContentToolsProvider.unregister();
      expect(UiItemsManager.hasRegisteredProviders).to.be.false;
    });
  });
});

