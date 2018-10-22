/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";
import {
  Backstage,
  CommandLaunchBackstageItem,
  FrontstageLaunchBackstageItem,
  SeparatorBackstageItem,
  TaskLaunchBackstageItem,
  FrontstageManager,
  FrontstageActivatedEventArgs,
  ConfigurableUiManager,
  TaskPropsList,
  WorkflowPropsList,
} from "../../src/index";
import TestUtils from "../TestUtils";
import NZ_BackstageItem from "@bentley/ui-ninezone/lib/backstage/Item";

describe("Backstage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();

    FrontstageManager.setActiveFrontstageDef(undefined);
  });

  describe("<Backstage />", () => {
    it("should render - isVisible", () => {
      mount(<Backstage isVisible={true} />);
    });

    it("should render - !isVisible", () => {
      mount(<Backstage isVisible={false} />);
    });

    it("renders correctly - isVisible", () => {
      shallow(<Backstage isVisible={true} />).should.matchSnapshot();
    });

    it("renders correctly - !isVisible", () => {
      shallow(<Backstage isVisible={false} />).should.matchSnapshot();
    });

    it("with child items", () => {
      const commandHandler = { execute: () => { } };
      shallow(
        <Backstage isVisible={true}>
          <CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label" iconClass="icon-placeholder" commandHandler={commandHandler} />
          <SeparatorBackstageItem />
          <FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconClass="icon-placeholder" />
          <SeparatorBackstageItem />
          <TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconClass="icon-placeholder" />
        </Backstage>,
      ).should.matchSnapshot();
    });

    it("SeparatorBackstageItem should render", () => {
      mount(<SeparatorBackstageItem />);
    });

    it("SeparatorBackstageItem renders correctly", () => {
      shallow(<SeparatorBackstageItem />).should.matchSnapshot();
    });

    it("CommandLaunchBackstageItem should render & execute", () => {
      const spyMethod = sinon.stub();
      const commandHandler = { execute: spyMethod };
      const wrapper = mount(<CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label" subtitleId="UiFramework:tests.subtitle" iconClass="icon-placeholder" commandHandler={commandHandler} />);
      const backstageItem = wrapper.find(NZ_BackstageItem);
      backstageItem.find(".nz-backstage-item").simulate("click");
      expect(spyMethod.calledOnce).to.be.true;
    });

    it("CommandLaunchBackstageItem renders correctly", () => {
      const commandHandler = { execute: () => { } };
      shallow(<CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label" iconClass="icon-placeholder" commandHandler={commandHandler} />).should.matchSnapshot();
    });

    it("FrontstageLaunchBackstageItem should render & execute", () => {
      const spyMethod = sinon.stub();
      const frontstageProps = {
        id: "Test1",
        defaultToolId: "PlaceLine",
        defaultLayout: "TwoHalvesVertical",
        contentGroup: "TestContentGroup1",
        defaultContentId: "TestContent1",
      };
      ConfigurableUiManager.loadFrontstage(frontstageProps);
      const remove = FrontstageManager.onFrontstageActivatedEvent.addListener((_args: FrontstageActivatedEventArgs) => spyMethod());
      const wrapper = mount(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconClass="icon-placeholder" />);
      const backstageItem = wrapper.find(NZ_BackstageItem);
      backstageItem.find(".nz-backstage-item").simulate("click");
      setImmediate(() => {
        expect(spyMethod.calledOnce).to.be.true;
        remove();
      });
    });

    it("FrontstageLaunchBackstageItem renders correctly", () => {
      shallow(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconClass="icon-placeholder" />).should.matchSnapshot();
    });

    it("TaskLaunchBackstageItem should render & execute", () => {
      const frontstageProps = {
        id: "Test1",
        defaultToolId: "PlaceLine",
        defaultLayout: "TwoHalvesVertical",
        contentGroup: "TestContentGroup1",
        defaultContentId: "TestContent1",
      };

      ConfigurableUiManager.loadFrontstage(frontstageProps);

      const taskPropsList: TaskPropsList = {
        tasks: [
          {
            id: "Task1",
            primaryStageId: "Test1",
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:backstage.task1",
          },
        ],
      };

      ConfigurableUiManager.loadTasks(taskPropsList);

      // Test Workflows
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
            tasks: ["Task1"],
          },
        ],
      };

      ConfigurableUiManager.loadWorkflows(workflowPropsList);

      const spyMethod = sinon.stub();
      const remove = FrontstageManager.onFrontstageActivatedEvent.addListener((_args: FrontstageActivatedEventArgs) => spyMethod());
      const wrapper = mount(<TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconClass="icon-placeholder" />);
      const backstageItem = wrapper.find(NZ_BackstageItem);
      backstageItem.find(".nz-backstage-item").simulate("click");
      setImmediate(() => {
        expect(spyMethod.calledOnce).to.be.true;
        remove();
      });
    });

    it("TaskLaunchBackstageItem renders correctly", () => {
      shallow(<TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconClass="icon-placeholder" />).should.matchSnapshot();
    });

  });
});
