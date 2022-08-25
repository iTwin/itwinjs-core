/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemedSelect } from "../../core-react";
import TestUtils from "../TestUtils";

describe("<ThemedSelect />", () => {
  enum ColorOptions {
    Red,
    White,
    Blue,
    Yellow,
  }
  const colorChoices = [
    { label: "Red", value: ColorOptions.Red },
    { label: "White", value: ColorOptions.White },
    { label: "Blue", value: ColorOptions.Blue },
    { label: "Yellow", value: ColorOptions.Yellow },
  ];
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });
  before(async () => {
    await TestUtils.initializeUiCore();
  });

  it("renders defaultValue correctly", () => {
    render(<ThemedSelect options={[]} defaultValue={colorChoices[1]} />);

    expect(screen.getByText("White")).to.exist;
  });

  it("renders value correctly", () => {
    render(<ThemedSelect options={[]} value={colorChoices[1]} />);

    expect(screen.getByText("White")).to.exist;
  });

  it("renders placeholder correctly", () => {
    render(<ThemedSelect options={[]} placeholder="placeholder-test" />);

    expect(screen.getByText("placeholder-test")).to.exist;
  });

  it("renders with default menu in portal", async () => {
    render(<ThemedSelect options={colorChoices} value={colorChoices[0]} />);

    await theUserTo.type(screen.getByRole("textbox"), "R");
    expect(screen.getByText("Red").matches("#portal *")).to.be.true;
  });

  it("renders with fixed menu correctly", async () => {
    render(<ThemedSelect options={colorChoices} value={colorChoices[0]} isMenuFixed={true}/>);

    await theUserTo.type(screen.getByRole("textbox"), "R");
    expect(screen.getByText("Red").matches("#portal *")).to.be.false;
  });

  it("renders with no options correctly", async () => {
    render(<ThemedSelect options={colorChoices} value={colorChoices[0]} noOptionsMessage={() => "Test empty options"} />);

    await theUserTo.type(screen.getByRole("textbox"), "xxx");
    expect(screen.getByText("Test empty options")).to.exist;
  });

  it("renders with default no options correctly", async () => {
    render(<ThemedSelect options={colorChoices} value={colorChoices[0]} />);

    await theUserTo.type(screen.getByRole("textbox"), "xxx");
    expect(screen.getByText("reactselect.noSelectOption")).to.exist;
  });

  const cityChoices = [
    { label: "London", value: "London" },
    { label: "Paris", value: "Paris" },
    { label: "Stockholm", value: "Stockholm" },
    { label: "Berlin", value: "Berlin" },
    { label: "Mumbai", value: "Mumbai" },
    { label: "Christchurch", value: "Christchurch" },
    { label: "Johannesburg", value: "Johannesburg" },
    { label: "Beijing", value: "Beijing" },
    { label: "New York", value: "New York" },
  ];

  it("single select passing multiple values", () => {
    const { container } = render(<ThemedSelect options={cityChoices} value={[cityChoices[3], cityChoices[5]]} />);
    expect(container.querySelector(".react-select__control")!.textContent).to.eq("Berlin");
  });
  it("multi select passing multiple values", () => {
    const { container } = render(<ThemedSelect options={cityChoices} isMulti={true} value={[cityChoices[3], cityChoices[5]]} />);
    expect(container.querySelector(".react-select__control")!.textContent).to.eq("BerlinChristchurch");
  });
  it("selects defaultValue correctly even when placeholder text is provided (uncontrolled)", () => {
    const { container } = render(<ThemedSelect options={cityChoices} defaultValue={cityChoices[4]} placeholder="place-holder-text" />);
    expect(container.querySelector(".react-select__control")!.textContent).to.eq("Mumbai");
  });
  it("open menu", () => {
    const { container } = render(<ThemedSelect options={cityChoices} menuIsOpen={true} />);
    const indicator = container.querySelector("div.react-select__dropdown-indicator");
    expect(indicator).not.to.be.null;
    fireEvent.mouseDown(indicator!, { button: 0 });
    const portal = document.querySelector("#portal");
    expect(portal).not.to.be.null;
    const menu = portal!.querySelector(".react-select__menu");
    expect(menu).not.to.be.null;
  });
  it("valid search param in type ahead", () => {
    const { container } = render(<ThemedSelect options={cityChoices} inputValue="y" menuIsOpen={true} isSearchable={true} />);
    const indicator = container.querySelector("div.react-select__dropdown-indicator");
    expect(indicator).not.to.be.null;
    fireEvent.mouseDown(indicator!, { button: 0 });
    const portal = document.querySelector("#portal");
    expect(portal).not.to.be.null;
    const menu = portal!.querySelector(".react-select__menu");
    expect(menu).not.to.be.null;
    const options = menu!.querySelectorAll(".react-select__option");
    expect(options).not.to.be.null;
    expect(options.length).to.eq(1);
    expect(options[0].textContent).to.eq("New York");
  });
  it("invalid search param in type ahead", () => {
    const { container } = render(<ThemedSelect options={cityChoices} inputValue="x" menuIsOpen={true} isSearchable={true} />);
    const indicator = container.querySelector("div.react-select__dropdown-indicator");
    expect(indicator).not.to.be.null;
    fireEvent.mouseDown(indicator!, { button: 0 });
    const portal = document.querySelector("#portal");
    expect(portal).not.to.be.null;
    const menu = portal!.querySelector(".react-select__menu");
    expect(menu).not.to.be.null;
    const noOptions = menu!.querySelector(".react-select__menu-notice--no-options");
    expect(noOptions).not.to.be.null;
  });
});
