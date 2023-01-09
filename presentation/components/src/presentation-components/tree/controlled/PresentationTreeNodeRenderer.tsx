/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as React from "react";
import classnames from "classnames";
import { AbstractTreeNodeLoader, isTreeModelNode, TreeModelNode, TreeNodeRenderer, TreeNodeRendererProps, TreeRenderer, TreeRendererProps } from "@itwin/components-react";
import { TreeNode } from "@itwin/core-react";
import { SvgFilter, SvgFilterHollow, SvgRemove } from "@itwin/itwinui-icons-react";
import { Button, ButtonGroup, IconButton, Modal } from "@itwin/itwinui-react";
import { translate } from "../../common/Utils";
import "./PresentationTreeNodeRenderer.scss";
import { IModelConnection } from "@itwin/core-frontend";
import { ContentSpecificationTypes, DefaultContentDisplayTypes, Descriptor, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { PresentationInstanceFilterBuilder, PresentationInstanceFilterInfo } from "../../instance-filter-builder/PresentationInstanceFilterBuilder";
import { isPresentationTreeNodeItem, PresentationTreeNodeItem } from "../DataProvider";

/** @alpha */
export interface UseHierarchyLevelFilteringProps {
  nodeLoader: AbstractTreeNodeLoader;
}

/** @alpha */
export function useHierarchyLevelFiltering(props: UseHierarchyLevelFilteringProps) {
  const { nodeLoader } = props;

  const applyFilter = React.useCallback((node: TreeModelNode, filterInfo: PresentationInstanceFilterInfo) => {
    applyHierarchyLevelFilter(nodeLoader, node.id, filterInfo);
  }, [nodeLoader]);

  const clearFilter = React.useCallback((node: TreeModelNode) => {
    applyHierarchyLevelFilter(nodeLoader, node.id);
  }, [nodeLoader]);

  return { applyFilter, clearFilter };
}

/** @alpha */
export interface UseFilterableTreeRendererProps {
  imodel: IModelConnection;
  nodeLoader: AbstractTreeNodeLoader;
}

/** @alpha */
export function useFilterableTreeRenderer(props: UseFilterableTreeRendererProps) {
  const { imodel, nodeLoader } = props;
  const { applyFilter, clearFilter } = useHierarchyLevelFiltering({ nodeLoader });

  return React.useCallback((treeProps: TreeRendererProps) => {
    const filterableNodeRenderer = (nodeProps: TreeNodeRendererProps) => {
      if (!isPresentationTreeNodeItem(nodeProps.node.item))
        return <TreeNodeRenderer {...nodeProps} />;

      return (
        <PresentationTreeNodeRenderer
          {...nodeProps}
          imodel={imodel}
          nodeItem={nodeProps.node.item}
          onFilterApplied={applyFilter}
          onFilterClear={clearFilter}
        />
      );
    };

    return <TreeRenderer {...treeProps} nodeRenderer={filterableNodeRenderer} />;
  }, [imodel, applyFilter, clearFilter]);
}

/**
 * @alpha
 */
export interface PresentationFilterableTreeNodeRendererProps extends TreeNodeRendererProps {
  imodel: IModelConnection;
  nodeItem: PresentationTreeNodeItem;
  onFilterApplied: (node: TreeModelNode, filterInfo: PresentationInstanceFilterInfo) => void;
  onFilterClear: (node: TreeModelNode) => void;
}

/**
 * @alpha
 */
export function PresentationTreeNodeRenderer(props: PresentationFilterableTreeNodeRendererProps) {
  if (props.nodeItem.tooManyChildren) {
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
    <FilterableNodeRenderer
      {...props}
    />
  );
}

/** @alpha */
export function FilterableNodeRenderer(props: PresentationFilterableTreeNodeRendererProps) {
  const { imodel, onFilterApplied, onFilterClear, className, nodeItem, ...restProps } = props;
  const [filterDialogOpen, setFilterDialogOpen] = React.useState(false);

  const onFilterApply = (filterInfo: PresentationInstanceFilterInfo) => {
    setFilterDialogOpen(false);
    onFilterApplied(restProps.node, filterInfo);
  };

  return (
    <>
      <TreeNodeRenderer
        {...restProps}
        className={classnames("presentation-components-node", className)}
      >
        <FilterableNodeActions
          isFiltered={nodeItem.filterInfo !== undefined}
          filteringDisabled={nodeItem.filteringDisabled}
          onClear={() => { onFilterClear(restProps.node); }}
          onFilter={() => { setFilterDialogOpen(true); }}
        />
      </TreeNodeRenderer>
      <NodeFilterBuilderDialog
        imodel={imodel}
        isOpen={filterDialogOpen}
        onApply={onFilterApply}
        onClose={() => { setFilterDialogOpen(false); }}
        node={nodeItem}
      />
    </>
  );
}

interface FilterableNodeActionsProps {
  onFilter: () => void;
  onClear: () => void;
  filteringDisabled?: boolean;
  isFiltered?: boolean;
}

function FilterableNodeActions(props: FilterableNodeActionsProps) {
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
              onClear();
              e.stopPropagation();
            }}
          >
            <SvgRemove />
          </IconButton>
          : null}
        <IconButton
          styleType="borderless"
          size="small"
          onClick={(e) => {
            onFilter();
            e.stopPropagation();
          }}
        >
          {isFiltered ? <SvgFilter /> : <SvgFilterHollow />}
        </IconButton>
      </ButtonGroup>
    </div>
  );
}

