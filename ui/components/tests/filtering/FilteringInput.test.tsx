/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as React from "react";

import { FilteringInput } from "../../src/filtering/FilteringInput";
import { ResultSelector } from "../../src/filtering/ResultSelector";
import TestUtils from "../TestUtils";

describe("FilteringInput", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  it("renders correctly", () => {
    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }} />);

    expect(filteringInput.find("input[type=\"text\"]").first().exists()).to.be.true;
    expect(filteringInput.find(".filtering-input-button").first().render().text())
      .to.be.eq(TestUtils.i18n.translate("Components:button.label.search"));
  });

  it("loading bar and 'Cancel' is visible when filterinInProgress gets changed from false to true", () => {
    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }} />);

    filteringInput.setProps({ filteringInProgress: true });

    expect(filteringInput.find(".filtering-input-loader").first().exists()).to.be.true;
    expect(filteringInput.find(".filtering-input-button").first().render().text())
      .to.be.eq(TestUtils.i18n.translate("Components:button.label.cancel"));
  });

  it("ResultSelector and 'X' button is visible when filteringInProgress gets changed from true to false and stepping is enabled", () => {
    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={true}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }} />);

    filteringInput.find("input[type=\"text\"]").first().simulate("change", { target: { value: "test" } });

    filteringInput.setProps({ filteringInProgress: false });
    expect(filteringInput.find(ResultSelector).first().exists(), "No ResultSelector found").to.be.true;
    expect(filteringInput.find(".filtering-input-clear").first().hasClass("icon-close"), "No X button found").to.be.true;
  });

  it("ResultSelector is not visible when filteringInProgress gets changed from true to false and stepping is disabled", () => {
    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={true}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }} />);

    filteringInput.setProps({ filteringInProgress: false });

    expect(filteringInput.find(".filtering-input-loader").first().exists()).to.be.false;
    expect(filteringInput.find(ResultSelector).first().exists()).to.be.false;
    expect(filteringInput.find(".filtering-input-clear").first().hasClass("icon-close"), "No X button found").to.be.true;
  });

  it("resets to default state when input is changed", () => {
    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={true}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }} />);

    filteringInput.find("input[type=\"text\"]").first().simulate("change", { target: { value: "test" } });

    filteringInput.setProps({ filteringInProgress: false });

    filteringInput.find("input[type=\"text\"]").first().simulate("change", { target: { value: "a" } });

    expect(filteringInput.find(ResultSelector).first().exists(), "No ResultSelector found").to.be.false;
    expect(filteringInput.find(".filtering-input-button").first().render().text())
      .to.be.eq(TestUtils.i18n.translate("Components:button.label.search"));
  });

  it("search gets started when input is being edited and 'Enter' key got pressed", () => {
    let searchStarted = false;
    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => searchStarted = true}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }} />);

    const inputField = filteringInput.find("input[type=\"text\"]").first();
    inputField.simulate("change", { target: { value: "test" } });

    inputField.simulate("keyDown", { keyCode: 15 });
    expect(searchStarted).to.be.false;

    inputField.simulate("keyDown", { keyCode: 13 });
    expect(searchStarted).to.be.true;
  });

  it("calls appropriate callbacks to different button clicks", () => {
    let searchCallbackCalled = false;
    let cancelCallbackCalled = false;
    let clearCallbackCalled = false;

    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => cancelCallbackCalled = true}
        onFilterClear={() => clearCallbackCalled = true}
        onFilterStart={() => searchCallbackCalled = true}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }} />);

    const inputField = filteringInput.find("input[type=\"text\"]").first();
    inputField.simulate("change", { target: { value: "test" } });
    filteringInput.find(".filtering-input-button").simulate("click");
    filteringInput.setProps({ filteringInProgress: true });
    expect(searchCallbackCalled, "Search callback not called").to.be.true;

    filteringInput.find(".filtering-input-button").simulate("click");
    filteringInput.setProps({ filteringInProgress: false });
    expect(cancelCallbackCalled, "Cancel callback not called").to.be.true;

    inputField.simulate("change", { target: { value: "test" } });
    filteringInput.find(".filtering-input-button").simulate("click");
    filteringInput.setProps({ filteringInProgress: true });
    filteringInput.setProps({ filteringInProgress: false, resultCount: 10 });
    filteringInput.find(".filtering-input-clear").simulate("click");
    expect(clearCallbackCalled, "Clear callback not called").to.be.true;
  });
});
