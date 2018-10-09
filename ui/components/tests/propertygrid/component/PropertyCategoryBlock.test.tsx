/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { PropertyCategory } from "../../../src/propertygrid/PropertyDataProvider";
import { PropertyCategoryBlock } from "../../../src/propertygrid/component/PropertyCategoryBlock";

describe("PropertyCategoryBlock", () => {
  let category: PropertyCategory;

  beforeEach(() => {
    category = { name: "Group_1", label: "Group 1", expand: false };
  });

  it("renders content correctly when collapsed", () => {
    category.expand = false;

    const categoryBlock = mount(
      <PropertyCategoryBlock category={category} >
        <div className="test-content" />
      </PropertyCategoryBlock>);

    expect(categoryBlock.find(".test-content").exists()).to.be.false;
  });

  it("renders content correctly when expanded", () => {
    category.expand = true;

    const categoryBlock = mount(
      <PropertyCategoryBlock category={category} >
        <div className="test-content" />
      </PropertyCategoryBlock>);

    expect(categoryBlock.find(".test-content").exists()).to.be.true;
  });

  it("does not expand if header gets clicked, but callback is not provided", () => {
    const categoryBlock = mount(<PropertyCategoryBlock category={category} />);

    const prevProps = categoryBlock.props();

    categoryBlock.find(".header").simulate("click");
    expect(categoryBlock.props().category).to.be.eq(prevProps.category);
  });

  it("expands when header gets clicked", () => {
    let toggled = false;

    const categoryBlock = mount(<PropertyCategoryBlock category={category} onExpansionToggled={() => { toggled = true; }} />);

    toggled = false;
    categoryBlock.find(".header").simulate("click");
    expect(toggled).to.be.true;
  });

  it("expands when \"Enter\" or \"Space\" key gets pressed", () => {
    let toggled = false;

    const categoryBlock = mount(<PropertyCategoryBlock category={category} onExpansionToggled={() => { toggled = true; }} />);

    const header = categoryBlock.find(".header");

    toggled = false;
    header.simulate("keyPress", { key: " ", which: 32 });
    expect(toggled).to.be.true;

    toggled = false;
    header.simulate("keyPress", { key: "Enter", which: 13 });
    expect(toggled).to.be.true;
  });

  it("does not expand when wrong key gets pressed", () => {
    let toggled = false;

    const categoryBlock = mount(<PropertyCategoryBlock category={category} onExpansionToggled={() => { toggled = true; }} />);

    const header = categoryBlock.find(".header");

    toggled = false;
    header.simulate("keyPress", { keyCode: 42 });
    expect(toggled).to.be.false;
  });
});
