/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as React from "react";
import classnames from "classnames";
import { TreeNodeItem, TreeNodeRenderer, TreeNodeRendererProps, TreeRenderer, TreeRendererProps } from "@itwin/components-react";
import { TreeNode } from "@itwin/core-react";
import { SvgFilterHollow } from "@itwin/itwinui-icons-react";
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

/**
 * @alpha
 */
export interface PresentationTreeNodeRendererProps extends TreeNodeRendererProps {
  onFilter?: (item: TreeNodeItem) => void;
}

/**
 * @alpha
 */
export function PresentationTreeNodeRenderer(props: PresentationTreeNodeRendererProps) {
  const { onFilter, className, ...restProps } = props;
  if (restProps.node.item.extendedData !== undefined && restProps.node.item.extendedData.tooManyChildren === true)
    return <TooManyChildNodeRenderer
      nodeDepth={restProps.node.depth}
    />;
  return <TreeNodeRenderer
    {...restProps }
    className={classnames("presentation-components-node", className)}
  >
    {onFilter && <div className="presentation-components-filter-action-button">
      <IconButton
        styleType="borderless"
        size="small"
        onClick={(e) => {
          onFilter(restProps.node.item);
          e.stopPropagation();
        }} >
        <SvgFilterHollow/>
      </IconButton>
    </div>}
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
