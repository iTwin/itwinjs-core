/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Panel } from "../../../../../ui-ninezone";
import { expect } from "chai";

describe("<Panel />", () => {
  it("should render", () => {
    mount(<Panel />);
  });

  it("renders correctly", () => {
    shallow(<Panel />).should.matchSnapshot();
  });

  it("isPanelOpen should return false", () => {
    expect(Panel.isPanelOpen).to.be.false; // tslint:disable-line: deprecation
  });

  it("isPanelOpen should return true", () => {
    const attachTo = document.createElement("div");
    document.body.appendChild(attachTo);

    const wrapper = mount(<Panel />, { attachTo });
    expect(Panel.isPanelOpen).to.be.true; // tslint:disable-line: deprecation
    wrapper.detach();
    wrapper.unmount();

    document.body.removeChild(attachTo);
  });

});
