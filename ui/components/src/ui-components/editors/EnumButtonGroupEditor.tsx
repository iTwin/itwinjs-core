/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyEditors
 */

import "./EnumButtonGroupEditor.scss";
import classnames from "classnames";
import * as React from "react";
import {
  ButtonGroupEditorParams, EnumerationChoice, IconDefinition, PrimitiveValue, PropertyEditorParams, PropertyEditorParamTypes, PropertyRecord,
  PropertyValue, PropertyValueFormat, StandardEditorNames, StandardTypeNames,
} from "@bentley/ui-abstract";
import { Icon } from "@bentley/ui-core";
import { PropertyEditorProps, TypeEditor } from "./EditorContainer";
import { PropertyEditorBase, PropertyEditorManager } from "./PropertyEditorManager";

// cspell:ignore buttongroup enumbuttongroup

/** @internal */
interface EnumButtonGroupEditorState {
  selectValue: string | number;
  enumIcons: IconDefinition[];
}

/** EnumButtonGroupEditor React component that is a property editor with select input
 * @beta
 */
export class EnumButtonGroupEditor extends React.Component<PropertyEditorProps, EnumButtonGroupEditorState> implements TypeEditor {
  private _btnRefs = new Map<string | number, HTMLButtonElement>();

  /** @internal */
  public readonly state: Readonly<EnumButtonGroupEditorState> = {
    selectValue: "",
    enumIcons: [],
  };

  public async getPropertyValue(): Promise<PropertyValue | undefined> {
    const record = this.props.propertyRecord;
    let propertyValue: PropertyValue | undefined;

    // istanbul ignore else
    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      propertyValue = {
        valueFormat: PropertyValueFormat.Primitive,
        value: this.state.selectValue,
        displayValue: "",
      };
    }

    return propertyValue;
  }

  /** @internal */
  public componentDidMount() {
    this.setStateFromProps(); // tslint:disable-line:no-floating-promises
  }

  /** @internal */
  public componentDidUpdate(prevProps: PropertyEditorProps) {
    if (this.props.propertyRecord !== prevProps.propertyRecord) {
      this.setStateFromProps(); // tslint:disable-line:no-floating-promises
    }
  }

  private async setStateFromProps() {
    const { propertyRecord } = this.props;

    // istanbul ignore else
    if (propertyRecord && propertyRecord.property.enum && propertyRecord.value.valueFormat === PropertyValueFormat.Primitive) {
      const primitiveValue = (propertyRecord.value as PrimitiveValue).value;
      let selectValue: string | number;

      if (typeof primitiveValue === "string") {
        selectValue = primitiveValue as string;
      } else {
        selectValue = primitiveValue as number;
      }

      const numChoices = propertyRecord!.property.enum!.choices.length;
      const enumIcons = new Array<IconDefinition>(numChoices);
      enumIcons.fill({ iconSpec: "icon icon-placeholder" });

      // istanbul ignore else
      if (propertyRecord.property.editor && propertyRecord.property.editor.params) {
        // istanbul ignore else
        if (propertyRecord.property.editor && propertyRecord.property.editor.params) {
          const bgParams = propertyRecord.property.editor.params.find((param: PropertyEditorParams) => param.type === PropertyEditorParamTypes.ButtonGroupData) as ButtonGroupEditorParams;
          // istanbul ignore else
          if (bgParams) {
            bgParams.buttons.forEach((iconDef: IconDefinition, index: number) => {
              // istanbul ignore else
              if (index < numChoices) {
                enumIcons![index] = iconDef;
              }
            });
          }
        }
      }
      this.setState({ selectValue, enumIcons });
    }
  }

  private _handleButtonClick = (index: number) => {
    const propertyRecord = this.props.propertyRecord as PropertyRecord;
    // istanbul ignore next
    const choices = propertyRecord ? propertyRecord.property.enum!.choices : undefined;

    // istanbul ignore else
    if (choices && choices.length > index) {
      const selectValue = choices[index].value;

      this.setState({
        selectValue,
      }, async () => {
        // istanbul ignore else
        if (propertyRecord && this.props.onCommit) {
          const propertyValue = await this.getPropertyValue();
          // istanbul ignore else
          if (propertyValue !== undefined) {
            this.props.onCommit({ propertyRecord, newValue: propertyValue });
          }
        }
      });
    }
  }

  private getButton(choice: EnumerationChoice, index: number) {
    const { propertyRecord } = this.props;
    const choiceValue = propertyRecord!.property.enum!.choices[index].value;
    const isActive = (choiceValue === this.state.selectValue) ? true : false;
    let isDisabled = false;
    const isEnabledFunction = this.state.enumIcons[index].isEnabledFunction;
    // istanbul ignore else
    if (isEnabledFunction) {
      isDisabled = !isEnabledFunction();
    }

    const className = classnames(
      "components-enumbuttongroup-button",
      isDisabled && "nz-is-disabled",
      isActive && "nz-is-active",
    );

    return (
      <button
        ref={(ref: HTMLButtonElement) => this._btnRefs.set(choiceValue, ref)}
        data-testid={choice.label}
        className={className}
        title={choice.label}
        key={choice.label}
        onClick={() => this._handleButtonClick(index)}
      >
        <Icon iconSpec={this.state.enumIcons[index].iconSpec} />
      </button >
    );
  }

  /** @internal */
  public render() {
    const { propertyRecord } = this.props;
    let choices: EnumerationChoice[] | undefined;

    // istanbul ignore else
    if (propertyRecord && propertyRecord.property.enum)
      choices = propertyRecord.property.enum.choices;

    return (
      <div className={classnames("components-enumbuttongroup-editor", this.props.className)} style={this.props.style}>
        {choices && this.state.enumIcons.length && choices.map((choice: EnumerationChoice, index: number) => this.getButton(choice, index))}
      </div>);
  }
}

/** Enum Property Button Group Editor registered for the "enum" type name and the "enum-buttongroup" editor name.
 * It uses the [[EnumButtonGroupEditor]] React component.
 * @beta
 */
export class EnumPropertyButtonGroupEditor extends PropertyEditorBase {

  public get reactNode(): React.ReactNode {
    return <EnumButtonGroupEditor />;
  }
}

PropertyEditorManager.registerEditor(StandardTypeNames.Enum, EnumPropertyButtonGroupEditor, StandardEditorNames.EnumButtonGroup);
