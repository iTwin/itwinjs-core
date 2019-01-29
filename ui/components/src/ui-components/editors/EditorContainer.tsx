/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import * as React from "react";
import { PropertyRecord } from "../properties/Record";
import { PropertyEditorBase, PropertyEditorManager } from "./PropertyEditorManager";
import { PropertyValue } from "../properties/Value";

import "./EditorContainer.scss";

/** Arguments for the Property Updated event callback */
export interface PropertyUpdatedArgs {
  /** The property being updated. */
  propertyRecord: PropertyRecord;
  /** The new value for the property. */
  newValue: PropertyValue;
}

/** Properties for a property editor component */
export interface PropertyEditorProps {
  propertyRecord?: PropertyRecord;
  onCommit?: (args: PropertyUpdatedArgs) => void;
  onCancel?: () => void;
  onBlur?: (event: React.FocusEvent) => void;
}

/** [[EditorContainer]] React component properties */
export interface EditorContainerProps {
  propertyRecord: PropertyRecord;
  title?: string;
  onCommit: (args: PropertyUpdatedArgs) => void;
  onCancel: () => void;

  /** @hidden */
  ignoreEditorBlur?: boolean;
}

interface CloneProps extends PropertyEditorProps {
  ref: (ref: any) => void;
}

/** Interface implemented by React based type editors  */
export interface TypeEditor {
  getPropertyValue: () => Promise<PropertyValue | undefined>;
  setFocus: () => void;
}

/**
 * EditorContainer React component
 */
export class EditorContainer extends React.Component<EditorContainerProps> {

  private _editorRef: any;
  private _propertyEditor: PropertyEditorBase | undefined;

  private getEditor(): TypeEditor {
    return this._editorRef;
  }

  private createEditor(): React.ReactNode {
    const editorRef = (ref: any) => this._editorRef = ref;

    const editorProps: CloneProps = {
      ref: editorRef,
      onCommit: this._handleEditorCommit,
      onCancel: this._handleEditorCancel,
      onBlur: this._handleEditorBlur,
      propertyRecord: this.props.propertyRecord,
    };

    let editorNode: React.ReactNode;
    const propDescription = this.props.propertyRecord.property;

    const editorName = propDescription.editor !== undefined ? propDescription.editor.name : undefined;
    this._propertyEditor = PropertyEditorManager.createEditor(propDescription.typename, editorName, propDescription.dataController);
    editorNode = this._propertyEditor.reactElement;

    if (React.isValidElement(editorNode)) {
      return React.cloneElement(editorNode, editorProps);
    }

    return null;
  }

  private _handleEditorBlur = (_e: React.FocusEvent) => {
    if (!this.props.ignoreEditorBlur)
      this._commit();   // tslint:disable-line: no-floating-promises
  }

  private _handleContainerBlur = (e: React.FocusEvent) => {
    e.stopPropagation();
  }

  private _handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  }

  private _handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        this.onPressEscape(e);
        break;
      case "Enter":
        this.onPressEnter(e);
        break;
      case "Tab":
        this.onPressTab(e);
        break;
    }

    // Prevent the arrow keys from bubbling up to the ReactDataGrid
    if (e.keyCode >= 37 && e.keyCode <= 40)
      e.stopPropagation();
  }

  private _handleRightClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  }

  private onPressEscape(_e: React.KeyboardEvent): void {
    this._commitCancel();
  }

  private onPressEnter(_e: React.KeyboardEvent): void {
    this._commit();   // tslint:disable-line: no-floating-promises
  }

  private onPressTab(_e: React.KeyboardEvent): void {
    this._commit();   // tslint:disable-line: no-floating-promises
  }

  private async isNewValueValid(value: PropertyValue): Promise<boolean> {
    if (this._propertyEditor && this.props.propertyRecord) {
      const validateResult = await this._propertyEditor.validateValue(value, this.props.propertyRecord);
      if (validateResult.encounteredError) {
        this.setState({ isInvalid: validateResult.encounteredError });
        // TODO - display InputField
        return !validateResult.encounteredError;
      }
    }

    return true;
  }

  private _handleEditorCommit = (args: PropertyUpdatedArgs): void => {
    this.props.onCommit(args);
  }

  private _commit = async () => {
    const newValue = await this.getEditor().getPropertyValue();
    if (newValue) {
      const isValid = await this.isNewValueValid(newValue);
      if (isValid) {
        let doCommit = true;
        if (this._propertyEditor && this.props.propertyRecord) {
          const commitResult = await this._propertyEditor.commitValue(newValue, this.props.propertyRecord);
          if (commitResult.encounteredError)
            doCommit = false;
        }

        if (doCommit)
          this.props.onCommit({ propertyRecord: this.props.propertyRecord, newValue });
      }
    }
  }

  private _handleEditorCancel = () => {
    this._commitCancel();
  }

  private _commitCancel = () => {
    this.props.onCancel();
  }

  public componentDidMount() {
    if (this.getEditor())
      return this.getEditor().setFocus();
  }

  public render() {
    return (
      <span className="components-editor-container"
        onBlur={this._handleContainerBlur}
        onKeyDown={this._handleKeyDown}
        onClick={this._handleClick}
        onContextMenu={this._handleRightClick}
        title={this.props.title}
        data-testid="editor-container"
      >
        {this.createEditor()}
      </span>
    );
  }
}
