/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { ScrollableToolSettings } from "../../../ui-ninezone";

describe("<ScrollableToolSettings />", () => {
  let createRefStub: sinon.SinonStub | undefined;
  let dateNowStub: sinon.SinonStub | undefined;
  let fakeTimers: sinon.SinonFakeTimers | undefined;
  const rafSpy = sinon.spy((cb: FrameRequestCallback) => {
    return window.setTimeout(cb, 1);
  });

  before(() => {
    window.requestAnimationFrame = rafSpy;
  });

  afterEach(() => {
    createRefStub && createRefStub.restore();
    dateNowStub && dateNowStub.restore();
    fakeTimers && fakeTimers.restore();
    rafSpy.resetHistory();
  });

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
    createRefStub = sinon.stub(React, "createRef");
    createRefStub.returns(ref);

    const sut = mount<ScrollableToolSettings>(<ScrollableToolSettings />);
    sut.setState({
      isBottomIndicatorVisible: true,
    });
    const indicator = sut.find(".nz-indicator.nz-bottom .nz-triangle");
    indicator.simulate("click");

    rafSpy.notCalled.should.true;
  });

  it("should scroll bottom", () => {
    fakeTimers = sinon.useFakeTimers();
    const sut = mount<ScrollableToolSettings>(<ScrollableToolSettings />);
    sut.setState({
      isBottomIndicatorVisible: true,
    });
    const content = sut.find(".nz-content");
    const contentElement = content.getDOMNode() as HTMLDivElement;
    const scrollTopGetter = sinon.spy();
    const scrollTopSetter = sinon.spy();
    sinon.stub(contentElement, "scrollTop").get(scrollTopGetter).set(scrollTopSetter);
    const indicator = sut.find(".nz-indicator.nz-bottom .nz-triangle");

    indicator.simulate("click");
    scrollTopGetter.calledOnce.should.true;
    rafSpy.calledOnce.should.true;

    dateNowStub = sinon.stub(Date, "now").returns(0);
    fakeTimers.tick(1);
    scrollTopSetter.calledOnce.should.true;
    rafSpy.calledTwice.should.true;

    dateNowStub.returns(200);
    fakeTimers.tick(200);
    scrollTopSetter.calledTwice.should.true;
    rafSpy.calledTwice.should.true;
  });

  it("should scroll top", () => {
    fakeTimers = sinon.useFakeTimers();
    const sut = mount<ScrollableToolSettings>(<ScrollableToolSettings />);
    sut.setState({
      isTopIndicatorVisible: true,
    });
    const content = sut.find(".nz-content");
    const contentElement = content.getDOMNode() as HTMLDivElement;
    const scrollTopGetter = sinon.spy();
    const scrollTopSetter = sinon.spy();
    sinon.stub(contentElement, "scrollTop").get(scrollTopGetter).set(scrollTopSetter);
    const indicator = sut.find(".nz-indicator .nz-triangle");

    indicator.simulate("click");
    scrollTopGetter.calledOnce.should.true;
    rafSpy.calledOnce.should.true;
  });
});
