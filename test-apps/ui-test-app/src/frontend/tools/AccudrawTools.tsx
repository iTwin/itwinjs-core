/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";
import { Point } from "@bentley/ui-core";
import { MenuItemProps, CommandItemDef, AccudrawUiManager } from "@bentley/ui-framework";

export class AccudrawTools {

  private static _menuButtonAdded = false;
  private static _accudrawMenuItems: MenuItemProps[] = [
    {
      id: "Mode", label: "~Mode", iconSpec: "icon-placeholder",
      submenu: [
        { id: "0", item: { label: "Mode 1", iconSpec: "icon-placeholder", execute: () => { } } },
        { id: "1", item: { label: "Mode 2", iconSpec: "icon-placeholder", execute: () => { } } },
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
      id: "LockToAxis", item: { label: "~Lock to Axis", iconSpec: "icon-placeholder", execute: () => { } },
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
          AccudrawUiManager.showMenuButton("test1", viewport.toolTipDiv, new Point(150, 150), this._accudrawMenuItems);
          this._menuButtonAdded = true;
        }
      },
    });
  }

  public static get hideMenuButton() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.hideMenuButton", execute: () => {
        if (this._menuButtonAdded) {
          AccudrawUiManager.hideMenuButton("test1");
          this._menuButtonAdded = false;
        }
      },
    });
  }

  private static _calculatorOnOk = (value: number) => {
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Calculated value is ${value}`));
    AccudrawTools._closeCalculator();
  }

  private static _calculatorOnCancel = () => {
    AccudrawTools._closeCalculator();
  }

  private static _closeCalculator() {
    AccudrawUiManager.removeCalculator();
  }

  public static get showCalculator() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showCalculator", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          AccudrawUiManager.showCalculator(viewport.toolTipDiv, new Point(150, 150), "icon-placeholder", this._calculatorOnOk, this._calculatorOnCancel);
        }
      },
    });
  }

  private static _inputCommit = (value: number) => {
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Updated value is ${value}`));
    AccudrawTools._closeInputEditor();
  }

  private static _inputCancel = () => {
    AccudrawTools._closeInputEditor();
  }

  private static _closeInputEditor() {
    AccudrawUiManager.removeInputEditor();
  }

  public static get showInputEditor() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.showInputEditor", execute: () => {
        const viewport = IModelApp.viewManager.selectedView;
        if (viewport) {
          AccudrawUiManager.showInputEditor(viewport.toolTipDiv, new Point(150, 150), "icon-placeholder", this._inputCommit, this._inputCancel);
        }
      },
    });
  }

}
