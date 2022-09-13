/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { Tile } from "../../core-react";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<Tile />", () => {

  it("renders correctly", () => {
    render(<Tile title="Test"/>);

    expect(screen.getByText("Test", {selector: ".uicore-tiles-tile .uicore-link .uicore-title"})).to.exist;
  });

  it("renders string icon correctly", () => {
    const {container} = render(<Tile title="Test" icon="icon-placeholder" />);

    expect(container.querySelector(".icon.icon-placeholder")).to.exist;
  });

  it("renders node icon correctly", () => {
    render(<Tile title="Test" icon={<i data-testid="my-test-icon" />} />);

    expect(screen.getByTestId("my-test-icon")).to.exist;
  });

  it("renders correct featured", () => {
    const {container} = render(<Tile title="Test" featured={true} />);

    expect(classesFromElement(container.firstElementChild)).to.include("uicore-featured");
  });

  it("render correct minimal", () => {
    const {container} = render(<Tile title="Test" minimal={true}>Content</Tile>);

    expect(classesFromElement(container.firstElementChild)).to.include("uicore-minimal");
    expect(screen.queryByText("Content")).to.be.null;
  });

  it("has correct step className 0", () => {
    const {container} = render(<Tile title="Test" stepCount={12} />);

    expect(classesFromElement(container.firstElementChild)).to.include("uicore-step-0");
  });

  it("has correct step className 5", () => {
    const {container} = render(<Tile title="Test" stepNum={5} stepCount={12} />);

    expect(classesFromElement(container.firstElementChild)).to.include("uicore-step-5");
  });

  it("renders children correctly", () => {
    render(<Tile title="Test">This is child text</Tile>);

    expect(screen.getByText("This is child text", {selector: ".uicore-children"}));
  });
});
