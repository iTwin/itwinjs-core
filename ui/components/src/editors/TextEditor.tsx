/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import * as React from "react";
import classnames from "classnames";
import { PropertyRecord } from "../properties/Record";
import { PropertyValueFormat, PrimitiveValue } from "../properties/Value";
import { TypeConverterManager } from "../converters/TypeConverterManager";

import "./TextEditor.scss";

/** Properties for [[TextEditor]] component */
export interface TextEditorProps {
  onBlur?: (event: any) => void;
  value?: PropertyRecord;
}

interface TextEditorState {
  inputValue: string;
}

/** TextEditor React component that is a property editor with text input  */
export class TextEditor extends React.Component<TextEditorProps, TextEditorState> {
  private _input: HTMLInputElement | null = null;
  private _isMounted = false;

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
    if (this._isMounted)
      this.setState({
        inputValue: e.target.value,
      });
  }

  public componentDidMount() {
    this._isMounted = true;
    this.getInitialValue();
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  private async getInitialValue() {
    const record = this.props.value;
    let initialValue = "";

    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      const value = (record.value as PrimitiveValue).value;
      initialValue = await TypeConverterManager.getConverter(record.property.typename).convertPropertyToString(record.property, value);
    }

    if (this._isMounted)
      this.setState(
        () => ({ inputValue: initialValue }),
        () => {
          if (this._input) {
            this._input.focus();
            this._input.select();
          }
        },
      );
  }

  public render() {
    const className = classnames("cell", "components-cell-editor", "components-text-editor");

    return (
      <input
        ref={(node) => this._input = node}
        type="text"
        onBlur={this.props.onBlur}
        className={className}
        defaultValue={this.state.inputValue}
        onChange={this._updateInputValue}
        data-testid="components-text-editor"
      />
    );
  }
}
