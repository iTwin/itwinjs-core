/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { Logger } from "@bentley/bentleyjs-core";
import {
  AbstractStatusBarItemUtilities, AbstractWidgetProps, BackstageItem, BackstageItemUtilities, CommonStatusBarItem, CommonToolbarItem,
  StagePanelLocation, StagePanelSection, StageUsage, StatusBarSection, ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage, UiItemsApplication,
  UiItemsApplicationAction, UiItemsArbiter, UiItemsManager, UiItemsProvider,
} from "../ui-abstract";

describe("UiItemsArbiter", () => {
  const onSpy = sinon.spy();
  let testUiProvider: UiItemsProvider;

  describe("uiItemsApplication", () => {
    it("should log error when already set", () => {
      UiItemsArbiter.clearApplication();
      expect(UiItemsArbiter.uiItemsApplication).to.be.undefined;

      class TestUiItemsApplication implements UiItemsApplication { }
      const spyLogger = sinon.spy(Logger, "logError");

      const app = new TestUiItemsApplication();
      UiItemsArbiter.uiItemsApplication = app;
      expect(UiItemsArbiter.uiItemsApplication).to.eq(app);

      UiItemsArbiter.uiItemsApplication = new TestUiItemsApplication();
      spyLogger.calledOnce.should.true;
      (Logger.logError as any).restore();

      UiItemsArbiter.clearApplication();
    });
  });

  describe("ToolbarItems", () => {

    class TestUiProvider implements UiItemsProvider {
      public readonly id = "TestUiProvider";
      public provideToolbarButtonItems(_stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
        if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
          const simpleActionSpec1 = ToolbarItemUtilities.createActionButton("test1", 100, "icon-developer", "addon-tool-1", (): void => { });
          const simpleActionSpec2 = ToolbarItemUtilities.createActionButton("test2", 200, "icon-developer", "addon-tool-2", (): void => { });
          return [simpleActionSpec1, simpleActionSpec2];
        }
        return [];
      }
      public onToolbarButtonItemArbiterChange(_item: CommonToolbarItem, _action: UiItemsApplicationAction): void {
        onSpy();
      }
    }

    beforeEach(() => {
      onSpy.resetHistory();
      testUiProvider = new TestUiProvider();
      UiItemsManager.register(testUiProvider);
    });

    afterEach(() => {
      UiItemsManager.unregister(testUiProvider.id);
      UiItemsArbiter.clearApplication();
    });

    it("should allow ToolbarItem", () => {
      class TestUiItemsApplication implements UiItemsApplication {
        public validateToolbarButtonItem(item: CommonToolbarItem): { updatedItem: CommonToolbarItem, action: UiItemsApplicationAction } {
          return { updatedItem: item, action: UiItemsApplicationAction.Allow };
        }
      }

      UiItemsArbiter.uiItemsApplication = new TestUiItemsApplication();

      const items = UiItemsManager.getToolbarButtonItems("", StageUsage.General, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
      const updatedItems = UiItemsArbiter.updateToolbarButtonItems(items);
      onSpy.calledOnce.should.false;
      expect(updatedItems.length).to.eq(2);
    });

    it("should disallow ToolbarItem", () => {
      class TestUiItemsApplication implements UiItemsApplication {
        public validateToolbarButtonItem(item: CommonToolbarItem): { updatedItem: CommonToolbarItem, action: UiItemsApplicationAction } {
          let action = UiItemsApplicationAction.Allow;
          if (item.id === "test2")
            action = UiItemsApplicationAction.Disallow;
          return { updatedItem: item, action };
        }
      }

      UiItemsArbiter.uiItemsApplication = new TestUiItemsApplication();

      const items = UiItemsManager.getToolbarButtonItems("", StageUsage.General, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
      const updatedItems = UiItemsArbiter.updateToolbarButtonItems(items);
      onSpy.calledOnce.should.true;
      expect(updatedItems.length).to.eq(1);
    });

    it("should change ToolbarItem", () => {
      class TestUiItemsApplication implements UiItemsApplication {
        public validateToolbarButtonItem(item: CommonToolbarItem): { updatedItem: CommonToolbarItem, action: UiItemsApplicationAction } {
          let action = UiItemsApplicationAction.Allow;
          let updatedItem = item;
          if (item.id === "test2") {
            action = UiItemsApplicationAction.Update;
            updatedItem = { ...item, itemPriority: 1000 };
          }
          return { updatedItem, action };
        }
      }

      UiItemsArbiter.uiItemsApplication = new TestUiItemsApplication();

      const items = UiItemsManager.getToolbarButtonItems("", StageUsage.General, ToolbarUsage.ContentManipulation, ToolbarOrientation.Horizontal);
      const updatedItems = UiItemsArbiter.updateToolbarButtonItems(items);
      onSpy.calledOnce.should.true;
      expect(updatedItems.length).to.eq(2);
      expect(updatedItems[1].itemPriority).to.eq(1000);
    });
  });

  describe("StatusBarItems", () => {
    class TestUiProvider implements UiItemsProvider {
      public readonly id = "TestUiProvider";
      public provideStatusBarItems(_stageId: string, stageUsage: string): CommonStatusBarItem[] {
        const statusBarItems: CommonStatusBarItem[] = [];

        if (stageUsage === StageUsage.General) {
          statusBarItems.push(
            AbstractStatusBarItemUtilities.createActionItem("test1", StatusBarSection.Center, 100, "icon-developer", "test status bar from extension", () => { }));
          statusBarItems.push(
            AbstractStatusBarItemUtilities.createLabelItem("test2", StatusBarSection.Center, 105, "icon-hand-2-condition", "Hello"));
        }
        return statusBarItems;
      }
      public onStatusBarItemArbiterChange(_item: CommonStatusBarItem, _action: UiItemsApplicationAction): void {
        onSpy();
      }
    }

    beforeEach(() => {
      onSpy.resetHistory();
      testUiProvider = new TestUiProvider();
      UiItemsManager.register(testUiProvider);
    });

    afterEach(() => {
      UiItemsManager.unregister(testUiProvider.id);
      UiItemsArbiter.clearApplication();
    });

    it("should allow StatusBarItem", () => {
      class TestUiItemsApplication implements UiItemsApplication {
        public validateStatusBarItem(item: CommonStatusBarItem): { updatedItem: CommonStatusBarItem, action: UiItemsApplicationAction } {
          return { updatedItem: item, action: UiItemsApplicationAction.Allow };
        }
      }

      UiItemsArbiter.uiItemsApplication = new TestUiItemsApplication();

      const items = UiItemsManager.getStatusBarItems("", StageUsage.General);
      const updatedItems = UiItemsArbiter.updateStatusBarItems(items);
      onSpy.calledOnce.should.false;
      expect(updatedItems.length).to.eq(2);
    });

    it("should disallow StatusBarItem", () => {
      class TestUiItemsApplication implements UiItemsApplication {
        public validateStatusBarItem(item: CommonStatusBarItem): { updatedItem: CommonStatusBarItem, action: UiItemsApplicationAction } {
          let action = UiItemsApplicationAction.Allow;
          if (item.id === "test2")
            action = UiItemsApplicationAction.Disallow;
          return { updatedItem: item, action };
        }
      }

      UiItemsArbiter.uiItemsApplication = new TestUiItemsApplication();

      const items = UiItemsManager.getStatusBarItems("", StageUsage.General);
      const updatedItems = UiItemsArbiter.updateStatusBarItems(items);
      onSpy.calledOnce.should.true;
      expect(updatedItems.length).to.eq(1);
    });

    it("should change StatusBarItem", () => {
      class TestUiItemsApplication implements UiItemsApplication {
        public validateStatusBarItem(item: CommonStatusBarItem): { updatedItem: CommonStatusBarItem, action: UiItemsApplicationAction } {
          let action = UiItemsApplicationAction.Allow;
          let updatedItem = item;
          if (item.id === "test2") {
            action = UiItemsApplicationAction.Update;
            updatedItem = { ...item, itemPriority: 1000 };
          }
          return { updatedItem, action };
        }
      }

      UiItemsArbiter.uiItemsApplication = new TestUiItemsApplication();

      const items = UiItemsManager.getStatusBarItems("", StageUsage.General);
      const updatedItems = UiItemsArbiter.updateStatusBarItems(items);
      onSpy.calledOnce.should.true;
      expect(updatedItems.length).to.eq(2);
      expect(updatedItems[1].itemPriority).to.eq(1000);
    });

  });

  describe("BackstageItems", () => {
    class TestUiProvider implements UiItemsProvider {
      public readonly id = "TestUiProvider";
      public provideBackstageItems(): BackstageItem[] {
        return [
          BackstageItemUtilities.createActionItem("test1", 500, 50, () => { }, "Dynamic Action", undefined, "icon-addon"),
          BackstageItemUtilities.createActionItem("test2", 600, 100, () => { }, "Dynamic Action", undefined, "icon-addon2"),
        ];
      }
      public onBackstageItemArbiterChange(_item: BackstageItem, _action: UiItemsApplicationAction): void {
        onSpy();
      }
    }

    beforeEach(() => {
      onSpy.resetHistory();
      testUiProvider = new TestUiProvider();
      UiItemsManager.register(testUiProvider);
    });

    afterEach(() => {
      UiItemsManager.unregister(testUiProvider.id);
      UiItemsArbiter.clearApplication();
    });

    it("should allow BackstageItem", () => {
      class TestUiItemsApplication implements UiItemsApplication {
        public validateBackstageItem(item: BackstageItem): { updatedItem: BackstageItem, action: UiItemsApplicationAction } {
          return { updatedItem: item, action: UiItemsApplicationAction.Allow };
        }
      }

      UiItemsArbiter.uiItemsApplication = new TestUiItemsApplication();

      const items = UiItemsManager.getBackstageItems();
      const updatedItems = UiItemsArbiter.updateBackstageItems(items);
      onSpy.calledOnce.should.false;
      expect(updatedItems.length).to.eq(2);
    });

    it("should disallow BackstageItem", () => {
      class TestUiItemsApplication implements UiItemsApplication {
        public validateBackstageItem(item: BackstageItem): { updatedItem: BackstageItem, action: UiItemsApplicationAction } {
          let action = UiItemsApplicationAction.Allow;
          if (item.id === "test2")
            action = UiItemsApplicationAction.Disallow;
          return { updatedItem: item, action };
        }
      }

      UiItemsArbiter.uiItemsApplication = new TestUiItemsApplication();

      const items = UiItemsManager.getBackstageItems();
      const updatedItems = UiItemsArbiter.updateBackstageItems(items);
      onSpy.calledOnce.should.true;
      expect(updatedItems.length).to.eq(1);
    });

    it("should change BackstageItem", () => {
      class TestUiItemsApplication implements UiItemsApplication {
        public validateBackstageItem(item: BackstageItem): { updatedItem: BackstageItem, action: UiItemsApplicationAction } {
          let action = UiItemsApplicationAction.Allow;
          let updatedItem = item;
          if (item.id === "test2") {
            action = UiItemsApplicationAction.Update;
            updatedItem = { ...item, itemPriority: 1000 };
          }
          return { updatedItem, action };
        }
      }

      UiItemsArbiter.uiItemsApplication = new TestUiItemsApplication();

      const items = UiItemsManager.getBackstageItems();
      const updatedItems = UiItemsArbiter.updateBackstageItems(items);
      onSpy.calledOnce.should.true;
      expect(updatedItems.length).to.eq(2);
      expect(updatedItems[1].itemPriority).to.eq(1000);
    });

  });

  describe("Widgets", () => {
    class TestUiProvider implements UiItemsProvider {
      public readonly id = "TestUiProvider";
      public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, _section?: StagePanelSection): ReadonlyArray<AbstractWidgetProps> {
        const widgets: AbstractWidgetProps[] = [];
        if (stageUsage === StageUsage.General && location === StagePanelLocation.Right) {
          widgets.push({ id: "test1", priority: 100, getWidgetContent: () => "Hello World!" });
          widgets.push({ id: "test2", priority: 200, getWidgetContent: () => "Hello World!" });
        }
        return widgets;
      }
      public onWidgetArbiterChange(_widget: AbstractWidgetProps, _action: UiItemsApplicationAction): void {
        onSpy();
      }
    }

    beforeEach(() => {
      onSpy.resetHistory();
      testUiProvider = new TestUiProvider();
      UiItemsManager.register(testUiProvider);
    });

    afterEach(() => {
      UiItemsManager.unregister(testUiProvider.id);
      UiItemsArbiter.clearApplication();
    });

    it("should allow Widget", () => {
      class TestUiItemsApplication implements UiItemsApplication {
        public validateWidget(widget: AbstractWidgetProps): { updatedWidget: AbstractWidgetProps, action: UiItemsApplicationAction } {
          return { updatedWidget: widget, action: UiItemsApplicationAction.Allow };
        }
      }

      UiItemsArbiter.uiItemsApplication = new TestUiItemsApplication();

      const widgets = UiItemsManager.getWidgets("", StageUsage.General, StagePanelLocation.Right);
      const updatedWidgets = UiItemsArbiter.updateWidgets(widgets);
      onSpy.calledOnce.should.false;
      expect(updatedWidgets.length).to.eq(2);
    });

    it("should disallow Widget", () => {
      class TestUiItemsApplication implements UiItemsApplication {
        public validateWidget(widget: AbstractWidgetProps): { updatedWidget: AbstractWidgetProps, action: UiItemsApplicationAction } {
          let action = UiItemsApplicationAction.Allow;
          if (widget.id === "test2")
            action = UiItemsApplicationAction.Disallow;
          return { updatedWidget: widget, action };
        }
      }

      UiItemsArbiter.uiItemsApplication = new TestUiItemsApplication();

      const widgets = UiItemsManager.getWidgets("", StageUsage.General, StagePanelLocation.Right);
      const updatedWidgets = UiItemsArbiter.updateWidgets(widgets);
      onSpy.calledOnce.should.true;
      expect(updatedWidgets.length).to.eq(1);
    });

    it("should change Widget", () => {
      class TestUiItemsApplication implements UiItemsApplication {
        public validateWidget(widget: AbstractWidgetProps): { updatedWidget: AbstractWidgetProps, action: UiItemsApplicationAction } {
          let action = UiItemsApplicationAction.Allow;
          let updatedWidget = widget;
          if (widget.id === "test2") {
            action = UiItemsApplicationAction.Update;
            updatedWidget = { ...widget, priority: 1000 };
          }
          return { updatedWidget, action };
        }
      }

      UiItemsArbiter.uiItemsApplication = new TestUiItemsApplication();

      const widgets = UiItemsManager.getWidgets("", StageUsage.General, StagePanelLocation.Right);
      const updatedWidgets = UiItemsArbiter.updateWidgets(widgets);
      onSpy.calledOnce.should.true;
      expect(updatedWidgets.length).to.eq(2);
      expect(updatedWidgets[1].priority).to.eq(1000);
    });
  });

});
