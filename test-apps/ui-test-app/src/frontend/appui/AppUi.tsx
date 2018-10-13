/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";

import { ConfigurableUiManager } from "@bentley/ui-framework";
import { ContentGroupProps, ViewClass } from "@bentley/ui-framework";
import { ItemPropsList, GroupItemProps } from "@bentley/ui-framework";
import { TaskPropsList } from "@bentley/ui-framework";
import { WorkflowPropsList } from "@bentley/ui-framework";
import { ContentLayoutProps } from "@bentley/ui-framework";
import { GroupItemDef } from "@bentley/ui-framework";
import { ToolItemDef } from "@bentley/ui-framework";

import { Direction } from "@bentley/ui-ninezone/lib/utilities/Direction";

import { StandardViewId } from "@bentley/imodeljs-frontend";

/** Include application registered Controls in Webpack
 */
import "./contentviews/IModelViewport";   // TODO - move to ui-framework
import "./contentviews/CubeContent";
import "./contentviews/TableExampleContent";
import "./contentviews/TreeExampleContent";
import "./widgets/BreadcrumbDemoWidget";
import "./widgets/TreeDemoWidget";
import "./widgets/TableDemoWidget";
import "./widgets/FeedbackWidget";
import "./widgets/NavigationTreeWidget";
import "./widgets/PropertyGridDemoWidget";
import "./tooluiproviders/Tool1UiProvider";
import "./tooluiproviders/Tool2UiProvider";
import "./statusbars/AppStatusBar";
import "./navigationaids/CubeExampleNavigationAid";

import { Frontstage1 } from "./frontstages/Frontstage1";
import { Frontstage2 } from "./frontstages/Frontstage2";
import { Frontstage3 } from "./frontstages/Frontstage3";
import { Frontstage4 } from "./frontstages/Frontstage4";
import { Frontstage5 } from "./frontstages/Frontstage5";

/** Example Ui Configuration for an iModelJS App
 */
export class AppUi {

  public static initialize() {
    ConfigurableUiManager.initialize();

    AppUi.defineFrontstages();
    AppUi.defineCommonItems();
    AppUi.defineContentGroups();
    AppUi.defineContentLayouts();
    AppUi.defineTasksAndWorkflows();
  }

  /** Define Frontstages
   */
  private static defineFrontstages() {
    ConfigurableUiManager.addFrontstage(new Frontstage1());
    ConfigurableUiManager.addFrontstage(new Frontstage2());
    ConfigurableUiManager.addFrontstage(new Frontstage3());
    ConfigurableUiManager.addFrontstage(new Frontstage4());
    ConfigurableUiManager.addFrontstage(new Frontstage5());
  }

  /** Define Common Items used in different Frontstages.
   */
  private static defineCommonItems() {

    const myToolItem1 = new ToolItemDef({
      toolId: "tool1",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.tool1",
      applicationData: { key: "value" },
    });
    ConfigurableUiManager.addCommonItem(myToolItem1);

    const myGroupItem1 = new GroupItemDef({
      groupId: "my-group1",
      labelKey: "SampleApp:buttons.toolGroup",
      iconClass: "icon-placeholder",
      items: [myToolItem1, "tool2", "item3", "item4", "item5", "item6", "item7", "item8", "tool1", "tool2", "item3", "item4", "item5", "item6", "item7", "item8"],
      direction: Direction.Bottom,
      itemsInColumn: 7,
    });
    ConfigurableUiManager.addCommonItem(myGroupItem1);

    const myGroupItemProps2: GroupItemProps = {
      groupId: "my-group2",
      labelKey: "SampleApp:buttons.anotherGroup",
      iconClass: "icon-placeholder",
      items: ["tool1", "tool2", "item3", "item4", "item5", "item6", "item7", "item8"],
      direction: Direction.Right,
    };
    ConfigurableUiManager.addCommonItem(new GroupItemDef(myGroupItemProps2));

    const commonItemsList: ItemPropsList = {
      items: [
        {
          toolId: "tool2",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.tool2",
        },
        {
          toolId: "SampleApp.BackstageToggle",
          iconClass: "icon-home",
        },
        {
          toolId: "item3",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.item3",
        },
        {
          toolId: "item4",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.item4",
        },
        {
          toolId: "item5",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.item5",
        },
        {
          toolId: "item6",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.item6",
        },
        {
          toolId: "item7",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.item7",
        },
        {
          toolId: "item8",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.item8",
        },
      ],
    };

    ConfigurableUiManager.loadCommonItems(commonItemsList);
  }

