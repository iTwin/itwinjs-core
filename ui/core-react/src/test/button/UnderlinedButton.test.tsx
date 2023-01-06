/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { render, screen } from "@testing-library/react";
import { UnderlinedButton } from "../../core-react/button/UnderlinedButton";
import userEvent from "@testing-library/user-event";

describe("<UnderlinedButton />", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  it("renders all props", () => {
    const title = "underlined button";

    render(
      <UnderlinedButton
        title={title}
        className={"test-class"}
      >
        Test text
      </UnderlinedButton>);

    const button = screen.getByRole("link");
    expect(button.className).to.include("test-class");
  });

  it("handles onClick", async () => {
    const spyClick = sinon.spy();
    const spyActivate = sinon.spy();

    render(<UnderlinedButton onClick={spyClick} onActivate={spyActivate}>Test text</UnderlinedButton>);

    await theUserTo.click(screen.getByRole("link"));

    expect(spyClick).to.have.been.calledOnce;
    expect(spyActivate).to.have.been.calledOnce;
  });

  ["[Enter]", "[Space]"].map((pressedKey) => {

    it(`handles onActivate for ${pressedKey} key`, async () => {
      const spyClick = sinon.spy();
      const spyActivate = sinon.spy();

      render(<UnderlinedButton onClick={spyClick} onActivate={spyActivate}>Test text</UnderlinedButton>);
      await theUserTo.tab();
      await theUserTo.type(screen.getByRole("link"), pressedKey, {skipClick: true});

      expect(spyClick).to.not.have.been.calledOnce;
      expect(spyActivate).to.have.been.calledOnce;
    });
  });
});
