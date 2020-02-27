/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";

import {
  ConfigurableUiManager, FrontstageManager, WidgetState, ContentGroupProps,
  ContentLayoutProps, UiFramework,
} from "@bentley/ui-framework";

/** Include application registered Controls in Webpack
 */
import "./contentviews/CubeContent";
import "./widgets/ModelCreationWidget";
import "./widgets/ActiveSettingsWidget";
import "./widgets/NavigationTreeWidget";
import "./widgets/VisibilityTreeWidget";
import "./tooluiproviders/PlaceBlockToolSettingsUiProvider";
import "./statusbars/AppStatusBar";
import "./navigationaids/CubeExampleNavigationAid";

import { IModelIndexFrontstage } from "./frontstages/IModelIndexFrontstage";
import { IModelOpenFrontstage } from "./frontstages/IModelOpenFrontstage";
import { SignInFrontstage } from "./frontstages/SignInFrontstage";
import { IModelViewportControl } from "./contentviews/IModelViewport";

/** Example Ui Configuration for an iModelJS App
 */
export class AppUi {

  public static initialize() {
    ConfigurableUiManager.initialize();
    UiFramework.setDefaultRulesetId("Items");

    AppUi.defineFrontstages();
    AppUi.defineContentGroups();
    AppUi.defineContentLayouts();
  }

  /** Define Frontstages
   */
  private static defineFrontstages() {

    ConfigurableUiManager.addFrontstageProvider(new IModelIndexFrontstage());
    ConfigurableUiManager.addFrontstageProvider(new IModelOpenFrontstage());
    ConfigurableUiManager.addFrontstageProvider(new SignInFrontstage());
  }

  public static command1 = () => {
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
    if (activeFrontstageDef) {
      const widgetDef = activeFrontstageDef.findWidgetDef("VerticalPropertyGrid");
      if (widgetDef) {
        widgetDef.setWidgetState(WidgetState.Open);
      }
    }
  }

  public static command2 = () => {
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
    if (activeFrontstageDef) {
      const widgetDef = activeFrontstageDef.findWidgetDef("VerticalPropertyGrid");
      if (widgetDef) {
        widgetDef.setWidgetState(WidgetState.Hidden);
      }
    }
  }

  /** Define Content Groups referenced by Frontstages.
   */
  private static defineContentGroups() {
    const one2dIModelViewport: ContentGroupProps = {
      id: "one2dIModelViewport",
      contents: [
        {
          classId: IModelViewportControl,
        },
      ],
    };

    const drawingAndSheetViewports: ContentGroupProps = {
      id: "DrawingAndSheetViewports",
      contents: [
        {
          classId: IModelViewportControl,
        },
        {
          classId: IModelViewportControl,
        },
      ],
    };

    const threeIModelViewportsWithItemsTable: ContentGroupProps = {
      id: "ThreeIModelViewportsWithItemsTable",
      contents: [
        {
          classId: IModelViewportControl,
        },
        {
          classId: IModelViewportControl,
        },
        {
          classId: "TablePane",
        },
        {
          classId: IModelViewportControl,
        },
      ],
    };

    const testContentGroup1: ContentGroupProps = {
      id: "TestContentGroup1",
      contents: [
        {
          classId: IModelViewportControl,
          applicationData: { label: "Content 1a", bgColor: "black" },
        },
        {
          classId: IModelViewportControl,
          applicationData: { label: "Content 2a", bgColor: "black" },
        },
        {
          classId: "TableExampleContent",
          applicationData: { label: "Content 3a", bgColor: "black" },
        },
        {
          classId: "TestContent",
          applicationData: { label: "Content 4a", bgColor: "black" },
        },
      ],
    };

    const testContentGroup2: ContentGroupProps = {
      id: "TestContentGroup2",
      contents: [
        {
          classId: IModelViewportControl,
          applicationData: { label: "Content 1b", bgColor: "black" },
        },
        {
          classId: IModelViewportControl,
          applicationData: { label: "Content 2b", bgColor: "black" },
        },
        {
          classId: "TableExampleContent",
          applicationData: { label: "Content 3b", bgColor: "black" },
        },
        {
          classId: IModelViewportControl,
          applicationData: { label: "Content 4b", bgColor: "black" },
        },
      ],
    };

    const testContentGroup3: ContentGroupProps = {
      id: "TestContentGroup3",
      contents: [
        {
          classId: IModelViewportControl,
          applicationData: { label: "Content 1a", bgColor: "black" },
        },
        {
          classId: "CubeContent",
          applicationData: { label: "Content 2a", bgColor: "black" },
        },
        {
          classId: "TableExampleContent",
          applicationData: { label: "Content 3a", bgColor: "black" },
        },
        {
          classId: IModelViewportControl,
          applicationData: { label: "Content 4a", bgColor: "black" },
        },
      ],
    };

    const testContentGroup4: ContentGroupProps = {
      id: "TestContentGroup4",
      contents: [
        {
          classId: IModelViewportControl,
          applicationData: { label: "Content 1a", bgColor: "black" },
        },
        {
          classId: IModelViewportControl,
          applicationData: { label: "Content 2a", bgColor: "black" },
        },
        {
          classId: "TableExampleContent",
          applicationData: { label: "Content 3a", bgColor: "black" },
        },
        {
          classId: "TreeExampleContent",
          applicationData: { label: "Content 4a", bgColor: "black" },
        },
      ],
    };

    const contentGroups: ContentGroupProps[] = [];
    contentGroups.push(one2dIModelViewport, drawingAndSheetViewports, threeIModelViewportsWithItemsTable, testContentGroup1, testContentGroup2, testContentGroup3, testContentGroup4);
    ConfigurableUiManager.loadContentGroups(contentGroups);
  }

