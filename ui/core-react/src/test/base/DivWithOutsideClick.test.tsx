/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { DivWithOutsideClick } from "../../core-react";

describe("<DivWithOutsideClick />", () => {
  it("should use onOutsideClick", async () => {
    const theUserTo = userEvent.setup();
    const spyMethod = sinon.spy();
    render(<div><button>Outside</button><DivWithOutsideClick onOutsideClick={spyMethod}>Inside</DivWithOutsideClick></div>);

    await theUserTo.click(screen.getByText("Inside"));
    expect(spyMethod).to.not.have.been.called;

    await theUserTo.click(screen.getByRole("button"));
    expect(spyMethod).to.have.been.calledOnce;
  });
});
