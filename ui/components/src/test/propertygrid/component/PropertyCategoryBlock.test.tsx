/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import enzyme from "enzyme"; const { mount } = enzyme;
import * as React from "react";
import { PropertyCategoryBlock } from "../../../ui-components/propertygrid/component/PropertyCategoryBlock.js";
import { PropertyCategory } from "../../../ui-components/propertygrid/PropertyDataProvider.js";
import { SpecialKey } from "@bentley/ui-abstract";

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
    header.simulate("keyPress", { key: SpecialKey.Space });
    expect(toggled).to.be.true;

    toggled = false;
    header.simulate("keyPress", { key: SpecialKey.Enter });
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
