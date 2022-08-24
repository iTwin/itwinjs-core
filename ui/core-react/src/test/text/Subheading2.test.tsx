/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { Subheading2 } from "../../core-react";

describe("<Subheading2 />", () => {
  it("renders correctly", () => {
    render(<Subheading2>Tested content</Subheading2>);

    expect(screen.getByText("Tested content", {selector: "span.uicore-text-subheading-2"})).to.exist;
  });
});
