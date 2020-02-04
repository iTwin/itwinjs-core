/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, FitViewTool, WindowAreaTool, ZoomViewTool, PanViewTool, RotateViewTool, SelectionTool } from "@bentley/imodeljs-frontend";
import { BadgeType, AbstractToolItemProps, AbstractMenuItemProps, AbstractToolbarProps } from "@bentley/ui-abstract";
import { CommandItemDef, ActionButtonItemDef } from "@bentley/ui-framework";

export class AccuDrawPopupTools {

  private static _menuButtonAdded = false;
  private static _accudrawMenuItems: AbstractMenuItemProps[] = [
    {
      id: "Mode", label: "~Mode", iconSpec: "icon-placeholder", badgeType: BadgeType.New,
      submenu: [
        { id: "0", item: { label: "Mode 1", iconSpec: "icon-placeholder", badgeType: BadgeType.New, execute: () => { } } },
        { id: "1", item: { label: "Mode 2", iconSpec: "icon-placeholder", badgeType: BadgeType.TechnicalPreview, execute: () => { } } },
      ],
    },
    {
      id: "Rotate", label: "~Rotate", iconSpec: "icon-placeholder",
      submenu: [
        { id: "0", item: { label: "Rotate 1", iconSpec: "icon-placeholder", execute: () => { } } },
        { id: "1", item: { label: "Rotate 2", iconSpec: "icon-placeholder", execute: () => { } } },
      ],
    },
    {
      id: "LockToAxis", item: { label: "~Lock to Axis", iconSpec: "icon-placeholder", badgeType: BadgeType.TechnicalPreview, execute: () => { } },
    },
    {
      id: "MoveOrigin", item: { label: "Move ~Origin", iconSpec: "icon-placeholder", execute: () => { } },
    },
    {
      id: "Hide", item: { label: "~Hide", iconSpec: "icon-placeholder", execute: () => { } },
    },
    {
      id: "Settings", label: "~Settings", iconSpec: "icon-placeholder",
      submenu: [
        { id: "0", item: { label: "Settings 1", iconSpec: "icon-placeholder", execute: () => { } } },
        { id: "1", item: { label: "Settings 2", iconSpec: "icon-placeholder", execute: () => { } } },
      ],
    },
  ];

