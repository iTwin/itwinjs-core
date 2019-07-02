/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";

import { withIsPressed } from "../../ui-core";

describe("withIsPressed", () => {

  const WithIsPressedDiv = withIsPressed((props) => (<div {...props} />)); // tslint:disable-line:variable-name

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
