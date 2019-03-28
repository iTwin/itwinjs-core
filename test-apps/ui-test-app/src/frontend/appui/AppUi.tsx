/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";

import {
  ConfigurableUiManager, FrontstageManager, WidgetState, ContentGroupProps,
  TaskPropsList, WorkflowPropsList, ContentLayoutProps, UiFramework,
  KeyboardShortcutProps, FunctionKey, CommandItemDef, KeyboardShortcutManager, WorkflowProps,
} from "@bentley/ui-framework";

/** Include application registered Controls in Webpack
 */
import "./contentviews/CubeContent";
import "./contentviews/TableExampleContent";
import "./contentviews/TreeExampleContent";
import "./contentviews/ScheduleAnimationViewport";
import "./widgets/BreadcrumbDemoWidget";
import "./widgets/TreeDemoWidget";
import "./widgets/TableDemoWidget";
import "./widgets/FeedbackWidget";
import "./widgets/NavigationTreeWidget";
import "./widgets/PropertyGridDemoWidget";
import "./widgets/VisibilityTreeWidget";
import "./tooluiproviders/Tool1UiProvider";
import "./tooluiproviders/Tool2UiProvider";
import "./statusbars/AppStatusBar";
import "./navigationaids/CubeExampleNavigationAid";

import { Frontstage1 } from "./frontstages/Frontstage1";
import { Frontstage2 } from "./frontstages/Frontstage2";
import { Frontstage3 } from "./frontstages/Frontstage3";
import { Frontstage4 } from "./frontstages/Frontstage4";
import { IModelIndexFrontstage } from "./frontstages/IModelIndexFrontstage";
import { IModelOpenFrontstage } from "./frontstages/IModelOpenFrontstage";
import { SignInFrontstage } from "./frontstages/SignInFrontstage";
import { IModelViewportControl } from "./contentviews/IModelViewport";
import { ScheduleAnimationFrontstage} from "./frontstages/ScheduleAnimationFrontstage";
import { AppTools } from "../tools/ToolSpecifications";

/** Example Ui Configuration for an iModelJS App
 */
export class AppUi {

  public static initialize() {
    ConfigurableUiManager.initialize();

    AppUi.defineFrontstages();
    AppUi.defineContentGroups();
    AppUi.defineContentLayouts();
    AppUi.defineTasksAndWorkflows();
    AppUi.defineKeyboardShortcuts();
  }

  /** Define Frontstages
   */
  private static defineFrontstages() {

    ConfigurableUiManager.addFrontstageProvider(new Frontstage1());
    ConfigurableUiManager.addFrontstageProvider(new Frontstage2());
    ConfigurableUiManager.addFrontstageProvider(new Frontstage3());
    ConfigurableUiManager.addFrontstageProvider(new Frontstage4());
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
        top: { verticalSplit: { percentage: 0.50, left: 0, right: 1 } },
        bottom: { verticalSplit: { percentage: 0.50, left: 2, right: 3 } },
      },
    };

    const twoHalvesVertical: ContentLayoutProps = {
      id: "TwoHalvesVertical",
      verticalSplit: { percentage: 0.50, left: 0, right: 1 },
    };

    const twoHalvesHorizontal: ContentLayoutProps = {
      id: "TwoHalvesHorizontal",
      horizontalSplit: { percentage: 0.50, top: 0, bottom: 1 },
    };

    const singleContent: ContentLayoutProps = {
      id: "SingleContent",
    };

    const threeRightStacked: ContentLayoutProps = { // Three Views, one on the left, two stacked on the right.
      id: "ThreeRightStacked",
      verticalSplit: {
        id: "ThreeRightStacked.MainVertical",
        percentage: 0.50,
        left: 0,
        right: { horizontalSplit: { percentage: 0.50, top: 1, bottom: 2 } },
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

  /** Define Tasks list and Workflows list.
   */
  private static defineTasksAndWorkflows() {
    const taskPropsList: TaskPropsList = {
      tasks: [
        {
          id: "Task1",
          primaryStageId: "Test1",
          iconSpec: "icon-placeholder",
          labelKey: "SampleApp:backstage.task1",
        },
        {
          id: "Task2",
          primaryStageId: "ViewsFrontstage",
          iconSpec: "icon-placeholder",
          labelKey: "SampleApp:backstage.task2",
        },
      ],
    };

    ConfigurableUiManager.loadTasks(taskPropsList);

    // Test Workflows
    const workflowProps: WorkflowProps = {
      id: "ExampleWorkflow",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:Test.my-label",
      defaultTaskId: "task1",
      tasks: ["Task1", "Task2"],
    };

    ConfigurableUiManager.loadWorkflow(workflowProps);

    // Test Workflows
    const workflowPropsList: WorkflowPropsList = {
      defaultWorkflowId: "ExampleWorkflow",
      workflows: [
        {
          id: "ExampleWorkflow",
          iconSpec: "icon-placeholder",
          labelKey: "SampleApp:Test.my-label",
          defaultTaskId: "task1",
          tasks: ["Task1", "Task2"],
        },
      ],
    };

    ConfigurableUiManager.loadWorkflows(workflowPropsList);
  }

  /** Define Keyboard Shortcuts list.
   */
  private static defineKeyboardShortcuts() {
    const keyboardShortcutList: KeyboardShortcutProps[] = [
      {
        key: "a",
        item: AppTools.verticalPropertyGridOpenCommand,
      },
      {
        key: "s",
        item: AppTools.verticalPropertyGridOffCommand,
      },
      {
        key: "r",
        item: AppUi._toggleZonesCommand,
      },
      {
        key: "d",
        labelKey: "SampleApp:buttons.shortcutsSubMenu",
        shortcuts: [
          {
            key: "1",
            item: AppTools.tool1,
          },
          {
            key: "2",
            item: AppTools.tool2,
          },
          {
            key: "s",
            item: AppTools.appSelectElementCommand,
          },
        ],
      },
      {
        key: FunctionKey.F7,
        item: AppUi._showShortcutsMenuCommand,
      },
    ];

    ConfigurableUiManager.loadKeyboardShortcuts(keyboardShortcutList);
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

  private static get _toggleZonesCommand() {
    return new CommandItemDef({
      commandId: "toggleZones",
      labelKey: "SampleApp:buttons.showhideZones",
      execute: () => {
        const isVisible = UiFramework.getIsUiVisible();
        UiFramework.setIsUiVisible(!isVisible);
        // IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "F11", "Click F11 to restore view!"));
      },
    });
  }
}
