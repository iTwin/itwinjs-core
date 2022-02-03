/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as React from "react";
import type { PrimitiveValue, PropertyDescription} from "@itwin/appui-abstract";
import { PropertyRecord } from "@itwin/appui-abstract";
import type { PropertyUpdatedArgs } from "../../../editors/EditorContainer";
import { EditorContainer } from "../../../editors/EditorContainer";
import type { TreeModelNode } from "../TreeModel";

/**
 * Properties for [[TreeNodeEditor]] component.
 * @public
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

/**
 * Type for tree node editor renderer.
 * @public
 */
export type TreeNodeEditorRenderer = (props: TreeNodeEditorProps) => React.ReactNode;

/**
 * React component for displaying tree node editor.
 * @public
 */
export function TreeNodeEditor(props: TreeNodeEditorProps) {
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
}

function createPropertyRecord(label: PropertyRecord) {
  const property: PropertyDescription = {
    name: "tree-node-editor",
    displayLabel: "Tree Node Editor",
    typename: label.property.typename,
  };

  const record = new PropertyRecord(label.value, property);
  record.description = "";
  record.isReadonly = false;

  return record;
}
