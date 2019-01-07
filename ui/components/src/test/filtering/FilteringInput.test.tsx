/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as enzyme from "enzyme";
import * as React from "react";
import { Key } from "ts-key-enum";

import { FilteringInput } from "../..//filtering/FilteringInput";
import { ResultSelector } from "../..//filtering/ResultSelector";
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

  it("shows loading bar and 'Cancel' button when `filteringInProgress` gets changed from `false` to `true`", () => {
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

  it("shows `ResultSelector` and 'X' button when `filteringInProgress` gets changed from `true` to `false` and stepping is enabled", () => {
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

  it("doesn't show `ResultSelector` when `filteringInProgress` gets changed from `true` to `false` and stepping is disabled", () => {
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

  it("starts search when input is edited and 'Enter' key is pressed", () => {
    const startCallback = sinon.spy();
    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={startCallback}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }} />);

    const inputField = filteringInput.find("input[type=\"text\"]").first();
    inputField.simulate("change", { target: { value: "test" } });

    inputField.simulate("keyDown", { key: Key.Backspace });
    expect(startCallback).to.not.be.called;

    inputField.simulate("keyDown", { key: Key.Enter });
    expect(startCallback).to.be.calledOnce;
  });

  it("doesn't start search when input is empty", () => {
    const startCallback = sinon.spy();
    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={startCallback} />);

    const inputField = filteringInput.find("input[type=\"text\"]").first();
    expect(inputField.props().value).to.be.empty;

    inputField.simulate("keyDown", { key: Key.Enter });
    expect(startCallback).to.not.be.called;

    const searchButton = filteringInput.find(".filtering-input-button");
    searchButton.simulate("click");
    expect(startCallback).to.not.be.called;
  });

  it("calls appropriate callbacks to different button clicks", () => {
    const cancelCallback = sinon.spy();
    const clearCallback = sinon.spy();
    const startCallback = sinon.spy();

    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={cancelCallback}
        onFilterClear={clearCallback}
        onFilterStart={startCallback}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }} />);

    const inputField = filteringInput.find("input[type=\"text\"]").first();
    inputField.simulate("change", { target: { value: "test" } });
    filteringInput.find(".filtering-input-button").simulate("click");
    filteringInput.setProps({ filteringInProgress: true });
    expect(startCallback).to.be.calledOnce;

    filteringInput.find(".filtering-input-button").simulate("click");
    filteringInput.setProps({ filteringInProgress: false });
    expect(cancelCallback).to.be.calledOnce;

    inputField.simulate("change", { target: { value: "test" } });
    filteringInput.find(".filtering-input-button").simulate("click");
    filteringInput.setProps({ filteringInProgress: true });
    filteringInput.setProps({ filteringInProgress: false, resultCount: 10 });
    filteringInput.find(".filtering-input-clear").simulate("click");
    expect(clearCallback).to.be.calledOnce;
  });
});
