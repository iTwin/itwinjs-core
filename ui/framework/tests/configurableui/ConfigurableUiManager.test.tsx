/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { expect } from "chai";
import TestUtils from "../TestUtils";
import {
  ConfigurableUiManager,
  ItemPropsList,
  ToolItemDef,
  FrontstageManager,
  WidgetControl,
  ConfigurableCreateInfo,
  ContentGroupProps,
  ContentGroupManager,
  ContentLayoutProps,
  ContentLayoutManager,
  TaskPropsList,
  TaskManager,
  WorkflowManager,
  WorkflowPropsList,
} from "../../src/index";

describe("ConfigurableUiManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    ConfigurableUiManager.initialize();
  });

  it("loadCommonItems & commonItems", () => {
    const commonItemsList: ItemPropsList = {
      items: [
        {
          toolId: "tool1",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.tool1",
        },
      ],
    };
    ConfigurableUiManager.loadCommonItems(commonItemsList);
    expect(ConfigurableUiManager.commonItems.get("tool1")).to.not.be.undefined;
  });

  it("addCommonItem & commonItems", () => {
    const item = {
      toolId: "tool2",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:buttons.tool2",
    };
    const itemDef = new ToolItemDef(item);
    ConfigurableUiManager.addCommonItem(itemDef);
    expect(ConfigurableUiManager.commonItems.get("tool2")).to.not.be.undefined;
  });

  it("loadFrontstages & findFrontstageDef", () => {
    const frontstagePropsList = [
      {
        id: "TestFrontstage1",
        defaultToolId: "PlaceLine",
        defaultLayout: "TwoHalvesVertical",
        contentGroup: "TestContentGroup1",
        defaultContentId: "TestContent1",
      },
    ];
    ConfigurableUiManager.loadFrontstages(frontstagePropsList);
    expect(ConfigurableUiManager.findFrontstageDef("TestFrontstage1")).to.not.be.undefined;
  });

  it("findFrontstageDef passed no argument", () => {
    FrontstageManager.setActiveFrontstageDef(undefined);
    expect(ConfigurableUiManager.findFrontstageDef()).to.be.undefined;
  });

  it("loadFrontstage & findItem", () => {
    const frontstageProps = {
      id: "TestFrontstage2",
      defaultToolId: "PlaceLine",
      defaultLayout: "TwoHalvesVertical",
      contentGroup: "TestContentGroup2",
      defaultContentId: "TestContent2",
      items: [
        {
          toolId: "frontstageTool",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.frontstageTool",
        },
      ],
    };
    ConfigurableUiManager.loadFrontstage(frontstageProps);
    const frontstageDef = ConfigurableUiManager.findFrontstageDef("TestFrontstage2");
    expect(frontstageDef).to.not.be.undefined;
    FrontstageManager.setActiveFrontstageDef(frontstageDef);
    expect(ConfigurableUiManager.findItem("frontstageTool")).to.not.be.undefined;
    expect(ConfigurableUiManager.findItem("tool2")).to.not.be.undefined;
  });

  class TestWidget extends WidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div />;
    }
  }

  it("registerControl & createConfigurable using same classId", () => {
    ConfigurableUiManager.registerControl("TestWidget", TestWidget);
    expect(ConfigurableUiManager.createControl("TestWidget", "1")).to.not.be.undefined;
  });

  it("registerControl trying to register a classId already registered", () => {
    expect(() => ConfigurableUiManager.registerControl("TestWidget", TestWidget)).to.throw(Error);
  });

  it("createConfigurable trying to create an unregistered control", () => {
    expect(() => ConfigurableUiManager.createControl("invalid", "1")).to.throw(Error);
  });

  it("loadContentGroup", () => {
    const contentGroupProps: ContentGroupProps = {
      id: "testContentGroup1",
      contents: [
        {
          classId: "TestContentControl",
          applicationData: { label: "Content 1a", bgColor: "black" },
        },
      ],
    };
    ConfigurableUiManager.loadContentGroup(contentGroupProps);
    expect(ContentGroupManager.findGroup("testContentGroup1")).to.not.be.undefined;
  });

  it("loadContentGroups", () => {
    const contentGroupProps: ContentGroupProps[] = [
      {
        id: "testContentGroup2",
        contents: [
          {
            classId: "TestContentControl",
            applicationData: { label: "Content 1a", bgColor: "black" },
          },
        ],
      },
    ];
    ConfigurableUiManager.loadContentGroups(contentGroupProps);
    expect(ContentGroupManager.findGroup("testContentGroup2")).to.not.be.undefined;
  });

  it("loadContentLayout", () => {
    const contentLayoutProps: ContentLayoutProps = {
      // Three Views, one on the left, two stacked on the right.
      id: "testContentLayout1",
      descriptionKey: "SampleApp:ContentDef.ThreeRightStacked",
      priority: 85,
      verticalSplit: {
        percentage: 0.50,
        left: 0,
        right: { horizontalSplit: { percentage: 0.50, top: 1, bottom: 2 } },
      },
    };
    ConfigurableUiManager.loadContentLayout(contentLayoutProps);
    expect(ContentLayoutManager.findLayout("testContentLayout1")).to.not.be.undefined;
  });

  it("loadContentLayouts", () => {
    const contentLayoutProps: ContentLayoutProps[] = [
      {
        // Three Views, one on the left, two stacked on the right.
        id: "testContentLayout2",
        descriptionKey: "SampleApp:ContentDef.ThreeRightStacked",
        priority: 85,
        verticalSplit: {
          percentage: 0.50,
          left: 0,
          right: { horizontalSplit: { percentage: 0.50, top: 1, bottom: 2 } },
        },
      },
    ];
    ConfigurableUiManager.loadContentLayouts(contentLayoutProps);
    expect(ContentLayoutManager.findLayout("testContentLayout2")).to.not.be.undefined;
  });

  it("loadTasks", () => {
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
    expect(TaskManager.findTask("Task1")).to.not.be.undefined;
  });

  it("loadWorkflows", () => {
    const workflowPropsList: WorkflowPropsList = {
      defaultWorkflowId: "default-workflow",
      taskPicker: {
        classId: "taskpicker-class",
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
    expect(WorkflowManager.findWorkflow("ExampleWorkflow")).to.not.be.undefined;
  });

});
