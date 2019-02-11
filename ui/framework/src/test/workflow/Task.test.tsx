/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";
import TestUtils from "../TestUtils";
import {
  FrontstageProvider,
  FrontstageProps,
  Frontstage,
  ConfigurableUiManager,
  TaskPropsList,
  WorkflowPropsList,
  FrontstageManager,
  FrontstageActivatedEventArgs,
  WorkflowManager,
  CoreTools,
} from "../../ui-framework";

describe("Task", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
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
        await WorkflowManager.setActiveWorkflowAndTask(workflow, task); // tslint:disable-line:no-floating-promises
      }
    }

    expect(spyMethod.calledOnce).to.be.true;
    expect(FrontstageManager.activeFrontstageId).to.eq("Test1");
    remove();
  });

});
