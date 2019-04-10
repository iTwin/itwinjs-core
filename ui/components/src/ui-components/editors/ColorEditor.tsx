/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import * as React from "react";
import classnames from "classnames";
import { PropertyValueFormat, PropertyValue, PrimitiveValue, PropertyRecord, PropertyEditorParams, PropertyEditorParamTypes, ColorEditorParams } from "@bentley/imodeljs-frontend"; //
import { PropertyEditorProps, TypeEditor } from "./EditorContainer";
import { ColorDef } from "@bentley/imodeljs-common";
import { ColorPickerButton } from "../color/ColorPickerButton";
import { PropertyEditorManager, PropertyEditorBase } from "./PropertyEditorManager";
import "./ColorEditor.scss";

/** @internal */
interface ColorEditorState {
  colorValue: number;
  readonly: boolean;
  isDisabled?: boolean;
}

/** ColorEditor React component that is a property editor with text input
 * @beta
 */
export class ColorEditor extends React.PureComponent<PropertyEditorProps, ColorEditorState> implements TypeEditor {
  private _control: any | null = null;
  private _isMounted = false;
  private _availableColors: ColorDef[] = [];
  private _numColumns = 4;

  /** @internal */
  public readonly state: Readonly<ColorEditorState> = {
    colorValue: 0,
    readonly: false,
  };

  constructor(props: PropertyEditorProps) {
    super(props);

    const record = this.props.propertyRecord;
    if (record && record.property && record.property.editor && record.property.editor.params) {
      const colorParams = record.property.editor.params.find((param: PropertyEditorParams) => param.type === PropertyEditorParamTypes.ColorData) as ColorEditorParams;
      // istanbul ignore else
      if (colorParams) {
        colorParams.colorValues.forEach((colorNumber: number) => {
          this._availableColors.push(new ColorDef(colorNumber));
        });
        if (colorParams.numColumns)
          this._numColumns = colorParams.numColumns;
      }
    }
  }

  public getValue(): number {
    return this.state.colorValue;
  }

  public async getPropertyValue(): Promise<PropertyValue | undefined> {
    const record = this.props.propertyRecord;
    let propertyValue: PropertyValue | undefined;

    // istanbul ignore else
    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      propertyValue = {
        valueFormat: PropertyValueFormat.Primitive,
        value: this.state.colorValue,
        displayValue: "",
      };
    }

    return propertyValue;
  }

  private setFocus(): void {
    // istanbul ignore else
    if (this._control && !this.state.isDisabled) {
      this._control.focus();
    }
  }

  private _onColorPick = (color: ColorDef) => {
    const propertyRecord = this.props.propertyRecord as PropertyRecord;

    this.setState({
      colorValue: color.tbgr,
    }, async () => {
      // istanbul ignore else
      if (propertyRecord && this.props.onCommit) {
        const propertyValue = await this.getPropertyValue();
        // istanbul ignore else
        if (propertyValue) {
          this.props.onCommit({ propertyRecord, newValue: propertyValue });
        }
      }
    });
  }

  public componentDidMount() {
    this._isMounted = true;
    this.setStateFromProps(); // tslint:disable-line:no-floating-promises
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  public componentDidUpdate(prevProps: PropertyEditorProps) {
    if (this.props.propertyRecord !== prevProps.propertyRecord) {
      this.setStateFromProps(); // tslint:disable-line:no-floating-promises
    }
  }

  private async setStateFromProps() {
    const record = this.props.propertyRecord;
    let initialValue = 0;

    // istanbul ignore else
    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      initialValue = (record.value as PrimitiveValue).value as number;
    }

    const readonly = record && undefined !== record.isReadonly ? record.isReadonly : false;
    const isDisabled = record ? record.isDisabled : undefined;

    // istanbul ignore else
    if (this._isMounted)
      this.setState(
        { colorValue: initialValue, readonly, isDisabled },
        () => {
          if (this.props.setFocus) {
            this.setFocus();
            // istanbul ignore else
            if (this._control)
              this._control.select();
          }
        },
      );
  }

  public render() {
    const colorDef = new ColorDef(this.state.colorValue);
    return (
      <div className={classnames("components-color-editor", this.props.className)} style={this.props.style}>
        <ColorPickerButton ref={(control) => this._control = control}
          activeColor={colorDef}
          colorDefs={this._availableColors.length > 0 ? this._availableColors : undefined}
          numColumns={this._numColumns}
          disabled={this.state.isDisabled ? true : false}
          onColorPick={this._onColorPick}
          data-testid="components-color-editor" />
      </div>
    );
  }
}

/** ColorPropertyEditor returns React component [[ColorEditor]] to select a  color value.
 * @beta
 */
export class ColorPropertyEditor extends PropertyEditorBase {
  public get reactElement(): React.ReactNode {
    return <ColorEditor />;
  }
}

PropertyEditorManager.registerEditor("number", ColorPropertyEditor, "color-picker");
