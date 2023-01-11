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
  const { onFilterClick, onClearFilterClick, ...restProps } = props;
  const nodeItem = props.node.item;
  if (!isPresentationTreeNodeItem(nodeItem))
    return <TreeNodeRenderer {...restProps} />;

  if (nodeItem.infoMessage) {
    return (
      <TreeNode
        className="presentation-components-info-node"
        isLeaf={true}
        label={nodeItem.infoMessage}
        level={props.node.depth}
        isHoverDisabled={true}
      />
    );
  }

  // hide filtering buttons if filtering is disabled explicitly or node is not filtered and has no children
  const filteringDisabled = nodeItem.isFilteringDisabled || (nodeItem.filterInfo === undefined && props.node.numChildren === 0);

  return (
    <TreeNodeRenderer
      {...restProps}
      className={classnames("presentation-components-node", restProps.className)}
    >
      <PresentationTreeNodeActions
        isFiltered={nodeItem.filterInfo !== undefined}
        filteringDisabled={filteringDisabled}
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
    <div className={classnames("presentation-components-node-action-buttons", isFiltered && "filtered")}>
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
