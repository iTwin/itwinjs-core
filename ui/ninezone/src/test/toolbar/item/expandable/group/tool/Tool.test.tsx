/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as useTargetedModule from "@bentley/ui-core/lib/ui-core/utils/hooks/useTargeted";
import { GroupTool } from "../../../../../../ui-ninezone";
import { mount } from "../../../../../Utils";

describe("<GroupTool />", () => {
  it("should render", () => {
    mount(<GroupTool />);
  });

  it("renders correctly", () => {
    shallow(<GroupTool />).dive().should.matchSnapshot();
  });

  it("renders active correctly", () => {
    shallow(<GroupTool isActive />).dive().should.matchSnapshot();
  });

  it("renders focused correctly", () => {
    shallow(<GroupTool isFocused />).dive().should.matchSnapshot();
  });

  it("renders disabled correctly", () => {
    shallow(<GroupTool isDisabled />).dive().should.matchSnapshot();
  });

  it("renders with badge correctly", () => {
    shallow(<GroupTool badge />).dive().should.matchSnapshot();
  });

  it("renders with pointer up correctly", () => {
    shallow(<GroupTool onPointerUp={sinon.spy()} />).dive().should.matchSnapshot();
  });

  it("renders targeted correctly", () => {
    sinon.stub(useTargetedModule, "useTargeted").returns(true);
    shallow(<GroupTool />).dive().should.matchSnapshot();
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

  it("should invoke onPointerUp handler", () => {
    const spy = sinon.spy();
    const sut = mount(<GroupTool onPointerUp={spy} />);
    sut.simulate("pointerup");
    spy.calledOnce.should.true;
  });
});
