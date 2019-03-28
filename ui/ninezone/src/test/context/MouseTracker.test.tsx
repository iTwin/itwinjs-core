/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";

import { MouseTracker, PointProps } from "../../ui-ninezone";

describe("<MouseTracker />", () => {
  let addEventListenerSpy: sinon.SinonSpy | undefined;
  let removeEventListenerSpy: sinon.SinonSpy | undefined;

  afterEach(() => {
    addEventListenerSpy && addEventListenerSpy.restore();
    removeEventListenerSpy && removeEventListenerSpy.restore();
  });

  it("should render", () => {
    mount(<MouseTracker />);
  });

  it("renders correctly", () => {
    shallow(<MouseTracker />).should.matchSnapshot();
  });

  it("should add event listener", () => {
    addEventListenerSpy = sinon.spy(document, "addEventListener");

    mount(<MouseTracker />);
    addEventListenerSpy.calledOnceWith("mousemove").should.true;
  });

  it("should remove event listener", () => {
    removeEventListenerSpy = sinon.spy(document, "removeEventListener");
    const sut = mount(<MouseTracker />);
    sut.unmount();

    removeEventListenerSpy.calledOnceWith("mousemove").should.true;
  });

  it("should notify about position changes", () => {
    const spy = sinon.spy();
    mount(<MouseTracker onPositionChange={spy} />);

    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 40, clientY: 95 }));

    const expected: PointProps = {
      x: 40,
      y: 95,
    };
    spy.calledOnceWith(sinon.match(expected)).should.true;
  });
});
