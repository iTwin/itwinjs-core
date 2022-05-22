/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import { Panel } from "../../../../../appui-layout-react";
import { mount } from "../../../../Utils";

describe("<Panel />", () => {
  it("should render", () => {
    mount(<Panel />);
  });

  it("renders correctly", () => {
    shallow(<Panel />).should.matchSnapshot();
  });

  it("isPanelOpen should return false", () => {
    expect(Panel.isPanelOpen).to.be.false; // eslint-disable-line deprecation/deprecation
  });

  it("isPanelOpen should return true", () => {
    const attachTo = document.createElement("div");
    document.body.appendChild(attachTo);

    const wrapper = mount(<Panel />, { attachTo });
    expect(Panel.isPanelOpen).to.be.true; // eslint-disable-line deprecation/deprecation
    wrapper.detach();
    wrapper.unmount();

    document.body.removeChild(attachTo);
  });

});
