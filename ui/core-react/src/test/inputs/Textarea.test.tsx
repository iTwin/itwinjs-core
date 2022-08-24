/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Textarea } from "../../core-react";
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<Textarea />", () => {
  it("renders correctly", () => {
    render(<Textarea />);

    expect(classesFromElement(screen.getByRole("textbox"))).to.include("uicore-inputs-textarea");
  });

  it("renders rows correctly", () => {
    render(<Textarea rows={30} />);

    expect(screen.getByRole<HTMLTextAreaElement>("textbox").rows).to.eq(30);
  });

  it("focus into textarea with setFocus prop", () => {
    const component = render(<Textarea setFocus={true} />);
    const textarea = component.container.querySelector("textarea");

    const element = document.activeElement as HTMLElement;
    expect(element && element === textarea).to.be.true;
  });

  it("input element is properly set", () => {
    const textElementRef = React.createRef<HTMLTextAreaElement>();
    const component = render(<Textarea setFocus={true} ref={textElementRef} />);
    const textNode = component.container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textNode).not.to.be.null;
    expect(textElementRef.current).not.to.be.null;
    expect(textNode).to.be.eq(textElementRef.current);
  });

});
