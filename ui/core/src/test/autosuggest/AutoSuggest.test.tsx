/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";
import { AutoSuggest, AutoSuggestData } from "../../ui-core";
import TestUtils from "../TestUtils";

describe("AutoSuggest", () => {
  const options: AutoSuggestData[] = [
    { value: "abc", label: "label" },
    { value: "def", label: "label2" },
    { value: "ghi", label: "label3" },
  ];

  it("renders", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<AutoSuggest options={options} onSuggestionSelected={spyMethod} />);

    expect(wrapper.find("input[type='text']").length).to.eq(1);
    wrapper.unmount();
  });

  it("should update the input value when props change", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<AutoSuggest options={options} onSuggestionSelected={spyMethod} />);
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    wrapper.setProps({ value: "abc" });
    expect(autoSuggest.state("inputValue")).to.eq("label");

    wrapper.unmount();
  });

  it("should update the input value when input changes", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<AutoSuggest options={options} onSuggestionSelected={spyMethod} />);
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    const value = "label";
    input.simulate("change", { target: { value } });
    expect(autoSuggest.state("inputValue")).to.eq(value);

    wrapper.unmount();
  });

  it("should open suggestions when typing", async () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const spyMethod = sinon.spy();
    const wrapper = mount(<AutoSuggest options={options} onSuggestionSelected={spyMethod} />, { attachTo: outerNode });
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    const inputNode = input.getDOMNode() as HTMLInputElement;
    inputNode.focus();

    input.simulate("keyDown", { key: "l" });
    wrapper.update();

    input.simulate("keyDown", { key: "a" });
    wrapper.update();

    input.simulate("keyDown", { key: "b" });
    await TestUtils.tick(1000);
    wrapper.update();

    // console.log(wrapper.debug()); // tslint:disable-line:no-console

    wrapper.unmount();
    document.body.removeChild(outerNode);
  });

  it("should invoke onPressEnter", () => {
    const spyMethod = sinon.spy();
    const spyEnter = sinon.spy();
    const wrapper = mount(<AutoSuggest options={options} onSuggestionSelected={spyMethod} onPressEnter={spyEnter} />);
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    input.simulate("keydown", { key: "Enter" });
    expect(spyEnter.called).to.be.true;

    wrapper.unmount();
  });

  it("should invoke onPressEscape", () => {
    const spyMethod = sinon.spy();
    const spyEscape = sinon.spy();
    const wrapper = mount(<AutoSuggest options={options} onSuggestionSelected={spyMethod} onPressEscape={spyEscape} />);
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    input.simulate("keydown", { key: "Escape" });
    expect(spyEscape.called).to.be.true;

    wrapper.unmount();
  });

  it("should invoke onPressTab", () => {
    const spyMethod = sinon.spy();
    const spyTab = sinon.spy();
    const wrapper = mount(<AutoSuggest options={options} onSuggestionSelected={spyMethod} onPressTab={spyTab} />);
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    input.simulate("keydown", { key: "Tab" });
    expect(spyTab.called).to.be.true;

    wrapper.unmount();
  });

  it("should invoke onInputFocus", async () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const spyMethod = sinon.spy();
    const spyFocus = sinon.spy();
    const wrapper = mount(<AutoSuggest options={options} onSuggestionSelected={spyMethod} onInputFocus={spyFocus} />, { attachTo: outerNode });
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    const inputNode = input.getDOMNode() as HTMLInputElement;
    inputNode.focus();

    expect(spyFocus.called).to.be.true;

    wrapper.unmount();
  });

});
