/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Dialog } from "../../src/index";
import TestUtils from "../TestUtils";

describe("Dialog", () => {

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  describe("<Dialog />", () => {
    it("should render", () => {
      const wrapper = mount(<Dialog opened={true} />);
      wrapper.unmount();
    });

    it("renders correctly", () => {
      shallow(<Dialog opened={true} />).should.matchSnapshot();
    });

    it("movable", () => {
      const wrapper = mount(<Dialog opened={true} movable={true} />);
      // TODO: simulate move
      wrapper.unmount();
    });

    it("resizable", () => {
      const wrapper = mount(<Dialog opened={true} resizable={true} />);
      // TODO: simulate resize
      wrapper.unmount();
    });
  });
});
