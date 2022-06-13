/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as React from "react";
import { TreeNodeRenderer, TreeNodeRendererProps, TreeRenderer, TreeRendererProps } from "@itwin/components-react";
import { TreeNode } from "@itwin/core-react";
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

/**
 * @alpha
 */
export interface PresentationTreeNodeRendererProps extends TreeNodeRendererProps {
  nodeRenderer?: (props: TreeNodeRendererProps) => React.ReactNode;
}

/**
 * @alpha
 */
export function PresentationTreeNodeRenderer(props: PresentationTreeNodeRendererProps) {
  const { nodeRenderer, ...restProps } = props;
  if (restProps.node.item.extendedData !== undefined && restProps.node.item.extendedData.tooManyChildren === true)
    return <TooManyChildNodeRenderer
      nodeDepth={restProps.node.depth}
    />;
  return nodeRenderer ? <>{nodeRenderer(restProps)}</> : <TreeNodeRenderer
    {...restProps}
  />;
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
