/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  FitViewTool, IModelApp, NotifyMessageDetails, OutputMessagePriority, PanViewTool, RotateViewTool, SelectionTool, WindowAreaTool, ZoomViewTool,
} from "@itwin/core-frontend";
import { AbstractMenuItemProps, AbstractToolbarProps, BadgeType, Primitives, PropertyDescription, RelativePosition } from "@itwin/appui-abstract";
import { ActionButtonItemDef, CommandItemDef } from "@itwin/appui-react";

export class AccuDrawPopupTools {

  private static _menuButtonAdded = false;
  private static _exampleMenuItems: AbstractMenuItemProps[] = [
    {
      id: "Mode", label: "~Mode", icon: "icon-placeholder", badgeType: BadgeType.New,
      submenu: [
        { id: "0", item: { label: "Mode 1", icon: "icon-placeholder", badgeType: BadgeType.New, execute: () => { } } },
        { id: "1", item: { label: "Mode 2", icon: "icon-placeholder", badgeType: BadgeType.TechnicalPreview, execute: () => { } } },
      ],
    },
    {
      id: "Rotate", label: "~Rotate", icon: "icon-placeholder",
      submenu: [
        { id: "0", item: { label: "Rotate 1", icon: "icon-placeholder", execute: () => { } } },
        { id: "1", item: { label: "Rotate 2", icon: "icon-placeholder", execute: () => { } } },
      ],
    },
    {
      id: "LockToAxis", item: { label: "~Lock to Axis", icon: "icon-placeholder", badgeType: BadgeType.TechnicalPreview, execute: () => { } },
    },
    {
      id: "MoveOrigin", item: { label: "Move ~Origin", icon: "icon-placeholder", execute: () => { } },
    },
    {
      id: "Hide", item: { label: "~Hide", icon: "icon-placeholder", execute: () => { } },
    },
    {
      id: "Settings", label: "~Settings", icon: "icon-placeholder",
      submenu: [
        { id: "0", item: { label: "Settings 1", icon: "icon-placeholder", execute: () => { } } },
        { id: "1", item: { label: "Settings 2", icon: "icon-placeholder", execute: () => { } } },
      ],
    },
  ];

