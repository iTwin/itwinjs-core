/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { mount, shallow } from "enzyme";
import * as React from "react";
import { InputStatus, LabeledThemedSelect } from "../../core-react";

describe("<LabeledThemedSelect />", () => {
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

  it("should render", () => {
    const sut = mount(<LabeledThemedSelect label="themedselect test" options={[]} />);
    sut.unmount();
  });

  it("renders correctly", () => {
    shallow(<LabeledThemedSelect label="themedselect test" options={[]} />).should.matchSnapshot();
  });

  it("renders disabled correctly", () => {
    shallow(<LabeledThemedSelect label="themedselect disabled test" isDisabled={true} options={[]} />).should.matchSnapshot();
  });

  it("renders status correctly", () => {
    shallow(<LabeledThemedSelect label="themedselect status test" status={InputStatus.Success} options={[]} />).should.matchSnapshot();
  });

  it("renders message correctly", () => {
    shallow(<LabeledThemedSelect label="themedselect message test" message={"Test message"} options={[]} />).should.matchSnapshot();
  });

  it("renders options correctly", () => {
    shallow(<LabeledThemedSelect label="themedselect single test" options={colorChoices} />).should.matchSnapshot();
  });

  it("renders multi-select correctly", () => {
    shallow(<LabeledThemedSelect label="themedselect multi test" isMulti={true} options={cityChoices} />).should.matchSnapshot();
  });
});
