/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { Title2 } from "../../core-react";

describe("<Title2 />", () => {
  it("renders correctly", () => {
    render(<Title2>Tested content</Title2>);

    expect(screen.getByText("Tested content", {selector: "span.uicore-text-title-2"})).to.exist;
  });
});