  public static get addMenuButton() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.addMenuButton", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          IModelApp.uiAdmin.showMenuButton("test1", this._accudrawMenuItems, IModelApp.uiAdmin.createXAndY(150, 150), viewport.toolTipDiv);
          this._menuButtonAdded = true;
        }
      },
    });
  }

  public static get hideMenuButton() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.hideMenuButton", execute: () => {
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
  }

  private static _calculatorOnCancel = () => {
    AccuDrawPopupTools._closeCalculator();
  }

  private static _closeCalculator() {
    IModelApp.uiAdmin.hideCalculator();
  }

  public static get showCalculator() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showCalculator", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          IModelApp.uiAdmin.showCalculator(100, "icon-placeholder", IModelApp.uiAdmin.createXAndY(150, 150), this._calculatorOnOk, this._calculatorOnCancel, viewport.toolTipDiv);
        }
      },
    });
  }

  private static _inputCommit = (value: number) => {
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Updated value is ${value}`));
    AccuDrawPopupTools._closeInputEditor();
  }

  private static _inputCancel = () => {
    AccuDrawPopupTools._closeInputEditor();
  }

  private static _closeInputEditor() {
    IModelApp.uiAdmin.hideInputEditor();
  }

  public static get showAngleEditor() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showAngleEditor", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          IModelApp.uiAdmin.showAngleEditor(90, IModelApp.uiAdmin.createXAndY(150, 150), this._inputCommit, this._inputCancel, viewport.toolTipDiv);
        }
      },
    });
  }

  public static get showLengthEditor() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showLengthEditor", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          IModelApp.uiAdmin.showLengthEditor(90, IModelApp.uiAdmin.createXAndY(150, 150), this._inputCommit, this._inputCancel, viewport.toolTipDiv);
        }
      },
    });
  }

  public static get showHeightEditor() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showHeightEditor", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          IModelApp.uiAdmin.showHeightEditor(30, IModelApp.uiAdmin.createXAndY(150, 150), this._inputCommit, this._inputCancel, viewport.toolTipDiv);
        }
      },
    });
  }

  public static get showContextMenu() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showContextMenu", execute: () => {
        IModelApp.uiAdmin.showContextMenu(this._accudrawMenuItems, IModelApp.uiAdmin.cursorPosition);
      },
    });
  }

  private static _HTMLElementOnCancel = () => {
    AccuDrawPopupTools._closeHTMLElement();
  }

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

  public static get selectElementItemProps(): AbstractToolItemProps {
    return {
      toolId: SelectionTool.toolId,
      iconSpec: SelectionTool.iconSpec,
      label: () => SelectionTool.flyover,
      description: () => SelectionTool.description,
      execute: () => {
        IModelApp.tools.run(SelectionTool.toolId);
      },
    };
  }

  public static get fitViewItemProps(): AbstractToolItemProps {
    return {
      toolId: FitViewTool.toolId,
      iconSpec: FitViewTool.iconSpec,
      label: () => FitViewTool.flyover,
      description: () => FitViewTool.description,
      execute: () => { IModelApp.tools.run(FitViewTool.toolId, IModelApp.viewManager.selectedView, true); },
    };
  }

  public static get windowAreaItemProps(): AbstractToolItemProps {
    return {
      toolId: WindowAreaTool.toolId,
      iconSpec: WindowAreaTool.iconSpec,
      label: () => WindowAreaTool.flyover,
      description: () => WindowAreaTool.description,
      execute: () => { IModelApp.tools.run(WindowAreaTool.toolId, IModelApp.viewManager.selectedView); },
    };
  }

  public static get zoomViewItemProps(): AbstractToolItemProps {
    return {
      toolId: ZoomViewTool.toolId,
      iconSpec: ZoomViewTool.iconSpec,
      label: () => ZoomViewTool.flyover,
      description: () => ZoomViewTool.description,
      execute: () => { IModelApp.tools.run(ZoomViewTool.toolId, IModelApp.viewManager.selectedView); },
    };
  }

  public static get panViewItemProps(): AbstractToolItemProps {
    return {
      toolId: PanViewTool.toolId,
      iconSpec: PanViewTool.iconSpec,
      label: () => PanViewTool.flyover,
      description: () => PanViewTool.description,
      execute: () => { IModelApp.tools.run(PanViewTool.toolId, IModelApp.viewManager.selectedView); },
    };
  }

  public static get rotateViewItemProps(): AbstractToolItemProps {
    return {
      toolId: RotateViewTool.toolId,
      iconSpec: RotateViewTool.iconSpec,
      label: () => RotateViewTool.flyover,
      description: () => RotateViewTool.description,
      execute: () => { IModelApp.tools.run(RotateViewTool.toolId, IModelApp.viewManager.selectedView); },
    };
  }

  private static _markerToolbar: AbstractToolbarProps = {
    items: [
      AccuDrawPopupTools.selectElementItemProps,
      AccuDrawPopupTools.fitViewItemProps,
      AccuDrawPopupTools.windowAreaItemProps,
      AccuDrawPopupTools.zoomViewItemProps,
      AccuDrawPopupTools.panViewItemProps,
      AccuDrawPopupTools.rotateViewItemProps,
      { label: "Mode 1", iconSpec: "icon-placeholder", badgeType: BadgeType.New, execute: () => { } },
      { label: "Mode 2", iconSpec: "icon-placeholder", badgeType: BadgeType.TechnicalPreview, execute: () => { } },
    ],
  };

  private static _toolbarItemExecuted = (_item: ActionButtonItemDef) => {
    AccuDrawPopupTools._closeToolbar();
  }

  private static _toolbarCancel = () => {
    AccuDrawPopupTools._closeToolbar();
  }

  private static _closeToolbar() {
    IModelApp.uiAdmin.hideToolbar();
  }

  public static get showToolbar() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showToolbar", execute: () => {
        IModelApp.uiAdmin.showToolbar(
          this._markerToolbar, IModelApp.uiAdmin.cursorPosition, IModelApp.uiAdmin.createXAndY(8, 8),
          this._toolbarItemExecuted, this._toolbarCancel);
      },
    });
  }

}
