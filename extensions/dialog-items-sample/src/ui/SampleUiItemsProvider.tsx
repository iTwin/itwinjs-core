/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { UiItemsProvider, CommonToolbarItem, StageUsage, ToolbarUsage, ToolbarOrientation, ToolbarItemUtilities, AbstractStatusBarItemUtilities, CommonStatusBarItem, StatusBarSection } from "@bentley/ui-abstract";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { SampleTool } from "./SampleTool";
import { UnitsPopup } from "./UnitsPopup";
import sampleToolButtonSvg from "./SampleTool.svg?sprite";
import statusBarButtonSvg from "./StatusField.svg?sprite";
import { ModalDialogManager } from "@bentley/ui-framework";
import { I18N } from "@bentley/imodeljs-i18n";

export class SampleUiItemsProvider implements UiItemsProvider {
  public readonly id = "SampleUiItemsProvider";
  public static i18n: I18N;

  public constructor(i18n: I18N) {
    SampleUiItemsProvider.i18n = i18n;
  }
/** provideToolbarButtonItems() is called for each registered UI provider as the Frontstage is building toolbars. We are adding an action button to the ContentManipulation Horizontal toolbar
 * in General use Frontstages. For more information, refer to the UiItemsProvider and Frontstage documentation on imodeljs.org.
 */
  public provideToolbarButtonItems(_stageId: string, stageUsage: StageUsage, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      const simpleActionSpec = ToolbarItemUtilities.createActionButton("dialogItemsSample:sampleTool", 1000, `svg:${sampleToolButtonSvg}`, "Sample Tool", this.startSampleTool);
      return [simpleActionSpec];
    }
    return [];
  }

  /** provideStatusBarItems() is called for each registered UI provider to allow the provider to add items to the StatusBar. For more information, see the UiItemsProvider and StatusBar
   * documentation on imodeljs.org.
   */
  public provideStatusBarItems(_stageId: string, stageUsage: string): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];
    if (stageUsage === StageUsage.General) {
      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("DialogItemsSample:UnitsStatusBarItem", StatusBarSection.Center, 100, `svg:${statusBarButtonSvg}`, SampleTool.i18n.translate("dialogItemsSample:StatusBar.UnitsFlyover"),
          () => {
            ModalDialogManager.openDialog(this.unitsPopup());
          }));
    }
    return statusBarItems;
  }
  public unitsPopup(): React.ReactNode {
    return (
      <UnitsPopup
        opened={true}
        i18N={SampleUiItemsProvider.i18n}
      />
    );
  }
  public startSampleTool() {
    IModelApp.tools.run(SampleTool.toolId);
  }
}
