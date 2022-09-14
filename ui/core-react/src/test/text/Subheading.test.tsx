/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { Subheading } from "../../core-react";

describe("<Subheading />", () => {
  it("renders correctly", () => {
    render(<Subheading>Tested content</Subheading>);

    expect(screen.getByText("Tested content", {selector: "span.uicore-text-subheading"})).to.exist;
  });
});
