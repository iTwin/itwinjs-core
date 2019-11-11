/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
// tslint:disable-next-line: no-duplicate-imports
import { useState, useEffect, useRef } from "react";
import classnames from "classnames";
import { TreeNodePlaceholder, isPromiseLike, CommonProps } from "@bentley/ui-core";
import { PrimitiveValue, PropertyRecord, PropertyValueFormat, PropertyDescription } from "@bentley/imodeljs-frontend";
import { TreeModelNode } from "../TreeModel";
import { HighlightingEngine, HighlightableTreeNodeProps } from "../../HighlightingEngine";
import { PropertyValueRendererManager, PropertyValueRendererContext, PropertyContainerType } from "../../../properties/ValueRendererManager";
import { CellEditingEngine } from "./CellEditingEngine";
import { UiComponents } from "../../../UiComponents";
import { ItemStyleProvider, ItemStyle } from "../../../properties/ItemStyle";
import "../../component/NodeContent.scss";

/** Properties for [[TreeNodeContent]] component
 * @internal
 */
export interface TreeNodeContentProps extends CommonProps {
  node: TreeModelNode;
  showDescription?: boolean;
  highlightProps?: HighlightableTreeNodeProps;
  valueRendererManager: PropertyValueRendererManager;
  cellEditing?: CellEditingEngine;

  onLabelRendered?: (node: TreeModelNode) => void;
}

/** React component for displaying [[TreeNode]] label
 * @internal
 */
// tslint:disable-next-line: variable-name
export const TreeNodeContent: React.FC<TreeNodeContentProps> = (props: TreeNodeContentProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const label = useLabel(props.node, props.valueRendererManager, props.highlightProps);
  useEffect(() => {
    if (props.onLabelRendered) {
      props.onLabelRendered(props.node);
    }
  }, [label, props.node]);

  // handle cell editing
  let editor: JSX.Element | undefined;
  if (props.cellEditing && props.cellEditing.isEditingEnabled(props.node)) {
    // if cell editing is enabled, return editor instead of the label
    const style = getStyle(props.node.item.style, props.node.isSelected);
    editor = props.cellEditing.renderEditor(props.node, style);
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
    <div ref={containerRef} className={containerClassName} style={props.style}>
      {editor ? editor : label}
      {isDescriptionEnabled ?
        <div className={descriptionClassName}>
          {props.node.item.description}
        </div>
        : undefined}
    </div>
  );
};

function useLabel(node: TreeModelNode, valueRendererManager: PropertyValueRendererManager, highlightProps?: HighlightableTreeNodeProps) {
  const [label, setLabel] = useState<React.ReactNode>(<TreeNodePlaceholder level={0} data-testid={"node-label-placeholder"} />);

  useEffect(() => {
    const getLabel = (): React.ReactNode | Promise<React.ReactNode> => {
      // handle filtered matches' highlighting
      let labelElement: React.ReactNode = node.label;
      if (highlightProps)
        labelElement = HighlightingEngine.renderNodeLabel(node.label, highlightProps);

      // handle custom cell rendering
      const context: PropertyValueRendererContext = {
        containerType: PropertyContainerType.Tree,
        decoratedTextElement: labelElement,
        style: getStyle(node.item.style, node.isSelected),
      };

      const nodeRecord = nodeToPropertyRecord(node);
      return valueRendererManager.render(nodeRecord, context);
    };

    const newLabel = getLabel();
    if (isPromiseLike(newLabel)) {
      // tslint:disable-next-line:no-floating-promises
      newLabel.then((result) => setLabel(result));
    } else {
      setLabel(newLabel);
    }
  }, [node, highlightProps, valueRendererManager]);

  return label;
}

function getStyle(style?: ItemStyle, isSelected?: boolean): React.CSSProperties {
  return ItemStyleProvider.createStyle(style ? style : {}, isSelected);
}

function nodeToPropertyRecord(node: TreeModelNode) {
  const value: PrimitiveValue = {
    displayValue: node.item.label,
    value: node.item.label,
    valueFormat: PropertyValueFormat.Primitive,
  };
  const property: PropertyDescription = {
    displayLabel: UiComponents.translate("general.label"),
    typename: node.item && node.item.typename ? node.item.typename : "string",
    name: "node_label",
  };

  return new PropertyRecord(value, property);
}
