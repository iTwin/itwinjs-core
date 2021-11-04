/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
/** Include application registered Controls in Webpack
 */
import "./contentviews/CubeContent";
import "./contentviews/TableExampleContent";
import "./contentviews/TreeExampleContent";
import "./contentviews/ScheduleAnimationViewport";
import "./widgets/BreadcrumbDemoWidget";
import "./widgets/TableDemoWidget";
import "./widgets/FeedbackWidget";
import "./widgets/NavigationTreeWidget";
import "./widgets/PropertyGridDemoWidget";
import "./tooluiproviders/Tool1UiProvider";
import "./tooluiproviders/Tool2UiProvider";
import "./statusbars/AppStatusBar";
import "./navigationaids/CubeExampleNavigationAid";
import { ContentLayoutProps, FunctionKey, StandardContentLayouts, WidgetState } from "@itwin/appui-abstract";
import { IModelApp } from "@itwin/core-frontend";

import {
  AccuDrawCommandItems,
  AccuDrawKeyboardShortcuts,
  CommandItemDef,
  ConfigurableUiManager,
  ContentGroupProps,
  FrontstageManager,
  KeyboardShortcutManager,
  KeyboardShortcutProps,
} from "@itwin/appui-react";
import { IModelViewportControl } from "./contentviews/IModelViewport";
import { Frontstage1 } from "./frontstages/Frontstage1";
import { Frontstage2 } from "./frontstages/Frontstage2";
import { Frontstage3 } from "./frontstages/Frontstage3";
import { Frontstage4 } from "./frontstages/Frontstage4";
import { IModelIndexFrontstage } from "./frontstages/IModelIndexFrontstage";
import { IModelOpenFrontstage } from "./frontstages/IModelOpenFrontstage";
import { ScheduleAnimationFrontstage } from "./frontstages/ScheduleAnimationFrontstage";
import { SignInFrontstage } from "./frontstages/SignInFrontstage";
import { AccuDrawPopupTools } from "../tools/AccuDrawPopupTools";
import { AppTools } from "../tools/ToolSpecifications";
import { FrontstageUi2 } from "./frontstages/FrontstageUi2";

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
    ConfigurableUiManager.addFrontstageProvider(new Frontstage1());
    ConfigurableUiManager.addFrontstageProvider(new Frontstage2());
    ConfigurableUiManager.addFrontstageProvider(new Frontstage3());
    ConfigurableUiManager.addFrontstageProvider(new Frontstage4());
    FrontstageUi2.register();
    ConfigurableUiManager.addFrontstageProvider(new IModelIndexFrontstage());
    ConfigurableUiManager.addFrontstageProvider(new IModelOpenFrontstage());
    ConfigurableUiManager.addFrontstageProvider(new SignInFrontstage());
    ConfigurableUiManager.addFrontstageProvider(new ScheduleAnimationFrontstage());
  }

  public static command1 = () => {
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
    if (activeFrontstageDef) {
      const widgetDef = activeFrontstageDef.findWidgetDef("VerticalPropertyGrid");
      if (widgetDef) {
        widgetDef.setWidgetState(WidgetState.Open);
      }
    }
  };

  public static command2 = () => {
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
    if (activeFrontstageDef) {
      const widgetDef = activeFrontstageDef.findWidgetDef("VerticalPropertyGrid");
      if (widgetDef) {
        widgetDef.setWidgetState(WidgetState.Hidden);
      }
    }
  };

  public static ThreeStackedVertical: ContentLayoutProps = {
    id: "ui-test-app:ThreeStacked",
    horizontalSplit: {
      id: "ui-test-app:ThreeStacked-TopSplit",
      percentage: 0.50,
      minSizeTop: 100,
      minSizeBottom: 200,
      top: 0,
      bottom: {
        horizontalSplit: { id: "ui-test-app:ThreeStacked-BottomSplit", percentage: 0.50, top: 1, bottom: 2, minSizeTop: 100, minSizeBottom: 100 },
      },
    },
  };

  /** Define Content Groups referenced by Frontstages.
   */
  public static TestContentGroup1: ContentGroupProps = {
    id: "TestContentGroup1",
    layout: StandardContentLayouts.threeViewsTwoOnLeft,
    contents: [
      {
        id: "primaryIModelView",
        classId: IModelViewportControl,
        applicationData: { label: "Content 1a", bgColor: "black" },
      },
      {
        id: "secondIModelView",
        classId: IModelViewportControl,
        applicationData: { label: "Content 2a", bgColor: "black" },
      },
      {
        id: "tableView",
        classId: "TableExampleContent",
        applicationData: { label: "Content 3a", bgColor: "black" },
      },
    ],
  };

  public static TestContentGroup2: ContentGroupProps = {
    id: "TestContentGroup2",
    layout: AppUi.ThreeStackedVertical,
    contents: [
      {
        id: "primaryIModelView",
        classId: IModelViewportControl,
        applicationData: { label: "Content 1b", bgColor: "black" },
      },
      {
        id: "secondIModelView",
        classId: IModelViewportControl,
        applicationData: { label: "Content 2b", bgColor: "black" },
      },
      {
        id: "tableView",
        classId: "TableExampleContent",
        applicationData: { label: "Content 3b", bgColor: "black" },
      },
    ],
  };

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
        key: "f",
        item: AppTools.setLengthFormatImperialCommand,
      },
      {
        key: "m",
        labelKey: "SampleApp:buttons.accuDrawSubMenu",
        shortcuts: [
          {
            key: "b",
            item: AccuDrawPopupTools.addMenuButton,
          },
          {
            key: "h",
            item: AccuDrawPopupTools.hideMenuButton,
          },
          {
            key: "c",
            item: AccuDrawPopupTools.showCalculator,
          },
          {
            key: "m",
            item: AccuDrawPopupTools.showContextMenu,
          },
          {
            key: "t",
            item: AccuDrawPopupTools.showToolbar,
          },
          {
            key: "l",
            item: AccuDrawPopupTools.showHTMLElement,
          },
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

    ConfigurableUiManager.loadKeyboardShortcuts(keyboardShortcutList);

    ConfigurableUiManager.loadKeyboardShortcuts(AccuDrawKeyboardShortcuts.getDefaultShortcuts());
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
        KeyboardShortcutManager.displayShortcutsMenu();
      },
    });
  }
}
