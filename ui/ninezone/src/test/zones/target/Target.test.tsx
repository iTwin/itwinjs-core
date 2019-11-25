/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { WidgetTarget } from "../../../ui-ninezone/zones/target/Target";
import * as useTargetedModule from "../../../ui-ninezone/base/useTargeted";

describe("<WidgetTarget />", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    mount(<WidgetTarget />);
  });

  it("renders correctly", () => {
    shallow(<WidgetTarget />).should.matchSnapshot();
  });

  it("renders targeted correctly", () => {
    sandbox.stub(useTargetedModule, "useTargeted").returns(true);
    shallow(<WidgetTarget />).should.matchSnapshot();
  });

  it("should invoke onTargetChanged handler when targeted changes", () => {
    const spy = sinon.spy();
    const sut = mount(<WidgetTarget onTargetChanged={spy} />);

    const target = sut.find(".nz-zones-target-target");
    sinon.stub(target.getDOMNode(), "contains").returns(true);

    const pointerMove = document.createEvent("HTMLEvents");
    pointerMove.initEvent("pointermove");
    document.dispatchEvent(pointerMove);
    sut.setProps({});

    spy.calledOnceWithExactly(true).should.true;
  });
});
