/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import {
  ConfigurableUiManager, CoreTools, Frontstage, FrontstageActivatedEventArgs, FrontstageManager, FrontstageProps, FrontstageProvider, TaskPropsList,
  WorkflowManager, WorkflowPropsList,
} from "../../ui-framework.js";
import TestUtils from "../TestUtils.js";

describe("Task", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("Task should activate Frontstage", async () => {
    class Frontstage1 extends FrontstageProvider {
      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id="Test1"
            defaultTool={CoreTools.selectElementCommand}
            defaultLayout="FourQuadrants"
            contentGroup="TestContentGroup1"
          />
        );
      }
    }
    const frontstageProvider = new Frontstage1();
    ConfigurableUiManager.addFrontstageProvider(frontstageProvider);

    const taskPropsList: TaskPropsList = {
      tasks: [
        {
          id: "Task1",
          primaryStageId: "Test1",
          iconSpec: "icon-placeholder",
          labelKey: "SampleApp:backstage.task1",
        },
      ],
    };

    ConfigurableUiManager.loadTasks(taskPropsList);

    // Test Workflows
    const workflowPropsList: WorkflowPropsList = {
      defaultWorkflowId: "default-workflow",
      workflows: [
        {
          id: "ExampleWorkflow",
          iconSpec: "icon-placeholder",
          labelKey: "SampleApp:Test.my-label",
          defaultTaskId: "task1",
          tasks: ["Task1"],
        },
      ],
    };

    ConfigurableUiManager.loadWorkflows(workflowPropsList);

    const spyMethod = sinon.stub();
    const remove = FrontstageManager.onFrontstageActivatedEvent.addListener((_args: FrontstageActivatedEventArgs) => spyMethod());

    const workflow = WorkflowManager.findWorkflow("ExampleWorkflow");
    if (workflow) {
      const task = workflow.getTask("Task1");
      if (task) {
        await WorkflowManager.setActiveWorkflowAndTask(workflow, task);
      }
    }

    expect(spyMethod.calledOnce).to.be.true;
    expect(FrontstageManager.activeFrontstageId).to.eq("Test1");
    remove();
  });

});
