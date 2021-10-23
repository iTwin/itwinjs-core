/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import { StandardRotationNavigationAid } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("StandardRotationNavigationAid", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("<StandardRotationNavigationAid />", () => {

    it("should render", () => {
      mount(<StandardRotationNavigationAid />);
    });

    it("renders correctly", () => {
      shallow(<StandardRotationNavigationAid />).should.matchSnapshot();
    });

    it("should expand on click and change on item click", () => {
      const wrapper = mount(<StandardRotationNavigationAid />);

      expect(wrapper.find("span.icon-cube-faces-top").length).to.eq(1);
      expect(wrapper.find("div.nz-toolbar-item-expandable-group-tool-item").length).to.eq(0);
      wrapper.find("button.icon-button").simulate("click");

      expect(wrapper.find("div.nz-toolbar-item-expandable-group-tool-item").length).to.be.greaterThan(0);
      wrapper.find("div.nz-toolbar-item-expandable-group-tool-item").at(1).simulate("click");
      expect(wrapper.find("span.icon-cube-faces-top").length).to.eq(0);
      expect(wrapper.find("span.icon-cube-faces-bottom").length).to.eq(1);
    });

  });

});
