/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { BackstageItem as NZ_BackstageItem } from "@itwin/appui-layout-react";
import {
  BackstageItemState, ConfigurableUiManager, CoreTools, Frontstage, FrontstageManager, FrontstageProps,
  FrontstageProvider, SyncUiEventDispatcher, TaskLaunchBackstageItem, TaskPropsList, WorkflowManager, WorkflowPropsList,
} from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("Backstage", () => {
  const testEventId = "test-state-function-event";

  before(async () => {
    await TestUtils.initializeUiFramework();
    await NoRenderApp.startup();

    await FrontstageManager.setActiveFrontstageDef(undefined);
  });

  after(async () => {
    TestUtils.terminateUiFramework();
    await IModelApp.shutdown();
  });

  describe("<TaskLaunchBackstageItem />", async () => {
    it("TaskLaunchBackstageItem should render & execute", async () => {
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

      let stateFuncRun = false;
      const stateFunc = (state: Readonly<BackstageItemState>): BackstageItemState => { // eslint-disable-line deprecation/deprecation
        stateFuncRun = true;
        return { ...state, isActive: true } as BackstageItemState; // eslint-disable-line deprecation/deprecation
      };

      ConfigurableUiManager.loadWorkflows(workflowPropsList);

      const spy = sinon.spy(FrontstageManager.onFrontstageActivatedEvent, "emit");
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
      expect(spy.calledOnce).to.be.true;
    });

    it("TaskLaunchBackstageItem should log error when invalid workflowId is provided", async () => {
      const spyMethod = sinon.spy(Logger, "logError");
      const wrapper = mount(
        <TaskLaunchBackstageItem taskId="Task1" workflowId="BadWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />,
      );
      const backstageItem = wrapper.find(NZ_BackstageItem);
      backstageItem.find(".nz-backstage-item").simulate("click");
      spyMethod.calledOnce.should.true;
    });

    it("TaskLaunchBackstageItem should log error when invalid taskId is provided", async () => {
      const spyMethod = sinon.spy(Logger, "logError");
      const wrapper = mount(
        <TaskLaunchBackstageItem taskId="BadTask" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />,
      );
      const backstageItem = wrapper.find(NZ_BackstageItem);
      backstageItem.find(".nz-backstage-item").simulate("click");
      spyMethod.calledOnce.should.true;
    });

    it("TaskLaunchBackstageItem renders correctly when inactive", async () => {
      WorkflowManager.setActiveWorkflow(undefined);
      const wrapper = shallow(<TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);
      wrapper.should.matchSnapshot();
    });

    it("TaskLaunchBackstageItem renders correctly when active", async () => {
      const workflow = WorkflowManager.findWorkflow("ExampleWorkflow");
      expect(workflow).to.not.be.undefined;

      if (workflow) {
        const task1 = workflow.getTask("Task1");
        expect(task1).to.not.be.undefined;

        await WorkflowManager.setActiveWorkflowAndTask(workflow, task1!);
        const wrapper = shallow(<TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);
        wrapper.should.matchSnapshot();
      }
    });

    it("TaskLaunchBackstageItem updates on property change", async () => {
      const wrapper = mount(<TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" isEnabled={false} />);
      expect(wrapper.find("li.nz-disabled").length).to.eq(1);

      wrapper.setProps({ isEnabled: true });
      wrapper.update();
      expect(wrapper.find("li.nz-disabled").length).to.eq(0);
    });

  });
});
