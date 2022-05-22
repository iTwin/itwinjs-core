/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as React from "react";
import { ResultSelector } from "../../components-react/filtering/ResultSelector";
import { SpecialKey } from "@itwin/appui-abstract";

describe("ResultSelector", () => {
  it("content is '0 of 0' and buttons are disabled when result count is 0", () => {
    enzyme.mount(<ResultSelector onSelectedChanged={() => { }} resultCount={0} />).should.matchSnapshot();
  });

  it("content is '1 of X' and buttons are not disabled when result count is higher than 0", () => {
    enzyme.mount(<ResultSelector onSelectedChanged={() => { }} resultCount={10} />).should.matchSnapshot();
  });

  it("calls onSelectedChanged after '<' or '>' button is clicked", () => {
    let callCount = 0;

    const resultSelector = enzyme.mount(
      <ResultSelector
        onSelectedChanged={() => callCount++}
        resultCount={10} />);

    const buttons = resultSelector.find(".components-result-selector-button");

    buttons.at(1).simulate("click");
    buttons.at(0).simulate("click");

    expect(callCount).to.be.eq(3); // 2 clicks and on in the start
  });

  it("nothing happens when trying to increase current selection to more than result count or less than 1", () => {
    let callCount = 0;

    const resultSelector = enzyme.mount(
      <ResultSelector
        onSelectedChanged={() => callCount++}
        resultCount={1} />);

    const buttons = resultSelector.find(".components-result-selector-button");

    buttons.at(0).simulate("click");
    buttons.at(1).simulate("click");

    expect(callCount).to.be.eq(1); // 1 in the start, not from clicking
  });

  it("input field to edit current selection appears after clicking on 'x of n'", () => {
    const resultSelector = enzyme.mount(<ResultSelector onSelectedChanged={() => { }} resultCount={1} />);

    resultSelector.find(".components-result-selector-current-result").first().simulate("click");

    expect(resultSelector.find("input[type=\"number\"]").first().exists()).to.be.true;
  });

  it("current selection gets submitted after pressing 'Enter' key while in edit mode", () => {
    const resultSelector = enzyme.mount(<ResultSelector onSelectedChanged={() => { }} resultCount={1} />);

    resultSelector.find(".components-result-selector-current-result").first().simulate("click");

    let inputElement = resultSelector.find("input[type=\"number\"]").first();

    inputElement.simulate("keyDown", { keyCode: 15 });
    inputElement = resultSelector.find("input[type=\"number\"]").first();
    expect(inputElement.exists()).to.be.true;

    inputElement.simulate("keyDown", { key: SpecialKey.Enter });
    inputElement = resultSelector.find("input[type=\"number\"]").first();
    expect(inputElement.exists()).to.be.false;
  });

  it("current selection gets submitted after clicking '<' or '>' button while in edit mode", () => {
    const resultSelector = enzyme.mount(<ResultSelector onSelectedChanged={() => { }} resultCount={1} />);

    resultSelector.find(".components-result-selector-current-result").first().simulate("click");

    const buttons = resultSelector.find(".components-result-selector-button");

    buttons.at(0).simulate("click");
    expect(resultSelector.find("input[type=\"number\"]").first().exists()).to.be.false;

    resultSelector.find(".components-result-selector-current-result").first().simulate("click");
    buttons.at(1).simulate("click");

    expect(resultSelector.find("input[type=\"number\"]").first().exists()).to.be.false;
  });

  it("current selection becomes 0 after changing result count from n to 0", () => {
    let currentSelection = -1;

    const resultSelector = enzyme.mount(
      <ResultSelector
        onSelectedChanged={(selection) => currentSelection = selection}
        resultCount={1} />);

    expect(currentSelection).to.be.eq(1);

    resultSelector.setProps({ resultCount: 0 });
    expect(currentSelection).to.be.eq(0);

    resultSelector.setProps({ resultCount: 3 });
    expect(currentSelection).to.be.eq(1);
  });

  it("onSelectedChanged does not get called after changing result count to same value", () => {
    let onSelectedTriggered = false;

    const resultSelector = enzyme.mount(
      <ResultSelector
        onSelectedChanged={() => onSelectedTriggered = true}
        resultCount={10} />);

    onSelectedTriggered = false;

    resultSelector.setProps({ resultCount: 10 });
    expect(onSelectedTriggered).to.be.false;
  });

  it("nothing happens if more than result count symbols get typed while editing current selection", () => {
    const resultSelector = enzyme.mount(<ResultSelector onSelectedChanged={() => { }} resultCount={11} />);

    resultSelector.find(".components-result-selector-current-result").first().simulate("click");

    let inputElement = resultSelector.find("input[type=\"number\"]").first();

    inputElement.simulate("change", { target: { value: "123" } });
    inputElement = resultSelector.find("input[type=\"number\"]").first();
    expect(inputElement.render().val()).to.be.eq("1");

    inputElement.simulate("change", { target: { value: "12" } });
    inputElement = resultSelector.find("input[type=\"number\"]").first();
    expect(inputElement.render().val()).to.be.eq("12");
  });

  it("current selection value gets corrected if typed number is bigger than result count or smaller than 1", () => {
    let selectedResult = 0;
    const resultSelector = enzyme.mount(<ResultSelector onSelectedChanged={(value) => selectedResult = value} resultCount={11} />);

    const nextButton = resultSelector.find(".components-result-selector-button").at(1);
    const resultInfo = resultSelector.find(".components-result-selector-current-result").first();

    resultInfo.simulate("click");

    let inputElement = resultSelector.find("input[type=\"number\"]").first();

    inputElement.simulate("change", { target: { value: "99" } });
    nextButton.simulate("click");
    expect(selectedResult).to.be.eq(11);

    resultInfo.simulate("click");
    inputElement = resultSelector.find("input[type=\"number\"]").first();
    inputElement.simulate("change", { target: { value: "0" } });
    nextButton.simulate("click");
    expect(selectedResult).to.be.eq(1);
  });
});
