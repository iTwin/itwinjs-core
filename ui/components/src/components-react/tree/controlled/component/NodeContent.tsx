/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import "./NodeContent.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, TreeNodePlaceholder } from "@itwin/core-react";
import { ItemStyle, ItemStyleProvider } from "../../../properties/ItemStyle";
import { PropertyContainerType, PropertyValueRendererContext, PropertyValueRendererManager } from "../../../properties/ValueRendererManager";
import { HighlightableTreeNodeProps, HighlightingEngine } from "../../HighlightingEngine";
import { TreeModelNode } from "../TreeModel";
import { TreeNodeEditor, TreeNodeEditorRenderer } from "./TreeNodeEditor";

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
  const label = React.useMemo(() => getLabel(node, valueRendererManager, highlightProps), [node, valueRendererManager, highlightProps]);
  React.useEffect(() => {
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
    "components-controlledTree-node-content",
    isDescriptionEnabled ? "with-description" : undefined,
    props.className,
  );

  const descriptionClassName = classnames(
    "components-controlledTree-node-description",
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
