/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { SmallText } from "../../core-react";

describe("<SmallText />", () => {
  it("renders correctly", () => {
    render(<SmallText>Tested content</SmallText>);

    expect(screen.getByText("Tested content", {selector: "span.uicore-text-small"})).to.exist;
  });
});