interface NodeFilterBuilderDialogProps {
  imodel: IModelConnection;
  node: PresentationTreeNodeItem;
  isOpen: boolean;
  onClose: () => void;
  onApply: (info: PresentationInstanceFilterInfo) => void;
}

function NodeFilterBuilderDialog(props: NodeFilterBuilderDialogProps) {
  const { isOpen, onClose, onApply, imodel, node } = props;
  const [filter, setFilter] = React.useState<PresentationInstanceFilterInfo>();

  React.useEffect(() => {
    setFilter(undefined);
  }, [isOpen]);

  const onFilterChanged = React.useCallback((info?: PresentationInstanceFilterInfo) => {
    setFilter(info);
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Build filter"
    >
      <NodesFilterBuilder
        imodel={imodel}
        node={node}
        onFilterChanged={onFilterChanged}
      />
      <ButtonGroup>
        <Button
          disabled={filter === undefined}
          onClick={() => { filter && onApply(filter); }}
        >
          Apply
        </Button>
        <Button onClick={onClose}>
          Close
        </Button>
      </ButtonGroup>
    </Modal>
  );
}

interface NodesFilterBuilderProps {
  imodel: IModelConnection;
  node: PresentationTreeNodeItem;
  onFilterChanged: (info?: PresentationInstanceFilterInfo) => void;
}

function NodesFilterBuilder(props: NodesFilterBuilderProps) {
  const { imodel, node, onFilterChanged } = props;
  const descriptor = useChildInstancesDescriptor(imodel, node);
  if (!descriptor)
    return null;

  return (
    <PresentationInstanceFilterBuilder
      descriptor={descriptor}
      imodel={imodel}
      onInstanceFilterChanged={onFilterChanged}
      initialFilter={node.filterInfo}
    />
  );
}

function applyHierarchyLevelFilter(nodeLoader: AbstractTreeNodeLoader, nodeId: string, filter?: PresentationInstanceFilterInfo) {
  let reloadChildren = true;
  nodeLoader.modelSource.modifyModel((model) => {
    const modelNode = model.getNode(nodeId);
    if (!modelNode || !isTreeModelNode(modelNode) || !isPresentationTreeNodeItem(modelNode.item))
      return;

    if (modelNode.item.filterInfo === filter) {
      reloadChildren = false;
      return;
    }

    modelNode.item.filterInfo = filter;
    model.clearChildren(nodeId);
  });

  const updatedNode = nodeLoader.modelSource.getModel().getNode(nodeId);
  if (!reloadChildren || updatedNode === undefined || !updatedNode.isExpanded)
    return;
  nodeLoader.loadNode(updatedNode, 0).subscribe();
}

// TODO: remove when RPC for getting child instances descriptor implemented

interface ChildInstancesInfo {
  schemaName: string;
  className: string;
}

function getChildInstancesInfo(node: PresentationTreeNodeItem) {
  if (!node.extendedData || !node.extendedData.childSchemaName || !node.extendedData.childClassName)
    return undefined;
  return {
    schemaName: node.extendedData.childSchemaName,
    className: node.extendedData.childClassName,
  };
}

function useChildInstancesDescriptor(imodel: IModelConnection, node: PresentationTreeNodeItem) {
  const [descriptor, setDescriptor] = React.useState<Descriptor>();

  React.useEffect(() => {
    let disposed = false;
    const childInfo = getChildInstancesInfo(node);
    if (!childInfo)
      return;

    void (async () => {
      const newDescriptor = await Presentation.presentation.getContentDescriptor({
        imodel,
        keys: new KeySet(),
        displayType: DefaultContentDisplayTypes.Undefined,
        rulesetOrId: createChildNodesRuleset(childInfo),
      });

      if (!disposed)
        setDescriptor(newDescriptor);
    })();
    return () => { disposed = true; };
  }, [node, imodel]);

  return descriptor;
}

function createChildNodesRuleset(childInfo: ChildInstancesInfo): Ruleset {
  return {
    id: "child-instance-properties",
    rules: [{
      ruleType: RuleTypes.Content,
      specifications: [{
        specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
        classes: { schemaName: childInfo.schemaName, classNames: [childInfo.className], arePolymorphic: true },
        handlePropertiesPolymorphically: true,
      }],
    }],
  };
}
