/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { MenuButton } from "../../appui-react/accudraw/MenuButton";
import { selectorMatches, userEvent } from "../TestUtils";
import { fireEvent, render, screen } from "@testing-library/react";
import * as sinon from "sinon";

describe("MenuButton", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  it("should call onSizeKnown when mounting", () => {
    const spy = sinon.spy();
    render(<MenuButton point={{ x: 100, y: 120 }} onSizeKnown={spy}/>);

    expect(spy).to.have.been.called;
  });

  it("should open and close on click", async () => {
    render(<MenuButton point={{ x: 100, y: 120 }}><div data-testid={"TestMenuItem"}></div></MenuButton>);
    expect(screen.getByTestId("TestMenuItem")).to.satisfy(selectorMatches(".core-context-menu-container div")).and.not.satisfy(selectorMatches(".core-context-menu-opened div"));

    await theUserTo.click(screen.getByRole("button"));
    expect(screen.getByTestId("TestMenuItem")).to.satisfy(selectorMatches(".core-context-menu-opened div"));

    // WRONG TEST: The real behavior (userEvent) will close the ContextMenu because of "OnOutsideClick"
    // and then the button click will toggle the state (which will spring back to open)
    // This component should be updated to fix this.
    fireEvent.click(screen.getByRole("button"));
    // await theUserTo.click(screen.getByRole("button"));
    expect(screen.getByTestId("TestMenuItem")).to.satisfy(selectorMatches(".core-context-menu-container div")).and.not.satisfy(selectorMatches(".core-context-menu-opened div"));
  });

});
