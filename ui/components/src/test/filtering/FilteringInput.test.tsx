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
import { FilteringInput } from "../../ui-components/filtering/FilteringInput";
import { ResultSelector } from "../../ui-components/filtering/ResultSelector";
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

    const actionIcon = filteringInput.find(".components-filtering-input-input-components").childAt(0);
    expect(actionIcon.render().hasClass("icon-search"));
  });

  it("shows 'Cancel' button when `filteringInProgress` gets changed from `false` to `true`", () => {
    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }} />);

    filteringInput.setProps({ filteringInProgress: true });

    const actionIcon = filteringInput.find(".components-filtering-input-input-components").childAt(0);
    expect(actionIcon.render().hasClass("icon-close"));
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
    expect(filteringInput.find(".components-filtering-input-clear").first().hasClass("icon-close"), "No X button found").to.be.true;
  });

  it("doesn't show `ResultSelector` when `filteringInProgress` gets changed from `true` to `false` and stepping is disabled", () => {
    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={true}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}/>);

    filteringInput.find("input[type=\"text\"]").first().simulate("change", { target: { value: "test" } });

    filteringInput.setProps({ filteringInProgress: false });

    expect(filteringInput.find(ResultSelector).first().exists()).to.be.false;
    expect(filteringInput.find(".components-filtering-input-clear").first().hasClass("icon-close"), "No X button found").to.be.true;
  });

  it("doesn't show `ResultSelector` when finished filtering and stepping is disabled and filteringComplete flag is changed from false to true", () => {
    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        filteringComplete={false} />);

    filteringInput.find("input[type=\"text\"]").first().simulate("change", { target: { value: "test" } });

    filteringInput.setProps({ filteringComplete: true });

    expect(filteringInput.find(ResultSelector).first().exists()).to.be.false;
    expect(filteringInput.find(".components-filtering-input-clear").first().hasClass("icon-close"), "No X button found").to.be.true;
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

    expect(filteringInput.find(ResultSelector).first().exists(), "ResultSelector found").to.be.false;
    const actionIcon = filteringInput.find(".components-filtering-input-input-components").childAt(0);
    expect(actionIcon.render().hasClass("icon-search"));
  });

  it("resets to default state when input is changed and filteringComplete flag is being used", () => {
    const filteringInput = enzyme.mount(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }}
        filteringComplete={true}/>);

    filteringInput.find("input[type=\"text\"]").first().simulate("change", { target: { value: "test" } });

    filteringInput.setProps({ resultSelectorProps: undefined });

    filteringInput.find("input[type=\"text\"]").first().simulate("change", { target: { value: "a" } });

    expect(filteringInput.find(ResultSelector).first().exists(), "ResultSelector found").to.be.false;
    const actionIcon = filteringInput.find(".components-filtering-input-input-components").childAt(0);
    expect(actionIcon.render().hasClass("icon-search"));
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
        filteringInProgress={false}
        onFilterCancel={cancelCallback}
        onFilterClear={clearCallback}
        onFilterStart={startCallback}
        filteringComplete={false} />);

    const inputField = filteringInput.find("input[type=\"text\"]").first();
    inputField.simulate("change", { target: { value: "test" } });
    filteringInput.find(".components-filtering-input-input-components>.icon-search").simulate("click");
    expect(startCallback).to.be.calledOnce;
    filteringInput.setProps({ filteringInProgress: true });

    filteringInput.find(".components-filtering-input-input-components>.icon-close").simulate("click");
    expect(cancelCallback).to.be.calledOnce;
    filteringInput.setProps({ filteringInProgress: false });

    inputField.simulate("change", { target: { value: "test" } });
    filteringInput.find(".components-filtering-input-input-components>.icon-search").simulate("click");
    filteringInput.setProps({ filteringInProgress: true });
    filteringInput.setProps({ filteringInProgress: false, resultSelectorProps: { onSelectedChanged: () => { }, resultCount: 0 } });
    filteringInput.find(".components-filtering-input-clear").simulate("click");
    expect(clearCallback).to.be.calledOnce;
  });

  it("renders result selector when given resultSelectorProps and filteringComplete flag", () => {
    const filteringInput = render(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 0 }}
        filteringComplete={true} />);

    expect(filteringInput.container.querySelector('[class="components-result-selector"]'), "ResultSelector found").to.exist;
  });

  it("re-renders ResultSelector(sets activeMatchIndex to 1) when resultSelectorProps are updated and resultSelectorPropsUpdateFlag is set to true", () => {
    const filteringInput = render(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 5 }}
        filteringComplete={true}
        resetResultSelectOnPropsChange={true} />);

    expect(filteringInput.getByText("1")).to.exist;
    const nextButton = filteringInput.container.querySelector('[class="components-result-selector-button icon icon-chevron-right"]');
    expect(nextButton).to.exist;
    fireEvent.click(nextButton as Element);

    expect(filteringInput.getByText("2")).to.exist;

    filteringInput.rerender(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 5 }}
        filteringComplete={true}
        resetResultSelectOnPropsChange={true} />
    )

    expect(filteringInput.getByText("1")).to.exist;
  });

  it("Does not re-render ResultSelector when resultSelectorProps are updated and resultSelectorPropsUpdateFlag is set to false", () => {
    const filteringInput = render(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 5 }}
        filteringComplete={true}
        resetResultSelectOnPropsChange={false} />);

    expect(filteringInput.getByText("1")).to.exist;
    const nextButton = filteringInput.container.querySelector('[class="components-result-selector-button icon icon-chevron-right"]');
    expect(nextButton).to.exist;
    fireEvent.click(nextButton as Element);

    expect(filteringInput.getByText("2")).to.exist;

    filteringInput.rerender(
      <FilteringInput
        filteringInProgress={false}
        onFilterCancel={() => { }}
        onFilterClear={() => { }}
        onFilterStart={() => { }}
        resultSelectorProps={{ onSelectedChanged: () => { }, resultCount: 5 }}
        filteringComplete={true}
        resetResultSelectOnPropsChange={false} />
    )

    expect(filteringInput.getByText("2")).to.exist;
  });
});
