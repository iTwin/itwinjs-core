/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import * as React from "react";
import { TextEditor } from "./TextEditor";
import { PropertyRecord } from "../properties/Record";

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
  onCommit: (commit: PropertyUpdatedArgs) => void;
  onCommitCancel: () => void;
}

/**
 * EditorContainer React component
 */
export class EditorContainer extends React.Component<EditorContainerProps> {

  private _editor: any;
  private _changeCommitted = false;
  private _changeCanceled = false;

  private getEditor(): any {
    return this._editor;
  }

  private createEditor(): React.ReactNode {
    const editorRef = (c: any) => this._editor = c;
    // let editorProps = {
    //   ref: editorRef,
    //   column: this.props.column,
    //   value: this.getInitialValue(),
    //   onCommit: this.commit,
    //   onCommitCancel: this.commitCancel,
    //   rowMetaData: this.getRowMetaData(),
    //   rowData: this.props.rowData,
    //   height: this.props.height,
    //   onBlur: this.commit,
    //   onOverrideKeyDown: this.onKeyDown
    // };

    // let CustomEditor = this.props.column.editor;
    // // return custom column editor or SimpleEditor if none specified
    // if (React.isValidElement(CustomEditor)) {
    //   return React.cloneElement(CustomEditor, editorProps);
    // }
    // if (isFunction(CustomEditor)) {
    //   return <CustomEditor ref={editorRef} {...editorProps} />;
    // }

    return <TextEditor ref={editorRef} onBlur={this._commit} value={this.props.propertyRecord} />;
    // column={this.props.column} value={this.getInitialValue()} onBlur={this.commit} rowMetaData={this.getRowMetaData()} onKeyDown={() => { }} commit={() => { }}
  }

  private _handleBlur = (e: React.FocusEvent) => {
    e.stopPropagation();
    // if (this.isBodyClicked(e)) {
    //   this.commit(e);
    // }

    // if (!this.isBodyClicked(e)) {
    //   // prevent null reference
    //   if (this.isViewportClicked(e) || !this.isClickInsideEditor(e)) {
    //     this.commit(e);
    //   }
    // }
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

  private isNewValueValid(value: string): boolean {
    if (isFunction(this.getEditor().validate)) {
      const isValid = this.getEditor().validate(value);
      this.setState({ isInvalid: !isValid });
      return isValid;
    }

    return true;
  }

  private _commit = (_args: { key: string }) => {
    const newValue = this.getEditor().getValue();
    if (this.isNewValueValid(newValue)) {
      this._changeCommitted = true;
      this.props.onCommit({ propertyRecord: this.props.propertyRecord, newValue });
    }
  }

  private _commitCancel = () => {
    this._changeCanceled = true;
    this.props.onCommitCancel();
  }

  public componentDidMount() {
    // let inputNode = this.getInputNode();
    // if (inputNode !== undefined) {
    //   this.setTextInputFocus();
    //   if (!this.getEditor().disableContainerStyles) {
    //     inputNode.className += ' editor-main';
    //     inputNode.style.height = this.props.height - 1 + 'px';
    //   }
    // }
  }

  public componentWillUnmount() {
    if (!this._changeCommitted && !this._changeCanceled) {
      // this._commit({ key: "Enter" });
    }
  }

  public render() {
    return (
      <div onBlur={this._handleBlur} onKeyDown={this._handleKeyDown} onContextMenu={this._handleRightClick} onClick={this._handleClick}>
        {this.createEditor()}
      </div>
    );
  }
}

const isFunction = (functionToCheck: any): boolean => {
  const getType = {};
  return functionToCheck && getType.toString.call(functionToCheck) === "[object Function]";
};
