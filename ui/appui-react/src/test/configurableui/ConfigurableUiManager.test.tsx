/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as React from "react";
import { MockRender } from "@itwin/core-frontend";
import { StandardContentLayouts } from "@itwin/appui-abstract";
import type {
  ConfigurableCreateInfo, ContentGroupProps, FrontstageProps, TaskPropsList, WorkflowProps, WorkflowPropsList} from "../../appui-react";
import { ConfigurableUiManager, ContentControl, ContentGroup, CoreTools,
  Frontstage, FrontstageManager, FrontstageProvider, MessageManager, ModalDialogManager, ModelessDialogManager, PopupManager,
  TaskManager, WidgetControl, WorkflowManager,
} from "../../appui-react";
import TestUtils from "../TestUtils";

class TableExampleContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactNode = <div />;
  }
}

describe("ConfigurableUiManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();

    ConfigurableUiManager.initialize();
    ConfigurableUiManager.registerControl("TableExampleContent", TableExampleContentControl);
  });

  after(async () => {
    ConfigurableUiManager.unregisterControl("TableExampleContent");
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("setActiveFrontstageDef passed no argument", async () => {
    await FrontstageManager.setActiveFrontstageDef(undefined);
    expect(FrontstageManager.activeFrontstageDef).to.be.undefined;
  });

  it("addFrontstageProvider & getFrontstageDef", async () => {
    class Frontstage1 extends FrontstageProvider {
      public static stageId = "TestFrontstage2";
      public get id(): string {
        return Frontstage1.stageId;
      }

      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id={Frontstage1.stageId}
            defaultTool={CoreTools.selectElementCommand}
            contentGroup={TestUtils.TestContentGroup1}
          />
        );
      }
    }
    ConfigurableUiManager.addFrontstageProvider(new Frontstage1());
    const frontstageDef2 = await FrontstageManager.getFrontstageDef(Frontstage1.stageId);
    expect(frontstageDef2).to.not.be.undefined;
    await FrontstageManager.setActiveFrontstageDef(frontstageDef2);
  });

  class TestWidget extends WidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = <div />;
    }
  }

  it("getConstructorClassId should return undefined before registration", () => {
    const classId = ConfigurableUiManager.getConstructorClassId(TestWidget);
    expect(classId).to.be.undefined;
  });

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

  it("loadContentGroup and read applicationData from control", () => {
    const contentGroupProps: ContentGroupProps = {
      id: "testContentGroup1",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "test-content-control",
          classId: "TableExampleContent",
          applicationData: { label: "Content 1a", bgColor: "black" },
        },
      ],
    };
    const contentGroup = new ContentGroup(contentGroupProps);
    expect(contentGroup).to.not.be.undefined;
    // force controls to be creates
    const controls = contentGroup?.getContentControls();
    expect(controls).to.not.be.undefined;
    const control = contentGroup?.getContentControlById("test-content-control");
    expect(control).to.not.be.undefined;
    expect(control?.applicationData.label).eql("Content 1a");
  });

  it("loadTasks", () => {
    const taskPropsList: TaskPropsList = {  // eslint-disable-line deprecation/deprecation
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

    ConfigurableUiManager.loadTasks(taskPropsList); // eslint-disable-line deprecation/deprecation
    expect(TaskManager.findTask("Task1")).to.not.be.undefined;  // eslint-disable-line deprecation/deprecation
  });

  it("loadWorkflows", () => {
    const workflowPropsList: WorkflowPropsList = {  // eslint-disable-line deprecation/deprecation
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

    ConfigurableUiManager.loadWorkflows(workflowPropsList); // eslint-disable-line deprecation/deprecation
    expect(WorkflowManager.findWorkflow("ExampleWorkflow")).to.not.be.undefined;  // eslint-disable-line deprecation/deprecation
  });

  it("loadWorkflow", () => {
    const workflowProps: WorkflowProps = {  // eslint-disable-line deprecation/deprecation
      id: "OneWorkflow",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:Test.my-label",
      defaultTaskId: "task1",
      tasks: ["Task1", "Task2"],
    };

    ConfigurableUiManager.loadWorkflow(workflowProps);  // eslint-disable-line deprecation/deprecation
    const workflow = WorkflowManager.findWorkflow("OneWorkflow"); // eslint-disable-line deprecation/deprecation
    expect(workflow).to.not.be.undefined;

    if (workflow)
      expect(WorkflowManager.removeWorkflow(workflow)).to.eq(true); // eslint-disable-line deprecation/deprecation
  });

  it("closeUi", () => {
    ConfigurableUiManager.closeUi();

    expect(MessageManager.messages.length).to.eq(0);
    expect(ModelessDialogManager.dialogCount).to.eq(0);
    expect(ModalDialogManager.dialogCount).to.eq(0);
    expect(PopupManager.popupCount).to.eq(0);
  });

});
