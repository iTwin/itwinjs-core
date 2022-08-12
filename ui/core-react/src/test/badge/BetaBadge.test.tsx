/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { BetaBadge } from "../../core-react";

describe("<BetaBadge />", () => {
  it("renders correctly", () => {
    const {container} = render(<BetaBadge />);

    expect(container.getElementsByClassName("core-badge-betaBadge")).to.have.lengthOf(1);
  });

  it("applies className", () => {
    const {container} = render(<BetaBadge className="testClass" />);

    expect(container.getElementsByClassName("testClass")).to.have.lengthOf(1);
  });
});
