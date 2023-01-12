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
import { ContentSpecificationTypes, DefaultContentDisplayTypes, Descriptor, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { PresentationInstanceFilterInfo } from "../../instance-filter-builder/PresentationInstanceFilterBuilder";
import { PresentationInstanceFilterDialog } from "../../instance-filter-builder/PresentationInstanceFilterDialog";
import { PresentationTreeNodeItem } from "../DataProvider";
import { PresentationTreeNodeRenderer } from "./PresentationTreeNodeRenderer";
import { useHierarchyLevelFiltering } from "./UseHierarchyLevelFiltering";

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
      initialFilter={node.filterInfo}
    />
  );
}

// TODO: remove when RPC for getting child instances descriptor implemented

interface ChildInstancesInfo {
  schemaName: string;
  className: string;
}

// istanbul ignore next
function getChildInstancesInfo(node: PresentationTreeNodeItem): ChildInstancesInfo {
  if (!node.extendedData || !node.extendedData.childSchemaName || !node.extendedData.childClassName)
    return { schemaName: "BisCore", className: "Element" };
  return {
    schemaName: node.extendedData.childSchemaName,
    className: node.extendedData.childClassName,
  };
}

// istanbul ignore next
function useChildInstancesDescriptorGetter(imodel: IModelConnection, node: PresentationTreeNodeItem) {
  return React.useCallback<() => Promise<Descriptor>>(async () => {
    const childInfo = getChildInstancesInfo(node);
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

// istanbul ignore next
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
