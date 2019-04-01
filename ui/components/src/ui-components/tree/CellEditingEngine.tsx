/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import { PrimitiveValue, PropertyRecord, PropertyValueFormat, PropertyDescription } from "@bentley/imodeljs-frontend";
import { BeInspireTreeNode } from "./component/BeInspireTree";
import { TreeNodeItem } from "./TreeDataProvider";
import { PropertyUpdatedArgs, EditorContainer } from "../editors/EditorContainer";

/** Properties for a tree that has cell editing enabled
 * @beta
 */
export interface EditableTreeProps {
  /** Callback to when editing starts */
  onCellEditing: (currentlyActiveNode?: BeInspireTreeNode<TreeNodeItem>) => void;
  /** Callback to when editing finishes */
  onCellUpdated: (args: TreeCellUpdatedArgs) => Promise<boolean>;

  /** @internal */
  ignoreEditorBlur?: boolean;
}

/** Arguments for the Tree Cell Updated event callback
 * @beta
 */
export interface TreeCellUpdatedArgs {
  /** The cell being updated. */
  node: BeInspireTreeNode<TreeNodeItem>;
  /** The new value for the cell. */
  newValue: string;
}

/** @internal */
export type SetCurrentlyEditedNode = (currentlyEditedNode?: BeInspireTreeNode<TreeNodeItem>) => void;

/** @internal */
export type GetCurrentlyEditedNode = () => BeInspireTreeNode<TreeNodeItem> | undefined;

/** @internal */
export class CellEditingEngine {
  private _getCurrentlyEditedNode?: GetCurrentlyEditedNode;
  private _setCurrentlyEditedNode?: SetCurrentlyEditedNode;
  private readonly _props: EditableTreeProps;

  /**
   * @param props Cell editing properties
   */
  constructor(props: EditableTreeProps) {
    this._props = props;
  }

  /**
   * @param getEditorState Function, that returns currently edited node
   * @param setEditorState Function, that sets currently edited node
   */
  public subscribe(getCurrentNode: GetCurrentlyEditedNode, setCurrentNode: SetCurrentlyEditedNode) {
    this._getCurrentlyEditedNode = getCurrentNode;
    this._setCurrentlyEditedNode = setCurrentNode;
  }

  public get hasSubscriptions() {
    return !!(this._getCurrentlyEditedNode && this._setCurrentlyEditedNode);
  }

  public unsubscribe() {
    this._getCurrentlyEditedNode = undefined;
    this._setCurrentlyEditedNode = undefined;
  }

  public static createPropertyRecord(value: string, typename: string = "text", editor?: string) {
    const v: PrimitiveValue = {
      valueFormat: PropertyValueFormat.Primitive,
      value,
      displayValue: value,
    };

    const p: PropertyDescription = {
      name: "tree-cell-editor",
      displayLabel: "Tree Cell Editor",
      typename,
    };

    if (editor)
      p.editor = { name: editor, params: [] };

    const record = new PropertyRecord(v, p);
    record.description = "";
    record.isReadonly = false;

    return record;
  }

  private _onCommit = async (args: PropertyUpdatedArgs) => {
    if (!this._getCurrentlyEditedNode || !this._setCurrentlyEditedNode)
      return;

    if (this._getCurrentlyEditedNode()) {
      const newValue = (args.newValue as PrimitiveValue).value as string;
      const cellUpdatedArgs: TreeCellUpdatedArgs = {
        node: this._getCurrentlyEditedNode()!,
        newValue,
      };
      const allowed = await this._props.onCellUpdated(cellUpdatedArgs);
      if (allowed)
        this._getCurrentlyEditedNode()!.setDirty(true);
    }
    this.deactivateEditor();
  }

  public deactivateEditor = (): void => {
    if (!this._setCurrentlyEditedNode || !this._getCurrentlyEditedNode)
      return;

    const node = this._getCurrentlyEditedNode();
    if (!node)
      return;

    node.setDirty(true);
    this._setCurrentlyEditedNode(undefined);
  }

  public checkStatus = (node: BeInspireTreeNode<TreeNodeItem>, isPressedItemSelected: boolean) => {
    if (node.selected() && isPressedItemSelected && node.payload && node.payload.isEditable)
      this.activateEditor(node);
    else
      this.deactivateEditor();
  }

  public activateEditor = (node: BeInspireTreeNode<TreeNodeItem>) => {
    if (!this._setCurrentlyEditedNode || !this._getCurrentlyEditedNode)
      return;

    const currentNode = this._getCurrentlyEditedNode();
    if (currentNode === node)
      return;

    if (currentNode)
      currentNode.setDirty(true);

    this._setCurrentlyEditedNode(node);
    this._props.onCellEditing(node);
  }

  public isEditingEnabled(node: BeInspireTreeNode<TreeNodeItem>) {
    return this._props && this._getCurrentlyEditedNode && node === this._getCurrentlyEditedNode();
  }

  public renderEditor(node: BeInspireTreeNode<TreeNodeItem>, style?: React.CSSProperties) {
    const record = CellEditingEngine.createPropertyRecord(node.text);
    return (
      <span style={style}>
        <EditorContainer
          propertyRecord={record}
          title={record.description}
          onCommit={this._onCommit}
          onCancel={this.deactivateEditor}
          ignoreEditorBlur={this._props.ignoreEditorBlur}
          setFocus={true}
        />
      </span>
    );
  }
}
