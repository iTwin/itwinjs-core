/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import "./PresentationTreeNodeRenderer.scss";
import * as React from "react";
import classnames from "classnames";
import { TreeNodeRenderer, TreeNodeRendererProps } from "@itwin/components-react";
import { TreeNode } from "@itwin/core-react";
import { SvgFilter, SvgFilterHollow, SvgRemove } from "@itwin/itwinui-icons-react";
import { ButtonGroup, IconButton } from "@itwin/itwinui-react";
import { translate } from "../../common/Utils";
import { isPresentationTreeNodeItem, PresentationTreeNodeItem } from "../DataProvider";

/**
 * @alpha
 */
export interface PresentationTreeNodeRendererProps extends TreeNodeRendererProps {
  onFilterClick: (node: PresentationTreeNodeItem) => void;
  onClearFilterClick: (node: PresentationTreeNodeItem) => void;
}

/**
 * @alpha
 */
export function PresentationTreeNodeRenderer(props: PresentationTreeNodeRendererProps) {
  const { onFilterClick, onClearFilterClick, className, ...restProps } = props;
  const nodeItem = props.node.item;
  if (!isPresentationTreeNodeItem(nodeItem))
    return null;

  if (nodeItem.tooManyChildren) {
    return (
      <TreeNode
        className="presentation-components-too-many-children-node"
        isLeaf={true}
        label={translate("tree.too-many-child-nodes")}
        level={props.node.depth}
        isHoverDisabled={true}
      />
    );
  }

  return (
    <TreeNodeRenderer
      {...restProps}
      className={classnames("presentation-components-node", className)}
    >
      <PresentationTreeNodeActions
        isFiltered={nodeItem.filterInfo !== undefined}
        filteringDisabled={nodeItem.filteringDisabled}
        onClear={() => { onClearFilterClick(nodeItem); }}
        onFilter={() => { onFilterClick(nodeItem); }}
      />
    </TreeNodeRenderer>
  );
}

interface PresentationTreeNodeActionsProps {
  onFilter: () => void;
  onClear: () => void;
  filteringDisabled?: boolean;
  isFiltered?: boolean;
}

function PresentationTreeNodeActions(props: PresentationTreeNodeActionsProps) {
  const { onFilter, onClear, filteringDisabled, isFiltered } = props;
  if (filteringDisabled)
    return null;

  return (
    <div className={classnames("presentation-components-filter-action-buttons", isFiltered && "filtered")}>
      <ButtonGroup>
        {isFiltered
          ? <IconButton
            styleType="borderless"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            <SvgRemove />
          </IconButton>
          : null}
        <IconButton
          styleType="borderless"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onFilter();
          }}
        >
          {isFiltered ? <SvgFilter /> : <SvgFilterHollow />}
        </IconButton>
      </ButtonGroup>
    </div>
  );
}
