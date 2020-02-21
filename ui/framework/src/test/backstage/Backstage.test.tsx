/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";
import {
  Backstage,
  CommandLaunchBackstageItem,
  FrontstageLaunchBackstageItem,
  TaskLaunchBackstageItem,
  FrontstageManager,
  SyncUiEventDispatcher,
} from "../../ui-framework";
import TestUtils, { MockAccessToken } from "../TestUtils";
import { SeparatorBackstageItem } from "../../ui-framework/backstage/Separator";

describe("Backstage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();

    await FrontstageManager.setActiveFrontstageDef(undefined);
    SyncUiEventDispatcher.initialize();   // To process Backstage events
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("<Backstage />", () => {
    it("should render - isVisible", () => {
      const wrapper = mount(<Backstage isVisible={true} />); // tslint:disable-line:deprecation
      wrapper.unmount();
    });

    it("should render - !isVisible", () => {
      const wrapper = mount(<Backstage isVisible={false} />); // tslint:disable-line:deprecation
      wrapper.unmount();
    });

    it("renders correctly - isVisible", () => {
      shallow(<Backstage isVisible={true} />).dive().should.matchSnapshot(); // tslint:disable-line:deprecation
    });

    it("renders correctly - !isVisible", () => {
      shallow(<Backstage isVisible={false} />).dive().should.matchSnapshot(); // tslint:disable-line:deprecation
    });

    it("renders correctly with header", () => {
      shallow(<Backstage header={<div> Hello World! </div>} />).dive().should.matchSnapshot(); // tslint:disable-line:deprecation
    });

    it("renders correctly with AccessToken", () => {
      shallow(<Backstage accessToken={new MockAccessToken()} />).dive().should.matchSnapshot(); // tslint:disable-line:deprecation
    });

    it("with child items", () => {
      const commandHandler = () => { };
      shallow(
        // tslint:disable-next-line:deprecation
        <Backstage isVisible={true}>
          <CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" execute={commandHandler} />
          <SeparatorBackstageItem />
          <FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />
          <SeparatorBackstageItem />
          <TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />
        </Backstage>, // tslint:disable-line:deprecation
      ).dive().should.matchSnapshot();
    });

    it("should show", () => {
      const wrapper = mount(<Backstage isVisible={false} />); // tslint:disable-line:deprecation
      expect(Backstage.isBackstageVisible).to.be.false; // tslint:disable-line:deprecation
      Backstage.show(); // tslint:disable-line:deprecation
      expect(Backstage.isBackstageVisible).to.be.true; // tslint:disable-line:deprecation
      wrapper.unmount();
    });

    it("should hide", () => {
      const wrapper = mount(<Backstage isVisible={true} />); // tslint:disable-line:deprecation
      expect(Backstage.isBackstageVisible).to.be.true; // tslint:disable-line:deprecation
      Backstage.hide(); // tslint:disable-line:deprecation
      expect(Backstage.isBackstageVisible).to.be.false; // tslint:disable-line:deprecation
      wrapper.unmount();
    });

    it("should toggle", () => {
      const wrapper = mount(<Backstage isVisible={false} />); // tslint:disable-line:deprecation
      expect(Backstage.isBackstageVisible).to.be.false; // tslint:disable-line:deprecation

      const toggleCommand = Backstage.backstageToggleCommand; // tslint:disable-line:deprecation
      toggleCommand.execute();
      expect(Backstage.isBackstageVisible).to.be.true; // tslint:disable-line:deprecation

      toggleCommand.execute();
      expect(Backstage.isBackstageVisible).to.be.false; // tslint:disable-line:deprecation

      wrapper.unmount();
    });

    it("should show by updating isVisible prop", () => {
      const wrapper = mount(<Backstage isVisible={false} />); // tslint:disable-line:deprecation
      expect(Backstage.isBackstageVisible).to.be.false; // tslint:disable-line:deprecation
      wrapper.setProps({ isVisible: true });
      expect(Backstage.isBackstageVisible).to.be.true; // tslint:disable-line:deprecation
      wrapper.unmount();
    });

    it("should close when clicking the overlay", () => {
      const spyMethod = sinon.spy();
      const wrapper = mount(<Backstage isVisible={true} onClose={spyMethod} />); // tslint:disable-line:deprecation
      expect(Backstage.isBackstageVisible).to.be.true; // tslint:disable-line:deprecation
      const overlay = wrapper.find("div.nz-backstage-backstage_overlay");
      overlay.simulate("click");
      expect(Backstage.isBackstageVisible).to.be.false; // tslint:disable-line:deprecation
      expect(spyMethod.calledOnce).to.be.true;
      wrapper.unmount();
    });
  });
});
