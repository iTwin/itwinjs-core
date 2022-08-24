/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as ReactAutosuggest from "react-autosuggest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Logger } from "@itwin/core-bentley";
import { AutoSuggest, AutoSuggestData } from "../../core-react";

describe("AutoSuggest", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  const options: AutoSuggestData[] = [
    { value: "abc", label: "label" },
    { value: "def", label: "label2" },
    { value: "ghi", label: "label3" },
  ];

  it("should update the input value when props change", () => {
    const { rerender} = render(<AutoSuggest options={options} onSuggestionSelected={()=>{}} />);

    rerender(<AutoSuggest options={options} onSuggestionSelected={()=>{}} value={"abc"}/>);
    expect(screen.getByRole<HTMLInputElement>("textbox").value).to.eq("label");
  });

  it("should update the input value when input changes", async () => {
    render(<AutoSuggest options={options} onSuggestionSelected={()=>{}} />);

    await theUserTo.type(screen.getByRole("textbox"), "label");
    expect(screen.getByRole<HTMLInputElement>("textbox").value).to.eq("label");
  });

  it("should open suggestions when typing", async () => {
    render(<div><AutoSuggest options={options} onSuggestionSelected={()=>{}} /></div>);

    await theUserTo.type(screen.getByRole("textbox"), "abc");
    expect(screen.getByRole("option", {name:"label"})).to.exist;

    await theUserTo.type(screen.getByRole("textbox"), "[Backspace>3/]lab");
    expect(screen.getByRole("option", {name:"label"})).to.exist;
    expect(screen.getByRole("option", {name:"label2"})).to.exist;
    expect(screen.getByRole("option", {name:"label3"})).to.exist;

    await theUserTo.clear(screen.getByRole("textbox"));
    expect(screen.queryAllByRole("option")).to.be.empty;
  });

  it("should call onSuggestionSelected with clicked suggestion", async () => {
    const spyMethod = sinon.spy();
    render(<AutoSuggest options={options} onSuggestionSelected={spyMethod} />);

    await theUserTo.type(screen.getByRole("textbox"), "abc");
    await theUserTo.click(screen.getByRole("option", {name: "label"}));
    spyMethod.calledOnce.should.true;
  });

  const getSuggestions = (input: string): AutoSuggestData[] => {
    const inputValue = input.trim().toLowerCase();
    const inputLength = inputValue.length;

    return inputLength === 0 ? [] : options
      .map(({value, label}) => ({
        value: value.split("").reverse().join(""),
        label: label.toUpperCase(),
      })).filter((data: AutoSuggestData) => {
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
    render(<AutoSuggest options={getSuggestions} getLabel={getLabel} onSuggestionSelected={()=>{}} />);

    await theUserTo.type(screen.getByRole("textbox"), "cba");

    expect(screen.getByRole("option", {name: "LABEL"})).to.exist;
  });

  it("should support getSuggestions prop", async () => {
    render(<AutoSuggest getSuggestions={getSuggestionsAsync} onSuggestionSelected={()=>{}} />);

    await theUserTo.type(screen.getByRole("textbox"), "cba");

    expect(screen.getByRole("option", {name: "LABEL"})).to.exist;
  });

  it("should support renderInputComponent prop", async () => {
    const spyInput = sinon.spy();
    const renderInput = (inputProps: ReactAutosuggest.InputProps<AutoSuggestData>): React.ReactNode => {
      const { onChange, ...otherProps } = inputProps;
      return (
        <input type="text" role="searchbox"
          onChange={(event) => { onChange(event, { newValue: event.target.value, method: "type" }); spyInput(); }}
          {...otherProps}
        />
      );
    };

    render(<AutoSuggest getSuggestions={getSuggestionsAsync} onSuggestionSelected={()=>{}} renderInputComponent={renderInput} />);

    await theUserTo.type(screen.getByRole("searchbox"), "cba");
    expect(spyInput.called).to.be.true;
  });

  it("should support onSuggestionsClearRequested prop", async () => {
    const spyClear = sinon.spy();
    render(<AutoSuggest getSuggestions={getSuggestionsAsync} onSuggestionSelected={()=>{}} onSuggestionsClearRequested={spyClear} />);

    await theUserTo.type(screen.getByRole("textbox"), "cba");
    await theUserTo.type(screen.getByRole("textbox"), "[Backspace>3/]");
    expect(spyClear.called).to.be.true;
  });

  it("should log Error when options function provided but not getLabel", async () => {
    const spyLogger = sinon.spy(Logger, "logError");
    render(<AutoSuggest options={getSuggestions} onSuggestionSelected={() => {}} />);

    await theUserTo.type(screen.getByRole("textbox"), "cba");
    expect(screen.getByRole("option", {name: "LABEL"}));
    spyLogger.called.should.true;

    (Logger.logError as any).restore();
  });

  it("should log Error when no options or getSuggestions provided", async () => {
    const spyLogger = sinon.spy(Logger, "logError");
    render(<AutoSuggest onSuggestionSelected={()=>{}} />);

    await theUserTo.type(screen.getByRole("textbox"), "abc");
    expect(screen.queryByRole("option")).to.be.null;
    spyLogger.called.should.true;
    (Logger.logError as any).restore();
  });

  it("should invoke onPressEnter", async () => {
    const spyEnter = sinon.spy();
    render(<AutoSuggest options={options} onSuggestionSelected={()=>{}} onPressEnter={spyEnter} />);

    await theUserTo.type(screen.getByRole("textbox"), "[Enter]");
    expect(spyEnter.called).to.be.true;
  });

  it("should invoke onPressEscape", async () => {
    const spyEscape = sinon.spy();
    render(<AutoSuggest options={options} onSuggestionSelected={() => {}} onPressEscape={spyEscape} />);

    await theUserTo.type(screen.getByRole("textbox"), "[Escape]");
    expect(spyEscape.called).to.be.true;
  });

  it("should invoke onPressTab", async () => {
    const spyTab = sinon.spy();
    render(<AutoSuggest options={options} onSuggestionSelected={() =>{}} onPressTab={spyTab} />);

    await theUserTo.type(screen.getByRole("textbox"), "[Tab]");
    expect(spyTab.called).to.be.true;
  });

  it("should invoke onInputFocus", async () => {
    const spyFocus = sinon.spy();
    render(<AutoSuggest options={options} onSuggestionSelected={()=>{}} onInputFocus={spyFocus} />);

    await theUserTo.click(screen.getByRole("textbox"));
    expect(spyFocus.called).to.be.true;
  });

  it("should handle unmounting before end of request", async () => {
    const spyMethod = sinon.spy();
    let resolver = (_: AutoSuggestData[] | PromiseLike<AutoSuggestData[]>) => {};
    const suggestion = new Promise<AutoSuggestData[]>((resolve) => {
      resolver = resolve;
    });
    const spySuggester = sinon.fake(async () => suggestion);

    const {unmount} = render(<AutoSuggest getSuggestions={spySuggester} onSuggestionSelected={spyMethod} />);

    await theUserTo.type(screen.getByRole("textbox"), "abc");

    unmount();
    resolver([]);
    expect(spySuggester).to.have.been.called;
    expect(spyMethod).not.to.have.been.called;
  });
});
