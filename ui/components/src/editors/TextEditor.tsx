/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import * as React from "react";
import classnames from "classnames";
import { PropertyRecord } from "../properties/Record";

export interface TextEditorProps {
  onBlur: (event: any) => void;
  value?: PropertyRecord;
}

export interface TextEditorState {
  inputValue: string;
}

export class TextEditor extends React.Component<TextEditorProps, TextEditorState> {
  private _input: HTMLInputElement | null = null;

  /** @hidden */
  public readonly state: Readonly<TextEditorState> = {
    inputValue: "",
  };

  public getValue(): string {
    return this.state.inputValue;
  }

  private _updateInputValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({
      inputValue: e.target.value,
    });
  }

  public componentDidMount() {
    this.getInitialValue();
  }

  private async getInitialValue() {
    const propertyRecord = this.props.value;
    const initialValue = propertyRecord ? await propertyRecord.getDisplayValue() : "";
    this.setState({ inputValue: initialValue });
  }

  public render() {
    const className = classnames("cell", "cell-editor" /*, "bwc-inputs-input", "form-control"*/);

    return (
      <input
        ref={(node) => this._input = node}
        type="text"
        autoFocus
        onBlur={this.props.onBlur}
        className={className}
        defaultValue={this.state.inputValue}
        onChange={this._updateInputValue}
      />
    );
  }
}
