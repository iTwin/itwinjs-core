/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { expect } from "chai";
import { WebFontIcon } from "../../ui-core/icons/WebFontIcon";

describe("WebFontIcon", () => {
  it("renders", () => {
    const icon = render(<WebFontIcon iconName="icon-test" title="test icon" style={{ color: "red" }} />);

    expect(icon.container.innerHTML).to.matchSnapshot();
  });
  it("renders specified size", () => {
    const icon = render(<WebFontIcon iconName="icon-test" iconSize="medium" />);

    expect(icon.container.getElementsByClassName("uicore-icons-medium")).to.not.be.empty;
  });
});
