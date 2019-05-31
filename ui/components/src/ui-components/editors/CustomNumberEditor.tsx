/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

// cSpell:ignore customnumber testid

import * as React from "react";
import classnames from "classnames";
import { Logger } from "@bentley/bentleyjs-core";
import {
  PropertyValueFormat, PropertyValue, PrimitiveValue, PropertyRecord, PropertyEditorParams, PropertyEditorParamTypes,
  InputEditorSizeParams, CustomFormattedNumberParams, IModelApp, NotifyMessageDetails, OutputMessagePriority,
} from "@bentley/imodeljs-frontend";
import { PropertyEditorProps, TypeEditor } from "./EditorContainer";
import { PropertyEditorManager, PropertyEditorBase } from "./PropertyEditorManager";
import { UiComponents } from "../UiComponents";

import "./CustomNumberEditor.scss";

/** @internal */
interface CustomNumberEditorState {
  inputValue: string;
  size?: number;
  maxLength?: number;
}

/** CustomNumberEditor is a React component that is a property editor for numbers that specify custom formatting and parsing functions.
 *
 * @alpha
 */
export class CustomNumberEditor extends React.PureComponent<PropertyEditorProps, CustomNumberEditorState> implements TypeEditor {
  private _input: HTMLInputElement | null = null;
  private _isMounted = false;
  private _formatParams: CustomFormattedNumberParams | undefined;

  /** @internal */
  public readonly state: Readonly<CustomNumberEditorState> = {
    inputValue: "",
  };

