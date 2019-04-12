/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { expect } from "chai";
import { FooterPopup } from "../../ui-ninezone";

describe("<FooterPopup />", () => {
  it("should render", () => {
    mount(<FooterPopup />);
  });

  it("renders correctly", () => {
    shallow(<FooterPopup />).should.matchSnapshot();
  });

  it("should set target state", () => {
    const target = document.createElement("div");
    const targetRef: React.RefObject<HTMLElement> = {
      current: target,
    };
    const sut = mount<FooterPopup>(<FooterPopup target={targetRef} />);
    expect(sut.state().target).eq(target);
  });
});
