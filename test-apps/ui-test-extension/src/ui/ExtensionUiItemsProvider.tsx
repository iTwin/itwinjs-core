/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  AbstractStatusBarItemUtilities, BackstageItem, BackstageItemUtilities, CommonStatusBarItem, CommonToolbarItem,
  StageUsage, StatusBarSection, ToolbarOrientation, ToolbarUsage, UiItemsProvider,
} from "@bentley/ui-abstract";
import { SampleTool } from "./tools/SampleTool";
import { UnitsPopupUiDataProvider } from "./UnitsPopup";
// import statusBarButtonSvg from "./StatusField.svg?sprite"; // use once svg are working again.
import { I18N } from "@bentley/imodeljs-i18n";
import { ExtensionFrontstage } from "./Frontstage";
import { IModelApp } from "@bentley/imodeljs-frontend";

export class ExtensionUiItemsProvider implements UiItemsProvider {
  public readonly id = "ExtensionUiItemsProvider";
  public static i18n: I18N;
  private _backstageItems?: BackstageItem[];

  public constructor(i18n: I18N) {
    ExtensionUiItemsProvider.i18n = i18n;
  }

  /** provideToolbarButtonItems() is called for each registered UI provider as the Frontstage is building toolbars. We are adding
   *  an action button to the ContentManipulation Horizontal toolbar in General use Frontstages. For more information, refer to
   *  the UiItemsProvider and Frontstage documentation on imodeljs.org.
   */
  public provideToolbarButtonItems(_stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      return [SampleTool.getActionButtonDef(1000)];
    }
    return [];
  }

  /** provide backstage item to the host application */
  public provideBackstageItems(): BackstageItem[] {
    const label = ExtensionUiItemsProvider.i18n.translate("uiTestExtension:backstage.stageName");
    if (!this._backstageItems) {
      this._backstageItems = [
        BackstageItemUtilities.createStageLauncher(ExtensionFrontstage.id, 100, 10, label, undefined, undefined),
      ];
    }
    return this._backstageItems;
  }

  /** provideStatusBarItems() is called for each registered UI provider to allow the provider to add items to the StatusBar. For more information, see the UiItemsProvider and StatusBar
   * documentation on imodeljs.org.
   */
  public provideStatusBarItems(_stageId: string, stageUsage: string): CommonStatusBarItem[] {
    const unitsIcon = "icon-app-1";   // `svg:${statusBarButtonSvg}` change once svg imports are working.
    const statusBarItems: CommonStatusBarItem[] = [];
    if (stageUsage === StageUsage.General) {
      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("UiTestExtension:UnitsStatusBarItem", StatusBarSection.Center, 100, unitsIcon, ExtensionUiItemsProvider.i18n.translate("uiTestExtension:StatusBar.UnitsFlyover"),
          () => {
            IModelApp.uiAdmin.openDialog(new UnitsPopupUiDataProvider(ExtensionUiItemsProvider.i18n), ExtensionUiItemsProvider.i18n.translate("uiTestExtension:StatusBar.Units"),
              true, "uiTestExtension:units-popup", {movable: true,  width: 280, minWidth: 280});
          }
        ));
    }
    return statusBarItems;
  }
}
