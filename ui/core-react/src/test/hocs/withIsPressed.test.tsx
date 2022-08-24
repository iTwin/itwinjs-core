/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { withIsPressed } from "../../core-react";

describe("withIsPressed", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  const WithIsPressedDiv = withIsPressed((props) => (<div {...props} />)); // eslint-disable-line @typescript-eslint/naming-convention

  it("mousedown event", async () => {
    let iAmPressed = false;
    const spyMethod = sinon.spy();

    function handlePressedChange(isPressed: boolean) {
      iAmPressed = isPressed;
      spyMethod();
    }

    render(<WithIsPressedDiv isPressed={iAmPressed} onIsPressedChange={handlePressedChange} data-testid="tested" />);
    await theUserTo.pointer({keys: "[MouseLeft>]", target: screen.getByTestId("tested")});

    expect(spyMethod.calledOnce).to.be.true;
    expect(iAmPressed).to.eq(true);
  });

  it("mouseup event", async () => {
    let iAmPressed = true;
    const spyMethod = sinon.spy();

    function handlePressedChange(isPressed: boolean) {
      iAmPressed = isPressed;
      spyMethod();
    }

    render(<WithIsPressedDiv isPressed={iAmPressed} onIsPressedChange={handlePressedChange} data-testid="tested" />);
    await theUserTo.pointer({keys: "[MouseLeft>]", target: screen.getByTestId("tested")});

    spyMethod.resetHistory();

    await theUserTo.pointer("[/MouseLeft]");

    expect(spyMethod.calledOnce).to.be.true;
    expect(iAmPressed).to.eq(false);
  });

  it("mouseup event when not pressed", async () => {
    let iAmPressed = false;
    const spyMethod = sinon.spy();

    function handlePressedChange(isPressed: boolean) {
      iAmPressed = isPressed;
      spyMethod();
    }

    render(<WithIsPressedDiv isPressed={iAmPressed} onIsPressedChange={handlePressedChange} data-testid="tested" />);
    await theUserTo.pointer(["[MouseLeft>]", {target: screen.getByTestId("tested")}, "[/MouseLeft]"]);

    expect(spyMethod.calledOnce).to.be.false;
    expect(iAmPressed).to.eq(false);
  });

  it("mouseleave event", async () => {
    let iAmPressed = true;
    const spyMethod = sinon.spy();

    function handlePressedChange(isPressed: boolean) {
      iAmPressed = isPressed;
      spyMethod();
    }

    render(<WithIsPressedDiv isPressed={iAmPressed} onIsPressedChange={handlePressedChange} data-testid="tested" />);
    await theUserTo.hover(screen.getByTestId("tested"));
    await theUserTo.unhover(screen.getByTestId("tested"));

    expect(spyMethod.calledOnce).to.be.true;
    expect(iAmPressed).to.eq(false);
  });

});
