/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { render } from "@testing-library/react";
import { FlatItemNestedBorderWrapper } from "../../../components-react/propertygrid/component/FlatItemNestedBorderWrapper";

describe("FlatItemNestedBorderWrapper", () => {
  /**
   * Creates a selector string to test appropriate amount of nested border wrappers.
   * @example: expectedSelector(".outer", 2, 1, ".inner", ".inner_wrapper") => ".outer > .nested-border-middle > .nested-border-middle.nested-border-bottom > .inner_wrapper > .inner".
   * @param outerClass ClassName of outer class. This is needed to ensure we are not just checking part of the border chain.
   * @param borderCount Amount of expected borders.
   * @param bottomBorderCount Amount of expected bottom borders, starting with deepest border.
   * @param innerClassName className of wrapped element.
   * @param wrapperClassName className of wrapper element. Defaults to div element if not provided.
   */
  function expectedSelector(outerClass: string, borderCount: number, bottomBorderCount: number, innerClassName: string, wrapperClassName?: string) {
    const selectors: string[] = [];
    const bottomBorderSelectors: string[] = [];
    for (let index = 0; index < bottomBorderCount; index++) {
      bottomBorderSelectors.push(".nested-border-bottom");
    }

    for (let index = 0; index < borderCount; index++) {
      const bottomBorderSelector = bottomBorderSelectors[index] ?? ":not(.nested-border-bottom)";
      selectors.push(`.nested-border-middle${bottomBorderSelector}`);
    }

    selectors.reverse();
    selectors.unshift(outerClass);
    selectors.push(wrapperClassName ?? "div");
    selectors.push(innerClassName);

    return selectors.join(" > ");
  }

  it("renders inner content when border count 0", () => {
    const { container } = render(
      <div className="outerClass">
        <FlatItemNestedBorderWrapper borderCount={0} bottomBorderCount={0}>
          <div className="content">Test string</div>
        </FlatItemNestedBorderWrapper>
      </div>);

    const insideContent = container.querySelector(expectedSelector(".outerClass", 0, 0, ".content"));
    expect(insideContent).to.not.be.null;
  });

  it("renders inner content within class when item class set and border count 0", () => {
    const { container } = render(
      <div className="outerClass">
        <FlatItemNestedBorderWrapper className="wrapper" borderCount={0} bottomBorderCount={0}>
          <div className="content">Test string</div>
        </FlatItemNestedBorderWrapper>
      </div>);

    const insideContent = container.querySelector(expectedSelector(".outerClass", 0, 0, ".content", ".wrapper"));
    expect(insideContent).to.not.be.null;
  });

  it("renders correct amount of borders when item class set and border count 1", () => {
    const { container } = render(
      <div className="outerClass">
        <FlatItemNestedBorderWrapper className="wrapper" borderCount={1} bottomBorderCount={0}>
          <div className="content">Test string</div>
        </FlatItemNestedBorderWrapper>
      </div>);

    const insideContent = container.querySelector(expectedSelector(".outerClass", 1, 0, ".content", ".wrapper"));
    expect(insideContent).to.not.be.null;
  });

  it("renders correct amount of borders when item class set and border count 1 and bottom border count 1", () => {
    const { container } = render(
      <div className="outerClass">
        <FlatItemNestedBorderWrapper className="wrapper" borderCount={1} bottomBorderCount={1}>
          <div className="content">Test string</div>
        </FlatItemNestedBorderWrapper>);
      </div>);

    const insideContent = container.querySelector(expectedSelector(".outerClass", 1, 1, ".content", ".wrapper"));
    expect(insideContent).to.not.be.null;
  });

  it("renders correct amount of borders when item class set and border count 1 and bottom border count 2", () => {
    const { container } = render(
      <div className="outerClass">
        <FlatItemNestedBorderWrapper className="inner_wrapper" borderCount={1} bottomBorderCount={2}>
          <div className="inner">Test string</div>
        </FlatItemNestedBorderWrapper>);
      </div>);

    const insideContent = container.querySelector(expectedSelector(".outerClass", 1, 2, ".inner", ".inner_wrapper"));
    expect(insideContent).to.not.be.null;
  });

  it("renders correct amount of borders when item class set and border count 5 and bottom border count 2", () => {
    const { container } = render(
      <div className="outerClass">
        <FlatItemNestedBorderWrapper className="inner_wrapper" borderCount={5} bottomBorderCount={2}>
          <div className="inner">Test string</div>
        </FlatItemNestedBorderWrapper>);
      </div>);

    const insideContent = container.querySelector(expectedSelector(".outerClass", 5, 2, ".inner", ".inner_wrapper"));
    expect(insideContent).to.not.be.null;
  });

  it("renders correct amount of borders when item class set and border count 10 and bottom border count 10", () => {
    const { container } = render(
      <div className="outerClass">
        <FlatItemNestedBorderWrapper className="inner_wrapper" borderCount={10} bottomBorderCount={10}>
          <div className="inner">Test string</div>
        </FlatItemNestedBorderWrapper>);
      </div>);

    const insideContent = container.querySelector(expectedSelector(".outerClass", 10, 10, ".inner", ".inner_wrapper"));
    expect(insideContent).to.not.be.null;
  });
});
