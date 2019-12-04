/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import { CommonProps, NodeCheckboxProps, NodeCheckboxRenderer, TreeNode } from "@bentley/ui-core";
import { TreeActions } from "../TreeActions";
import { TreeModelNode, CheckBoxInfo } from "../TreeModel";
import { TreeNodeContent } from "./NodeContent";
import { PropertyValueRendererManager } from "../../../properties/ValueRendererManager";
import { HighlightableTreeNodeProps } from "../../HighlightingEngine";
import { ITreeImageLoader } from "../../ImageLoader";
import { ImageRenderer } from "../../../common/ImageRenderer";
import { TreeTest } from "../../component/Tree";

/**
 * Properties for [[TreeNodeRenderer]].
 * @alpha
 */
export interface TreeNodeRendererProps extends CommonProps {
  node: TreeModelNode;
  treeActions: TreeActions;
  onLabelRendered?: (node: TreeModelNode) => void;
  nodeHighlightProps?: HighlightableTreeNodeProps;
}

/**
 * Extended properties for [[TreeNodeRenderer]].
 * @alpha
 */
export interface ExtendedTreeNodeRendererProps extends TreeNodeRendererProps {
  checkboxRenderer?: NodeCheckboxRenderer;
  descriptionEnabled?: boolean;
  imageLoader?: ITreeImageLoader;
}

/**
 * Default component for rendering tree node.
 * @alpha
 */
// tslint:disable-next-line: variable-name
export const TreeNodeRenderer = React.memo((props: ExtendedTreeNodeRendererProps) => {
  const label = (
    <TreeNodeContent
      key={props.node.id}
      node={props.node}
      showDescription={props.descriptionEnabled}
      valueRendererManager={PropertyValueRendererManager.defaultManager}
      highlightProps={props.nodeHighlightProps}
      onLabelRendered={props.onLabelRendered}
    />
  );

  function onExpansionToggle() {
    if (props.node.isExpanded) {
      props.treeActions.onNodeCollapsed(props.node.id);

      return;
    }

    props.treeActions.onNodeExpanded(props.node.id);
  }

  const createCheckboxProps = (checkboxInfo: CheckBoxInfo): NodeCheckboxProps => ({
    state: checkboxInfo.state,
    tooltip: checkboxInfo.tooltip,
    isDisabled: checkboxInfo.isDisabled,
    onClick: (newState) => props.treeActions.onNodeCheckboxClicked(props.node.id, newState),
  });

  return (
    <TreeNode
      data-testid={TreeTest.TestId.Node}
      className={props.className}
      checkboxProps={props.node.checkbox.isVisible ? createCheckboxProps(props.node.checkbox) : undefined}
      style={props.style}
      isExpanded={props.node.isExpanded}
      isSelected={props.node.isSelected}
      isLoading={props.node.isLoading}
      isLeaf={props.node.numChildren === 0}
      icon={props.imageLoader ? <TreeNodeIcon node={props.node} imageLoader={props.imageLoader} /> : undefined}
      label={label}
      level={props.node.depth}
      onClick={(event) => props.treeActions.onNodeClicked(props.node.id, event)}
      onMouseDown={() => props.treeActions.onNodeMouseDown(props.node.id)}
      onMouseMove={() => props.treeActions.onNodeMouseMove(props.node.id)}
      onClickExpansionToggle={onExpansionToggle}
      renderOverrides={{ renderCheckbox: props.checkboxRenderer }}
    />
  );
});

interface TreeNodeIconProps {
  node: TreeModelNode;
  imageLoader: ITreeImageLoader;
}

const TreeNodeIcon: React.FC<TreeNodeIconProps> = ({ imageLoader, node }) => { // tslint:disable-line:variable-name
  const image = imageLoader.load(node.item);

  if (!image)
    return null;

  const renderer = new ImageRenderer();
  return <>{renderer.render(image)}</>;
};
