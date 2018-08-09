/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SearchBox */

import * as React from "react";
import * as classnames from "classnames";

import UiCore from "../UiCore";

import "./SearchBox.scss";

/** Property interface for SearchBox */
export interface SearchBoxProps {
  /** value to set SearchBox to initially */
  initialValue?: string;
  /** placeholder value to show in gray before anything is entered in */
  placeholder?: string;
  /** triggered when the content of SearchBox is changed */
  onValueChanged: (value: string) => void;
  /** frequency to poll for changes in value */
  valueChangedDelay?: number;
  /** listens for <Enter> keypresses */
  onEnterPressed?: () => void;
  /** listens for <Esc> keypresses */
  onEscPressed?: () => void;
  /** listens for onClick event for Clear (x) icon */
  onClear?: () => void;
  /** width of SearchBox, measured in em */
  size?: number;
}

/** @hidden */
export interface SearchBoxState {
  value: string;
}

/**
 * Input box with builtin icon right justified bounded by the SearchBox
 */
export class SearchBox extends React.Component<SearchBoxProps, SearchBoxState> {
  private _inputElement: HTMLInputElement | null = null;
  private _timeoutId: number = 0;

  public static defaultProps: Partial<SearchBoxProps> = {
    size: 12,
  };

  /** @hidden */
  public readonly state: Readonly<SearchBoxState> = { value: this.props.initialValue || "" };

  /** @hidden */
  public render(): React.ReactNode {
    const emptyString = this.state.value === "";
    const iconClassName = classnames(
      "searchbox-icon",
      "icon",
      {
        "icon-search": emptyString,
        "icon-close": !emptyString,
      },
    );
    const sizeStyle = {
      width: this.props.size ? this.props.size.toString() + "em" : "12em",
    };
    return (
      <div className={"searchbox"} style={sizeStyle}>
        <input
          className={"searchbox-input"}
          ref={(el) => { this._inputElement = el; }}
          onChange={this.trackChange}
          onKeyUp={this.trackChange}
          onPaste={this.trackChange}
          onCut={this.trackChange}
          placeholder={this.props.placeholder ? this.props.placeholder : UiCore.i18n.translate("UiCore:searchbox.search")}
          style={sizeStyle}
        ></input>
        <div
          className={iconClassName}
          onClick={this.handleIconClick}></div>
      </div>
    );
  }

  private trackChange = (event?: any): void => {
    let value = "";

    if (this._inputElement)
      value = this._inputElement.value;

    this.setState((_prevState) => {
      return {
        value,
      };
    }, () => {
      if (this.props.valueChangedDelay) {
        this.unsetTimeout();
        this._timeoutId = window.setTimeout(() => { this.props.onValueChanged(this.state.value); }, this.props.valueChangedDelay);
      } else {
        this.props.onValueChanged(this.state.value);
      }
    });
    if (event && event.keyCode) {
      switch (event.keyCode) {
        case 27:
          if (this.props.onEscPressed) this.props.onEscPressed();
          break;
        case 13:
          if (this.props.onEnterPressed) this.props.onEnterPressed();
          break;
      }
    }
  }

  private handleIconClick = (_event: React.MouseEvent<HTMLElement>): void => {
    if (this._inputElement) {
      const clear = this.state.value !== "";
      this._inputElement.value = "";
      if (clear && this.props.onClear) this.props.onClear();
      this._inputElement.focus();
    }
    this.trackChange();
  }

  private unsetTimeout = (): void => {
    if (this._timeoutId) {
      window.clearTimeout(this._timeoutId);
      this._timeoutId = 0;
    }
  }

  public componentWillUnmount() {
    this.unsetTimeout();
  }
}

export default SearchBox;
