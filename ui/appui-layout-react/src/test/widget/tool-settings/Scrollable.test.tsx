/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { ScrollableToolSettings } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<ScrollableToolSettings />", () => {
  it("should render", () => {
    mount(<ScrollableToolSettings />);
  });

  it("renders correctly", () => {
    shallow(<ScrollableToolSettings />).should.matchSnapshot();
  });

  it("renders correctly with top indicator", () => {
    const sut = shallow<ScrollableToolSettings>(<ScrollableToolSettings />);
    sut.setState({
      isTopIndicatorVisible: true,
    });
    sut.should.matchSnapshot();
  });

  it("renders correctly with bottom indicator", () => {
    const sut = shallow<ScrollableToolSettings>(<ScrollableToolSettings />);
    sut.setState({
      isBottomIndicatorVisible: true,
    });
    sut.should.matchSnapshot();
  });

  it("should not scroll if content ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    sinon.stub(React, "createRef").returns(ref);
    const rafSpy = sinon.spy(window, "requestAnimationFrame");

    const sut = mount<ScrollableToolSettings>(<ScrollableToolSettings />);
    sut.setState({
      isBottomIndicatorVisible: true,
    });
    const indicator = sut.find(".nz-indicator.nz-bottom .nz-triangle");
    indicator.simulate("click");

    rafSpy.notCalled.should.true;
  });

  it("should scroll bottom", () => {
    const fakeTimers = sinon.useFakeTimers();
    const rafSpy = sinon.spy(window, "requestAnimationFrame");
    const sut = mount<ScrollableToolSettings>(<ScrollableToolSettings />);
    sut.setState({
      isBottomIndicatorVisible: true,
    });
    const content = sut.find(".nz-content");
    const contentElement = content.getDOMNode();
    const scrollTopGetter = sinon.spy();
    const scrollTopSetter = sinon.spy();
    sinon.stub(contentElement, "scrollTop").get(scrollTopGetter).set(scrollTopSetter);
    const indicator = sut.find(".nz-indicator.nz-bottom .nz-triangle");

    indicator.simulate("click");
    scrollTopGetter.calledOnce.should.true;
    rafSpy.calledOnce.should.true;

    const dateNowStub = sinon.stub(Date, "now").returns(0);
    fakeTimers.tick(1);
    scrollTopSetter.calledOnce.should.true;
    rafSpy.calledTwice.should.true;

    dateNowStub.returns(200);
    fakeTimers.tick(200);
    scrollTopSetter.calledTwice.should.true;
    rafSpy.calledTwice.should.true;
  });

  it("should scroll top", () => {
    const rafSpy = sinon.spy(window, "requestAnimationFrame");
    const sut = mount<ScrollableToolSettings>(<ScrollableToolSettings />);
    sut.setState({
      isTopIndicatorVisible: true,
    });
    const content = sut.find(".nz-content");
    const contentElement = content.getDOMNode();
    const scrollTopGetter = sinon.spy();
    const scrollTopSetter = sinon.spy();
    sinon.stub(contentElement, "scrollTop").get(scrollTopGetter).set(scrollTopSetter);
    const indicator = sut.find(".nz-indicator .nz-triangle");

    indicator.simulate("click");
    scrollTopGetter.calledOnce.should.true;
    rafSpy.calledOnce.should.true;
  });
});
