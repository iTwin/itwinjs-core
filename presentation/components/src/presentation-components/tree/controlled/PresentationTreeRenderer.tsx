/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as React from "react";
import { TreeModelSource, TreeNodeRenderer, TreeNodeRendererProps, TreeRenderer, TreeRendererProps } from "@itwin/components-react";
import { IModelConnection } from "@itwin/core-frontend";
import { ContentSpecificationTypes, DefaultContentDisplayTypes, Descriptor, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { PresentationInstanceFilterInfo } from "../../instance-filter-builder/PresentationInstanceFilterBuilder";
import { PresentationInstanceFilterDialog } from "../../instance-filter-builder/PresentationInstanceFilterDialog";
import { isPresentationTreeNodeItem, PresentationTreeNodeItem } from "../DataProvider";
import { PresentationTreeNodeRenderer } from "./PresentationTreeNodeRenderer";
import { useHierarchyLevelFiltering } from "./UseHierarchyLevelFiltering";

/**
 * @alpha
 */
export interface UsePresentationTreeRendererProps {
  imodel: IModelConnection;
  modelSource: TreeModelSource;
}

/**
 * @alpha
 */
export function usePresentationTreeRenderer(props: UsePresentationTreeRendererProps) {
  const { imodel, modelSource } = props;
  return React.useCallback((treeProps: TreeRendererProps) => <PresentationTreeRenderer {...treeProps} imodel={imodel} modelSource={modelSource} />, [imodel, modelSource]);
}

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
  const openFilteringDialog = React.useCallback((node: PresentationTreeNodeItem) => {
    setFilterNode(node);
  }, []);

  const filterableNodeRenderer = React.useCallback((nodeProps: TreeNodeRendererProps) => {
    if (!isPresentationTreeNodeItem(nodeProps.node.item))
      return <TreeNodeRenderer {...nodeProps} />;

    return (
      <PresentationTreeNodeRenderer
        {...nodeProps}
        onFilterClick={openFilteringDialog}
        onClearFilterClick={clearFilter}
      />
    );
  }, [openFilteringDialog, clearFilter]);

  return (
    <>
      <TreeRenderer {...restProps} nodeRenderer={filterableNodeRenderer} />
      {
        filterNode
          ? <TreeNodeFilterBuilderDialog
            imodel={imodel}
            onApply={(info) => {
              applyFilter(filterNode, info);
              setFilterNode(undefined);
            }}
            onClose={() => { setFilterNode(undefined); }}
            node={filterNode}
          />
          : null
      }
    </>
  );
}

interface TreeNodeFilterBuilderDialogProps {
  imodel: IModelConnection;
  node: PresentationTreeNodeItem;
  onClose: () => void;
  onApply: (info: PresentationInstanceFilterInfo) => void;
}

function TreeNodeFilterBuilderDialog(props: TreeNodeFilterBuilderDialogProps) {
  const { onClose, onApply, imodel, node } = props;
  const descriptorGetter = useChildInstancesDescriptorGetter(imodel, node);

  return (
    <PresentationInstanceFilterDialog
      isOpen={true}
      onClose={onClose}
      onApply={onApply}
      imodel={imodel}
      descriptor={descriptorGetter}
      initialFilter={node?.filterInfo}
    />
  );
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

function useChildInstancesDescriptorGetter(imodel: IModelConnection, node: PresentationTreeNodeItem) {
  return React.useCallback<() => Promise<Descriptor>>(async () => {
    const childInfo = getChildInstancesInfo(node);
    if (!childInfo)
      throw new Error(`Cannot create descriptor for node ${node.id} as it is missing child info`);

    const descriptor = await Presentation.presentation.getContentDescriptor({
      imodel,
      keys: new KeySet(),
      displayType: DefaultContentDisplayTypes.Undefined,
      rulesetOrId: createChildNodesRuleset(childInfo),
    });

    if (!descriptor)
      throw new Error(`Failed to create descriptor for node ${node.id}`);

    return descriptor;
  }, [imodel, node]);
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
