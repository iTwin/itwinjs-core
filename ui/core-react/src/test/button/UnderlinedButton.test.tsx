/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { UnderlinedButton } from "../../core-react/button/UnderlinedButton";

describe("<UnderlinedButton />", () => {
  it("renders content", () => {
    const button = render(<UnderlinedButton>Test text</UnderlinedButton>);

    // Verify, that Button can be queried by text. Throws if element is not found
    button.getByText("Test text");
  });

  it("renders all props", () => {
    const title = "underlined button";

    const button = render(
      <UnderlinedButton
        title={title}
        className={"test-class"}
      >
        Test text
      </UnderlinedButton>);

    expect((button.container.childNodes[0] as HTMLElement).title).to.equal(title);
    expect(button.container.getElementsByClassName("test-class")).to.not.be.empty;
  });

  it("handles onClick", () => {
    const spyClick = sinon.spy();
    const spyActivate = sinon.spy();

    const button = render(<UnderlinedButton onClick={spyClick} onActivate={spyActivate}>Test text</UnderlinedButton>);

    fireEvent.click(button.container.childNodes[0] as HTMLElement);

    expect(spyClick).to.have.been.calledOnce;
    expect(spyActivate).to.have.been.calledOnce;
  });

  it("handles onActivate", () => {
    const spy = sinon.spy();

    const button = render(<UnderlinedButton onActivate={spy}>Test text</UnderlinedButton>);

    fireEvent.keyUp(button.container.childNodes[0] as HTMLElement, { key: "Enter" });

    expect(spy).to.have.been.calledOnce;
  });
});
