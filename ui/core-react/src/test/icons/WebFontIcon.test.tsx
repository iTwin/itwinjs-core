/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { WebFontIcon } from "../../core-react/icons/WebFontIcon";
import { classesFromElement } from "../TestUtils";

describe("WebFontIcon", () => {
  it("renders with custom font class", () => {
    render(<WebFontIcon iconClassName="fas" iconName="fas-test" title="fas test icon" style={{ color: "green" }} />);

    expect(classesFromElement(screen.getByRole("presentation"))).to.include.members(["fas", "fas-test"]).and.not.include("bui-webfont-icon");
  });
  it("renders specified size and default class name", () => {
    render(<WebFontIcon iconName="icon-test" iconSize="medium" />);

    expect(classesFromElement(screen.getByRole("presentation"))).to.include.members(["uicore-icons-medium", "bui-webfont-icon"]);
  });
  it("renders specified size with custom font class", () => {
    render(<WebFontIcon iconClassName="fas" iconName="fas-test" iconSize="medium" />);

    expect(classesFromElement(screen.getByRole("presentation"))).to.include.members(["uicore-icons-medium", "fas", "fas-test"]);
  });
  it("renders specified size", () => {
    render(<WebFontIcon iconName="icon-test" iconSize="x-small" />);

    expect(classesFromElement(screen.getByRole("presentation"))).to.include("uicore-icons-x-small");
  });

});
