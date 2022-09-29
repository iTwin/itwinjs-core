/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle, ToggleButtonType } from "../../core-react";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<Toggle />", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  it("renders correctly", () => {
    const {container} = render(
      <Toggle />,
    );

    expect(classesFromElement(container.firstElementChild)).to.include.members(["core-toggle", "core-toggle-rounded"]);
  });

  it("renders large correctly", () => {
    const {container} = render(<Toggle large={true} />);

    expect(classesFromElement(container.firstElementChild)).to.include("core-toggle-large");
  });

  it("Toggle should call onChange handler", async () => {
    const fakeTimers = sinon.useFakeTimers();
    const throttleMs = 16;
    theUserTo = userEvent.setup({
      advanceTimers:(delay) => {
        fakeTimers.tick(delay);
      },
      delay: throttleMs,
    });
    const spyMethod = sinon.spy();

    const {container} = render(<Toggle isOn={false} onChange={spyMethod} />);

    await theUserTo.click(screen.getByRole("checkbox"));
    expect(classesFromElement(container.querySelector(".core-toggle-handle"))).to.include("core-toggling");
    expect(spyMethod).to.be.calledWith(true);

    fakeTimers.tick(1000);
    fakeTimers.restore();
    expect(classesFromElement(container.querySelector(".core-toggle-handle"))).to.not.include("core-toggling");
  });

  it("Toggle should call onBlur handler", () => {
    const spyMethod = sinon.spy();

    const {container} = render(<Toggle isOn={false} onBlur={spyMethod} />);

    fireEvent.blur(screen.getByRole("checkbox"));
    spyMethod.calledOnce.should.false;

    fireEvent.blur(container.firstElementChild!);
    spyMethod.calledOnce.should.true;
  });

  it("Toggle should update on props.isOn change", () => {
    const spyMethod = sinon.spy();

    const {rerender} = render(<Toggle isOn={false} onChange={spyMethod} />);
    expect(screen.getByRole<HTMLInputElement>("checkbox").checked).to.be.false;

    rerender(<Toggle isOn={true} onChange={spyMethod} />);
    expect(screen.getByRole<HTMLInputElement>("checkbox").checked).to.be.true;

    rerender(<Toggle isOn={false} onChange={spyMethod} />);
    expect(screen.getByRole<HTMLInputElement>("checkbox").checked).to.be.false;

    expect(spyMethod).not.to.have.been.called;
  });

  it("Toggle should update on props.disabled change", () => {
    const spyMethod = sinon.spy();
    const handleChange = (_checked: boolean) => {
      spyMethod();
    };

    const {container, rerender} = render(
      // eslint-disable-next-line deprecation/deprecation
      <Toggle isOn={false} onChange={handleChange} disabled={false} buttonType={ToggleButtonType.Primary} showCheckmark={true} rounded={false} />,
    );

    rerender(
      // eslint-disable-next-line deprecation/deprecation
      <Toggle isOn={false} onChange={handleChange} disabled={true} buttonType={ToggleButtonType.Primary} showCheckmark={true} rounded={false} />,
    );

    expect(screen.getByRole<HTMLInputElement>("checkbox").disabled).to.be.true;
    expect(classesFromElement(container.firstElementChild)).to.include("uicore-disabled");
  });

  it("focus into input with setFocus prop", () => {
    render(<Toggle setFocus={true} />);
    const input = screen.getByRole("checkbox");

    expect(document.activeElement).to.eq(input);
  });

});
