/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SearchBox
 */

import "./SearchBox.scss";
import classnames from "classnames";
import * as React from "react";
import { UiCore } from "../UiCore";
import { CommonProps } from "../utils/Props";
import { SpecialKey } from "@bentley/ui-abstract";

/** Properties for [[SearchBox]] component
 * @public
 */
export interface SearchBoxProps extends CommonProps {
  /** value to set SearchBox to initially */
  initialValue?: string;
  /** placeholder value to show in gray before anything is entered in */
  placeholder?: string;
  /** triggered when the content of SearchBox is changed */
  onValueChanged: (value: string) => void;
  /** frequency to poll for changes in value, in milliseconds */
  valueChangedDelay?: number;
  /** listens for <Enter> keypress */
  onEnterPressed?: () => void;
  /** listens for <Esc> keypress */
  onEscPressed?: () => void;
  /** listens for onClick event for Clear (x) icon */
  onClear?: () => void;
}

/** @internal */
interface SearchBoxState {
  value: string;
}

/**
 * Input box with builtin icon right justified bounded by the SearchBox
 * @public
 */
export class SearchBox extends React.Component<SearchBoxProps, SearchBoxState> {
  private _inputElement: HTMLInputElement | null = null;
  private _timeoutId: number = 0;

  /** @internal */
  public readonly state: Readonly<SearchBoxState> = { value: this.props.initialValue || "" };

  constructor(props: SearchBoxProps) {
    super(props);
  }

  /** @internal */
  public render(): React.ReactNode {
    const searchClassName = classnames("core-searchbox", this.props.className);
    const emptyString = this.state.value === "";
    const iconClassName = classnames(
      "core-searchbox-icon",
      "icon",
      {
        "icon-search": emptyString,
        "icon-close": !emptyString,
      },
    );
    const buttonTitle = UiCore.translate(emptyString ? "general.search" : "general.clear");
    return (
      <div className={searchClassName} style={this.props.style}>
        <input
          defaultValue={this.props.initialValue}
          ref={(el) => { this._inputElement = el; }}
          onChange={this._trackChange}
          onKeyDown={this._handleKeyDown}
          onPaste={this._trackChange}
          onCut={this._trackChange}
          placeholder={this.props.placeholder ? this.props.placeholder : UiCore.translate("general.search")}
          role="searchbox"
        ></input>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
        <div className="core-searchbox-button" onClick={this._handleIconClick} role="button" tabIndex={-1} title={buttonTitle}>
          <span className={iconClassName} />
        </div>
      </div>
    );
  }

  private _trackChange = (_event?: any): void => {
    let value = "";

    // istanbul ignore else
    if (this._inputElement)
      value = this._inputElement.value;

    this.setState((_prevState) => {
      return {
        value,
      };
    }, () => {
      if (this.props.valueChangedDelay) {
        this._unsetTimeout();
        this._timeoutId = window.setTimeout(() => { this.props.onValueChanged(this.state.value); }, this.props.valueChangedDelay);
      } else {
        this.props.onValueChanged(this.state.value);
      }
    });
  };

  private _handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case SpecialKey.Escape:
        // istanbul ignore else
        if (this.props.onEscPressed)
          this.props.onEscPressed();
        break;
      case SpecialKey.Enter:
        // istanbul ignore else
        if (this.props.onEnterPressed)
          this.props.onEnterPressed();
        break;
    }
  };

  private _handleIconClick = (_event: React.MouseEvent<HTMLElement>): void => {
    // istanbul ignore else
    if (this._inputElement) {
      const clear = this.state.value !== "";
      this._inputElement.value = "";
      // istanbul ignore else
      if (clear && this.props.onClear)
        this.props.onClear();
      this._inputElement.focus();
    }
    this._trackChange();
  };

  private _unsetTimeout = (): void => {
    if (this._timeoutId) {
      window.clearTimeout(this._timeoutId);
      this._timeoutId = 0;
    }
  };

  public componentWillUnmount() {
    this._unsetTimeout();
  }

  public focus() {
    // istanbul ignore else
    if (this._inputElement)
      this._inputElement.focus();
  }
}
