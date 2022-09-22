/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  AbstractStatusBarItemUtilities,
  CommonStatusBarItem, CommonToolbarItem, IconSpecUtilities, StageUsage, StatusBarSection, ToolbarOrientation, ToolbarUsage, UiItemsProvider,
} from "@itwin/appui-abstract";
import { SampleTool } from "../../tools/SampleTool";
import { UnitsPopupUiDataProvider } from "../dialogs/UnitsPopup";
import { IModelApp } from "@itwin/core-frontend";
import { AppUiTestProviders } from "../../AppUiTestProviders";
import { OpenAbstractDialogTool } from "../../tools/OpenAbstractModalDialogTool";
import statusFieldSvg from "../icons/StatusField.svg";

export interface AbstractUiItemsProviderProps {
  sampleTool?: {itemPriority?: number, groupPriority?: number};
  openAbstractDialogTool?: {itemPriority?: number, groupPriority?: number};
  unitsStatusBarItem?: {itemPriority?: number, section?: StatusBarSection };
}

/**
 * The AbstractUiItemsProvider provides additional items to any frontstage that has a usage value of StageUsage.General.
 * The unique thing about the items provided with this provider is that the toolbar and and statusbar items provider simply
 * provide abstract item data and the UI packages generate the necessary React components. This means that the package that
 * supplies the abstract definitions only need to take a dependency on appui-abstract and not on react or any of the other appui packages.
 */
export class AbstractUiItemsProvider implements UiItemsProvider {
  public readonly id = "appui-test-providers:AbstractUiItemsProvider";

  constructor(localizationNamespace: string, public props?: AbstractUiItemsProviderProps) {
    // register tools that will be returned via this provider
    OpenAbstractDialogTool.register(localizationNamespace);
    SampleTool.register(localizationNamespace);
  }

  public provideToolbarButtonItems(_stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    /** Add a tool that displays tool settings  */
    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      return [SampleTool.getActionButtonDef(this.props?.sampleTool?.itemPriority ?? 1000, this.props?.sampleTool?.groupPriority)];
    }
    /** Add a tool that opens a dialog box  */
    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Vertical) {
      return [OpenAbstractDialogTool.getActionButtonDef(this.props?.openAbstractDialogTool?.itemPriority ?? 10.1, this.props?.openAbstractDialogTool?.groupPriority)];
    }

    return [];
  }

  public provideStatusBarItems(_stageId: string, stageUsage: string): CommonStatusBarItem[] {
    const unitsIcon = IconSpecUtilities.createWebComponentIconSpec(statusFieldSvg);
    const statusBarItems: CommonStatusBarItem[] = [];
    if (stageUsage === StageUsage.General) {

      statusBarItems.push(
        /** Add a status bar item that will open a dialog allow the user to set the active unit system used to display quantity values.  */
        AbstractStatusBarItemUtilities.createActionItem("AppUiTestProviders:UnitsStatusBarItem",
          this.props?.unitsStatusBarItem?.section ?? StatusBarSection.Center,
          this.props?.unitsStatusBarItem?.itemPriority ?? 100,
          unitsIcon, AppUiTestProviders.translate("StatusBar.UnitsFlyover"),
          () => {
            IModelApp.uiAdmin.openDialog(new UnitsPopupUiDataProvider(), AppUiTestProviders.translate("StatusBar.Units"),
              true, "uiItemsProvidersTest:units-popup", { movable: true, width: 280, minWidth: 280 });
          }
        ));
    }
    return statusBarItems;
  }
}
