/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AutoSuggest
 */

import * as React from "react";
import * as ReactAutosuggest from "react-autosuggest";
import { CommonProps } from "../utils/Props";

import "./AutoSuggest.scss";

/** Data for the [[AutoSuggest]] options
 *  @beta
 */
export interface AutoSuggestData {
  value: string;
  label: string;
}

/** Properties for the [[AutoSuggest]] component.
 * @beta
 */
export interface AutoSuggestProps extends React.InputHTMLAttributes<HTMLInputElement>, CommonProps {
  /** Current value. */
  value?: string;
  /** Options for dropdown. */
  options: AutoSuggestData[];
  /** Handler for when suggested selected. */
  onSuggestionSelected: (selected: AutoSuggestData) => void;
  /** Indicates whether to set focus to the input element */
  setFocus?: boolean;
  /** Handler for Enter key. */
  onPressEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Handler for Escape key. */
  onPressEscape?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Handler for Tab key. */
  onPressTab?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Handler for input receiving focus. */
  onInputFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /** Calculate suggestions for any given input value. */
  getSuggestions?: (value: string) => AutoSuggestData[];

  /** @internal */
  alwaysRenderSuggestions?: boolean;
}

/** @internal */
interface AutoSuggestState {
  inputValue: string;
  suggestions: AutoSuggestData[];
}

/** Auto Suggest React component. Uses the react-autosuggest component internally.
 * @beta
 */
export class AutoSuggest extends React.PureComponent<AutoSuggestProps, AutoSuggestState> {

  constructor(props: AutoSuggestProps) {
    super(props);

    // Autosuggest is a controlled component.
    // This means that you need to provide an input value
    // and an onChange handler that updates this value (see below).
    // Suggestions also need to be provided to the Autosuggest,
    // and they are initially empty because the Autosuggest is closed.
    this.state = {
      inputValue: this.getLabel(props.value),
      suggestions: [],
    };
  }

  public componentDidUpdate(prevProps: AutoSuggestProps) {
    if (this.props.value !== prevProps.value || this.props.options !== prevProps.options) {
      this.setState((_prevState, props) => ({
        inputValue: this.getLabel(props.value),
      }));
    }
  }

  private _onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = "";

    if (e.target.tagName === "LI" && e.target.textContent)
      newValue = e.target.textContent;
    else if (e.target.value)
      newValue = e.target.value;

    this.setState({
      inputValue: newValue,
    });
  }

  private _onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // istanbul ignore else
    if (this.props.onInputFocus)
      this.props.onInputFocus(e);
  }

  /** Autosuggest will call this function every time you need to update suggestions. */
  private _onSuggestionsFetchRequested = (request: ReactAutosuggest.SuggestionsFetchRequestedParams): void => {
    const value = request.value;
    this.setState({
      suggestions: this._getSuggestions(value),
    });
  }

  /** Autosuggest will call this function every time you need to clear suggestions. */
  private _onSuggestionsClearRequested = () => {
    this.setState({ suggestions: [] });
  }

  private _onSuggestionSelected = (_event: React.FormEvent<any>, data: ReactAutosuggest.SuggestionSelectedEventData<AutoSuggestData>): void => {
    this.props.onSuggestionSelected(data.suggestion);
  }

  /** Teach Autosuggest how to calculate suggestions for any given input value. */
  private _getSuggestions = (value: string): AutoSuggestData[] => {
    if (this.props.getSuggestions)
      return this.props.getSuggestions(value);

    const inputValue = value.trim().toLowerCase();
    const inputLength = inputValue.length;

    return inputLength === 0 ? [] : this.props.options.filter((data: AutoSuggestData) => {
      return data.label.toLowerCase().includes(inputValue) || data.value.toLowerCase().includes(inputValue);
    });
  }

  /** When suggestion is clicked, Autosuggest needs to populate the input based on the clicked suggestion.  */
  private _getSuggestionValue = (suggestion: AutoSuggestData) => suggestion.label;

  /** Render each suggestion. */
  private _renderSuggestion = (suggestion: AutoSuggestData) => (
    <span>
      {suggestion.label}
    </span>
  )

  private getLabel(value: string | undefined): string {
    let label = "";
    const entry = this.props.options.find((data: AutoSuggestData) => data.value === value);
    if (entry)
      label = entry.label;
    return label;
  }

  private _handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "Enter":
        // istanbul ignore else
        if (this.props.onPressEnter)
          this.props.onPressEnter(e);
        break;
      case "Escape":
        // istanbul ignore else
        if (this.props.onPressEscape)
          this.props.onPressEscape(e);
        break;
      case "Tab":
        // istanbul ignore else
        if (this.props.onPressTab)
          this.props.onPressTab(e);
        break;
    }
  }

  private _theme = {
    container: "uicore-autosuggest__container",
    containerOpen: "uicore-autosuggest__container--open",
    input: "uicore-autosuggest__input",
    inputOpen: "uicore-autosuggest__input--open",
    inputFocused: "uicore-autosuggest__input--focused",
    suggestionsContainer: "uicore-autosuggest__suggestions-container",
    suggestionsContainerOpen: "uicore-autosuggest__suggestions-container--open",
    suggestionsList: "uicore-autosuggest__suggestions-list",
    suggestion: "uicore-autosuggest__suggestion",
    suggestionFirst: "uicore-autosuggest__suggestion--first",
    suggestionHighlighted: "uicore-autosuggest__suggestion--highlighted",
    sectionContainer: "uicore-autosuggest__section-container",
    sectionContainerFirst: "uicore-autosuggest__section-container--first",
    sectionTitle: "uicore-autosuggest__section-title",
  };

  public render(): JSX.Element {
    const { inputValue, suggestions } = this.state;
    const { value, onChange, placeholder, options, onSuggestionSelected, setFocus, alwaysRenderSuggestions,
      onPressEnter, onPressEscape, onPressTab, onInputFocus, getSuggestions,
      ...props } = this.props;
    const inputPlaceholder = (!inputValue) ? placeholder : undefined;

    const inputProps: ReactAutosuggest.InputProps<AutoSuggestData> = {
      ...props,
      value: inputValue,
      onChange: this._onChange,
      onFocus: this._onFocus,
      placeholder: inputPlaceholder,
    };

    return (
      <div className={this.props.className} style={this.props.style} onKeyDown={this._handleKeyDown}>
        <ReactAutosuggest
          theme={this._theme}
          suggestions={suggestions}
          onSuggestionsFetchRequested={this._onSuggestionsFetchRequested}
          onSuggestionsClearRequested={this._onSuggestionsClearRequested}
          getSuggestionValue={this._getSuggestionValue}
          renderSuggestion={this._renderSuggestion}
          inputProps={inputProps}
          onSuggestionSelected={this._onSuggestionSelected}
          alwaysRenderSuggestions={alwaysRenderSuggestions}
        />
      </div>
    );
  }
}
