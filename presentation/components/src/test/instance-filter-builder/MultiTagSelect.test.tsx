/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { MultiTagSelect } from "../../presentation-components/instance-filter-builder/MultiTagSelect";

describe("MultiTagSelect", () => {
  const options = [{
    label: "Option1",
    value: "option1",
  }, {
    label: "Option2",
    value: "option2",
  }, {
    label: "Option3",
    value: "option3",
  }];

  it("renders with selected tags", () => {
    const { container } = render(<MultiTagSelect
      options={options}
      getOptionLabel={(option) => option.label}
      getOptionValue={(option) => option.value}
      value={[options[1], options[2]]}
    />);

    const tags = container.querySelectorAll(".iui-tag");
    expect(tags).to.have.lengthOf(2);
  });

  it("render dropdown menu", () => {
    const { container, getByTestId } = render(<MultiTagSelect
      options={options}
      getOptionLabel={(option) => option.label}
      getOptionValue={(option) => option.value}
      value={[options[1], options[2]]}
      hideSelectedOptions={false}
    />);

    const dropdownIndicator = getByTestId("multi-tag-select-dropdownIndicator");
    fireEvent.mouseDown(dropdownIndicator);

    const dropdownMenu = container.querySelector(".iui-menu");
    expect(dropdownMenu).to.not.be.null;
  });
});
