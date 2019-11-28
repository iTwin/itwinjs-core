/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import { PrimitiveValue, PropertyValueFormat, PropertyDescription, PropertyRecord } from "@bentley/imodeljs-frontend";
import { EditorContainer, PropertyUpdatedArgs, TreeModelNode } from "../../../../ui-components";

/** Properties for [[TreeNodeEditor]] component
 * @alpha
 */
export interface TreeNodeEditorProps {
  node: TreeModelNode;
  onCommit: (node: TreeModelNode, newValue: string) => void;
  onCancel: () => void;

  style?: React.CSSProperties;
  ignoreEditorBlur?: boolean;
}

/** Type for tree node editor renderer
 * @alpha
 */
export type TreeNodeEditorRenderer = (props: TreeNodeEditorProps) => React.ReactNode;

/** React component for displaying tree node editor
 * @alpha
 */
// tslint:disable-next-line: variable-name
export const TreeNodeEditor: React.FC<TreeNodeEditorProps> = (props: TreeNodeEditorProps) => {
  const onCommit = (args: PropertyUpdatedArgs) => {
    const newValue = (args.newValue as PrimitiveValue).value as string;
    props.onCommit(props.node, newValue);
  };

  const propertyRecord = createPropertyRecord(props.node.item.label);

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

function createPropertyRecord(value: string, typename: string = "text", editor?: string) {
  const v: PrimitiveValue = {
    valueFormat: PropertyValueFormat.Primitive,
    value,
    displayValue: value,
  };

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
