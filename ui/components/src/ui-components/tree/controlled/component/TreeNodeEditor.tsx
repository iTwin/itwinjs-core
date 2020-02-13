/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as React from "react";
import { PrimitiveValue, PropertyValueFormat, PropertyDescription, PropertyRecord } from "@bentley/imodeljs-frontend";
import { EditorContainer, PropertyUpdatedArgs, TreeModelNode } from "../../../../ui-components";

/** Properties for [[TreeNodeEditor]] component
 * @beta
 */
export interface TreeNodeEditorProps {
  /** Tree node which is in editing mode. */
  node: TreeModelNode;
  /** Callback that is called when changes are committed. */
  onCommit: (node: TreeModelNode, newValue: string) => void;
  /** Callback that is called when editing is canceled. */
  onCancel: () => void;

  /** Editor style. */
  style?: React.CSSProperties;
  /** @internal */
  ignoreEditorBlur?: boolean;
}

/** Type for tree node editor renderer
 * @beta
 */
export type TreeNodeEditorRenderer = (props: TreeNodeEditorProps) => React.ReactNode;

/** React component for displaying tree node editor
 * @beta
 */
// tslint:disable-next-line: variable-name
export const TreeNodeEditor: React.FC<TreeNodeEditorProps> = (props: TreeNodeEditorProps) => {
  const onCommit = (args: PropertyUpdatedArgs) => {
    const newValue = (args.newValue as PrimitiveValue).value as string;
    props.onCommit(props.node, newValue);
  };

  const label = props.node.item.labelDefinition ?? props.node.item.label;
  const propertyRecord = createPropertyRecord(label);

  return (
    <span style={props.style}>
      <EditorContainer
        propertyRecord={propertyRecord}
        title={propertyRecord.description}
        onCommit={onCommit}
        onCancel={props.onCancel}
        ignoreEditorBlur={props.ignoreEditorBlur}
        setFocus={true}
      />
    </span>
  );
};

function createPropertyRecord(label: string | PropertyRecord, typename: string = "text", editor?: string) {
  const createPrimitiveValue = (value: string): PrimitiveValue => ({
    valueFormat: PropertyValueFormat.Primitive,
    value,
    displayValue: value,
  });

  const v = typeof label === "string" ? createPrimitiveValue(label) : label.value;

  const p: PropertyDescription = {
    name: "tree-node-editor",
    displayLabel: "Tree Node Editor",
    typename,
  };

  // istanbul ignore if
  if (editor)
    p.editor = { name: editor, params: [] };

  const record = new PropertyRecord(v, p);
  record.description = "";
  record.isReadonly = false;

  return record;
}