  /** Define Content Groups referenced by Frontstages.
   */
  private static defineContentGroups() {
    const one2dIModelViewport: ContentGroupProps = {
      id: "one2dIModelViewport",
      contents: [
        {
          classId: "IModelViewport",
          backgroundColor: { r: 0, g: 0, b: 0, a: 255 },
          defaultViewSpec: {
            viewDefinitionClass: ViewClass.Drawing,
            viewRotation: StandardViewId.Top,
          },
        },
      ],
    };

    const drawingAndSheetViewports: ContentGroupProps = {
      id: "DrawingAndSheetViewports",
      contents: [
        {
          classId: "IModelViewport",
          backgroundColor: { r: 0, g: 0, b: 0, a: 255 },
          defaultViewSpec: {
            viewDefinitionClass: ViewClass.Drawing,
            viewRotation: StandardViewId.Top,
          },
        },
        {
          classId: "IModelViewport",
          backgroundColor: { r: 0, g: 0, b: 0, a: 255 },
          defaultViewSpec: {
            viewDefinitionClass: ViewClass.Sheet,
            viewRotation: StandardViewId.Top,
          },
        },
      ],
    };

    const threeIModelViewportsWithItemsTable: ContentGroupProps = {
      id: "ThreeIModelViewportsWithItemsTable",
      contents: [
        {
          classId: "IModelViewport",
          backgroundColor: { r: 0, g: 0, b: 0, a: 255 },
          defaultViewSpec: {
            viewDefinitionClass: ViewClass.Camera,
            viewRotation: StandardViewId.Iso,
          },
        },
        {
          classId: "IModelViewport",
          backgroundColor: { r: 0, g: 0, b: 0, a: 255 },
          defaultViewSpec: {
            viewDefinitionClass: ViewClass.Orthographic,
            viewRotation: StandardViewId.Top,
          },
        },
        {
          classId: "TablePane",
        },
        {
          classId: "IModelViewport",
          backgroundColor: { r: 0, g: 0, b: 0, a: 255 },
          defaultViewSpec: {
            viewDefinitionClass: ViewClass.Orthographic,
            viewRotation: StandardViewId.Front,
          },
        },
      ],
    };

    const testContentGroup1: ContentGroupProps = {
      id: "TestContentGroup1",
      contents: [
        {
          classId: "IModelViewport",
          applicationData: { label: "Content 1a", bgColor: "black" },
        },
        {
          classId: "IModelViewport",
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
          classId: "IModelViewport",
          applicationData: { label: "Content 1b", bgColor: "black" },
        },
        {
          classId: "IModelViewport",
          applicationData: { label: "Content 2b", bgColor: "black" },
        },
        {
          classId: "TableExampleContent",
          applicationData: { label: "Content 3b", bgColor: "black" },
        },
        {
          classId: "IModelViewport",
          applicationData: { label: "Content 4b", bgColor: "black" },
        },
      ],
    };

    const testContentGroup3: ContentGroupProps = {
      id: "TestContentGroup3",
      contents: [
        {
          classId: "IModelViewport",
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
          classId: "IModelViewport",
          applicationData: { label: "Content 4a", bgColor: "black" },
        },
      ],
    };

    const testContentGroup4: ContentGroupProps = {
      id: "TestContentGroup4",
      contents: [
        {
          classId: "IModelViewport",
          applicationData: { label: "Content 1a", bgColor: "black" },
        },
        {
          classId: "IModelViewport",
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
      descriptionKey: "Protogist:ContentLayoutDef.FourQuadrants",
      priority: 1000,
      horizontalSplit: {
        id: "FourQuadrants.MainHorizontal",
        percentage: 0.50,
        top: { verticalSplit: { id: "FourQuadrants.TopVert", percentage: 0.60, left: 0, right: 1 } },
        bottom: { verticalSplit: { id: "FourQuadrants.BottomVert", percentage: 0.40, left: 2, right: 3 } },
      },
    };

    const twoHalvesVertical: ContentLayoutProps = {
      id: "TwoHalvesVertical",
      descriptionKey: "Protogist:ContentLayoutDef.TwoHalvesVertical",
      priority: 60,
      verticalSplit: { id: "TwoHalvesVertical.VerticalSplit", percentage: 0.50, left: 0, right: 1 },
    };

    const twoHalvesHorizontal: ContentLayoutProps = {
      id: "TwoHalvesHorizontal",
      descriptionKey: "Protogist:ContentLayoutDef.TwoHalvesHorizontal",
      priority: 50,
      horizontalSplit: { id: "TwoHalvesHorizontal.HorizontalSplit", percentage: 0.50, top: 0, bottom: 1 },
    };

    const singleContent: ContentLayoutProps = {
      id: "SingleContent",
      descriptionKey: "Protogist:ContentLayoutDef.SingleContent",
      priority: 100,
    };

    const threeRightStacked: ContentLayoutProps = { // Three Views, one on the left, two stacked on the right.
      id: "ThreeRightStacked",
      descriptionKey: "Protogist:ContentDef.ThreeRightStacked",
      priority: 85,
      verticalSplit: {
        id: "ThreeRightStacked.MainVertical",
        percentage: 0.50,
        left: 0,
        right: { horizontalSplit: { id: "ThreeRightStacked.Right", percentage: 0.50, top: 1, bottom: 2 } },
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
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:backstage.task1",
        },
        {
          id: "Task2",
          primaryStageId: "Test2",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:backstage.task2",
        },
      ],
    };

    ConfigurableUiManager.loadTasks(taskPropsList);

    // Test Workflows
    const workflowPropsList: WorkflowPropsList = {
      defaultWorkflowId: "default-workflow",
      taskPicker: {
        classid: "taskpicker-class",
        iconClass: "taskpicker-icon",
        labelKey: "taskpicker-label",
      },
      workflows: [
        {
          id: "ExampleWorkflow",
          iconClass: "icon-placeholder",
          labelKey: "Protogist:Test.my-label",
          defaultTaskId: "task1",
          tasks: ["Task1", "Task2"],
        },
      ],
    };

    ConfigurableUiManager.loadWorkflows(workflowPropsList);
  }
}
