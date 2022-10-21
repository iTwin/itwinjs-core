/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import {
  BackstageItemState, ConfigurableUiManager, CoreTools, Frontstage, FrontstageManager, FrontstageProps,
  FrontstageProvider, SyncUiEventDispatcher, TaskLaunchBackstageItem, TaskPropsList, WorkflowManager, WorkflowPropsList,
} from "../../appui-react";
import TestUtils, { selectorMatches, userEvent } from "../TestUtils";
import { render, screen } from "@testing-library/react";

/* eslint-disable deprecation/deprecation */

describe("Backstage", () => {
  const testEventId = "test-state-function-event";
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(async ()=>{
    theUserTo = userEvent.setup();
    await FrontstageManager.setActiveFrontstageDef(undefined);
    WorkflowManager.setActiveWorkflow(undefined);
  });

  before(async () => {
    await TestUtils.initializeUiFramework();
    await NoRenderApp.startup();

    class Frontstage1 extends FrontstageProvider {
      public static stageId = "Test1";
      public get id(): string {
        return Frontstage1.stageId;
      }
      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id={this.id}
            defaultTool={CoreTools.selectElementCommand}
            contentGroup={TestUtils.TestContentGroup1}
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
          primaryStageId: Frontstage1.stageId,
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
  });

  after(async () => {
    TestUtils.terminateUiFramework();
    await IModelApp.shutdown();
  });

  describe("<TaskLaunchBackstageItem />", async () => {
    it("TaskLaunchBackstageItem should render & execute", async () => {
      const stateFunc = sinon.fake((state: Readonly<BackstageItemState>): BackstageItemState => {
        return { ...state, isActive: true } as BackstageItemState;
      });

      const spy = sinon.spy(WorkflowManager, "setActiveWorkflowAndTask");
      render(
        <TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder"
          isEnabled={true} isActive={false}
          stateSyncIds={[testEventId]} stateFunc={stateFunc} />,
      );

      expect(stateFunc).not.to.be.called;
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
      expect(stateFunc).to.be.called;

      await theUserTo.click(screen.getByRole("menuitem"));
      expect(spy).to.be.calledWith(sinon.match({workflowId: "ExampleWorkflow"}), sinon.match({taskId: "Task1"}));
      expect(screen.getByRole("menuitem")).to.satisfy(selectorMatches(".nz-active"));
    });

    it("TaskLaunchBackstageItem should log error when invalid workflowId is provided", async () => {
      const spyMethod = sinon.spy(Logger, "logError");
      render(
        <TaskLaunchBackstageItem taskId="Task1" workflowId="BadWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />,
      );

      await theUserTo.click(screen.getByRole("menuitem"));
      spyMethod.calledOnce.should.true;
    });

    it("TaskLaunchBackstageItem should log error when invalid taskId is provided", async () => {
      const spyMethod = sinon.spy(Logger, "logError");
      render(
        <TaskLaunchBackstageItem taskId="BadTask" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />,
      );

      await theUserTo.click(screen.getByRole("menuitem"));
      spyMethod.calledOnce.should.true;
    });

    it("TaskLaunchBackstageItem renders correctly when inactive", async () => {
      render(<TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);

      expect(screen.getByRole("menuitem")).to.not.satisfy(selectorMatches(".nz-active"));
    });

    it("TaskLaunchBackstageItem renders correctly when active", async () => {
      const workflow = WorkflowManager.findWorkflow("ExampleWorkflow");
      expect(workflow).to.not.be.undefined;

      if (workflow) {
        const task1 = workflow.getTask("Task1");
        expect(task1).to.not.be.undefined;

        await WorkflowManager.setActiveWorkflowAndTask(workflow, task1!);
      }
      render(<TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);

      expect(screen.getByRole("menuitem")).to.satisfy(selectorMatches(".nz-active"));
    });

    it("TaskLaunchBackstageItem updates on property change", async () => {
      const {rerender} = render(<TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" isEnabled={false} />);
      expect(screen.getByRole("menuitem")).to.satisfy(selectorMatches(".nz-disabled"));

      rerender(<TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" isEnabled={true} />);
      expect(screen.getByRole("menuitem")).not.to.satisfy(selectorMatches(".nz-disabled"));
    });

  });
});
