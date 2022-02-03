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
import type { CommonProps} from "@itwin/core-react";
import { UiCore } from "@itwin/core-react";
import { Input } from "@itwin/itwinui-react";
import { UiComponents } from "../UiComponents";
import type { ResultSelectorProps } from "./ResultSelector";
import { ResultSelector } from "./ResultSelector";

/** [[FilteringInput]] React Component state
 * @internal
 */
interface FilteringInputState {
  /** A string which will be used for search */
  searchText: string;
  /**
   *  Tells the component if the search was started.
   *  Gets reset to false if search is canceled/cleared or searchText is changed.
  */
  searchStarted: boolean;
  /* Used for resetting the state of [[ResultSelector]] component */
  resultSelectorKey: number;
}

/**
 * [[FilteringInput]] React Component properties
 * @public
 */
export interface FilteringInputProps extends CommonProps {
  /** Filtering should start */
  onFilterStart: (searchText: string) => void;
  /** Filtering is canceled while still in progress */
  onFilterCancel: () => void;
  /** Filtering is cleared after everything's loaded */
  onFilterClear: () => void;
  /**
   * Tells the component what is the status of filtering.
   */
  status: FilteringInputStatus;
  /**
   * [[ResultSelector]] React Component properties.
   * Attribute should be memoized and updated when [[ResultSelector]] state needs to be reset.
   * This allows resetting the selected active match index back to 0.
   */
  resultSelectorProps?: ResultSelectorProps;
  /** Specify that the <input> element should automatically get focus */
  autoFocus?: boolean;
}

/**
 * Enumeration of possible component contexts
 * @public
 */
export enum FilteringInputStatus {
  /** Component is ready to filter */
  ReadyToFilter,
  /** Component's parent is currently filtering */
  FilteringInProgress,
  /** Component's parent has finished filtering */
  FilteringFinished,
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
      searchStarted: false,
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
      this.setState({ searchStarted: false, searchText: "" });
      this.props.onFilterClear();
      return;
    }

    this.props.onFilterStart(this.state.searchText);
    this.setState({ searchStarted: true });
  };

  private _onCancelButtonClick = () => {
    this.setState({ searchStarted: false, searchText: "" });
    this.props.onFilterCancel();
    this.focus();
  };

  private _onClearButtonClick = () => {
    this.setState({ searchStarted: false, searchText: "" });
    this.props.onFilterClear();
    this.focus();
  };

  private _onFilterKeyDown = (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.key !== Key.Enter)
      return;

    if (!this.state.searchText)
      return;

    this.props.onFilterStart(this.state.searchText);
    this.setState({ searchStarted: true });
    e.stopPropagation();
  };

  private _onInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (this.state.searchStarted) {
      this.props.onFilterCancel();
    }
    this.setState({ searchText: e.target.value, searchStarted: false });
  };

  /** @internal */
  public override componentDidUpdate(prevProps: FilteringInputProps) {
    if (this.props.resultSelectorProps !== prevProps.resultSelectorProps) {
      this.setState((state) => ({ resultSelectorKey: state.resultSelectorKey + 1 }));
    }
  }

  public override render() {
    const status = this.props.status;
    return (
      // TODO: What is filtering-input-preload-images?
      <div className={classnames("components-filtering-input", "filtering-input-preload-images", this.props.className)}
        style={this.props.style}
        onKeyDown={this._onFilterKeyDown}
        role="presentation"
      >
        <span className="components-filtering-input-input">
          <Input type="text"
            placeholder={UiComponents.translate("filteringInput:placeholder")}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={this.props.autoFocus}
            onKeyDown={this._onFilterKeyDown}
            value={this.state.searchText}
            onChange={this._onInputChanged}
            aria-label={UiCore.translate("general.search")}
            size="small" />

          <span className="components-filtering-input-input-components">
            {status === FilteringInputStatus.FilteringFinished && this.props.resultSelectorProps ?
              <ResultSelector key={this.state.resultSelectorKey} {...this.props.resultSelectorProps} /> : undefined}
            {status === FilteringInputStatus.ReadyToFilter ?
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <span className="icon icon-search" onClick={this._onSearchButtonClick}
                role="button" tabIndex={-1} title={this._searchLabel} /> : undefined}
            {status === FilteringInputStatus.FilteringInProgress ?
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <span className="icon icon-close" onClick={this._onCancelButtonClick}
                role="button" tabIndex={-1} title={this._cancelLabel} /> : undefined}
            {status === FilteringInputStatus.FilteringFinished ?
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <span className="components-filtering-input-clear icon icon-close" onClick={this._onClearButtonClick}
                role="button" tabIndex={-1} title={this._clearLabel} /> : undefined}
          </span>
        </span>
      </div>
    );
  }
}
