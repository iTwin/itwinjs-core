/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as React from "react";
import { TreeModelSource, TreeNodeRendererProps, TreeRenderer, TreeRendererProps } from "@itwin/components-react";
import { IModelConnection } from "@itwin/core-frontend";
import { PresentationInstanceFilterInfo } from "../../instance-filter-builder/PresentationInstanceFilterBuilder";
import { PresentationInstanceFilterDialog } from "../../instance-filter-builder/PresentationInstanceFilterDialog";
import { PresentationTreeNodeRenderer } from "./PresentationTreeNodeRenderer";
import { useHierarchyLevelFiltering } from "./UseHierarchyLevelFiltering";
import { PresentationTreeNodeItem, PresentationTreeNodeItemFilteringInfo } from "../PresentationTreeNodeItem";

/**
 * @alpha
 */
export interface PresentationTreeRendererProps extends TreeRendererProps {
  imodel: IModelConnection;
  modelSource: TreeModelSource;
}

/**
 * @alpha
 */
export function PresentationTreeRenderer(props: PresentationTreeRendererProps) {
  const { imodel, modelSource, ...restProps } = props;
  const nodeLoader = restProps.nodeLoader;

  const { applyFilter, clearFilter } = useHierarchyLevelFiltering({ nodeLoader, modelSource });
  const [filterNode, setFilterNode] = React.useState<PresentationTreeNodeItem>();

  const filterableNodeRenderer = React.useCallback((nodeProps: TreeNodeRendererProps) => {
    return (
      <PresentationTreeNodeRenderer
        {...nodeProps}
        onFilterClick={(node) => { setFilterNode(node); }}
        onClearFilterClick={clearFilter}
      />
    );
  }, [clearFilter]);

  return (
    <>
      <TreeRenderer {...restProps} nodeRenderer={filterableNodeRenderer} />
      {
        filterNode && filterNode.filtering
          ? <TreeNodeFilterBuilderDialog
            imodel={imodel}
            onApply={(info) => {
              applyFilter(filterNode, info);
              setFilterNode(undefined);
            }}
            onClose={() => { setFilterNode(undefined); }}
            filteringInfo={filterNode.filtering}
          />
          : null
      }
    </>
  );
}

interface TreeNodeFilterBuilderDialogProps {
  imodel: IModelConnection;
  filteringInfo: PresentationTreeNodeItemFilteringInfo;
  onClose: () => void;
  onApply: (info: PresentationInstanceFilterInfo) => void;
}

function TreeNodeFilterBuilderDialog(props: TreeNodeFilterBuilderDialogProps) {
  const { onClose, onApply, imodel, filteringInfo } = props;

  return (
    <PresentationInstanceFilterDialog
      isOpen={true}
      onClose={onClose}
      onApply={onApply}
      imodel={imodel}
      descriptor={filteringInfo.descriptor}
      initialFilter={filteringInfo.active}
    />
  );
}
