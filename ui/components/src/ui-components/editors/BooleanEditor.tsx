/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import * as React from "react";
import classnames from "classnames";
import { PropertyValueFormat, PrimitiveValue, PropertyValue } from "@bentley/imodeljs-frontend";
import { PropertyEditorManager, PropertyEditorBase } from "./PropertyEditorManager";
import { PropertyEditorProps, TypeEditor } from "./EditorContainer";
import "./BooleanEditor.scss";

/** @internal */
interface BooleanEditorState {
  checkboxValue: boolean;
}

/** BooleanEditor React component that is a property editor with checkbox input
 * @beta
 */
export class BooleanEditor extends React.PureComponent<PropertyEditorProps, BooleanEditorState> implements TypeEditor {
  private _checkboxElement: HTMLInputElement | null = null;
  private _isMounted = false;

  /** @internal */
  public readonly state: Readonly<BooleanEditorState> = {
    checkboxValue: false,
  };

  public getValue(): boolean {
    return this.state.checkboxValue;
  }

  public async getPropertyValue(): Promise<PropertyValue | undefined> {
    const record = this.props.propertyRecord;
    let propertyValue: PropertyValue | undefined;

    // istanbul ignore else
    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      propertyValue = {
        valueFormat: PropertyValueFormat.Primitive,
        value: this.state.checkboxValue,
        displayValue: "",
      };
    }

    return propertyValue;
  }

  private setFocus(): void {
    // istanbul ignore else
    if (this._checkboxElement) {
      this._checkboxElement.focus();
    }
  }

  private _updateCheckboxValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    // istanbul ignore else
    if (this._isMounted) {
      let checkboxValue: boolean = false;

      // istanbul ignore if
      if (e.target.checked !== undefined)   // Needed for unit test environment
        checkboxValue = e.target.checked;
      else {
        // istanbul ignore else
        if (e.target.value !== undefined && typeof e.target.value === "boolean")
          checkboxValue = e.target.value;
      }

      this.setState({
        checkboxValue,
      }, async () => {
        // istanbul ignore else
        if (this.props.propertyRecord && this.props.onCommit) {
          const propertyValue = await this.getPropertyValue();
          // istanbul ignore else
          if (propertyValue) {
            this.props.onCommit({ propertyRecord: this.props.propertyRecord, newValue: propertyValue });
          }
        }
      });
    }
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
    const { propertyRecord } = this.props;
    let checkboxValue = false;

    // istanbul ignore else
    if (propertyRecord && propertyRecord.value.valueFormat === PropertyValueFormat.Primitive) {
      const primitiveValue = (propertyRecord.value as PrimitiveValue).value;
      checkboxValue = primitiveValue as boolean;
    }

    // istanbul ignore else
    if (this._isMounted)
      this.setState(
        { checkboxValue },
        () => {
          if (this.props.setFocus)
            this.setFocus();
        },
      );
  }

  public render() {
    const className = classnames("cell", "components-cell-editor", "components-boolean-editor");
    const checked = this.state.checkboxValue;

    return (
      <input
        type="checkbox"
        ref={(node) => this._checkboxElement = node}
        onBlur={this.props.onBlur}
        className={className}
        checked={checked}
        onChange={this._updateCheckboxValue}
        data-testid="components-checkbox-editor">
      </input>
    );
  }
}

/** BooleanPropertyEditor React component that uses the [[BooleanEditor]] property editor.
 * @beta
 */
export class BooleanPropertyEditor extends PropertyEditorBase {

  public get reactElement(): React.ReactNode {
    return <BooleanEditor />;
  }
}

PropertyEditorManager.registerEditor("bool", BooleanPropertyEditor);
PropertyEditorManager.registerEditor("boolean", BooleanPropertyEditor);
