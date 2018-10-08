/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { WorkflowManager, WorkflowPropsList, ConfigurableUiManager, TaskPropsList, Workflow } from "../../src/index";

describe("Workflow & WorkflowManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();

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
        {
          id: "Task4",
          primaryStageId: "Test4",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:backstage.task4",
        },
        {
          id: "Task3",
          primaryStageId: "Test3",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:backstage.task3",
        },
      ],
    };

    ConfigurableUiManager.loadTasks(taskPropsList);

    const workflowPropsList: WorkflowPropsList = {
      defaultWorkflowId: "default-workflow",
      taskPicker: {
        classid: "taskpicker-class",
        iconClass: "taskpicker-icon",
        labelKey: "taskpicker-label",
      },
      workflows: [
        {
          id: "ExampleWorkflow3",
          iconClass: "icon-placeholder",
          labelKey: "Protogist:Test.ExampleWorkflow3",
          defaultTaskId: "Task3",
          tasks: ["Task4", "Task3", "Task1"],
        },
        {
          id: "ExampleWorkflow",
          iconClass: "icon-placeholder",
          labelKey: "Protogist:Test.ExampleWorkflow1",
          defaultTaskId: "Task1",
          tasks: ["Task1", "Task2"],
        },
        {
          id: "ExampleWorkflow2",
          iconClass: "icon-placeholder",
          labelKey: "Protogist:Test.ExampleWorkflow2",
          defaultTaskId: "Task2",
          tasks: ["Task4", "Task3", "Task2"],
        },
      ],
    };

    ConfigurableUiManager.loadWorkflows(workflowPropsList);
  });

  describe("Workflow", () => {

    it("loadWorkflows & findWorkflow", () => {
      expect(WorkflowManager.findWorkflow("ExampleWorkflow")).to.not.be.undefined;
    });

    it("getTask, lastActiveTask & activeTask", () => {
      const workflow = WorkflowManager.findWorkflow("ExampleWorkflow");
      expect(workflow).to.not.be.undefined;

      if (workflow) {
        const task1 = workflow.getTask("Task1");
        expect(task1).to.not.be.undefined;
        expect(workflow.lastActiveTask).to.eq(task1);

        const task2 = workflow.getTask("Task2");
        expect(task2).to.not.be.undefined;
        if (task2) {
          workflow.setActiveTask(task2);
          expect(workflow.activeTask).to.eq(task2);
          expect(workflow.lastActiveTask).to.eq(task2);
        }
      }
    });

    it("getSortedTasks", () => {
      const workflow = new Workflow(
        {
          id: "ExampleWorkflow",
          iconClass: "icon-placeholder",
          labelKey: "Protogist:Test.my-label",
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
      expect(WorkflowManager.defaultWorkflowId).to.eq("default-workflow");
    });

    it("Task Picker", () => {
      const taskPickerProps = WorkflowManager.taskPickerProps;
      expect(taskPickerProps.classid).to.eq("taskpicker-class");
    });

    it("setActiveWorkflowAndTask & isActive", () => {
      const workflow = WorkflowManager.findWorkflow("ExampleWorkflow");
      expect(workflow).to.not.be.undefined;

      if (workflow) {
        const task1 = workflow.getTask("Task1");
        expect(task1).to.not.be.undefined;

        if (task1) {
          WorkflowManager.setActiveWorkflowAndTask(workflow, task1);
          expect(workflow.isActive).to.be.true;
          expect(task1.isActive).to.be.true;
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

  });

});
