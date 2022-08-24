/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { render } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { SvgSprite } from "../../core-react";
import { classesFromElement } from "../TestUtils";

describe("<SvgSprite />", () => {
  it("should render className and src", () => {
    const {container: {firstElementChild}} = render(<SvgSprite src="#test-sprite" />);

    expect(classesFromElement(firstElementChild)).to.include("core-icons-svgSprite");
  });
});
