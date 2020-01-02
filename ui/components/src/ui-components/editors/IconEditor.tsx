/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import * as React from "react";
import classnames from "classnames";
import {
  PropertyValueFormat, PropertyValue, PrimitiveValue, PropertyRecord, IconListEditorParams,
  PropertyEditorParams, PropertyEditorParamTypes,
} from "@bentley/imodeljs-frontend";
import { PropertyEditorProps, TypeEditor } from "./EditorContainer";
import { IconPickerButton } from "../iconpicker/IconPickerButton";
import { PropertyEditorManager, PropertyEditorBase } from "./PropertyEditorManager";
import "./IconEditor.scss";

/** @internal */
interface IconEditorState {
  icon: string;
  icons: string[];
  numColumns: number;
  readonly?: boolean;
  isDisabled?: boolean;
}

/** IconEditor React component that is a property editor with button and popup
 * @alpha
 */
// istanbul ignore next
export class IconEditor extends React.PureComponent<PropertyEditorProps, IconEditorState> implements TypeEditor {
  private _control: any | null = null;
  private _isMounted = false;

  constructor(props: PropertyEditorProps) {
    super(props);

    let icon = "";
    let numColumns = 4;
    const icons: string[] = [];
    const readonly = false;

    // TODO: add support for following if we need to specify set of weights to display
    const record = props.propertyRecord;
    if (record && record.property && record.property.editor && record.property.editor.params) {
      const iconParams = record.property.editor.params.find((param: PropertyEditorParams) => param.type === PropertyEditorParamTypes.IconListData) as IconListEditorParams;
      // istanbul ignore else
      if (iconParams) {
        if (iconParams.iconValue)
          icon = iconParams.iconValue;
        if (iconParams.numColumns)
          numColumns = iconParams.numColumns;
        if (iconParams.iconValues)
          iconParams.iconValues.forEach((i: string) => icons.push(i));
      }
    }

    this.state = { icon, icons, numColumns, readonly };
  }

  // istanbul ignore next
  public getValue(): string {
    return this.state.icon;
  }

  public async getPropertyValue(): Promise<PropertyValue | undefined> {
    const record = this.props.propertyRecord;
    let propertyValue: PropertyValue | undefined;

    // istanbul ignore else
    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      propertyValue = {
        valueFormat: PropertyValueFormat.Primitive,
        value: this.state.icon,
        displayValue: "",
      };
    }

    return propertyValue;
  }

  private setFocus(): void {
    // istanbul ignore else
    if (this._control && !this.state.isDisabled) {
      this._control.setFocus();
    }
  }

  private _onIconChange = (icon: string) => {
    const propertyRecord = this.props.propertyRecord as PropertyRecord;

    this.setState({
      icon,
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
    let initialValue = "";

    // istanbul ignore else
    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      initialValue = (record.value as PrimitiveValue).value as string;
    }

    const readonly = record && undefined !== record.isReadonly ? record.isReadonly : false;
    const isDisabled = record ? record.isDisabled : undefined;

    // istanbul ignore else
    if (this._isMounted)
      this.setState(
        { icon: initialValue, readonly, isDisabled },
        () => {
          if (this.props.setFocus) {
            this.setFocus();
          }
        },
      );
  }

  public render() {
    const { icon, icons, numColumns } = this.state;
    return (
      <div className={classnames("components-icon-editor", this.props.className)} style={this.props.style}>
        <IconPickerButton ref={(control) => this._control = control}
          icon={icon}
          icons={icons}
          numColumns={numColumns}
          disabled={this.state.isDisabled}
          readonly={this.state.readonly}
          onIconChange={this._onIconChange}
          data-testid="components-icon-editor" />
      </div>
    );
  }
}

/** IconPropertyEditor returns React component [[IconEditor]] to select an icon (string).
 * @alpha
 */
// istanbul ignore next
export class IconPropertyEditor extends PropertyEditorBase {
  public get reactElement(): React.ReactNode {
    return <IconEditor />;
  }
}

PropertyEditorManager.registerEditor("text", IconPropertyEditor, "icon-picker");
PropertyEditorManager.registerEditor("string", IconPropertyEditor, "icon-picker");
