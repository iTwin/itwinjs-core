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
import { Toggle } from "@bentley/ui-core";
import "./ToggleEditor.scss";

interface ToggleEditorState {
  toggleValue: boolean;
}

/** ToggleEditor React component that is a property editor with checkbox input  */
export class ToggleEditor extends React.PureComponent<PropertyEditorProps, ToggleEditorState> implements TypeEditor {
  private _isMounted = false;

  /** @hidden */
  public readonly state: Readonly<ToggleEditorState> = {
    toggleValue: false,
  };

  public getValue(): boolean {
    return this.state.toggleValue;
  }

  public async getPropertyValue(): Promise<PropertyValue | undefined> {
    const record = this.props.propertyRecord;
    let propertyValue: PropertyValue | undefined;

    // istanbul ignore else
    if (record && record.value.valueFormat === PropertyValueFormat.Primitive) {
      propertyValue = record.value;
      (record.value as PrimitiveValue).value = this.state.toggleValue;
    }

    return propertyValue;
  }

  private setFocus(): void {
  }

  private _updateToggleValue = (toggleValue: boolean): any => {
    // istanbul ignore else
    if (this._isMounted) {

      this.setState({
        toggleValue,
      }, async () => {
        // istanbul ignore else
        if (this.props.propertyRecord && this.props.onCommit) {
          const propertyValue = await this.getPropertyValue();
          // istanbul ignore else
          if (propertyValue)
            this.props.onCommit({ propertyRecord: this.props.propertyRecord, newValue: propertyValue });
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
    let toggleValue = false;

    // istanbul ignore else
    if (propertyRecord && propertyRecord.value.valueFormat === PropertyValueFormat.Primitive) {
      const primitiveValue = (propertyRecord.value as PrimitiveValue).value;
      toggleValue = primitiveValue as boolean;
    }

    // istanbul ignore else
    if (this._isMounted)
      this.setState(
        { toggleValue },
        () => {
          if (this.props.setFocus)
            this.setFocus();
        },
      );
  }

  public render() {
    const className = classnames("cell", "components-cell-editor", "components-toggle-editor");
    const inOn = this.state.toggleValue;

    return (
      <Toggle
        onBlur={this.props.onBlur}
        className={className}
        isOn={inOn}
        onChange={this._updateToggleValue} />
    );
  }
}

/** TogglePropertyEditor React component that uses the [[ToggleEditor]] property editor. */
export class TogglePropertyEditor extends PropertyEditorBase {

  public get reactElement(): React.ReactNode {
    return <ToggleEditor />;
  }
}

PropertyEditorManager.registerEditor("bool", TogglePropertyEditor, "toggle");
PropertyEditorManager.registerEditor("boolean", TogglePropertyEditor, "toggle");
