/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { ConfigurableUiManager, TaskPropsList, Workflow, WorkflowManager, WorkflowProps, WorkflowPropsList } from "../../appui-react";
import TestUtils from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("Workflow & WorkflowManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();

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
        {
          id: "Task4",
          primaryStageId: "Test4",
          iconSpec: "icon-placeholder",
          labelKey: "SampleApp:backstage.task4",
        },
        {
          id: "Task3",
          primaryStageId: "Test3",
          iconSpec: "icon-placeholder",
          labelKey: "SampleApp:backstage.task3",
        },
      ],
    };

    ConfigurableUiManager.loadTasks(taskPropsList);

    const workflowPropsList: WorkflowPropsList = {
      defaultWorkflowId: "ExampleWorkflow",
      workflows: [
        {
          id: "ExampleWorkflow3",
          iconSpec: "icon-placeholder",
          labelKey: "App:Test.ExampleWorkflow3",
          defaultTaskId: "Task3",
          tasks: ["Task4", "Task3", "Task1"],
        },
        {
          id: "ExampleWorkflow",
          iconSpec: "icon-placeholder",
          labelKey: "App:Test.ExampleWorkflow1",
          defaultTaskId: "Task1",
          tasks: ["Task1", "Task2"],
        },
        {
          id: "ExampleWorkflow2",
          iconSpec: "icon-placeholder",
          labelKey: "App:Test.ExampleWorkflow2",
          defaultTaskId: "Task2",
          tasks: ["Task4", "Task3", "Task2"],
        },
      ],
    };

    ConfigurableUiManager.loadWorkflows(workflowPropsList);
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("Workflow", () => {

    it("loadWorkflows & findWorkflow", () => {
      expect(WorkflowManager.findWorkflow("ExampleWorkflow")).to.not.be.undefined;
    });

    it("getTask, lastActiveTask & activeTask", async () => {
      const workflow = WorkflowManager.findWorkflow("ExampleWorkflow");
      expect(workflow).to.not.be.undefined;

      if (workflow) {
        const task1 = workflow.getTask("Task1");
        expect(task1).to.not.be.undefined;
        expect(workflow.lastActiveTask).to.eq(task1);

        const task2 = workflow.getTask("Task2");
        expect(task2).to.not.be.undefined;
        if (task2) {
          await workflow.setActiveTask(task2);
          expect(workflow.activeTask).to.eq(task2);
          expect(workflow.lastActiveTask).to.eq(task2);
        }
      }
    });

    it("getSortedTasks", () => {
      const workflow = new Workflow(
        {
          id: "ExampleWorkflow",
          iconSpec: "icon-placeholder",
          labelKey: "App:Test.my-label",
          defaultTaskId: "Task1",
          tasks: ["Task4", "Task3", "Task1", "Task2"],
          isDefault: true,
        },
      );

      const tasks = workflow.getSortedTasks();
      expect(tasks.length).to.eq(4);
      expect(tasks[0].id).eq("Task1");
      expect(tasks[1].id).eq("Task2");
      expect(tasks[2].id).eq("Task3");
      expect(tasks[3].id).eq("Task4");
    });

  });

  describe("WorkflowManager", () => {
    it("Default Workflow Id", () => {
      expect(WorkflowManager.defaultWorkflowId).to.eq("ExampleWorkflow");
    });

    it("setActiveWorkflowAndTask & isActive", async () => {
      const workflow = WorkflowManager.findWorkflow("ExampleWorkflow");
      expect(workflow).to.not.be.undefined;

      if (workflow) {
        const task1 = workflow.getTask("Task1");
        expect(task1).to.not.be.undefined;

        if (task1) {
          await WorkflowManager.setActiveWorkflowAndTask(workflow, task1);
          expect(workflow.isActive).to.be.true;
          expect(task1.isActive).to.be.true;
          expect(WorkflowManager.activeWorkflow).to.eq(workflow);
          expect(WorkflowManager.activeTask).to.eq(task1);
        }
      }
    });

    it("Workflow & Task getters & setters should return correct values", async () => {
      WorkflowManager.setActiveWorkflow(undefined);
      expect(WorkflowManager.activeWorkflow).to.be.undefined;
      expect(WorkflowManager.activeWorkflowId.length).to.eq(0);
      expect(WorkflowManager.activeTask).to.be.undefined;
      expect(WorkflowManager.activeTaskId.length).to.eq(0);

      const workflow = WorkflowManager.findWorkflow("ExampleWorkflow");
      expect(workflow).to.not.be.undefined;

      if (workflow) {
        WorkflowManager.setActiveWorkflow(workflow);
        expect(WorkflowManager.activeWorkflow).to.eq(workflow);

        const taskId = "Task1";
        const task1 = workflow.getTask(taskId);
        expect(task1).to.not.be.undefined;

        if (task1) {
          await workflow.setActiveTask(task1);
          expect(WorkflowManager.activeTaskId).to.eq(taskId);
        }
      }
    });

    it("getSortedWorkflows", () => {
      const sorted = WorkflowManager.getSortedWorkflows();
      expect(sorted.length).to.eq(3);
      expect(sorted[0].id).eq("ExampleWorkflow");
      expect(sorted[1].id).eq("ExampleWorkflow2");
      expect(sorted[2].id).eq("ExampleWorkflow3");
    });

    it("loadWorkflow", () => {
      const workflowProps: WorkflowProps = {
        id: "OneWorkflow",
        iconSpec: "icon-placeholder",
        labelKey: "SampleApp:Test.my-label",
        defaultTaskId: "task1",
        tasks: ["Task1", "Task2"],
      };

      WorkflowManager.loadWorkflow(workflowProps);
      const workflow = WorkflowManager.findWorkflow("OneWorkflow");
      expect(workflow).to.not.be.undefined;

      if (workflow)
        expect(WorkflowManager.removeWorkflow(workflow)).to.eq(true);
    });

    it("removeWorkflow with unregistered workflow logs error & returns false", () => {
      const workflowProps: WorkflowProps = {
        id: "OneWorkflow",
        iconSpec: "icon-placeholder",
        labelKey: "SampleApp:Test.my-label",
        defaultTaskId: "task1",
        tasks: ["Task1", "Task2"],
      };

      const spyMethod = sinon.spy(Logger, "logError");
      const workflow = new Workflow(workflowProps);
      expect(WorkflowManager.removeWorkflow(workflow)).to.eq(false);
      spyMethod.calledOnce.should.true;
    });

  });
});
