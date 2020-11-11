/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Filtering
 */

import "./FilteringInput.scss";
import classnames from "classnames";
import * as React from "react";
import { Key } from "ts-key-enum";
import { CommonProps, UiCore } from "@bentley/ui-core";
import { UiComponents } from "../UiComponents";
import { ResultSelector, ResultSelectorProps } from "./ResultSelector";

/** [[FilteringInput]] React Component state
 * @internal
 */
interface FilteringInputState {
  /** A string which will be used for search */
  searchText: string;
  /** @internal */
  context: InputContext;
  resultSelectorKey: number;
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
  /** Tells the component if parent component has finished filtering
   * @alpha
   */
  filteringComplete?: boolean;
  /** [[ResultSelector]] React Component properties */
  resultSelectorProps?: ResultSelectorProps;
  /** Specify that the <input> element should automatically get focus */
  autoFocus?: boolean;
  /**
   * Tells component to reset the state of internal [[ResultSelector]] whenever provided `resultSelectorProps` change.
   * This allows resetting the selected active match back to 0.
   * @beta
  */
  resetResultSelectOnPropsChange?: boolean;
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
export class FilteringInput extends React.PureComponent<FilteringInputProps, FilteringInputState> {
  private _inputElement = React.createRef<HTMLInputElement>();
  private _searchLabel = UiCore.translate("general.search");
  private _cancelLabel = UiCore.translate("dialog.cancel");
  private _clearLabel = UiCore.translate("general.search");

  constructor(props: FilteringInputProps) {
    super(props);
    this.state = {
      searchText: "",
      context: InputContext.ReadyToFilter,
      resultSelectorKey: 0,
    };
  }

  private focus() {
    // istanbul ignore next
    if (this._inputElement.current)
      this._inputElement.current.focus();
  }

  private _onSearchButtonClick = () => {
    if (!this.state.searchText) {
      // Empty search string is the same as clearing the search.
      this.setState({ context: InputContext.ReadyToFilter, searchText: "" });
      this.props.onFilterClear();
      return;
    }

    this.props.onFilterStart(this.state.searchText);
  }

  private _onCancelButtonClick = () => {
    this.setState({ context: InputContext.ReadyToFilter, searchText: "" });
    this.props.onFilterCancel();
    this.focus();
  }

  private _onClearButtonClick = () => {
    this.setState({ context: InputContext.ReadyToFilter, searchText: "" });
    this.props.onFilterClear();
    this.focus();
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
    if (this.props.filteringComplete)
      this.props.onFilterCancel();
  }

  /** @internal */
  public static getDerivedStateFromProps(props: FilteringInputProps, state: FilteringInputState) {
    if (props.filteringInProgress) {
      return { context: InputContext.FilteringInProgress };
    }

    if (props.filteringComplete) {
      if (props.resultSelectorProps)
        return { context: InputContext.FilteringFinished };
      return { context: InputContext.FilteringFinishedWithNoStepping };
    }

    if (state.context === InputContext.FilteringInProgress && !props.filteringInProgress) {
      if (state.searchText && props.resultSelectorProps)
        return { context: InputContext.FilteringFinished };
      else
        return { context: InputContext.FilteringFinishedWithNoStepping };
    }

    return null;
  }

  /** @internal */
  public componentDidUpdate(prevProps: FilteringInputProps, _prevState: FilteringInputState ) {
    if (this.props.resetResultSelectOnPropsChange && this.props.resultSelectorProps!==prevProps.resultSelectorProps) {
      this.setState((state, _props) => ({ resultSelectorKey: state.resultSelectorKey + 1 }));
    }
  }


  public render() {
    return (
      // TODO: What is filtering-input-preload-images?
      <div className={classnames("components-filtering-input", "filtering-input-preload-images", this.props.className)}
        style={this.props.style}
        onKeyDown={this._onFilterKeyDown}
        role="presentation"
      >
        <span className="components-filtering-input-input">
          <input type="text"
            placeholder={UiComponents.translate("filteringInput:placeholder")}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={this.props.autoFocus}
            onKeyDown={this._onFilterKeyDown}
            value={this.state.searchText}
            onChange={this._onInputChanged}
            aria-label={UiCore.translate("general.search")} />

          <span className="components-filtering-input-input-components">
            {this.state.context === InputContext.FilteringFinished ?
              <ResultSelector key={this.state.resultSelectorKey} {...this.props.resultSelectorProps!} /> : undefined}

            {this.state.context === InputContext.ReadyToFilter ?
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <span className="icon icon-search" onClick={this._onSearchButtonClick}
                role="button" tabIndex={-1} title={this._searchLabel} /> : undefined}

            {this.state.context === InputContext.FilteringInProgress ?
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <span className="icon icon-close" onClick={this._onCancelButtonClick}
                role="button" tabIndex={-1} title={this._cancelLabel} /> : undefined}

            {this.state.context === InputContext.FilteringFinishedWithNoStepping || this.state.context === InputContext.FilteringFinished ?
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <span className="components-filtering-input-clear icon icon-close" onClick={this._onClearButtonClick}
                role="button" tabIndex={-1} title={this._clearLabel} /> : undefined}
          </span>
        </span>
      </div>
    );
  }
}
