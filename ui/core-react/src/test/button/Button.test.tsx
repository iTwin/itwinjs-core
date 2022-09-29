/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { Button, ButtonSize, ButtonType } from "../../core-react/button/Button";
import userEvent from "@testing-library/user-event";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<Button />", () => {
  // Lists of ButtonTypes and expected resulting iui classes
  ([[undefined, "iui-cta"],
    [ButtonType.Primary, "iui-cta"],
    [ButtonType.Blue, "iui-high-visibility"],
    [ButtonType.Hollow, "iui-default"],
  ] as ([ButtonType | undefined, string][])).map(([buttonType, expectedClass]) => {

    it(`should have proper class for ${buttonType} button type`, () => {
      render(<Button buttonType={buttonType} />);

      expect(classesFromElement(screen.getByRole("button"))).to.include(expectedClass);
    });

  });

  // List of ButtonSize, expected iui class and assertion (should it be there or not);
  ([[undefined, "iui-small", "does"],
    [ButtonSize.Default, "iui-small", "does"],
    [ButtonSize.Large, "iui-small", "not"],
  ] as ([ButtonSize | undefined, string, "does"|"not"][])).map(([buttonSize, expectedClass, chaiAssertion]) => {

    it(`should have proper class for ${buttonSize} button size`, () => {
      render(<Button size={buttonSize} />);

      expect(classesFromElement(screen.getByRole("button")))[chaiAssertion].include(expectedClass);
    });

  });

  it("handles click", async () => {
    const theUserTo = userEvent.setup();
    const callbackSpy = sinon.spy();
    render(<Button onClick={callbackSpy} />);

    await theUserTo.click(screen.getByRole("button"));

    expect(callbackSpy).to.have.been.called;
  });
});
