/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import * as React from "react";
import classnames from "classnames";

/** Properties for [[TextEditor]] component */
export interface TextEditorProps {
  onBlur?: (event: any) => void;
  text?: string;
}

interface TextEditorState {
  inputValue: string;
}

/** TextEditor React component that is a property editor with text input  */
export class TextEditor extends React.Component<TextEditorProps, TextEditorState> {
  private _input: HTMLInputElement | null = null;

  /** @hidden */
  public readonly state: Readonly<TextEditorState> = {
    inputValue: "",
  };

  public getValue(): string {
    return this.state.inputValue;
  }

  public getInputNode(): HTMLInputElement | null {
    return this._input;
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
    this.setState(
      () => ({ inputValue: this.props.text ? this.props.text : "" }),
      () => {
        if (this._input) {
          this._input.focus();
          this._input.select();
        }
      },
    );
  }

  public render() {
    const className = classnames("cell", "cell-editor" /*, "bwc-inputs-input", "form-control"*/);

    return (
      <input
        ref={(node) => this._input = node}
        type="text"
        onBlur={this.props.onBlur}
        className={className}
        defaultValue={this.state.inputValue}
        onChange={this._updateInputValue}
      />
    );
  }
}
