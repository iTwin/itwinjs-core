/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { render, screen } from "@testing-library/react";
import { Select } from "../../core-react";

/* eslint-disable deprecation/deprecation */

describe("<Select />", () => {
  it("renders correctly", () => {
    render(<Select options={[]} />);

    expect(screen.getByRole("combobox")).to.exist;
  });

  it("renders defaultValue correctly", () => {
    render(<Select options={["first", "test"]} defaultValue="test" />);

    expect(screen.getByRole<HTMLSelectElement>("combobox").value).to.eq("test");
    expect(screen.getByRole<HTMLOptionElement>("option", {name: "test"}).selected).to.be.true;
  });

  it("renders value correctly", () => {
    const spy = sinon.spy();
    render(<Select options={["first", "test"]} value="test" onChange={spy}/>);

    expect(screen.getByRole<HTMLSelectElement>("combobox").value).to.eq("test");
    expect(screen.getByRole<HTMLOptionElement>("option", {name: "test"}).selected).to.be.true;
  });

  it("renders placeholder correctly", () => {
    render(<Select options={[]} placeholder="test" />);

    expect(screen.getByRole<HTMLOptionElement>("option", {name: "test"}).selected).to.be.true;
  });

  it("renders array options correctly", () => {
    render(<Select options={["Option 1", "Option 2", "Option 3"]} />);

    expect(screen.getByRole("option", {name: "Option 1"})).to.exist;
    expect(screen.getByRole("option", {name: "Option 2"})).to.exist;
    expect(screen.getByRole("option", {name: "Option 3"})).to.exist;
  });

  it("renders SelectOption[] array options correctly", () => {
    render(<Select options={[{ label: "Option 1", value: "option1" }, { label: "Option 2", value: "option2" }, { label: "Option 3", value: "option3" }]} />);

    expect(screen.getByRole("option", {name: "Option 1"})).to.exist;
    expect(screen.getByRole("option", {name: "Option 2"})).to.exist;
    expect(screen.getByRole("option", {name: "Option 3"})).to.exist;
  });

  it("renders array options with disabled correctly", () => {
    render(<Select options={[{ label: "Option 1", disabled: true }, "Option 2", "Option 3"]} />);

    expect(screen.getByRole<HTMLOptionElement>("option", {name: "Option 1"}).disabled).to.be.true;
    expect(screen.getByRole<HTMLOptionElement>("option", {name: "Option 2"}).disabled).to.be.false;
    expect(screen.getByRole<HTMLOptionElement>("option", {name: "Option 3"}).disabled).to.be.false;
  });

  it("renders object options correctly", () => {
    render(<Select options={{ option1: "Option 1", option2: "Option 2", option3: "Option 3" }} />);

    expect(screen.getByRole("option", {name: "Option 1"})).to.exist;
    expect(screen.getByRole("option", {name: "Option 2"})).to.exist;
    expect(screen.getByRole("option", {name: "Option 3"})).to.exist;
  });

  it("renders object options with disabled correctly", () => {
    render(<Select options={{ option1: { label: "Option 1", disabled: true }, option2: "Option 2", option3: "Option 3" }} />);

    expect(screen.getByRole<HTMLOptionElement>("option", {name: "Option 1"}).disabled).to.be.true;
    expect(screen.getByRole<HTMLOptionElement>("option", {name: "Option 2"}).disabled).to.be.false;
    expect(screen.getByRole<HTMLOptionElement>("option", {name: "Option 3"}).disabled).to.be.false;
  });

  it("renders placeholder correctly when options are provided", () => {
    render(<Select options={{ option1: "Option 1", option2: "Option 2", option3: "Option 3" }} placeholder="place-holder-text" />);

    expect(screen.getByRole<HTMLSelectElement>("combobox").value).to.eq("placeholder");
    expect(screen.getByRole<HTMLOptionElement>("option", {name: "place-holder-text"}).selected).to.be.true;
    expect(screen.getByRole("option", {name: "Option 1"})).to.exist;
    expect(screen.getByRole("option", {name: "Option 2"})).to.exist;
    expect(screen.getByRole("option", {name: "Option 3"})).to.exist;
  });

  it("focus into select with setFocus prop", () => {
    render(<Select options={[]} setFocus={true} />);
    const input = screen.getByRole("combobox");

    const element = document.activeElement as HTMLElement;
    expect(element === input).to.be.true;
  });

  it("selects defaultValue correctly even when placeholder text is provided (uncontrolled)", () => {
    render(<Select options={{ option1: "Option 1", option2: "Option 2", option3: "Option 3" }} defaultValue="option3" placeholder="place-holder-text" />);

    expect(screen.getByRole<HTMLOptionElement>("option", {name: "Option 3"}).selected).to.be.true;
  });

  it("renders initial value correctly (controlled)", () => {
    const {rerender} = render(<Select options={{ option1: "Option 1", option2: "Option 2", option3: "Option 3" }} value="option2" onChange={() => { }} />);

    rerender(<Select options={{ option1: "Option 1", option2: "Option 2", option3: "Option 3" }} value="option3" onChange={() => { }} />);

    expect(screen.getByRole<HTMLSelectElement>("combobox").value).to.eq("option3");
    expect(screen.getByRole<HTMLOptionElement>("option", {name: "Option 3"}).selected).to.be.true;
  });

  it("renders value correctly overrides placeholder value when not null (controlled)", () => {
    // select value = "option2"
    const {rerender} = render(<Select options={{ option1: "Option 1", option2: "Option 2", option3: "Option 3" }} value="option2" placeholder="select value" onChange={() => { }} />);

    // revert to showing placeholder
    rerender(<Select options={{ option1: "Option 1", option2: "Option 2", option3: "Option 3" }} value={undefined} placeholder="select value" onChange={() => { }} />);
    expect(screen.getByRole<HTMLSelectElement>("combobox").value).to.be.eq("placeholder");
  });

});
