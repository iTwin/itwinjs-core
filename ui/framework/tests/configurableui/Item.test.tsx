/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";

import {
  ToolButton,
  ActionItemButton,
  CommandItemDef,
  FrontstageManager,
} from "../../src/index";
import TestUtils from "../TestUtils";

describe("ToolButton", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("<ToolButton />", () => {
    it("should render", () => {
      mount(<ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="UiFramework:tests.label" />);
    });

    it("renders correctly", () => {
      FrontstageManager.setActiveToolId("tool1");
      shallow(<ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="UiFramework:tests.label" />).should.matchSnapshot();
    });

    it("should execute a function", () => {
      const spyMethod = sinon.spy();
      const wrapper = mount(<ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="UiFramework:tests.label" execute={spyMethod} />);
      wrapper.find(".nz-toolbar-item-item").simulate("click");
      spyMethod.should.have.been.called;
      wrapper.unmount();
    });
  });
});

describe("ActionItemButton", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("<ActionItemButton />", () => {
    it("should render", () => {
      const testCommand =
        new CommandItemDef({
          commandId: "command",
          iconClass: "icon-placeholder",
          labelKey: "UiFramework:tests.label",
          execute: () => { },
        });

      mount(<ActionItemButton actionItem={testCommand} />);
    });

    it("renders correctly", () => {
      const testCommand =
        new CommandItemDef({
          commandId: "command",
          iconClass: "icon-placeholder",
          labelKey: "UiFramework:tests.label",
          execute: () => { },
        });
      shallow(<ActionItemButton actionItem={testCommand} />).should.matchSnapshot();
    });

    it("should execute a function", () => {
      const spyMethod = sinon.spy();
      const spyCommand =
        new CommandItemDef({
          commandId: "command",
          iconClass: "icon-placeholder",
          labelKey: "UiFramework:tests.label",
          execute: spyMethod,
        });

      const wrapper = mount(<ActionItemButton actionItem={spyCommand} />);
      wrapper.find(".nz-toolbar-item-item").simulate("click");
      spyMethod.should.have.been.called;
      wrapper.unmount();
    });

  });

});
