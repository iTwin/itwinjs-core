/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { HorizontalTabs } from "../../core-react";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<HorizontalTabs />", () => {
  it("should render", () => {
    const {container} = render(<HorizontalTabs labels={[]} />);

    expect(classesFromElement(container.firstElementChild)).to.include("uicore-tabs-horizontal");
  });
});
