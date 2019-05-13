/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import * as React from "react";
import classnames from "classnames";
import { PropertyValueFormat, PropertyValue, PrimitiveValue, PropertyEditorParams, PropertyEditorParamTypes, InputEditorSizeParams } from "@bentley/imodeljs-frontend";
import { PropertyEditorProps, TypeEditor } from "./EditorContainer";
import { TypeConverterManager } from "../converters/TypeConverterManager";

import "./TextEditor.scss";

/** @internal */
interface TextEditorState {
  inputValue: string;
  readonly: boolean;
  isDisabled?: boolean;
  size?: number;
  maxLength?: number;
}

/** TextEditor React component that is a property editor with text input
 * @beta
 */
export class TextEditor extends React.PureComponent<PropertyEditorProps, TextEditorState> implements TypeEditor {
  private _input: HTMLInputElement | null = null;
  private _isMounted = false;

  /** @internal */
  public readonly state: Readonly<TextEditorState> = {
    inputValue: "",
    readonly: false,
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

  private setFocus(): void {
    // istanbul ignore else
    if (this._input && !this.state.isDisabled) {
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

  /** @internal */
  public componentDidMount() {
    this._isMounted = true;
    this.setStateFromProps(); // tslint:disable-line:no-floating-promises
  }

  /** @internal */
  public componentWillUnmount() {
    this._isMounted = false;
  }

  /** @internal */
  public componentDidUpdate(prevProps: PropertyEditorProps) {
    if (this.props.propertyRecord !== prevProps.propertyRecord) {
      this.setStateFromProps(); // tslint:disable-line:no-floating-promises
    }
  }

  private async setStateFromProps() {
    const record = this.props.propertyRecord;
    let initialValue = "";

    // istanbul ignore else
    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      const value = (record.value as PrimitiveValue).value;
      initialValue = await TypeConverterManager.getConverter(record.property.typename).convertPropertyToString(record.property, value);
    }

    const readonly = record && undefined !== record.isReadonly ? record.isReadonly : false;
    let size: number | undefined;
    let maxLength: number | undefined;

    const isDisabled = record ? record.isDisabled : undefined;

    if (record && record.property && record.property.editor && record.property.editor.params) {
      const editorSizeParams = record.property.editor.params.find((param: PropertyEditorParams) => param.type === PropertyEditorParamTypes.InputEditorSize) as InputEditorSizeParams;
      // istanbul ignore else
      if (editorSizeParams) {
        // istanbul ignore else
        if (editorSizeParams.size)
          size = editorSizeParams.size;
        // istanbul ignore else
        if (editorSizeParams.maxLength)
          maxLength = editorSizeParams.maxLength;
      }
    }

    // istanbul ignore else
    if (this._isMounted)
      this.setState(
        { inputValue: initialValue, readonly, size, maxLength, isDisabled },
        () => {
          if (this.props.setFocus) {
            this.setFocus();
            // istanbul ignore else
            if (this._input)
              this._input.select();
          }
        },
      );
  }

  /** @internal */
  public render() {
    const className = classnames("cell", "components-cell-editor", "components-text-editor", this.props.className);

    return (
      <input
        ref={(node) => this._input = node}
        type="text"
        onBlur={this.props.onBlur}
        className={className}
        style={this.props.style}
        readOnly={this.state.readonly}
        disabled={this.state.isDisabled}
        size={this.state.size}
        maxLength={this.state.maxLength}
        defaultValue={this.state.inputValue}
        onChange={this._updateInputValue}
        data-testid="components-text-editor"
      />
    );
  }
}
