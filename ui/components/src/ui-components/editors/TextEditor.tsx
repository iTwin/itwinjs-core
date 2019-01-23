/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import * as React from "react";
import classnames from "classnames";
import { PropertyEditorProps, TypeEditor } from "./EditorContainer";
import { PropertyValueFormat, PrimitiveValue, PropertyValue } from "../properties/Value";
import { TypeConverterManager } from "../converters/TypeConverterManager";

import "./TextEditor.scss";

interface TextEditorState {
  inputValue: string;
}

/** TextEditor React component that is a property editor with text input  */
export class TextEditor extends React.Component<PropertyEditorProps, TextEditorState> implements TypeEditor {
  private _input: HTMLInputElement | null = null;
  private _isMounted = false;

  /** @hidden */
  public readonly state: Readonly<TextEditorState> = {
    inputValue: "",
  };

  public getValue(): string {
    return this.state.inputValue;
  }

  public async getPropertyValue(): Promise<PropertyValue | undefined> {
    const record = this.props.propertyRecord;
    let propertyValue: PropertyValue | undefined;

    // istanbul ignore else
    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      propertyValue = await TypeConverterManager.getConverter(record.property.typename).convertFromStringToPropertyValue(this.state.inputValue, record);
      (propertyValue as PrimitiveValue).displayValue = this.state.inputValue;
    }

    return propertyValue;
  }

  public setFocus(): void {
    // istanbul ignore else
    if (this._input) {
      this._input.focus();
    }
  }

  private _updateInputValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    // istanbul ignore else
    if (this._isMounted)
      this.setState({
        inputValue: e.target.value,
      });
  }

  public componentDidMount() {
    this._isMounted = true;
    this.getInitialValue(); // tslint:disable-line:no-floating-promises
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  private async getInitialValue() {
    const record = this.props.propertyRecord;
    let initialValue = "";

    // istanbul ignore else
    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      const value = (record.value as PrimitiveValue).value;
      initialValue = await TypeConverterManager.getConverter(record.property.typename).convertPropertyToString(record.property, value);
    }

    // istanbul ignore else
    if (this._isMounted)
      this.setState(
        { inputValue: initialValue },
        () => {
          if (this._input)
            this._input.select();
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
