/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as UiCore from "@bentley/ui-core";
import { createRect } from "../../Utils";

import { Toast } from "../../../ui-ninezone";

describe("<Toast />", () => {
  let timerConstructorStub: sinon.SinonStub | undefined;
  let fakeTimers: sinon.SinonFakeTimers | undefined;
  const rafSpy = sinon.spy((cb: FrameRequestCallback) => {
    return window.setTimeout(cb, 0);
  });

  before(() => {
    window.requestAnimationFrame = rafSpy;
  });

  afterEach(() => {
    timerConstructorStub && timerConstructorStub.restore();
    fakeTimers && fakeTimers.restore();
  });

  it("should render", () => {
    mount(<Toast animateOutTo={React.createRef()} />);
  });

  it("renders correctly", () => {
    shallow(<Toast animateOutTo={React.createRef()} />).should.matchSnapshot();
  });

  it("should stop the timer when unmounting", () => {
    const timer = new UiCore.Timer(1000);
    const stopSpy = sinon.spy(timer, "stop");
    timerConstructorStub = sinon.stub(UiCore, "Timer").returns(timer);

    const sut = mount(<Toast animateOutTo={React.createRef()} />);
    sut.unmount();

    stopSpy.calledOnce.should.true;
  });

  it("should animate out to specified element", () => {
    fakeTimers = sinon.useFakeTimers();

    const ref = React.createRef<HTMLDivElement>();
    const sut = mount(
      <div>
        <Toast animateOutTo={ref} />
        <div ref={ref}></div>
      </div>,
    ).find(".nz-toast").getDOMNode() as HTMLElement;

    // Wait for animation.
    fakeTimers.tick(2000);
    // Wait for 1st raf cb.
    fakeTimers.tick(1);
    // Wait for 2nd raf cb.
    fakeTimers.tick(1);

    expect(sut.style.transform).to.not.undefined;
    expect(sut.style.width).to.eq("0px");
    expect(sut.style.height).to.eq("0px");
  });

  it("should not prepare for animation if component is unmounted", () => {
    fakeTimers = sinon.useFakeTimers();

    const ref = React.createRef<HTMLDivElement>();
    const mounted = mount(
      <div>
        <Toast animateOutTo={ref} />
        <div ref={ref}></div>
      </div>,
    );
    const sut = mounted.find(".nz-toast").getDOMNode() as HTMLDivElement;

    fakeTimers.tick(2000);
    mounted.unmount();
    fakeTimers.tick(1);

    expect(sut.style.width).to.eq("");
    expect(sut.style.height).to.eq("");
  });

  it("should not start animation if component is unmounted", () => {
    fakeTimers = sinon.useFakeTimers();

    const ref = React.createRef<HTMLDivElement>();
    const mounted = mount(
      <div>
        <Toast animateOutTo={ref} />
        <div ref={ref}></div>
      </div>,
    );
    const sut = mounted.find(".nz-toast").getDOMNode() as HTMLDivElement;
    sinon.stub(sut, "getBoundingClientRect").returns(createRect(10, 20, 40, 80));

    fakeTimers.tick(2000);
    fakeTimers.tick(1);
    mounted.unmount();
    fakeTimers.tick(1);

    expect(sut.style.width).to.eq("30px");
    expect(sut.style.height).to.eq("60px");
  });

  it("should notify when toast animates out", () => {
    const spy = sinon.spy();
    const sut = mount(
      <Toast
        animateOutTo={React.createRef()}
        onAnimatedOut={spy}
      />,
    ).find(".nz-toast");

    sut.simulate("transitionEnd");
    spy.calledOnce.should.true;
  });
});
