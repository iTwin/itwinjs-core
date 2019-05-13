/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";

import { GroupTool } from "../../../../../../ui-ninezone";

describe("<GroupTool />", () => {
  it("should render", () => {
    mount(<GroupTool />);
  });

  it("renders correctly", () => {
    shallow(<GroupTool />).should.matchSnapshot();
  });

  it("renders active correctly", () => {
    shallow(<GroupTool isActive />).should.matchSnapshot();
  });

  it("renders focused correctly", () => {
    shallow(<GroupTool isFocused />).should.matchSnapshot();
  });

  it("renders disabled correctly", () => {
    shallow(<GroupTool isDisabled />).should.matchSnapshot();
  });

  it("should invoke onClick handler", () => {
    const spy = sinon.spy();
    const sut = mount(<GroupTool onClick={spy} />);
    sut.simulate("click");
    spy.calledOnce.should.true;
  });

  it("should not invoke onClick handler if disabled", () => {
    const spy = sinon.spy();
    const sut = mount(<GroupTool onClick={spy} isDisabled />);
    sut.simulate("click");
    spy.notCalled.should.true;
  });
});
