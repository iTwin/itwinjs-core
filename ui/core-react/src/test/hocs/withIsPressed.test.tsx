/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { withIsPressed } from "../../core-react";

describe("withIsPressed", () => {

  const WithIsPressedDiv = withIsPressed((props) => (<div {...props} />)); // eslint-disable-line @typescript-eslint/naming-convention

  it("should render", () => {
    mount(<WithIsPressedDiv isPressed={false} />);
  });

  it("renders correctly", () => {
    shallow(<WithIsPressedDiv isPressed={false} />).should.matchSnapshot();
  });

  it("mousedown event", () => {
    let iAmPressed = false;
    const spyMethod = sinon.spy();

    function handlePressedChange(isPressed: boolean) {
      iAmPressed = isPressed;
      spyMethod();
    }

    const wrapper = mount(<WithIsPressedDiv isPressed={iAmPressed} onIsPressedChange={handlePressedChange} />);
    const div = wrapper.find("div.withispressed-wrapper");

    const e1 = new MouseEvent("mousedown", { clientX: 0, clientY: 0 });
    div.simulate("mousedown", e1);
    expect(spyMethod.calledOnce).to.be.true;
    expect(iAmPressed).to.eq(true);
  });

  it("mouseup event", () => {
    let iAmPressed = true;
    const spyMethod = sinon.spy();

    function handlePressedChange(isPressed: boolean) {
      iAmPressed = isPressed;
      spyMethod();
    }

    const wrapper = mount(<WithIsPressedDiv isPressed={iAmPressed} onIsPressedChange={handlePressedChange} />);
    const div = wrapper.find("div.withispressed-wrapper");

    const e1 = new MouseEvent("mouseup", { clientX: 0, clientY: 0 });
    div.simulate("mouseup", e1);
    expect(spyMethod.calledOnce).to.be.true;
    expect(iAmPressed).to.eq(false);
  });

  it("mouseup event when not pressed", () => {
    let iAmPressed = false;
    const spyMethod = sinon.spy();

    function handlePressedChange(isPressed: boolean) {
      iAmPressed = isPressed;
      spyMethod();
    }

    const wrapper = mount(<WithIsPressedDiv isPressed={iAmPressed} onIsPressedChange={handlePressedChange} />);
    const div = wrapper.find("div.withispressed-wrapper");

    const e1 = new MouseEvent("mouseup", { clientX: 0, clientY: 0 });
    div.simulate("mouseup", e1);
    expect(spyMethod.calledOnce).to.be.false;
    expect(iAmPressed).to.eq(false);
  });

  it("mouseleave event", () => {
    let iAmPressed = true;
    const spyMethod = sinon.spy();

    function handlePressedChange(isPressed: boolean) {
      iAmPressed = isPressed;
      spyMethod();
    }

    const wrapper = mount(<WithIsPressedDiv isPressed={iAmPressed} onIsPressedChange={handlePressedChange} />);
    const div = wrapper.find("div.withispressed-wrapper");

    const e1 = new MouseEvent("mouseenter", { clientX: 0, clientY: 0 });
    div.simulate("mouseenter", e1);
    const e2 = new MouseEvent("mouseleave", { clientX: 0, clientY: 0 });
    div.simulate("mouseleave", e2);
    expect(spyMethod.calledOnce).to.be.true;
    expect(iAmPressed).to.eq(false);
  });

});
