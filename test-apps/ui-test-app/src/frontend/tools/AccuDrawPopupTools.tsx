/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";
import { Point } from "@bentley/ui-core";
import { MenuItemProps, CommandItemDef, AccuDrawPopupManager } from "@bentley/ui-framework";
import { BadgeType } from "@bentley/ui-abstract";

export class AccuDrawPopupTools {

  private static _menuButtonAdded = false;
  private static _accudrawMenuItems: MenuItemProps[] = [
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
          AccuDrawPopupManager.showMenuButton("test1", viewport.toolTipDiv, new Point(150, 150), this._accudrawMenuItems);
          this._menuButtonAdded = true;
        }
      },
    });
  }

  public static get hideMenuButton() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.hideMenuButton", execute: () => {
        if (this._menuButtonAdded) {
          AccuDrawPopupManager.hideMenuButton("test1");
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
    AccuDrawPopupManager.removeCalculator();
  }

  public static get showCalculator() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showCalculator", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          AccuDrawPopupManager.showCalculator(viewport.toolTipDiv, new Point(150, 150), 100, "icon-placeholder", this._calculatorOnOk, this._calculatorOnCancel);
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
    AccuDrawPopupManager.removeInputEditor();
  }

  public static get showAngleEditor() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showAngleEditor", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          AccuDrawPopupManager.showAngleEditor(viewport.toolTipDiv, new Point(150, 150), 90, this._inputCommit, this._inputCancel);
        }
      },
    });
  }

  public static get showLengthEditor() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showLengthEditor", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          AccuDrawPopupManager.showLengthEditor(viewport.toolTipDiv, new Point(150, 150), 90, this._inputCommit, this._inputCancel);
        }
      },
    });
  }

  public static get showHeightEditor() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showHeightEditor", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          AccuDrawPopupManager.showHeightEditor(viewport.toolTipDiv, new Point(150, 150), 30, this._inputCommit, this._inputCancel);
        }
      },
    });
  }

}
