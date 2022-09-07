/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { NewBadge } from "../../core-react";

describe("<NewBadge />", () => {
  it("renders correctly", () => {
    const {container} = render(<NewBadge />);

    expect(container.getElementsByClassName("core-new-badge")).to.have.lengthOf(1);
  });

  it("applies className", () => {
    const {container} = render(<NewBadge className="testClass" />);

    expect(container.getElementsByClassName("testClass")).to.have.lengthOf(1);
  });
});
