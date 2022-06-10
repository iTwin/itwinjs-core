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
export function PresentationTreeNodeRenderer(props: TreeNodeRendererProps){
  if (props.node.item.extendedData !== undefined && props.node.item.extendedData.tooManyChildren === true)
    return <TooManyChildNodeRenderer
      nodeDepth={props.node.depth}
    />;
  return <TreeNodeRenderer
    {...props}
  />;
}

interface TooManyChildNodeRendererProps{
  nodeDepth: number;
}

function TooManyChildNodeRenderer(props: TooManyChildNodeRendererProps) {
  return (
    <TreeNode
      className="presentation-custom-node"
      isLeaf={true}
      label={translate("tree.presentation-custom-node-label")}
      level={props.nodeDepth}
      isHoverDisabled={true}
    />
  );
}