  public async getPropertyValue(): Promise<PropertyValue | undefined> {
    const record = this.props.propertyRecord as PropertyRecord;
    let propertyValue: PropertyValue | undefined;

    if (record.isReadonly) {
      return {
        valueFormat: PropertyValueFormat.Primitive,
        value: (record.value as PrimitiveValue).value,
        displayValue: (record.value as PrimitiveValue).displayValue,
      };
    }

    // istanbul ignore else
    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      const parseResults = (this._formatParams as CustomFormattedNumberParams).parseFunction(this.state.inputValue, record.property.quantityType);
      if (!parseResults.parseError && parseResults.value) {
        const newDisplayValue = (this._formatParams as CustomFormattedNumberParams).formatFunction(parseResults.value as number, record.property!.quantityType);
        propertyValue = {
          valueFormat: PropertyValueFormat.Primitive,
          value: parseResults.value,
          displayValue: newDisplayValue,
        };
        // make sure the text in the input item matches the latest formatted text... this could get out if the input string say 1.5 === the display string of 1'-6"
        // istanbul ignore else
        if (newDisplayValue !== this.state.inputValue) {
          this.setState({ inputValue: newDisplayValue });
        }
      } else {
        const msg = new NotifyMessageDetails(OutputMessagePriority.Error, UiComponents.translate("errors.unable-to-parse-quantity"));
        msg.setInputFieldTypeDetails(this._input as HTMLElement);
        // istanbul ignore next
        if (IModelApp.notifications)
          IModelApp.notifications.outputMessage(msg);
        const displayValue = (record.value.displayValue && record.value.displayValue.length > 0) ? record.value.displayValue : (this._formatParams as CustomFormattedNumberParams).formatFunction(record.value.value as number, record.property!.quantityType);
        propertyValue = {
          valueFormat: PropertyValueFormat.Primitive,
          value: record.value.value,
          displayValue,
        };
      }
    }
    return propertyValue;
  }

  private setFocus(): void {
    const record = this.props.propertyRecord as PropertyRecord;
    const disabled = (record && !record.isDisabled) ? false : true;
    const readonly = (record && !record.isReadonly) ? false : true;

    // istanbul ignore else
    if (this._input && !disabled && !readonly) {
      this._input.focus();
    }
  }

  private _applyUpdatedValue(userInput: string) {
    const record = this.props.propertyRecord as PropertyRecord;
    const readonly = (record && !record.isReadonly) ? false : true;
    const disabled = (record && !record.isDisabled) ? false : true;

    if (readonly || disabled)
      return;

    // istanbul ignore else
    if (this._isMounted)
      this.setState({
        inputValue: userInput,
      });
  }

  private _updateInputValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    this._applyUpdatedValue(e.target.value);
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
    // istanbul ignore next
    if (!record || !record.property) {
      Logger.logError(UiComponents.loggerCategory(this), "PropertyRecord must be defined to use CustomNumberPropertyEditor");
      // tslint:disable-next-line:no-console
      // console.log("PropertyRecord must be defined to use CustomNumberPropertyEditor");
      return;
    }
    // istanbul ignore else
    if (record.property && record.property.editor && record.property.editor.params) {
      this._formatParams = record.property.editor.params.find((param: PropertyEditorParams) => param.type === PropertyEditorParamTypes.CustomFormattedNumber) as CustomFormattedNumberParams;
    }

    if (!this._formatParams) {
      Logger.logError(UiComponents.loggerCategory(this), `CustomFormattedNumberParams must be defined for property ${record!.property!.name}`);
      // tslint:disable-next-line:no-console
      // console.log(`CustomFormattedNumberParams must be defined for property ${record!.property!.name}`);
      return;
    }

    let initialDisplayValue = "";
    let numberValue = 0;

    // istanbul ignore else
    if (record.value.valueFormat === PropertyValueFormat.Primitive) {
      const primitiveValue = (record.value as PrimitiveValue);
      numberValue = (undefined !== primitiveValue.value) ? primitiveValue.value as number : 0;
      if (primitiveValue.displayValue)
        initialDisplayValue = primitiveValue.displayValue;
      else
        initialDisplayValue = (this._formatParams as CustomFormattedNumberParams).formatFunction(numberValue, record.property!.quantityType);
    }

    let size: number | undefined;
    let maxLength: number | undefined;
    // istanbul ignore else
    if (record.property && record.property.editor && record.property.editor.params) {
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
        { inputValue: initialDisplayValue, size, maxLength },
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

  private _resetToOriginalValue() {
    const record = this.props.propertyRecord;
    let initialDisplayValue = "";
    let numberValue = 0;
    if (record) {
      if (record.value.valueFormat === PropertyValueFormat.Primitive) {
        const primitiveValue = (record.value as PrimitiveValue);
        numberValue = (undefined !== primitiveValue.value) ? primitiveValue.value as number : 0;
        if (primitiveValue.displayValue)
          initialDisplayValue = primitiveValue.displayValue;
        else
          initialDisplayValue = (this._formatParams as CustomFormattedNumberParams).formatFunction(numberValue, record.property!.quantityType);
      }
    }

    this.setState({ inputValue: initialDisplayValue });
  }

  private _onKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this._resetToOriginalValue();
    }

    if (e.key !== "Enter") {
      // istanbul ignore next
      if (IModelApp.notifications)
        IModelApp.notifications.closeInputFieldMessage();
    }
  }

  /** @internal */
  public render() {
    const record = this.props.propertyRecord as PropertyRecord;
    if (!record || !this._formatParams)
      return null;

    const readonly = !record.isReadonly ? false : true;
    const isDisabled = !record.isDisabled ? false : true;

    const className = classnames("cell", "components-cell-editor", "components-customnumber-editor", this.props.className);
    return (
      <input
        ref={(node) => this._input = node}
        type="text"
        className={className}
        style={this.props.style}
        readOnly={readonly}
        disabled={isDisabled}
        size={this.state.size}
        maxLength={this.state.maxLength}
        value={this.state.inputValue}
        onChange={this._updateInputValue}
        onKeyDown={this._onKeyPress}
        data-testid="components-customnumber-editor"
      />
    );
  }
}
// onKeyPress={this._onKeyPress}

/** CustomNumberPropertyEditor React component that uses the [[CustomNumberEditor]] property editor.
 * @alpha
 */
export class CustomNumberPropertyEditor extends PropertyEditorBase {

  public get reactElement(): React.ReactNode {
    return <CustomNumberEditor />;
  }
}
PropertyEditorManager.registerEditor("number", CustomNumberPropertyEditor, "number-custom");
