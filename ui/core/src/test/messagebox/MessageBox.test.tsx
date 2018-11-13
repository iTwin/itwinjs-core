/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { expect } from "chai";

import { MessageBox, MessageSeverity, ButtonType, ButtonStyle } from "../../index";
import TestUtils from "../TestUtils";

describe("MessageBox", () => {

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  const buttonCluster = [
    { type: ButtonType.Close, buttonStyle: ButtonStyle.Primary, onClick: () => { } },
  ];

  describe("renders", () => {
    it("should render", () => {
      const wrapper = mount(<MessageBox opened={true} severity={MessageSeverity.Information} buttonCluster={buttonCluster} />);
      const icon = wrapper.find("div.message-box-information");
      expect(icon.length).to.eq(1);
      wrapper.unmount();
    });

    it("renders correctly", () => {
      shallow(<MessageBox opened={true} severity={MessageSeverity.Information} buttonCluster={buttonCluster} />).should.matchSnapshot();
    });
  });

  describe("renders different severities", () => {
    it("MessageSeverity.Question", () => {
      const wrapper = mount(<MessageBox opened={true} severity={MessageSeverity.Question} buttonCluster={buttonCluster} />);
      const icon = wrapper.find("div.message-box-question");
      expect(icon.length).to.eq(1);
    });
    it("MessageSeverity.Warning", () => {
      const wrapper = mount(<MessageBox opened={true} severity={MessageSeverity.Warning} buttonCluster={buttonCluster} />);
      const icon = wrapper.find("div.message-box-warning");
      expect(icon.length).to.eq(1);
    });
    it("MessageSeverity.Error", () => {
      const wrapper = mount(<MessageBox opened={true} severity={MessageSeverity.Error} buttonCluster={buttonCluster} />);
      const icon = wrapper.find("div.message-box-error");
      expect(icon.length).to.eq(1);
    });
    it("MessageSeverity.Fatal", () => {
      const wrapper = mount(<MessageBox opened={true} severity={MessageSeverity.Fatal} buttonCluster={buttonCluster} />);
      const icon = wrapper.find("div.message-box-fatal");
      expect(icon.length).to.eq(1);
    });
  });

});
