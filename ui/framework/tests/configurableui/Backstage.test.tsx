/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Backstage, CommandLaunchBackstageItem, FrontstageLaunchBackstageItem, SeparatorBackstageItem, TaskLaunchBackstageItem } from "../../src/index";
import TestUtils from "../TestUtils";

describe("Backstage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("<Backstage />", () => {
    it("should render", () => {
      mount(<Backstage isVisible={true} />);
    });

    it("renders correctly", () => {
      shallow(<Backstage isVisible={true} />).should.matchSnapshot();
    });

    it("with child items", () => {
      const commandHandler = { messageId: "", parameters: null, execute: () => { } };
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

    it("with child items", () => {
    });
  });
});
