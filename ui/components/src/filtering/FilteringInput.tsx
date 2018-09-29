/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Filtering  */

import * as React from "react";
import { ResultSelector, ResultSelectorProps } from "./ResultSelector";
import "./FilteringInput.scss";
import UiComponents from "../UiComponents";

/** [[FilteringInput]] React Component state */
export interface FilteringInputState {
  /** A string which will be used for search */
  searchText: string;
  /** @hidden */
  context: InputContext;
}

/** [[FilteringInput]] React Component properties */
export interface FilteringInputProps {
  /** Filtering should start */
  onFilterStart: (searchText: string) => void;
  /** Filtering is canceled while still in progress */
  onFilterCancel: () => void;
  /** Filtering is cleared after everything's loaded */
  onFilterClear: () => void;
  /** Tells the component if parent component is still handling the filtering */
  filteringInProgress: boolean;
  /** [[ResultSelector]] React Component properties */
  resultSelectorProps?: ResultSelectorProps;
}

/**
 * Enumeration of possible component contexts
 * @hidden
 */
export enum InputContext {
  /** Component is ready to filter */
  ReadyToFilter,
  /** Component's parent is currently filtering */
  FilteringInProgress,
  /** Component's parent has finished filtering */
  FilteringFinished,
  /** Component's parent has finished filtering, but ResultSelector(stepping through results) is not enabled */
  FilteringFinishedWithNoStepping,
}

/** A helper component for filtering trees and stepping through results */
export class FilteringInput extends React.Component<FilteringInputProps, FilteringInputState> {
  constructor(props: FilteringInputProps) {
    super(props);
    this.state = {
      searchText: "",
      context: InputContext.ReadyToFilter,
    };
  }

  private _onSearchButtonClick = () => {
    this.props.onFilterStart(this.state.searchText);
  }

  private _onCancelButtonClick = () => {
    this.setState({ context: InputContext.ReadyToFilter, searchText: "" });
    this.props.onFilterCancel();
  }

  private _onClearButtonClick = () => {
    this.setState({ context: InputContext.ReadyToFilter, searchText: "" });
    this.props.onFilterClear();
  }

  private _onFilterKeyDown = (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.keyCode === 13) // Enter
      this.props.onFilterStart(this.state.searchText);
  }

  private _onInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ searchText: e.target.value, context: InputContext.ReadyToFilter });
  }

  public static getDerivedStateFromProps(props: FilteringInputProps, state: FilteringInputState) {
    if (state.context === InputContext.FilteringInProgress && !props.filteringInProgress) {
      if (state.searchText && props.resultSelectorProps)
        return { context: InputContext.FilteringFinished };
      else
        return { context: InputContext.FilteringFinishedWithNoStepping };
    } else if (state.context === InputContext.ReadyToFilter && props.filteringInProgress) {
      return { context: InputContext.FilteringInProgress };
    }
    return null;
  }

  public render() {
    return (
      <div className="filtering-input filtering-input-preload-images" onKeyDown={this._onFilterKeyDown}>
        <span className="filtering-input-input">
          <input type="text"
            onKeyDown={this._onFilterKeyDown}
            value={this.state.searchText}
            onChange={this._onInputChanged} />

          <span className="filtering-input-input-components">
            {this.state.context === InputContext.FilteringInProgress ?
              <div className="filtering-input-loader"><i></i><i></i><i></i><i></i><i></i><i></i></div> : undefined}

            {this.state.context === InputContext.FilteringFinished ?
              <ResultSelector {...this.props.resultSelectorProps!} /> : undefined}
          </span>
        </span>

        {this.state.context === InputContext.ReadyToFilter ?
          <button className="filtering-input-button"
            onClick={this._onSearchButtonClick}>{UiComponents.i18n.translate("UiComponents:button.label.search")}</button> : undefined}

        {this.state.context === InputContext.FilteringInProgress ?
          <button className="filtering-input-button"
            onClick={this._onCancelButtonClick}>{UiComponents.i18n.translate("UiComponents:button.label.cancel")}</button> : undefined}

        {this.state.context === InputContext.FilteringFinishedWithNoStepping || this.state.context === InputContext.FilteringFinished ?
          <button className="filtering-input-clear icon icon-close" onClick={this._onClearButtonClick}></button> :
          undefined}

      </div>
    );
  }
}
