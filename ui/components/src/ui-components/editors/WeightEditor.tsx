/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import * as React from "react";
import classnames from "classnames";
import { PropertyValueFormat, PropertyValue, PrimitiveValue, PropertyRecord } from "@bentley/imodeljs-frontend"; // , PropertyEditorParams, PropertyEditorParamTypes, WeightEditorParams
import { PropertyEditorProps, TypeEditor } from "./EditorContainer";
import { WeightPickerButton } from "../lineweight/WeightPickerButton";
import { PropertyEditorManager, PropertyEditorBase } from "./PropertyEditorManager";
import "./WeightEditor.scss";

/** @internal */
interface WeightEditorState {
  weightValue: number;
  readonly: boolean;
  isDisabled?: boolean;
}

/** WeightEditor React component that is a property editor with text input
 * @beta
 */
export class WeightEditor extends React.PureComponent<PropertyEditorProps, WeightEditorState> implements TypeEditor {
  private _control: any | null = null;
  private _isMounted = false;
  private _availableWeights: number[] = [];

  /** @internal */
  public readonly state: Readonly<WeightEditorState> = {
    weightValue: 0,
    readonly: false,
  };

  constructor(props: PropertyEditorProps) {
    super(props);

    // TODO: add support for following if we need to specify set of weights to display
    //  const record = this.props.propertyRecord;
    //  if (record && record.property && record.property.editor && record.property.editor.params) {
    //    const weightParams = record.property.editor.params.find((param: PropertyEditorParams) => param.type === PropertyEditorParamTypes.ColorData) as WeightEditorParams;
    //    // istanbul ignore else
    //    if (weightParams) {
    //      weightParams.weightValues.forEach((weight: number) => {
    //        this._availableWeights.push(weight);
    //      });
    //    }
    //   }
  }

  public getValue(): number {
    return this.state.weightValue;
  }

  public async getPropertyValue(): Promise<PropertyValue | undefined> {
    const record = this.props.propertyRecord;
    let propertyValue: PropertyValue | undefined;

    // istanbul ignore else
    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      propertyValue = {
        valueFormat: PropertyValueFormat.Primitive,
        value: this.state.weightValue,
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

  private _onLineWeightPick = (weight: number) => {
    const propertyRecord = this.props.propertyRecord as PropertyRecord;

    this.setState({
      weightValue: weight,
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
        { weightValue: initialValue, readonly, isDisabled },
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
    return (
      <div className={classnames("components-weight-editor", this.props.className)} style={this.props.style}>
        <WeightPickerButton ref={(control) => this._control = control}
          activeWeight={this.state.weightValue}
          weights={this._availableWeights.length > 0 ? this._availableWeights : undefined}
          disabled={this.state.isDisabled ? true : false}
          onLineWeightPick={this._onLineWeightPick}
          data-testid="components-weight-editor" />
      </div>
    );
  }
}

/** WeightPropertyEditor returns React component [[WeightEditor]] to select a  color value.
 * @beta
 */
export class WeightPropertyEditor extends PropertyEditorBase {
  public get reactElement(): React.ReactNode {
    return <WeightEditor />;
  }
}

PropertyEditorManager.registerEditor("number", WeightPropertyEditor, "weight-picker");
