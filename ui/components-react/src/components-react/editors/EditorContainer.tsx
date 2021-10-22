/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyEditors
 */

import "./EditorContainer.scss";
import * as React from "react";
import { PropertyRecord, PropertyValue, SpecialKey, UiAdmin } from "@itwin/appui-abstract";
import { CommonProps } from "@itwin/core-react";
import { AsyncErrorMessage, PropertyEditorBase, PropertyEditorManager } from "./PropertyEditorManager";

/** Arguments for the Property Updated event callback
 * @public
 */
export interface PropertyUpdatedArgs {
  /** The property being updated. */
  propertyRecord: PropertyRecord;
  /** The new value for the property. */
  newValue: PropertyValue;
}

/** Properties for a property editor component
 * @public
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
 * @public
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
 * @public
 */
export interface TypeEditor {
  getPropertyValue: () => Promise<PropertyValue | undefined>;
  htmlElement: HTMLElement | null;
  hasFocus: boolean;
}

/**
 * EditorContainer React component used by the Table, Tree and PropertyGrid for cell editing.
 * @public
 */
export class EditorContainer extends React.PureComponent<EditorContainerProps> {

  private _editorRef: TypeEditor | undefined;
  private _propertyEditor: PropertyEditorBase | undefined;

  private createEditor(): React.ReactNode {
    const editorRef = (ref: TypeEditor | undefined) => this._editorRef = ref;

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
    if (!this.props.ignoreEditorBlur && this._propertyEditor && this._propertyEditor.containerHandlesBlur)
      this._handleContainerCommit(); // eslint-disable-line @typescript-eslint/no-floating-promises
  };

  private _handleContainerBlur = (e: React.FocusEvent) => {
    e.stopPropagation();
  };

  private _handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

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
      default:
        if (this._propertyEditor && this._propertyEditor.containerStopsKeydownPropagation)
          e.stopPropagation();
    }
  };

  private _handleRightClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  private onPressEscape(_e: React.KeyboardEvent): void {
    // istanbul ignore else
    if (this._propertyEditor && this._propertyEditor.containerHandlesEscape) {
      this._commitCancel();
    }
  }

  private onPressEnter(e: React.KeyboardEvent): void {
    // istanbul ignore else
    if (this._propertyEditor && this._propertyEditor.containerHandlesEnter) {
      // istanbul ignore else
      if (this._editorRef && this._editorRef.hasFocus)
        e.stopPropagation();
      this._handleContainerCommit(); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  private onPressTab(e: React.KeyboardEvent): void {
    // istanbul ignore else
    if (this._propertyEditor && this._propertyEditor.containerHandlesTab) {
      e.stopPropagation();
      this._handleContainerCommit(); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  private displayOutputMessage(errorMessage: AsyncErrorMessage | undefined) {
    // istanbul ignore else
    if (errorMessage && this._editorRef) {
      const htmlElement = this._editorRef && this._editorRef.htmlElement;
      // istanbul ignore else
      if (htmlElement)
        UiAdmin.messagePresenter.displayInputFieldMessage(htmlElement, errorMessage.severity, errorMessage.briefMessage, errorMessage.detailedMessage);
      else
        UiAdmin.messagePresenter.displayMessage(errorMessage.severity, errorMessage.briefMessage, errorMessage.detailedMessage, errorMessage.messageType);
    }
  }

  private async isNewValueValid(value: PropertyValue): Promise<boolean> {
    let isValid = true;

    // istanbul ignore else
    if (this._propertyEditor && this.props.propertyRecord) {
      const validateResult = await this._propertyEditor.validateValue(value, this.props.propertyRecord);

      if (validateResult.encounteredError) {
        this.displayOutputMessage(validateResult.errorMessage);
        isValid = false;
      }
    } else {
      isValid = false;
    }

    return isValid;
  }

  private _handleEditorCommit = (args: PropertyUpdatedArgs): void => {
    this._commit(args); // eslint-disable-line @typescript-eslint/no-floating-promises
  };

  private _handleContainerCommit = async (): Promise<void> => {
    const newValue = this._editorRef && await this._editorRef.getPropertyValue();
    // istanbul ignore else
    if (newValue !== undefined) {
      this._commit({ propertyRecord: this.props.propertyRecord, newValue });  // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  };

  private _commit = async (args: PropertyUpdatedArgs) => {
    const newValue = args.newValue;
    const isValid = await this.isNewValueValid(newValue);
    if (isValid) {
      let doCommit = true;
      // istanbul ignore else
      if (this._propertyEditor && args.propertyRecord) {
        const commitResult = await this._propertyEditor.commitValue(newValue, args.propertyRecord);
        if (commitResult.encounteredError) {
          this.displayOutputMessage(commitResult.errorMessage);
          doCommit = false;
        }
      }

      if (doCommit) {
        this.props.onCommit(args);
      }
    }
  };

  private _handleEditorCancel = () => {
    this._commitCancel();
  };

  private _commitCancel = () => {
    this.props.onCancel();
  };

  /** @internal */
  public override render() {
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
