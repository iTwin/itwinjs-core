/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyEditors
 */

import "./EditorContainer.scss";
import * as React from "react";
import { IModelApp, NotifyMessageDetails } from "@bentley/imodeljs-frontend";
import { isArrowKey, PropertyRecord, PropertyValue, SpecialKey } from "@bentley/ui-abstract";
import { CommonProps } from "@bentley/ui-core";
import { PropertyEditorBase, PropertyEditorManager } from "./PropertyEditorManager";

/** Arguments for the Property Updated event callback
 * @beta
 */
export interface PropertyUpdatedArgs {
  /** The property being updated. */
  propertyRecord: PropertyRecord;
  /** The new value for the property. */
  newValue: PropertyValue;
}

/** Properties for a property editor component
 * @beta
 */
export interface PropertyEditorProps extends CommonProps {
  /** The property being updated. */
  propertyRecord?: PropertyRecord;
  /** Handler for commit */
  onCommit?: (args: PropertyUpdatedArgs) => void;
  /** Handler for cancel */
  onCancel?: () => void;
  /** Handler for blur */
  onBlur?: (event: React.FocusEvent) => void;
  /** Indicates whether the Property Editor should set focus */
  setFocus?: boolean;
}

/** [[EditorContainer]] React component properties
 * @beta
 */
export interface EditorContainerProps extends CommonProps {
  /** The property being updated. */
  propertyRecord: PropertyRecord;
  /** Tooltip text */
  title?: string;
  /** Handler for commit */
  onCommit: (args: PropertyUpdatedArgs) => void;
  /** Handler for cancel */
  onCancel: () => void;
  /** Indicates whether the Property Editor should set focus */
  setFocus?: boolean;

  /** @internal */
  ignoreEditorBlur?: boolean;
}

/** @internal */
interface CloneProps extends PropertyEditorProps {
  ref: (ref: any) => void;
}

/** Interface implemented by React based type editors
 * @beta
 */
export interface TypeEditor {
  getPropertyValue: () => Promise<PropertyValue | undefined>;
}

/**
 * EditorContainer React component used by the Table, Tree and PropertyGrid for cell editing.
 * @beta
 */
export class EditorContainer extends React.PureComponent<EditorContainerProps> {

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
      setFocus: this.props.setFocus !== undefined ? this.props.setFocus : true,
      className: this.props.className,
      style: this.props.style,
    };

    const propDescription = this.props.propertyRecord.property;

    const editorName = propDescription.editor !== undefined ? propDescription.editor.name : undefined;
    this._propertyEditor = PropertyEditorManager.createEditor(propDescription.typename, editorName, propDescription.dataController);
    const editorNode: React.ReactNode = this._propertyEditor.reactNode;

    let clonedNode: React.ReactNode = null;
    // istanbul ignore else
    if (React.isValidElement(editorNode)) {
      clonedNode = React.cloneElement(editorNode, editorProps);
    }

    return clonedNode;
  }

  private _handleEditorBlur = (_e: React.FocusEvent) => {
    // istanbul ignore else
    if (!this.props.ignoreEditorBlur)
      this._commit(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  private _handleContainerBlur = (e: React.FocusEvent) => {
    e.stopPropagation();
  }

  private _handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  }

  private _handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case SpecialKey.Escape:
        this.onPressEscape(e);
        break;
      case SpecialKey.Enter:
        this.onPressEnter(e);
        break;
      case SpecialKey.Tab:
        this.onPressTab(e);
        break;
    }

    // Prevent the arrow keys from bubbling up to the ReactDataGrid
    if (isArrowKey(e.key))
      e.stopPropagation();
  }

  private _handleRightClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  }

  private onPressEscape(e: React.KeyboardEvent): void {
    // istanbul ignore next
    if (this._editorRef && this._editorRef === document.activeElement)
      e.stopPropagation();
    this._commitCancel();
  }

  private onPressEnter(e: React.KeyboardEvent): void {
    // istanbul ignore next
    if (this._editorRef && this._editorRef === document.activeElement)
      e.stopPropagation();
    this._commit(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  private onPressTab(e: React.KeyboardEvent): void {
    e.stopPropagation();
    this._commit(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  private async isNewValueValid(value: PropertyValue): Promise<boolean> {
    // istanbul ignore else
    if (this._propertyEditor && this.props.propertyRecord) {
      const validateResult = await this._propertyEditor.validateValue(value, this.props.propertyRecord);
      if (validateResult.encounteredError) {
        const errorMessage = validateResult.errorMessage;
        if (errorMessage && this._editorRef) {
          const details = new NotifyMessageDetails(errorMessage.priority, errorMessage.briefMessage, errorMessage.detailedMessage);
          details.setInputFieldTypeDetails(this._editorRef);
          IModelApp.notifications.outputMessage(details);
        }
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
    // istanbul ignore else
    if (newValue) {
      const isValid = await this.isNewValueValid(newValue);
      // istanbul ignore else
      if (isValid) {
        let doCommit = true;
        // istanbul ignore else
        if (this._propertyEditor && this.props.propertyRecord) {
          const commitResult = await this._propertyEditor.commitValue(newValue, this.props.propertyRecord);
          if (commitResult.encounteredError)
            doCommit = false;
        }

        // istanbul ignore else
        if (doCommit) {
          this.props.onCommit({ propertyRecord: this.props.propertyRecord, newValue });
        }
      }
    }
  }

  private _handleEditorCancel = () => {
    this._commitCancel();
  }

  private _commitCancel = () => {
    this.props.onCancel();
  }

  /** @internal */
  public render() {
    return (
      <span className="components-editor-container"
        onBlur={this._handleContainerBlur}
        onKeyDown={this._handleKeyDown}
        onClick={this._handleClick}
        onContextMenu={this._handleRightClick}
        title={this.props.title}
        data-testid="editor-container"
        role="presentation"
      >
        {this.createEditor()}
      </span>
    );
  }
}
