/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import type { ReactWrapper} from "enzyme";
import { mount, shallow } from "enzyme";
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { ThemedSelect } from "../../core-react";

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

  describe("mounted", () => {
    let sut: ReactWrapper;

    afterEach(() => {
      sut.unmount();
    });

    it("should render", () => {
      sut = mount(<ThemedSelect options={[]} />);
    });
  });

  it("renders correctly", () => {
    shallow(<ThemedSelect options={[]} />).should.matchSnapshot();
  });

  it("renders status correctly", () => {
    shallow(<ThemedSelect options={[]} defaultValue={colorChoices[0]} />).should.matchSnapshot();
  });

  it("renders defaultValue correctly", () => {
    shallow(<ThemedSelect options={[]} defaultValue={colorChoices[1]} />).should.matchSnapshot();
  });

  it("renders value correctly", () => {
    shallow(<ThemedSelect options={[]} value={colorChoices[1]} />).should.matchSnapshot();
  });

  it("renders placeholder correctly", () => {
    shallow(<ThemedSelect options={[]} placeholder="test" />).should.matchSnapshot();
  });

  it("renders array options correctly", () => {
    shallow(<ThemedSelect options={colorChoices} />).should.matchSnapshot();
  });

  it("renders object options correctly", () => {
    shallow(<ThemedSelect options={colorChoices} />).should.matchSnapshot();
  });

  it("renders placeholder correctly when options are provided", () => {
    shallow(<ThemedSelect options={colorChoices} placeholder="place-holder-text" />).should.matchSnapshot();
  });

  it("renders default value correctly when options are provided ", () => {
    shallow(<ThemedSelect options={colorChoices} defaultValue={colorChoices[1]} />).should.matchSnapshot();
  });

  it("renders initial value correctly", () => {
    shallow(<ThemedSelect options={colorChoices} value={colorChoices[0]} />).should.matchSnapshot();
  });

  it("renders with fixed menu correctly", () => {
    shallow(<ThemedSelect options={colorChoices} value={colorChoices[0]} isMenuFixed={true} />).should.matchSnapshot();
  });

  it("renders with no options correctly", () => {
    shallow(<ThemedSelect options={colorChoices} value={colorChoices[0]} noOptionsMessage={() => "No options"} />).should.matchSnapshot();
  });

  it("renders with no options correctly", () => {
    const className = "uicore-reactSelect.width100";
    shallow(<ThemedSelect className={className} options={colorChoices} value={colorChoices[0]} noOptionsMessage={() => "No options"} />).should.matchSnapshot();
  });
});

describe("<ThemedSelect - React Testing Library />", () => {

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
  it("placeholder text is provided", () => {
    const { container } = render(<ThemedSelect options={cityChoices} placeholder="type here..." />);
    expect(container.querySelector(".react-select__control")!.textContent).to.eq("type here...");
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
