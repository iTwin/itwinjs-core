/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { MinimalFeaturedTile } from "../../core-react";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<MinimalFeaturedTile />", () => {
  const icon = <i className="icon icon-placeholder" />;

  it("renders correctly", () => {
    const {container} = render(<MinimalFeaturedTile title="Test" icon={icon} />);

    expect(classesFromElement(container.firstElementChild)).to.include.members(["uicore-featured", "uicore-minimal"]);
  });
});
