/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";

import { StandardRotationNavigationAid } from "../../ui-framework";
import TestUtils from "../TestUtils";

// NEEDSWORK_MODULARIZATION needs work after modularization reorganization. Might just need snap update, might now be wrong.
describe("StandardRotationNavigationAid", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
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
      wrapper.find("div.icon-button").simulate("click");

      expect(wrapper.find("div.nz-toolbar-item-expandable-group-tool-item").length).to.be.greaterThan(0);
      wrapper.find("div.nz-toolbar-item-expandable-group-tool-item").at(1).simulate("click");
      expect(wrapper.find("span.icon-cube-faces-top").length).to.eq(0);
      expect(wrapper.find("span.icon-cube-faces-bottom").length).to.eq(1);

      wrapper.unmount();
    });

  });

});