  /** Define Content Layouts referenced by Frontstages.
   */
  private static defineContentLayouts() {
    const contentLayouts: ContentLayoutProps[] = AppUi.getContentLayouts();
    ConfigurableUiManager.loadContentLayouts(contentLayouts);
  }

  private static getContentLayouts(): ContentLayoutProps[] {
    const fourQuadrants: ContentLayoutProps = {
      id: "FourQuadrants",
      horizontalSplit: {
        percentage: 0.50,
        minSizeTop: 100, minSizeBottom: 100,
        top: { verticalSplit: { percentage: 0.50, left: 0, right: 1, minSizeLeft: 100, minSizeRight: 100 } },
        bottom: { verticalSplit: { percentage: 0.50, left: 2, right: 3, minSizeLeft: 100, minSizeRight: 100 } },
      },
    };

    const twoHalvesVertical: ContentLayoutProps = {
      id: "TwoHalvesVertical",
      verticalSplit: { percentage: 0.50, left: 0, right: 1, minSizeLeft: 100, minSizeRight: 100 },
    };

    const twoHalvesHorizontal: ContentLayoutProps = {
      id: "TwoHalvesHorizontal",
      horizontalSplit: { percentage: 0.50, top: 0, bottom: 1, minSizeTop: 100, minSizeBottom: 100 },
    };

    const singleContent: ContentLayoutProps = {
      id: "SingleContent",
    };

    const threeRightStacked: ContentLayoutProps = { // Three Views, one on the left, two stacked on the right.
      id: "ThreeRightStacked",
      verticalSplit: {
        id: "ThreeRightStacked.MainVertical",
        percentage: 0.50,
        minSizeLeft: 100, minSizeRight: 100,
        left: 0,
        right: { horizontalSplit: { percentage: 0.50, top: 1, bottom: 2, minSizeTop: 100, minSizeBottom: 100 } },
      },
    };

    const contentLayouts: ContentLayoutProps[] = [];
    // in order to pick out by number of views for convenience.
    contentLayouts.push(singleContent, twoHalvesVertical, threeRightStacked, fourQuadrants, singleContent, twoHalvesHorizontal);
    return contentLayouts;
  }

  public static findLayoutFromContentCount(contentCount: number): ContentLayoutProps | undefined {
    const contentLayouts: ContentLayoutProps[] = AppUi.getContentLayouts();
    if (contentCount <= 4)
      return contentLayouts[contentCount - 1];
    return undefined;
  }

}
