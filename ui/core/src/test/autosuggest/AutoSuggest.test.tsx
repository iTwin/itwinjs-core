/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, ReactWrapper } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as ReactAutosuggest from "react-autosuggest";
import { Logger } from "@bentley/bentleyjs-core";
import { SpecialKey } from "@bentley/ui-abstract";
import { AutoSuggest, AutoSuggestData } from "../../ui-core";
import TestUtils from "../TestUtils";

describe("AutoSuggest", () => {
  const options: AutoSuggestData[] = [
    { value: "abc", label: "label" },
    { value: "def", label: "label2" },
    { value: "ghi", label: "label3" },
  ];

  const getInputElement = (wrapper: ReactWrapper): HTMLInputElement => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return wrapper.getDOMNode() as HTMLInputElement;
  };

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
    expect(autoSuggest.state().inputValue).to.eq("label");

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
    expect(autoSuggest.state().inputValue).to.eq(value);

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

    const inputNode = getInputElement(input);
    inputNode.focus();

    input.simulate("change", { target: { value: "abc" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    let li = wrapper.find("li");
    expect(li.length).to.eq(1);

    input.simulate("change", { target: { value: "lab" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    li = wrapper.find("li");
    expect(li.length).to.eq(3);

    input.simulate("change", { target: { value: "" } });
    wrapper.update();

    li = wrapper.find("li");
    expect(li.length).to.eq(0);

    wrapper.unmount();
    document.body.removeChild(outerNode);
  });

  it("should call onSuggestionSelected with clicked suggestion", async () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const spyMethod = sinon.spy();
    const wrapper = mount(<AutoSuggest options={options} onSuggestionSelected={spyMethod} />, { attachTo: outerNode });
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    const inputNode = getInputElement(input);
    inputNode.focus();

    input.simulate("change", { target: { value: "abc" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const li = wrapper.find("li");
    expect(li.length).to.eq(1);

    li.simulate("click");
    spyMethod.calledOnce.should.true;

    wrapper.unmount();
    document.body.removeChild(outerNode);
  });

  const getSuggestions = (value: string): AutoSuggestData[] => {
    const inputValue = value.trim().toLowerCase();
    const inputLength = inputValue.length;

    return inputLength === 0 ? [] : options.filter((data: AutoSuggestData) => {
      return data.label.toLowerCase().includes(inputValue) || data.value.toLowerCase().includes(inputValue);
    });
  };

  const getSuggestionsAsync = async (value: string): Promise<AutoSuggestData[]> => {
    return Promise.resolve(getSuggestions(value));
  };

  const getLabel = (value: string | undefined): string => {
    let label = "";
    const entry = options.find((data: AutoSuggestData) => data.value === value);
    if (entry)
      label = entry.label;
    return label;
  };

  it("should support options function and getLabel", async () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const spyMethod = sinon.spy();
    const wrapper = mount(<AutoSuggest options={getSuggestions} getLabel={getLabel} onSuggestionSelected={spyMethod} />, { attachTo: outerNode });
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    const inputNode = getInputElement(input);
    inputNode.focus();

    input.simulate("change", { target: { value: "abc" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const li = wrapper.find("li");
    expect(li.length).to.eq(1);

    wrapper.unmount();
    document.body.removeChild(outerNode);
  });

  it("should support getSuggestions prop", async () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const spyMethod = sinon.spy();
    const wrapper = mount(<AutoSuggest getSuggestions={getSuggestionsAsync} onSuggestionSelected={spyMethod} />, { attachTo: outerNode });
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    const inputNode = getInputElement(input);
    inputNode.focus();

    input.simulate("change", { target: { value: "abc" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const li = wrapper.find("li");
    expect(li.length).to.eq(1);

    wrapper.unmount();
    document.body.removeChild(outerNode);
  });

  it("should support renderInputComponent prop", async () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const spyInput = sinon.spy();
    const renderInput = (inputProps: ReactAutosuggest.InputProps<AutoSuggestData>): React.ReactNode => {
      const { onChange, ...otherProps } = inputProps;
      return (
        <input type="text"
          onChange={(event) => { onChange(event, { newValue: event.target.value, method: "type" }); spyInput(); }}
          {...otherProps}
        />
      );
    };

    const spyMethod = sinon.spy();
    const wrapper = mount(<AutoSuggest getSuggestions={getSuggestionsAsync} onSuggestionSelected={spyMethod} renderInputComponent={renderInput} />, { attachTo: outerNode });
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    const inputNode = getInputElement(input);
    inputNode.focus();

    input.simulate("change", { target: { value: "abc" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    expect(spyInput.called).to.be.true;

    wrapper.unmount();
    document.body.removeChild(outerNode);
  });

  it("should support onSuggestionsClearRequested prop", async () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const spyMethod = sinon.spy();
    const spyClear = sinon.spy();
    const wrapper = mount(<AutoSuggest getSuggestions={getSuggestionsAsync} onSuggestionSelected={spyMethod} onSuggestionsClearRequested={spyClear} />, { attachTo: outerNode });
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    const inputNode = getInputElement(input);
    inputNode.focus();

    input.simulate("change", { target: { value: "abc" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    input.simulate("change", { target: { value: "" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    expect(spyClear.called).to.be.true;

    wrapper.unmount();
    document.body.removeChild(outerNode);
  });

  it("should log Error when options function provided but not getLabel", async () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const spyMethod = sinon.spy();
    const spyLogger = sinon.spy(Logger, "logError");
    const wrapper = mount(<AutoSuggest options={getSuggestions} onSuggestionSelected={spyMethod} />, { attachTo: outerNode });
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    const inputNode = getInputElement(input);
    inputNode.focus();

    input.simulate("change", { target: { value: "abc" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const li = wrapper.find("li");
    expect(li.length).to.eq(1);

    wrapper.unmount();
    document.body.removeChild(outerNode);

    spyLogger.called.should.true;
    (Logger.logError as any).restore();
  });

  it("should log Error when no options or getSuggestions provided", async () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const spyMethod = sinon.spy();
    const spyLogger = sinon.spy(Logger, "logError");
    const wrapper = mount(<AutoSuggest onSuggestionSelected={spyMethod} />, { attachTo: outerNode });
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    const inputNode = getInputElement(input);
    inputNode.focus();

    input.simulate("change", { target: { value: "abc" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    wrapper.unmount();
    document.body.removeChild(outerNode);

    spyLogger.called.should.true;
    (Logger.logError as any).restore();
  });

  it("should invoke onPressEnter", () => {
    const spyMethod = sinon.spy();
    const spyEnter = sinon.spy();
    const wrapper = mount(<AutoSuggest options={options} onSuggestionSelected={spyMethod} onPressEnter={spyEnter} />);
    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input[type='text']");
    expect(input.length).to.eq(1);

    input.simulate("keydown", { key: SpecialKey.Enter });
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

    input.simulate("keydown", { key: SpecialKey.Escape });
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

    input.simulate("keydown", { key: SpecialKey.Tab });
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

    const inputNode = getInputElement(input);
    inputNode.focus();

    expect(spyFocus.called).to.be.true;

    wrapper.unmount();
    document.body.removeChild(outerNode);
  });

});
