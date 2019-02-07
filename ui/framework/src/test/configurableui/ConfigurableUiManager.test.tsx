/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { expect } from "chai";
import TestUtils from "../TestUtils";
import {
  ConfigurableUiManager,
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
  Frontstage,
  FrontstageProvider,
  FrontstageProps,
  CoreTools,
} from "../../ui-framework";

describe("ConfigurableUiManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    ConfigurableUiManager.initialize();
  });

  it("findFrontstageDef passed no argument", () => {
    FrontstageManager.setActiveFrontstageDef(undefined); // tslint:disable-line:no-floating-promises
    expect(ConfigurableUiManager.findFrontstageDef()).to.be.undefined;
  });

  it("addFrontstageProvider & findFrontstageDef", () => {
    class Frontstage1 extends FrontstageProvider {
      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id="TestFrontstage2"
            defaultTool={CoreTools.selectElementCommand}
            defaultLayout="FourQuadrants"
            contentGroup="TestContentGroup1"
          />
        );
      }
    }
    ConfigurableUiManager.addFrontstageProvider(new Frontstage1());

    const frontstageDef2 = ConfigurableUiManager.findFrontstageDef("TestFrontstage2");
    expect(frontstageDef2).to.not.be.undefined;
    FrontstageManager.setActiveFrontstageDef(frontstageDef2); // tslint:disable-line:no-floating-promises
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

  it("unregisterControl removes a registered control", () => {
    ConfigurableUiManager.unregisterControl("TestWidget");
    expect(ConfigurableUiManager.isControlRegistered("TestWidget")).to.be.false;
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
          iconSpec: "icon-placeholder",
          labelKey: "SampleApp:backstage.task1",
        },
        {
          id: "Task2",
          primaryStageId: "Test2",
          iconSpec: "icon-placeholder",
          labelKey: "SampleApp:backstage.task2",
        },
      ],
    };

    ConfigurableUiManager.loadTasks(taskPropsList);
    expect(TaskManager.findTask("Task1")).to.not.be.undefined;
  });

  it("loadWorkflows", () => {
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
    expect(WorkflowManager.findWorkflow("ExampleWorkflow")).to.not.be.undefined;
  });

});
