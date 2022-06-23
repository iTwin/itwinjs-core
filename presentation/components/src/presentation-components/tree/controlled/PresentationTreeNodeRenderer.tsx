/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as React from "react";
import classnames from "classnames";
import { TreeModelNode, TreeNodeRenderer, TreeNodeRendererProps, TreeRenderer, TreeRendererProps } from "@itwin/components-react";
import { TreeNode } from "@itwin/core-react";
import { SvgFilter } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { translate } from "../../common/Utils";
import "./PresentationTreeNodeRenderer.scss";
/**
 * @alpha
 */
export function PresentationTreeRenderer(props: TreeRendererProps) {
  return <TreeRenderer
    {...props}
    nodeRenderer={PresentationTreeNodeRenderer}
  />;
}

interface FilterButtonProps {
  onFilter?: (node: TreeModelNode) => void;
}

const FilterButton = (props: FilterButtonProps) => {
  return (
    <IconButton className="presentation-filter-action-button" styleType="borderless"
      onClick={() => props.onFilter}>
      <SvgFilter className="presentation-filter-icon"/>
    </IconButton>
  );
};

/**
 * @alpha
 */
export interface PresentationTreeNodeRendererProps extends TreeNodeRendererProps {
  onFilter?: (node: TreeModelNode) => void;
}

/**
 * @alpha
 */
export function PresentationTreeNodeRenderer(props: PresentationTreeNodeRendererProps) {
  const { onFilter, ...restProps } = props;
  const className = classnames("presentation-node", restProps.className);
  if (restProps.node.item.extendedData !== undefined && restProps.node.item.extendedData.tooManyChildren === true)
    return <TooManyChildNodeRenderer
      nodeDepth={restProps.node.depth}
    />;
  return <TreeNodeRenderer
    {...restProps }
    className={className}
  >
    <FilterButton
      onFilter={onFilter}
    />
  </TreeNodeRenderer>;
}

interface TooManyChildNodeRendererProps {
  nodeDepth: number;
}

function TooManyChildNodeRenderer(props: TooManyChildNodeRendererProps) {
  return (
    <TreeNode
      className="presentation-components-muted-node"
      isLeaf={true}
      label={translate("tree.presentation-components-muted-node-label")}
      level={props.nodeDepth}
      isHoverDisabled={true}
    />
  );
}
