/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { ToolSettingsPopup } from "../../../ui-ninezone";

describe("<ToolSettingsPopup />", () => {
  it("should render", () => {
    mount(<ToolSettingsPopup />);
  });

  it("renders correctly", () => {
    shallow(<ToolSettingsPopup />).should.matchSnapshot();
  });

  it("should update target when mounting", () => {
    const target = document.createElement("div");
    const targetRef: React.RefObject<HTMLElement> = {
      current: target,
    };
    const sut = mount<ToolSettingsPopup>(<ToolSettingsPopup target={targetRef} />);
    expect(sut.state().target).eq(target);
  });

  it("should update target when updating", () => {
    const targetRef: React.RefObject<HTMLElement> = {
      current: null,
    };
    const sut = mount<ToolSettingsPopup>(<ToolSettingsPopup target={targetRef} />);

    const target = document.createElement("div");
    sinon.stub(targetRef, "current").get(() => target);

    sut.instance().componentDidUpdate();

    expect(sut.state().target).eq(target);
  });

  it("should reset target when updating", () => {
    const targetRef: React.RefObject<HTMLElement> = {
      current: document.createElement("div"),
    };
    const sut = mount<ToolSettingsPopup>(<ToolSettingsPopup target={targetRef} />);
    sut.setProps({
      target: undefined,
    });

    expect(sut.state().target).null;
  });
});
