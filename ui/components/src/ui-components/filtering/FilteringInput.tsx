/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Filtering  */

import * as React from "react";
import classnames from "classnames";
import { Key } from "ts-key-enum";
import { ResultSelector, ResultSelectorProps } from "./ResultSelector";
import "./FilteringInput.scss";
import { UiComponents } from "../UiComponents";
import { Spinner, SpinnerSize, CommonProps } from "@bentley/ui-core";

/** [[FilteringInput]] React Component state
 * @internal
 */
interface FilteringInputState {
  /** A string which will be used for search */
  searchText: string;
  /** @internal */
  context: InputContext;
}

/** [[FilteringInput]] React Component properties
 * @public
 */
export interface FilteringInputProps extends CommonProps {
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
 * @internal
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

/** A helper component for filtering trees and stepping through results
 * @public
 */
export class FilteringInput extends React.Component<FilteringInputProps, FilteringInputState> {
  constructor(props: FilteringInputProps) {
    super(props);
    this.state = {
      searchText: "",
      context: InputContext.ReadyToFilter,
    };
  }

  private _onSearchButtonClick = () => {
    if (!this.state.searchText)
      return;

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
    if (e.key !== Key.Enter)
      return;

    if (!this.state.searchText)
      return;

    this.props.onFilterStart(this.state.searchText);
    e.stopPropagation();
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
      // TODO: What is filtering-input-preload-images?
      <div className={classnames("components-filtering-input", "filtering-input-preload-images", this.props.className)}
        style={this.props.style}
        onKeyDown={this._onFilterKeyDown}
      >
        <span className="components-filtering-input-input">
          <input type="text"
            onKeyDown={this._onFilterKeyDown}
            value={this.state.searchText}
            onChange={this._onInputChanged} />

          <span className="components-filtering-input-input-components">
            {this.state.context === InputContext.FilteringInProgress ?
              <div className="components-filtering-input-loader">
                <Spinner size={SpinnerSize.Medium} />
              </div>
              : undefined}

            {this.state.context === InputContext.FilteringFinished ?
              <ResultSelector {...this.props.resultSelectorProps!} /> : undefined}
          </span>
        </span>

        {this.state.context === InputContext.ReadyToFilter ?
          <button className="components-filtering-input-button"
            onClick={this._onSearchButtonClick}>{UiComponents.i18n.translate("UiComponents:button.label.search")}</button> : undefined}

        {this.state.context === InputContext.FilteringInProgress ?
          <button className="components-filtering-input-button"
            onClick={this._onCancelButtonClick}>{UiComponents.i18n.translate("UiComponents:button.label.cancel")}</button> : undefined}

        {this.state.context === InputContext.FilteringFinishedWithNoStepping || this.state.context === InputContext.FilteringFinished ?
          <button className="components-filtering-input-clear icon icon-close" onClick={this._onClearButtonClick}></button> :
          undefined}

      </div>
    );
  }
}
