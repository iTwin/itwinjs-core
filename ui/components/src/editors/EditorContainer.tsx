/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import * as React from "react";
import { PropertyRecord } from "../properties/Record";
import { PropertyEditor, PropertyEditorManager } from "./PropertyEditorManager";

/** Arguments for the Property Updated event callback */
export interface PropertyUpdatedArgs {
  /** The property being updated. */
  propertyRecord?: PropertyRecord;
  /** The new value for the property. */
  newValue: any;
}

/** [[EditorContainer]] React component properties */
export interface EditorContainerProps {
  propertyRecord?: PropertyRecord;
  title: string;
  onCommit: (commit: PropertyUpdatedArgs) => void;
  onCommitCancel: () => void;
}

/**
 * EditorContainer React component
 */
export class EditorContainer extends React.Component<EditorContainerProps> {

  private _editorRef: any;
  private _propertyEditor: PropertyEditor | null = null;

  private getEditor(): any {
    return this._editorRef;
  }

  private createEditor(): React.ReactNode {
    const editorRef = (c: any) => this._editorRef = c;

    const editorProps = {
      ref: editorRef,
      onBlur: this._commit,
      value: this.props.propertyRecord,
    };

    if (this.props.propertyRecord) {
      let editorNode: React.ReactNode;
      const propDescription = this.props.propertyRecord.property;

      if (propDescription.typename) {
        const editorName = propDescription.editor !== undefined ? propDescription.editor.name : undefined;
        this._propertyEditor = PropertyEditorManager.createEditor(propDescription.typename, editorName, propDescription.dataController);
        if (this._propertyEditor)
          editorNode = this._propertyEditor.reactElement;
      }

      if (React.isValidElement(editorNode)) {
        return React.cloneElement(editorNode, editorProps);
      }
    }

    return null;
  }

  private _handleBlur = (e: React.FocusEvent) => {
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

  private onPressEscape(e: React.KeyboardEvent): void {
    if (!this.editorIsSelectOpen()) {
      this._commitCancel();
    } else {
      // prevent event from bubbling if editor has results to select
      e.stopPropagation();
    }
  }

  private onPressEnter(e: React.KeyboardEvent): void {
    this._commit({ key: e.key });
  }

  private onPressTab(e: React.KeyboardEvent): void {
    this._commit({ key: e.key });
  }

  private editorIsSelectOpen(): boolean {
    if (isFunction(this.getEditor().isSelectOpen)) {
      return this.getEditor().isSelectOpen();
    }

    return false;
  }

  private async isNewValueValid(value: any): Promise<boolean> {
    if (isFunction(this.getEditor().validate)) {
      const isValid = this.getEditor().validate(value);
      if (!isValid) {
        this.setState({ isInvalid: !isValid });
        return isValid;
      }
    }

    if (this._propertyEditor && this.props.propertyRecord) {
      const valueResult = await this._propertyEditor.validateValue(value, this.props.propertyRecord);
      if (valueResult.encounteredError) {
        this.setState({ isInvalid: valueResult.encounteredError });
        // TODO - display InputField
        return !valueResult.encounteredError;
      }
    }

    return true;
  }

  private _commit = (_args: { key: string }) => {
    const newValue = this.getEditor().getValue();
    if (this.isNewValueValid(newValue)) {
      this.props.onCommit({ propertyRecord: this.props.propertyRecord, newValue });
    }
  }

  private _commitCancel = () => {
    this.props.onCommitCancel();
  }

  public componentDidMount() {
    const inputNode = this.getInputNode();
    if (inputNode) {
      inputNode.focus();
    }
  }

  private getInputNode(): HTMLInputElement | null {
    if (this.getEditor() && isFunction(this.getEditor().getInputNode))
      return this.getEditor().getInputNode();
    return null;
  }

  public render() {
    return (
      <div
        onBlur={this._handleBlur}
        onKeyDown={this._handleKeyDown}
        onClick={this._handleClick}
        onContextMenu={this._handleRightClick}
        title={this.props.title}
      >
        {this.createEditor()}
      </div>
    );
  }
}

const isFunction = (functionToCheck: any): boolean => {
  const getType = {};
  return functionToCheck && getType.toString.call(functionToCheck) === "[object Function]";
};
