/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as timerModule from "@bentley/ui-core/lib/ui-core/utils/Timer";
import { Toast } from "../../../ui-ninezone";
import { createBoundingClientRect, mount } from "../../Utils";

describe("<Toast />", () => {
  it("should render", () => {
    mount(<Toast />);
  });

  it("renders correctly", () => {
    shallow(<Toast />).should.matchSnapshot();
  });

  it("should stop the timer when unmounting", () => {
    const timer = new timerModule.Timer(1000);
    const stopSpy = sinon.spy(timer, "stop");
    sinon.stub(timerModule, "Timer").returns(timer);

    const sut = mount(<Toast />);
    sut.unmount();

    stopSpy.calledOnce.should.true;
  });

  it("should animate out to specified element", () => {
    const fakeTimers = sinon.useFakeTimers();

    const animateOutTo = document.createElement("div");
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const sut = mount(<Toast
      animateOutTo={animateOutTo}
    />).find(".nz-toast").getDOMNode() as HTMLElement;

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
    const fakeTimers = sinon.useFakeTimers();

    const animateOutTo = document.createElement("div");
    const mounted = mount(<Toast
      animateOutTo={animateOutTo}
    />);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const sut = mounted.find(".nz-toast").getDOMNode() as HTMLDivElement;

    fakeTimers.tick(2000);
    mounted.unmount();
    fakeTimers.tick(1);

    expect(sut.style.width).to.eq("");
    expect(sut.style.height).to.eq("");
  });

  it("should not start animation if component is unmounted", () => {
    const fakeTimers = sinon.useFakeTimers();

    const animateOutTo = document.createElement("div");
    const mounted = mount(<Toast
      animateOutTo={animateOutTo}
    />);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const sut = mounted.find(".nz-toast").getDOMNode() as HTMLDivElement;
    sinon.stub(sut, "getBoundingClientRect").returns(createBoundingClientRect(10, 20, 40, 80));

    fakeTimers.tick(2000);
    fakeTimers.tick(1);
    mounted.unmount();
    fakeTimers.tick(1);

    expect(sut.style.width).to.eq("30px");
    expect(sut.style.height).to.eq("60px");
  });

  it("should notify when toast animates out", () => {
    const spy = sinon.spy();
    const sut = mount(<Toast
      onAnimatedOut={spy}
    />).find(".nz-toast");

    sut.simulate("transitionEnd");
    spy.calledOnce.should.true;
  });
});
