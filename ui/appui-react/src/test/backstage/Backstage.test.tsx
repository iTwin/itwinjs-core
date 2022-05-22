/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import {
  Backstage, CommandLaunchBackstageItem, FrontstageLaunchBackstageItem, FrontstageManager, SyncUiEventDispatcher, TaskLaunchBackstageItem,
} from "../../appui-react";
import { SeparatorBackstageItem } from "../../appui-react/backstage/Separator";
import TestUtils, { mount } from "../TestUtils";

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
      mount(<Backstage isVisible={true} />); // eslint-disable-line deprecation/deprecation
    });

    it("should render - !isVisible", () => {
      mount(<Backstage isVisible={false} />); // eslint-disable-line deprecation/deprecation
    });

    it("renders correctly - isVisible", () => {
      shallow(<Backstage isVisible={true} />).dive().should.matchSnapshot(); // eslint-disable-line deprecation/deprecation
    });

    it("renders correctly - !isVisible", () => {
      shallow(<Backstage isVisible={false} />).dive().should.matchSnapshot(); // eslint-disable-line deprecation/deprecation
    });

    it("renders correctly with header", () => {
      shallow(<Backstage header={<div> Hello World! </div>} />).dive().should.matchSnapshot(); // eslint-disable-line deprecation/deprecation
    });

    it("with child items", () => {
      const commandHandler = () => { };
      shallow(
        // eslint-disable-next-line deprecation/deprecation
        <Backstage isVisible={true}>
          { /* eslint-disable-next-line deprecation/deprecation */ }
          <CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" execute={commandHandler} />
          <SeparatorBackstageItem /> { /* eslint-disable-line deprecation/deprecation */ }
          { /* eslint-disable-next-line deprecation/deprecation */ }
          <FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />
          <SeparatorBackstageItem /> { /* eslint-disable-line deprecation/deprecation */ }
          {/* eslint-disable-next-line deprecation/deprecation */}
          <TaskLaunchBackstageItem taskId="Task1" workflowId="ExampleWorkflow" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />
        </Backstage>, // eslint-disable-line deprecation/deprecation
      ).dive().should.matchSnapshot();
    });

    it("should show", () => {
      mount(<Backstage isVisible={false} />); // eslint-disable-line deprecation/deprecation
      expect(Backstage.isBackstageVisible).to.be.false; // eslint-disable-line deprecation/deprecation
      Backstage.show(); // eslint-disable-line deprecation/deprecation
      expect(Backstage.isBackstageVisible).to.be.true; // eslint-disable-line deprecation/deprecation
    });

    it("should hide", () => {
      mount(<Backstage isVisible={true} />); // eslint-disable-line deprecation/deprecation
      expect(Backstage.isBackstageVisible).to.be.true; // eslint-disable-line deprecation/deprecation
      Backstage.hide(); // eslint-disable-line deprecation/deprecation
      expect(Backstage.isBackstageVisible).to.be.false; // eslint-disable-line deprecation/deprecation
    });

    it("should toggle", () => {
      mount(<Backstage isVisible={false} />); // eslint-disable-line deprecation/deprecation
      expect(Backstage.isBackstageVisible).to.be.false; // eslint-disable-line deprecation/deprecation

      const toggleCommand = Backstage.backstageToggleCommand; // eslint-disable-line deprecation/deprecation
      toggleCommand.execute();
      expect(Backstage.isBackstageVisible).to.be.true; // eslint-disable-line deprecation/deprecation

      toggleCommand.execute();
      expect(Backstage.isBackstageVisible).to.be.false; // eslint-disable-line deprecation/deprecation
    });

    it("should show by updating isVisible prop", () => {
      const wrapper = mount(<Backstage isVisible={false} />); // eslint-disable-line deprecation/deprecation
      expect(Backstage.isBackstageVisible).to.be.false; // eslint-disable-line deprecation/deprecation
      wrapper.setProps({ isVisible: true });
      expect(Backstage.isBackstageVisible).to.be.true; // eslint-disable-line deprecation/deprecation
    });

    it("should close when clicking the overlay", () => {
      const spyMethod = sinon.spy();
      const wrapper = mount(<Backstage isVisible={true} onClose={spyMethod} />); // eslint-disable-line deprecation/deprecation
      expect(Backstage.isBackstageVisible).to.be.true; // eslint-disable-line deprecation/deprecation
      const overlay = wrapper.find("div.nz-backstage-backstage_overlay");
      overlay.simulate("click");
      expect(Backstage.isBackstageVisible).to.be.false; // eslint-disable-line deprecation/deprecation
      expect(spyMethod.calledOnce).to.be.true;
    });
  });
});
