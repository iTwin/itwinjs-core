/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import * as React from "react";
import classnames from "classnames";
import {
  PropertyValueFormat, PrimitiveValue, PropertyValue, EnumerationChoice,
  PropertyEditorParamTypes, IconDefinition, PropertyEditorParams, ButtonGroupEditorParams, PropertyRecord,
} from "@bentley/imodeljs-frontend";
import { PropertyEditorManager, PropertyEditorBase } from "./PropertyEditorManager";
import { PropertyEditorProps, TypeEditor } from "./EditorContainer";
import "./EnumButtonGroupEditor.scss";

interface EnumEditorState {
  selectValue: string | number;
  valueIsNumber: boolean;
  propertyRecord?: PropertyRecord;
}

/** EnumButtonGroupEditor React component that is a property editor with select input  */
export class EnumButtonGroupEditor extends React.Component<PropertyEditorProps, EnumEditorState> implements TypeEditor {
  private _isMounted = false;
  private _enumIcons?: IconDefinition[];
  private _btnRefs = new Map<string | number, HTMLButtonElement>();

  /** @hidden */
  public readonly state: Readonly<EnumEditorState> = {
    selectValue: "",
    valueIsNumber: false,
  };

  constructor(props: PropertyEditorProps) {
    super(props);

    const state = EnumButtonGroupEditor.getStateFromProps(props);
    if (state)
      this.state = state;

    this.loadIcons();
  }

  private loadIcons(): void {
    if (this._enumIcons)
      return;

    const { propertyRecord } = this.props;

    if (propertyRecord) {
      if (propertyRecord.property.enum) {
        const numChoices = propertyRecord.property.enum.choices.length;
        this._enumIcons = new Array<IconDefinition>(numChoices);
        this._enumIcons.fill({ iconClass: "icon icon-placeholder" });

        if (propertyRecord.property.editor && propertyRecord.property.editor.params) {
          const bgParams = propertyRecord.property.editor.params.find((param: PropertyEditorParams) => param.type === PropertyEditorParamTypes.ButtonGroupData) as ButtonGroupEditorParams;
          if (bgParams) {
            bgParams.buttons.forEach((iconDef: IconDefinition, index: number) => {
              if (index < numChoices) {
                this._enumIcons![index] = iconDef;
              }
            });
          }
        }
      }
    }
  }

  public getValue(): string | number {
    return this.state.selectValue;
  }

  public async getPropertyValue(): Promise<PropertyValue | undefined> {
    const record = this.props.propertyRecord;
    let propertyValue: PropertyValue | undefined;
    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      propertyValue = record.value;
      (record.value as PrimitiveValue).value = this.state.selectValue;
    }
    return propertyValue;
  }

  public setFocus(): void {
    const button = this._btnRefs.get(this.state.selectValue);
    // istanbul ignore else
    if (button)
      button.focus();
  }

  public componentDidMount() {
    this._isMounted = true;
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  /** @hidden */
  public componentDidUpdate() {
    // required to ensure the state is kept in sync with props, since props may be updated from outside the type editor. For example from interactive tool.
    const state = EnumButtonGroupEditor.getStateFromProps(this.props);
    // istanbul ignore else
    if (this.state.selectValue !== state!.selectValue) {
      this.setState(state);
      const button = this._btnRefs.get(state!.selectValue);
      // istanbul ignore else
      if (button)
        button.focus();
    }
  }

  private static getStateFromProps(props: PropertyEditorProps): EnumEditorState | null {
    const propertyRecord = props.propertyRecord;
    let selectValue: string | number;
    let valueIsNumber: boolean;

    // istanbul ignore else
    if (propertyRecord && propertyRecord.value.valueFormat === PropertyValueFormat.Primitive) {
      const primitiveValue = (propertyRecord.value as PrimitiveValue).value;
      if (typeof primitiveValue === "string") {
        selectValue = primitiveValue as string;
        valueIsNumber = false;
      } else {
        selectValue = primitiveValue as number;
        valueIsNumber = true;
      }

      return { selectValue, valueIsNumber, propertyRecord };
    }

    return null;
  }

  private getIcon(index: number) {
    if (this._enumIcons && this._enumIcons.length > index)
      return (<i className={this._enumIcons[index].iconClass} />);
    return null;
  }

  private _handleButtonClick = (index: number) => {
    const propertyRecord = this.props.propertyRecord as PropertyRecord;
    const choices = propertyRecord ? propertyRecord.property.enum!.choices : undefined;

    // istanbul ignore else
    if (this._isMounted && choices && choices.length > index) {
      const selectValue = choices[index].value;

      this.setState({ selectValue }, async () => {
        if (this.props.onCommit) {
          const propertyValue = await this.getPropertyValue();
          // istanbul ignore else
          if (propertyValue)
            this.props.onCommit({ propertyRecord, newValue: propertyValue });
        }
      });
    }
  }

  private getButton(choice: EnumerationChoice, index: number) {
    const { propertyRecord } = this.props;
    const choiceValue = propertyRecord!.property.enum!.choices[index].value;
    const isActive = (choiceValue === this.state.selectValue) ? true : false;
    let isDisabled = false;
    if (this._enumIcons && this._enumIcons.length > index) {
      const isEnabledFunction = this._enumIcons![index].isEnabledFunction;
      if (isEnabledFunction) {
        isDisabled = !isEnabledFunction();
      }
    }

    const className = classnames(
      "components-enumbuttongroup-button",
      isDisabled && "nz-is-disabled",
      isActive && "nz-is-active",
    );

    return (
      <button
        ref={(ref: HTMLButtonElement) => this._btnRefs.set(choiceValue, ref)}
        className={className}
        title={choice.label}
        key={choice.label}
        onClick={() => this._handleButtonClick(index)}
      >
        {this.getIcon(index)}
      </button>
    );
  }

  public render() {
    const { propertyRecord } = this.props;
    let choices: EnumerationChoice[] | undefined;

    // istanbul ignore else
    if (propertyRecord && propertyRecord.property.enum)
      choices = propertyRecord.property.enum.choices;

    return (
      <div className="components-enumbuttongroup-editor">
        {choices && choices.map((choice: EnumerationChoice, index: number) => this.getButton(choice, index))}
      </div>);
  }
}

/** EnumPropertyButtonGroupEditor React component that uses the [[EnumButtonGroupEditor]] property editor. */
export class EnumPropertyButtonGroupEditor extends PropertyEditorBase {

  public get reactElement(): React.ReactNode {
    return <EnumButtonGroupEditor />;
  }
}

PropertyEditorManager.registerEditor("enum", EnumPropertyButtonGroupEditor, "enum-buttongroup");
