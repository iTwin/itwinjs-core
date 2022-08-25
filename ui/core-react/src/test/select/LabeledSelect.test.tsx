/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { InputStatus, LabeledSelect } from "../../core-react";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<LabeledSelect />", () => {
  it("should render", () => {
    render(<LabeledSelect label="select test" options={[]} />);

    expect(screen.getByLabelText("select test")).to.eq(screen.getByRole("combobox"));
  });

  it("renders disabled correctly", () => {
    const {container} = render(<LabeledSelect label="select test" disabled options={[]} />);

    expect(classesFromElement(container.firstElementChild)).to.include("uicore-disabled");
  });

  it("renders status correctly", () => {
    const {container} = render(<LabeledSelect label="select test" status={InputStatus.Success} options={[]} />);

    expect(classesFromElement(container.firstElementChild)).to.include("success");
  });

  it("renders message correctly", () => {
    render(<LabeledSelect label="select test" message={"Test message"} options={[]} />);

    expect(screen.getByText("Test message", {selector: ".uicore-message"})).to.exist;
  });

  it("renders array options correctly", () => {
    render(<LabeledSelect label="select test" options={["Option 1", "Option 2", "Option 3"]} />);

    expect(screen.getByRole("option", {name: "Option 1"})).to.exist;
    expect(screen.getByRole("option", {name: "Option 2"})).to.exist;
    expect(screen.getByRole("option", {name: "Option 3"})).to.exist;
  });

  it("renders object options correctly", () => {
    render(<LabeledSelect label="select test" options={{ option1: "Option 1", option2: "Option 2", option3: "Option 3" }} />);

    expect(screen.getByRole("option", {name: "Option 1"})).to.exist;
    expect(screen.getByRole("option", {name: "Option 2"})).to.exist;
    expect(screen.getByRole("option", {name: "Option 3"})).to.exist;
  });
});
