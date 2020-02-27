/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as React from "react";
// tslint:disable-next-line: no-duplicate-imports
import { useEffect, useMemo } from "react";
import classnames from "classnames";
import { CommonProps, TreeNodePlaceholder } from "@bentley/ui-core";
import { TreeModelNode } from "../TreeModel";
import { HighlightingEngine, HighlightableTreeNodeProps } from "../../HighlightingEngine";
import { PropertyValueRendererManager, PropertyValueRendererContext, PropertyContainerType } from "../../../properties/ValueRendererManager";
import { ItemStyleProvider, ItemStyle } from "../../../properties/ItemStyle";
import { TreeNodeEditorRenderer, TreeNodeEditor } from "./TreeNodeEditor";
import "./NodeContent.scss";

/** Properties for [[TreeNodeContent]] component
 * @internal
 */
export interface TreeNodeContentProps extends CommonProps {
  node: TreeModelNode;
  showDescription?: boolean;
  highlightProps?: HighlightableTreeNodeProps;
  valueRendererManager: PropertyValueRendererManager;

  onLabelRendered?: (node: TreeModelNode) => void;
  nodeEditorRenderer?: TreeNodeEditorRenderer;
}

/** React component for displaying [[TreeNode]] label
 * @internal
 */
export function TreeNodeContent(props: TreeNodeContentProps) {
  const { node, valueRendererManager, onLabelRendered, highlightProps } = props;
  const label = useMemo(() => getLabel(node, valueRendererManager, highlightProps), [node, valueRendererManager, highlightProps]);
  useEffect(() => {
    onLabelRendered && onLabelRendered(node);
  }, [label, node, onLabelRendered]);

  // handle cell editing
  let editor: React.ReactNode;
  if (props.node.editingInfo) {
    // if cell editing is enabled, return editor instead of the label
    const style = getStyle(props.node.item.style, props.node.isSelected);
    const editorProps = {
      node: props.node,
      onCancel: props.node.editingInfo.onCancel,
      onCommit: props.node.editingInfo.onCommit,
      style,
    };
    editor = props.nodeEditorRenderer ? props.nodeEditorRenderer(editorProps) : <TreeNodeEditor {...editorProps} />;
  }

  const isDescriptionEnabled = props.node.item.description && props.showDescription;

  const containerClassName = classnames(
    "components-tree-node-content",
    isDescriptionEnabled ? "with-description" : undefined,
    props.className,
  );

  const descriptionClassName = classnames(
    "components-tree-node-description",
    editor ? "with-editor" : undefined,
  );

  return (
    <div className={containerClassName} style={props.style}>
      {editor ? editor : label}
      {isDescriptionEnabled ?
        <div className={descriptionClassName}>
          {props.node.item.description}
        </div>
        : undefined}
    </div>
  );
}

function getLabel(
  node: TreeModelNode,
  valueRendererManager: PropertyValueRendererManager,
  highlightProps?: HighlightableTreeNodeProps): React.ReactNode | Promise<React.ReactNode> {
  // handle filtered matches' highlighting
  const highlightCallback = highlightProps
    ? (text: string) => HighlightingEngine.renderNodeLabel(text, highlightProps)
    : undefined;

  // handle custom cell rendering
  const context: PropertyValueRendererContext = {
    containerType: PropertyContainerType.Tree,
    style: getStyle(node.item.style, node.isSelected),
    textHighlighter: highlightCallback,
    defaultValue: <TreeNodePlaceholder level={0} data-testid={"node-label-placeholder"} />,
  };

  return valueRendererManager.render(node.item.label, context);
}

function getStyle(style?: ItemStyle, isSelected?: boolean): React.CSSProperties {
  return ItemStyleProvider.createStyle(style ? style : {}, isSelected);
}
