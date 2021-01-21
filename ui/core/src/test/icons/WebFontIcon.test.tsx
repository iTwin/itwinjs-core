/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { render } from "@testing-library/react";
import { WebFontIcon } from "../../ui-core/icons/WebFontIcon";

describe("WebFontIcon", () => {
  it("renders", () => {
    const icon = render(<WebFontIcon iconName="icon-test" title="test icon" style={{ color: "red" }} />);

    expect(icon.container.innerHTML).to.matchSnapshot();
  });
  it("renders with custom font class", () => {
    const icon = render(<WebFontIcon iconClassName="fas" iconName="fas-test" title="fas test icon" style={{ color: "green" }} />);

    expect(icon.container.innerHTML).to.matchSnapshot();
  });
  it("renders specified size", () => {
    const icon = render(<WebFontIcon iconName="icon-test" iconSize="medium" />);

    expect(icon.container.getElementsByClassName("uicore-icons-medium")).to.not.be.empty;
  });
  it("renders specified size with custom font class", () => {
    const icon = render(<WebFontIcon iconClassName="fas" iconName="fas-test" iconSize="medium" />);

    expect(icon.container.getElementsByClassName("uicore-icons-medium")).to.not.be.empty;
  });
  it("renders specified size", () => {
    const icon = render(<WebFontIcon iconName="icon-test" iconSize="x-small" />);

    expect(icon.container.getElementsByClassName("uicore-icons-x-small")).to.not.be.empty;
  });

});
