/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ReactWrapper, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as useTargetedModule from "@bentley/ui-core/lib/ui-core/utils/hooks/useTargeted";
import { WidgetTarget, WidgetTargetProps } from "../../../ui-ninezone/zones/target/Target";
import { mount } from "../../Utils";

describe("<WidgetTarget />", () => {
  function target(widgetTarget: ReactWrapper) {
    const targetElement = widgetTarget.find(".nz-zones-target-target");
    sinon.stub(targetElement.getDOMNode(), "contains").returns(true);
    const pointerMove = document.createEvent("HTMLEvents");
    pointerMove.initEvent("pointermove");
    document.dispatchEvent(pointerMove);
    widgetTarget.setProps({});
  }

  it("should render", () => {
    mount(<WidgetTarget />);
  });

  it("renders correctly", () => {
    shallow(<WidgetTarget />).should.matchSnapshot();
  });

  it("renders targeted correctly", () => {
    sinon.stub(useTargetedModule, "useTargeted").returns(true);
    shallow(<WidgetTarget />).should.matchSnapshot();
  });

  it("should invoke onTargetChanged handler when targeted changes", () => {
    const spy = sinon.spy();
    const sut = mount(<WidgetTarget onTargetChanged={spy} />);

    target(sut);

    spy.calledOnceWithExactly(true).should.true;
  });

  it("should invoke onTargetChanged handler when component unmounts", () => {
    const spy = sinon.spy();
    const sut = mount(<WidgetTarget onTargetChanged={spy} />);

    target(sut);

    spy.resetHistory();
    sut.unmount();
    spy.calledOnceWithExactly(false).should.true;
  });

  it("should not invoke unmount handler when handler changes", () => {
    const spy = sinon.spy();
    const sut = mount<WidgetTargetProps>(<WidgetTarget
      onTargetChanged={spy}
    />);

    target(sut);

    spy.resetHistory();
    sut.setProps({ onTargetChanged: () => { } });

    spy.callCount.should.eq(0);
  });

  it("should not invoke newly set onTargetChanged handler", () => {
    const sut = mount<WidgetTargetProps>(<WidgetTarget
      onTargetChanged={() => { }}
    />);

    target(sut);

    const onTargetChanged = sinon.spy();
    sut.setProps({ onTargetChanged });

    onTargetChanged.callCount.should.eq(0);
  });

  it("should invoke last onTargetChanged handler", () => {
    const sut = mount<WidgetTargetProps>(<WidgetTarget onTargetChanged={() => { }} />);

    const onTargetChanged = sinon.spy();
    sut.setProps({ onTargetChanged });
    target(sut);

    onTargetChanged.calledOnceWithExactly(true).should.true;
  });

  it("should invoke last onTargetChanged handler on unmount", () => {
    const sut = mount<WidgetTargetProps>(<WidgetTarget
      onTargetChanged={() => { }}
    />);

    target(sut);

    const onTargetChanged = sinon.spy();
    sut.setProps({ onTargetChanged });
    onTargetChanged.resetHistory();
    sut.unmount();

    onTargetChanged.callCount.should.eq(1);
    onTargetChanged.calledOnceWithExactly(false).should.true;
  });
});