  public static get addMenuButton() {
    return new CommandItemDef({
      labelKey: "SampleApp:buttons.addMenuButton", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          IModelApp.uiAdmin.showMenuButton("test1", this._exampleMenuItems, IModelApp.uiAdmin.createXAndY(150, 150), viewport.toolTipDiv);
          this._menuButtonAdded = true;
        }
      },
    });
  }

  public static get hideMenuButton() {
    return new CommandItemDef({
      labelKey: "SampleApp:buttons.hideMenuButton", execute: () => {
        if (this._menuButtonAdded) {
          IModelApp.uiAdmin.hideMenuButton("test1");
          this._menuButtonAdded = false;
        }
      },
    });
  }

  private static _calculatorOnOk = (value: number) => {
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Calculated value is ${value}`));
    AccuDrawPopupTools._closeCalculator();
  };

  private static _calculatorOnCancel = () => {
    AccuDrawPopupTools._closeCalculator();
  };

  private static _closeCalculator() {
    IModelApp.uiAdmin.hideCalculator();
  }

  public static get showCalculator() {
    return new CommandItemDef({
      labelKey: "SampleApp:buttons.showCalculator", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          IModelApp.uiAdmin.showCalculator(100, "icon-placeholder", IModelApp.uiAdmin.createXAndY(150, 150), this._calculatorOnOk, this._calculatorOnCancel, viewport.toolTipDiv);
        }
      },
    });
  }

  private static _numberInputCommit = (value: number) => {
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Updated value is ${value}`));
    AccuDrawPopupTools._closeInputEditor();
  };

  private static _inputCommit = (value: Primitives.Value) => {
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Updated value is ${value}`));
    AccuDrawPopupTools._closeInputEditor();
  };

  private static _inputCancel = () => {
    AccuDrawPopupTools._closeInputEditor();
  };

  private static _closeInputEditor() {
    IModelApp.uiAdmin.hideInputEditor();
  }

  public static get showAngleEditor() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showAngleEditor", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          IModelApp.uiAdmin.showAngleEditor(90, IModelApp.uiAdmin.createXAndY(150, 150), this._numberInputCommit, this._inputCancel, viewport.toolTipDiv);
        }
      },
    });
  }

  public static get showLengthEditor() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showLengthEditor", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          IModelApp.uiAdmin.showLengthEditor(90, IModelApp.uiAdmin.createXAndY(150, 150), this._numberInputCommit, this._inputCancel, viewport.toolTipDiv);
        }
      },
    });
  }

  public static get showHeightEditor() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showHeightEditor", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          IModelApp.uiAdmin.showHeightEditor(30, IModelApp.uiAdmin.createXAndY(150, 150), this._numberInputCommit, this._inputCancel, viewport.toolTipDiv);
        }
      },
    });
  }

  public static get showInputEditor() {
    return new CommandItemDef({
      labelKey: "SampleApp:buttons.showInputEditor", execute: () => {
        const propertyDescription: PropertyDescription = { name: "test", displayLabel: "Test", typename: "number" };
        IModelApp.uiAdmin.showInputEditor(30, propertyDescription, IModelApp.uiAdmin.cursorPosition, this._inputCommit, this._inputCancel);
      },
    });
  }

  public static get showContextMenu() {
    return new CommandItemDef({
      labelKey: "SampleApp:buttons.showContextMenu", execute: () => {
        IModelApp.uiAdmin.showContextMenu(this._exampleMenuItems, IModelApp.uiAdmin.cursorPosition);
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private static _HTMLElementOnCancel = () => {
    AccuDrawPopupTools._closeHTMLElement();
  };

  private static _closeHTMLElement() {
    IModelApp.uiAdmin.hideHTMLElement();
  }

  public static get showHTMLElement() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showHTMLElement", execute: () => {
        const html = "<div style='width: 200px; height: 50px; display: flex; justify-content: center; align-items: center; background-color: aqua;'>Hello World!</div>";
        const display = new DOMParser().parseFromString(html, "text/html");
        IModelApp.uiAdmin.showHTMLElement(display.documentElement, IModelApp.uiAdmin.cursorPosition, IModelApp.uiAdmin.createXAndY(8, 8), this._HTMLElementOnCancel);
      },
    });
  }

  private static _exampleToolbar = (): AbstractToolbarProps => {
    return {
      toolbarId: "example-toolbar",
      items: [
        {
          id: SelectionTool.toolId,
          itemPriority: 10,
          icon: SelectionTool.iconSpec,
          label: SelectionTool.flyover,
          description: SelectionTool.description,
          execute: async () => IModelApp.tools.run(SelectionTool.toolId),
        },
        {
          id: FitViewTool.toolId, itemPriority: 20,
          icon: FitViewTool.iconSpec,
          label: FitViewTool.flyover,
          description: FitViewTool.description,
          execute: async () => IModelApp.tools.run(FitViewTool.toolId, IModelApp.viewManager.selectedView, true),
        },
        {
          id: WindowAreaTool.toolId,
          itemPriority: 30,
          icon: WindowAreaTool.iconSpec,
          label: WindowAreaTool.flyover,
          description: WindowAreaTool.description,
          execute: async () => IModelApp.tools.run(WindowAreaTool.toolId, IModelApp.viewManager.selectedView),
        },
        {
          id: ZoomViewTool.toolId,
          itemPriority: 40,
          icon: ZoomViewTool.iconSpec,
          label: ZoomViewTool.flyover,
          description: ZoomViewTool.description,
          execute: async () => IModelApp.tools.run(ZoomViewTool.toolId, IModelApp.viewManager.selectedView),
        },
        {
          id: PanViewTool.toolId,
          itemPriority: 50,
          icon: PanViewTool.iconSpec,
          label: PanViewTool.flyover,
          description: PanViewTool.description,
          execute: async () => IModelApp.tools.run(PanViewTool.toolId, IModelApp.viewManager.selectedView),
        },
        {
          id: RotateViewTool.toolId,
          itemPriority: 60,
          icon: RotateViewTool.iconSpec,
          label: RotateViewTool.flyover,
          description: RotateViewTool.description,
          execute: async () => IModelApp.tools.run(RotateViewTool.toolId, IModelApp.viewManager.selectedView),
        },
        { id: "accuDraw-mode-1", itemPriority: 70, label: "Mode 1", icon: "icon-placeholder", badgeType: BadgeType.New, execute: () => { } },
        { id: "accuDraw-mode-2", itemPriority: 80, label: "Mode 2", icon: "icon-placeholder", badgeType: BadgeType.TechnicalPreview, execute: () => { } },
      ],
    };
  };

  private static _toolbarItemExecuted = (_item: ActionButtonItemDef) => {
    AccuDrawPopupTools._closeToolbar();
  };

  private static _toolbarCancel = () => {
    AccuDrawPopupTools._closeToolbar();
  };

  private static _closeToolbar() {
    IModelApp.uiAdmin.hideToolbar();
  }

  public static get showToolbar() {
    return new CommandItemDef({
      labelKey: "SampleApp:buttons.showToolbar", execute: () => {
        IModelApp.uiAdmin.showToolbar(
          this._exampleToolbar(), IModelApp.uiAdmin.cursorPosition, IModelApp.uiAdmin.createXAndY(8, 8),
          this._toolbarItemExecuted, this._toolbarCancel);
      },
    });
  }

  public static get showToolbarOnViewport() {
    return new CommandItemDef({
      labelKey: "SampleApp:buttons.showToolbar", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          IModelApp.uiAdmin.showToolbar(
            this._exampleToolbar(), IModelApp.uiAdmin.createXAndY(200, 200), IModelApp.uiAdmin.createXAndY(8, 8),
            this._toolbarItemExecuted, this._toolbarCancel, RelativePosition.BottomRight, viewport.parentDiv);
        }
      },
    });
  }
}
