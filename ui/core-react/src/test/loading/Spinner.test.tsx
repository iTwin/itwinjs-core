/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { Spinner, SpinnerSize } from "../../core-react";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<Spinner />", () => {
  ([[SpinnerSize.Small, "small"],
    [SpinnerSize.Medium, "medium"],
    [SpinnerSize.Large, "large"],
    [SpinnerSize.XLarge, "xlarge"],
  ] as [SpinnerSize, string][])
    .map(([propSize, size]) => {
      it(`should render ${size}`, () => {
        const {container} = render(<Spinner size={propSize} />);

        expect(classesFromElement(container.firstElementChild)).to.include(`core-spinner-${size}`);
      });
    });

  it("should render with sizeClass", () => {
    const {container} = render(<Spinner sizeClass="test-class" />);

    expect(classesFromElement(container.firstElementChild)).to.include("test-class");
  });

});
