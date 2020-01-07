/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render, fireEvent } from "@testing-library/react";
import { expect } from "chai";
import { Checkbox } from "../../../ui-core/inputs/checkbox/Checkbox";
import { InputStatus } from "../../../ui-core/inputs/InputStatus";

describe("Checkbox", () => {
  it("renders", () => {
    const checkbox = render(<Checkbox />);

    expect(checkbox.container.querySelector("input[type='checkbox']")).not.to.be.null;
  });

  it("renders with id", () => {
    const checkbox = render(<Checkbox id="test" />);

    expect(checkbox.container.querySelector("#test")).not.to.be.null;
  });

  it("renders with label", () => {
    const checkbox = render(<Checkbox label="Test checkbox" />);

    expect(checkbox.container.querySelector(".core-checkbox-label")).not.to.be.null;
  });

  it("renders input status when it's provided", () => {
    const checkbox = render(<Checkbox label="Test checkbox" status={InputStatus.Error} />);

    expect(checkbox.container.querySelector(`.${InputStatus.Error}`)).to.not.be.null;
  });

  it("renders properly as disabled", () => {
    const checkbox = render(<Checkbox label="Test checkbox" disabled={true} />);

    expect((checkbox.container.childNodes[0] as HTMLElement).querySelector("[disabled]"), "Checkbox tag did not get set to 'disabled'").to.not.be.null;
  });

  it("allows stopping click propagation", () => {
    const outsideClickSpy = sinon.spy();
    const checkboxClickSpy = sinon.fake((e: React.MouseEvent) => e.stopPropagation());
    const changeSpy = sinon.spy();
    const result = render(
      <div onClick={outsideClickSpy}>
        <Checkbox label="Test checkbox" onClick={checkboxClickSpy} onChange={changeSpy} />
      </div>,
    );
    const divElement = result.container.childNodes[0] as HTMLDivElement;
    fireEvent.click(divElement.childNodes[0] as HTMLElement);
    expect(checkboxClickSpy).to.be.calledOnce;
    expect(changeSpy).to.be.calledOnce;
    expect(outsideClickSpy).to.not.be.called;
  });

  it("focus into checkbox with setFocus prop", () => {
    const checkbox = render(<Checkbox label="Test checkbox" setFocus={true} />);
    const input = checkbox.container.querySelector("input[type='checkbox']");

    const element = document.activeElement as HTMLElement;
    expect(element && element === input).to.be.true;
  });

});
