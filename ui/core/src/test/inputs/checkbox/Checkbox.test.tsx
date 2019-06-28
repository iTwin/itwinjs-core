/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
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

    expect(checkbox.container.querySelector(".disabled"), "Checkbox class did not get set to 'disabled'").to.not.be.null;
    expect(checkbox.container.querySelector("[disabled]"), "Checkbox tag did not get set as disabled").to.not.be.null;
  });
});
