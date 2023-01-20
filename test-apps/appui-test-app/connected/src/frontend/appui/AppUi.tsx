/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
/** Include application registered Controls in Webpack
 */
import { ContentLayoutProps, FunctionKey, StandardContentLayouts } from "@itwin/appui-abstract";
import { IModelApp } from "@itwin/core-frontend";

import {
  AccuDrawCommandItems,
  AccuDrawKeyboardShortcuts,
  CommandItemDef,
  KeyboardShortcutProps,
  UiFramework,
} from "@itwin/appui-react";
import { SignInFrontstage } from "./frontstages/SignInFrontstage";
import { IModelOpenFrontstage } from "./frontstages/IModelOpenFrontstage";

// cSpell:ignore uitestapp

/** Example Ui Configuration for an iTwin.js App
 */
export class AppUi {

  public static initialize() {
    // initialize content groups and layouts before any frontstages.
    AppUi.defineFrontstages();
    AppUi.defineKeyboardShortcuts();
  }

  /** Define Frontstages
   */
  private static defineFrontstages() {
    UiFramework.frontstages.addFrontstageProvider(new SignInFrontstage());
    IModelOpenFrontstage.register();
  }

  public static findLayoutFromContentCount(contentCount: number): ContentLayoutProps | undefined {
    if (contentCount < 0)
      return undefined;

    switch (contentCount) {
      case 1:
        return StandardContentLayouts.singleView;
      case 2:
        return StandardContentLayouts.twoHorizontalSplit;
      case 3:
        return StandardContentLayouts.threeViewsTwoOnRight;
      default:
        return StandardContentLayouts.fourQuadrants;
    }
  }

  /** Define Keyboard Shortcuts list.
   */
  private static defineKeyboardShortcuts() {
    const keyboardShortcutList: KeyboardShortcutProps[] = [
      {
        key: "m",
        labelKey: "SampleApp:buttons.accuDrawSubMenu",
        shortcuts: [
          {
            key: "n",
            item: AppUi._bumpToolSettingToggle,
          },
          {
            key: "f",
            item: AccuDrawCommandItems.focusToolSetting,
          },
        ],
      },
      {
        key: FunctionKey.F7,
        item: AppUi._showShortcutsMenuCommand,
      },
    ];

    UiFramework.keyboardShortcuts.loadKeyboardShortcuts(keyboardShortcutList);

    UiFramework.keyboardShortcuts.loadKeyboardShortcuts(AccuDrawKeyboardShortcuts.getDefaultShortcuts());
  }

  private static get _bumpToolSettingToggle() {
    return new CommandItemDef({
      commandId: "bumpToolSettingToggle",
      labelKey: "SampleApp:buttons.bumpToolSettingToggle",
      execute: async () => IModelApp.toolAdmin.bumpToolSetting(2),  // Works with ToolWithSettings
    });
  }

  private static get _showShortcutsMenuCommand() {
    return new CommandItemDef({
      commandId: "showShortcutsMenu",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.showShortcutsMenu",
      execute: () => {
        UiFramework.keyboardShortcuts.displayShortcutsMenu();
      },
    });
  }
}
