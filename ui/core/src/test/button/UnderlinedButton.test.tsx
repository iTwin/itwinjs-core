/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { render, fireEvent } from "@testing-library/react";
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { UnderlinedButton } from "../../ui-core/button/UnderlinedButton";

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
    const spy = sinon.spy();

    const button = render(<UnderlinedButton onClick={spy}>Test text</UnderlinedButton>);

    fireEvent.click(button.container.childNodes[0] as HTMLElement);

    expect(spy).to.have.been.calledOnce;
  });
});
