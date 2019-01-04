/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";

import {
  ActionItemButton,
  CommandItemDef,
} from "../../../ui-framework";
import TestUtils from "../../TestUtils";

describe("ActionItemButton", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("<ActionItemButton />", () => {
    it("should render", () => {
      const testCommand =
        new CommandItemDef({
          commandId: "command",
          iconSpec: "icon-placeholder",
          labelKey: "UiFramework:tests.label",
          execute: () => { },
        });

      mount(<ActionItemButton actionItem={testCommand} />);
    });

    it("renders correctly", () => {
      const testCommand =
        new CommandItemDef({
          commandId: "command",
          iconSpec: "icon-placeholder",
          labelKey: "UiFramework:tests.label",
          execute: () => { },
        });
      shallow(<ActionItemButton actionItem={testCommand} />).should.matchSnapshot();
    });

    it("hidden renders correctly", () => {
      const testCommand =
        new CommandItemDef({
          commandId: "command",
          iconSpec: "icon-placeholder",
          labelKey: "UiFramework:tests.label",
          isVisible: false,
          execute: () => { },
        });
      shallow(<ActionItemButton actionItem={testCommand} />).should.matchSnapshot();
    });

    it("disabled renders correctly", () => {
      const testCommand =
        new CommandItemDef({
          commandId: "command",
          iconSpec: "icon-placeholder",
          labelKey: "UiFramework:tests.label",
          isEnabled: false,
          execute: () => { },
        });
      shallow(<ActionItemButton actionItem={testCommand} />).should.matchSnapshot();
    });

    it("should execute a function", () => {
      const spyMethod = sinon.spy();
      const spyCommand =
        new CommandItemDef({
          commandId: "command",
          iconSpec: "icon-placeholder",
          labelKey: "UiFramework:tests.label",
          execute: spyMethod,
        });

      const wrapper = mount(<ActionItemButton actionItem={spyCommand} />);
      wrapper.find(".nz-toolbar-item-icon").simulate("click");
      spyMethod.should.have.been.called;
      wrapper.unmount();
    });

  });

});
