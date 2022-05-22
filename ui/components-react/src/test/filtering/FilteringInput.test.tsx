/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { fireEvent, render } from "@testing-library/react";
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Key } from "ts-key-enum";
import { FilteringInput, FilteringInputStatus } from "../../components-react/filtering/FilteringInput";
import { ResultSelector } from "../../components-react/filtering/ResultSelector";
import TestUtils from "../TestUtils";

describe("FilteringInput", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  it("renders correctly", () => {
    const filteringInput = enzyme.mount(
      <FilteringInput
        status={FilteringInputStatus.ReadyToFilter}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }} />);

    expect(filteringInput.find("input[type=\"text\"]").first().exists()).to.be.true;

    const actionIcon = filteringInput.find(".components-filtering-input-input-components").childAt(0);
    expect(actionIcon.render().hasClass("icon-search"));
  });

  it("shows 'Cancel' button when filtering status is `FilteringInProgress`", () => {
    const filteringInput = enzyme.mount(
      <FilteringInput
        status={FilteringInputStatus.FilteringInProgress}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }} />);
    const actionIcon = filteringInput.find(".components-filtering-input-input-components").childAt(0);
    expect(actionIcon.render().hasClass("icon-close"));
  });

  it("shows `ResultSelector` and 'X' button when filtering status is `FilteringFinished` and stepping is enabled", () => {
    const filteringInput = enzyme.mount(
      <FilteringInput
        status={FilteringInputStatus.FilteringFinished}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }} />);
    expect(filteringInput.find(ResultSelector).first().exists(), "No ResultSelector found").to.be.true;
    expect(filteringInput.find(".components-filtering-input-clear").first().hasClass("icon-close"), "No X button found").to.be.true;
  });

  it("doesn't show `ResultSelector` when filtering status is `FilteringFinished` and stepping is disabled", () => {
    const filteringInput = enzyme.mount(
      <FilteringInput
        status={FilteringInputStatus.FilteringFinished}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }} />);
    expect(filteringInput.find(ResultSelector).first().exists()).to.be.false;
    expect(filteringInput.find(".components-filtering-input-clear").first().hasClass("icon-close"), "No X button found").to.be.true;
  });

  it("starts search when input is edited and 'Enter' key is pressed", () => {
    const startCallback = sinon.spy();
    const filteringInput = enzyme.mount(
      <FilteringInput
        status={FilteringInputStatus.ReadyToFilter}
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
        status={FilteringInputStatus.ReadyToFilter}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={startCallback} />);

    const inputField = filteringInput.find("input[type=\"text\"]").first();
    expect(inputField.props().value).to.be.empty;

    inputField.simulate("keyDown", { key: Key.Enter });
    expect(startCallback).to.not.be.called;

    const searchButton = filteringInput.find(".components-filtering-input-input-components>.icon-search");
    searchButton.simulate("click");
    expect(startCallback).to.not.be.called;
  });

  it("calls appropriate callbacks to different button clicks", () => {
    const cancelCallback = sinon.spy();
    const clearCallback = sinon.spy();
    const startCallback = sinon.spy();

    const filteringInput = enzyme.mount(
      <FilteringInput
        status={FilteringInputStatus.ReadyToFilter}
        onFilterCancel={cancelCallback}
        onFilterClear={clearCallback}
        onFilterStart={startCallback} />);

    const inputField = filteringInput.find("input[type=\"text\"]").first();
    inputField.simulate("change", { target: { value: "test" } });
    filteringInput.find(".components-filtering-input-input-components>.icon-search").simulate("click");
    expect(startCallback).to.be.calledOnce;
    filteringInput.setProps({ status: FilteringInputStatus.FilteringInProgress });

    filteringInput.find(".components-filtering-input-input-components>.icon-close").simulate("click");
    expect(cancelCallback).to.be.calledOnce;
    filteringInput.setProps({ status: FilteringInputStatus.ReadyToFilter });

    inputField.simulate("change", { target: { value: "test" } });
    filteringInput.find(".components-filtering-input-input-components>.icon-search").simulate("click");
    filteringInput.setProps({ status: FilteringInputStatus.FilteringInProgress });
    filteringInput.setProps({ status: FilteringInputStatus.FilteringFinished, resultSelectorProps: { onSelectedChanged: () => { }, resultCount: 0 } });
    filteringInput.find(".components-filtering-input-clear").simulate("click");
    expect(clearCallback).to.be.calledOnce;
  });

  it("calls onFilterCancel when input text is changed after starting the search", () => {
    const cancelCallback = sinon.spy();

    const filteringInput = render(
      <FilteringInput
        onFilterCancel={cancelCallback}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        status={FilteringInputStatus.ReadyToFilter} />);

    const searchBar = filteringInput.container.querySelector('[class="components-filtering-input-input"]')?.firstChild;
    const searchIcon = filteringInput.container.querySelector('[class="icon icon-search"]');
    expect(searchBar).to.exist;
    expect(searchIcon).to.exist;

    fireEvent.change(searchBar as Element, { target: { value: "test" } });
    fireEvent.click(searchIcon as Element);
    fireEvent.change(searchBar as Element, { target: { value: "testing" } });

    expect(cancelCallback).to.be.calledOnce;

  });

  it("does not render `ResultSelector` but renders `search` button when status is set to `ReadyToFilter`", () => {
    const filteringInput = render(
      <FilteringInput
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        status={FilteringInputStatus.ReadyToFilter} />);

    expect(filteringInput.container.querySelector('[class="components-result-selector"]'), "ResultSelector found").to.not.exist;
    expect(filteringInput.container.querySelector('[class="icon icon-search"]'), "Search icon found").to.exist;
  });

  it("does not render `ResultSelector` but renders `X` button when status is set to `FilteringInProgress`", () => {
    const filteringInput = render(
      <FilteringInput
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        status={FilteringInputStatus.FilteringInProgress} />);

    expect(filteringInput.container.querySelector('[class="components-result-selector"]'), "ResultSelector found").to.not.exist;
    expect(filteringInput.container.querySelector('[class="icon icon-close"]'), "X button found").to.exist;
  });

  it("renders `ResultSelector` and 'X' button when status is set to `FilteringFinished` and `resultSelectorProps` are provided ", () => {
    const filteringInput = render(
      <FilteringInput
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        status={FilteringInputStatus.FilteringFinished}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }} />);

    expect(filteringInput.container.querySelector('[class="components-result-selector"]'), "ResultSelector found").to.exist;
    expect(filteringInput.container.querySelector('[class="components-filtering-input-clear icon icon-close"]'), "X button found").to.exist;
  });

  it("doesn't render `ResultSelector` but renders 'X' button when status is set to `FilteringFinished` and `resultSelectorProps` are not provided ", () => {
    const filteringInput = render(
      <FilteringInput
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        status={FilteringInputStatus.FilteringFinished} />);

    expect(filteringInput.container.querySelector('[class="components-result-selector"]'), "ResultSelector found").to.not.exist;
    expect(filteringInput.container.querySelector('[class="components-filtering-input-clear icon icon-close"]'), "X button found").to.exist;
  });

  it("re-renders ResultSelector(sets activeMatchIndex to 1) when resultSelectorProps are updated when using status property", () => {
    const filteringInput = render(
      <FilteringInput
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 5 }}
        status={FilteringInputStatus.FilteringFinished} />);

    expect(filteringInput.getByText("1")).to.exist;
    const nextButton = filteringInput.container.querySelector('[class="components-result-selector-button icon icon-chevron-right"]');
    expect(nextButton).to.exist;
    fireEvent.click(nextButton as Element);

    expect(filteringInput.getByText("2")).to.exist;

    filteringInput.rerender(
      <FilteringInput
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 5 }}
        status={FilteringInputStatus.FilteringFinished} />);

    expect(filteringInput.getByText("1")).to.exist;
  });
});
