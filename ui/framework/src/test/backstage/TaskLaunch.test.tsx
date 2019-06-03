/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";
import {
  TaskLaunchBackstageItem,
  FrontstageManager,
  FrontstageActivatedEventArgs,
  ConfigurableUiManager,
  TaskPropsList,
  WorkflowPropsList,
  FrontstageProvider,
  Frontstage,
  FrontstageProps,
  BackstageItemState,
} from "../../ui-framework";
import TestUtils from "../TestUtils";
import { BackstageItem as NZ_BackstageItem } from "@bentley/ui-ninezone";
import { CoreTools } from "../../ui-framework/CoreToolDefinitions";
import { SyncUiEventDispatcher } from "../../ui-framework/syncui/SyncUiEventDispatcher";
import { WorkflowManager } from "../../ui-framework/workflow/Workflow";
import { Logger } from "@bentley/bentleyjs-core";

describe("Backstage", () => {
  const testEventId = "test-state-function-event";

  before(async () => {
    await TestUtils.initializeUiFramework();

    FrontstageManager.setActiveFrontstageDef(undefined); // tslint:disable-line:no-floating-promises
  });

  describe("<TaskLaunchBackstageItem />", () => {
    it("TaskLaunchBackstageItem should render & execute", async () => {
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

      let stateFuncRun = false;
      const stateFunc = (state: Readonly<BackstageItemState>): BackstageItemState => {
        stateFuncRun = true;
        return { ...state, isActive: true } as BackstageItemState;
      };

      ConfigurableUiManager.loadWorkflows(workflowPropsList);

      const spyMethod = sinon.stub();
      const remove = FrontstageManager.onFrontstageActivatedEvent.addListener((_args: FrontstageActivatedEventArgs) => spyMethod());
      const wrapper = mount(
        <TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder"
          isEnabled={true} isActive={false}
          stateSyncIds={[testEventId]} stateFunc={stateFunc} />,
      );
      const backstageItem = wrapper.find(NZ_BackstageItem);

      expect(stateFuncRun).to.be.false;
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
      expect(stateFuncRun).to.be.true;

      backstageItem.find(".nz-backstage-item").simulate("click");
      await TestUtils.flushAsyncOperations();
      expect(spyMethod.calledOnce).to.be.true;
      remove();
      wrapper.unmount();
    });

    it("TaskLaunchBackstageItem should log error when invalid workflowId is provided", async () => {
      const spyMethod = sinon.spy(Logger, "logError");
      const wrapper = mount(
        <TaskLaunchBackstageItem taskId="Task1" workflowId="BadWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />,
      );
      const backstageItem = wrapper.find(NZ_BackstageItem);
      backstageItem.find(".nz-backstage-item").simulate("click");
      spyMethod.calledOnce.should.true;
      wrapper.unmount();
      (Logger.logError as any).restore();
    });

    it("TaskLaunchBackstageItem should log error when invalid taskId is provided", async () => {
      const spyMethod = sinon.spy(Logger, "logError");
      const wrapper = mount(
        <TaskLaunchBackstageItem taskId="BadTask" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />,
      );
      const backstageItem = wrapper.find(NZ_BackstageItem);
      backstageItem.find(".nz-backstage-item").simulate("click");
      spyMethod.calledOnce.should.true;
      wrapper.unmount();
      (Logger.logError as any).restore();
    });

    it("TaskLaunchBackstageItem renders correctly when inactive", () => {
      WorkflowManager.setActiveWorkflow(undefined);
      const wrapper = shallow(<TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);
      wrapper.should.matchSnapshot();
      wrapper.unmount();
    });

    it("TaskLaunchBackstageItem renders correctly when active", async () => {
      const workflow = WorkflowManager.findWorkflow("ExampleWorkflow");
      expect(workflow).to.not.be.undefined;

      if (workflow) {
        const task1 = workflow.getTask("Task1");
        expect(task1).to.not.be.undefined;

        if (task1) {
          await WorkflowManager.setActiveWorkflowAndTask(workflow, task1);
          const wrapper = shallow(<TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);
          wrapper.should.matchSnapshot();
          wrapper.unmount();
        }
      }
    });

    it("TaskLaunchBackstageItem updates on property change", async () => {
      const wrapper = mount(<TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" isEnabled={false} />);
      expect(wrapper.find("li.nz-disabled").length).to.eq(1);

      wrapper.setProps({ isEnabled: true });
      wrapper.update();
      expect(wrapper.find("li.nz-disabled").length).to.eq(0);

      wrapper.unmount();
    });

  });
});
