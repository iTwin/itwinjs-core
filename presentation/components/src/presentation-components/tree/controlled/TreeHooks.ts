/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as immer from "immer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PartialHierarchyModification, RegisteredRuleset, Ruleset, UPDATE_FULL, VariableValue } from "@bentley/presentation-common";
import { IModelHierarchyChangeEventArgs, Presentation } from "@bentley/presentation-frontend";
import {
  MutableTreeModel, PagedTreeNodeLoader, Subscription, TreeModel, TreeModelNodeInput, TreeModelSource, TreeNodeItemData, usePagedTreeNodeLoader,
} from "@bentley/ui-components";
import { useDisposable } from "@bentley/ui-core";
import { PresentationTreeDataProvider, PresentationTreeDataProviderProps } from "../DataProvider";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";
import { createPartialTreeNodeItem, createTreeNodeId, createTreeNodeItem, CreateTreeNodeItemProps } from "../Utils";
import { getExpandedNodeItems, useExpandedNodesTracking } from "./UseExpandedNodesTracking";

/**
 * Properties for [[usePresentationTreeNodeLoader]] hook.
 * @beta
 */
export interface PresentationTreeNodeLoaderProps extends PresentationTreeDataProviderProps {
  /**
   * Number of nodes in a single page. The created loader always requests at least
   * a page nodes, so it should be optimized for usability vs performance (using
   * smaller pages gives better responsiveness, but makes overall performance
   * slightly worse).
   *
   * Note: The prop is already defined in `PresentationTreeDataProviderProps` but specified here again to make it required.
   */
  pagingSize: number;

  /**
   * Should node loader initiate loading of the whole hierarchy as soon as it's created.
   * @alpha @deprecated Will be removed on 3.0.
   */
  preloadingEnabled?: boolean;

  /**
   * Auto-update the hierarchy when ruleset, ruleset variables or data in the iModel changes.
   * @alpha
   */
  enableHierarchyAutoUpdate?: boolean;

  /**
   * Used for testing
   * @internal
   */
  dataProvider?: IPresentationTreeDataProvider;
}

/**
 * Custom hooks which creates PagedTreeNodeLoader with PresentationTreeDataProvider using
 * supplied imodel and ruleset.
 *
 * @beta
 */
export function usePresentationTreeNodeLoader(props: PresentationTreeNodeLoaderProps): PagedTreeNodeLoader<IPresentationTreeDataProvider> {
  interface Info {
    treeModel: MutableTreeModel | undefined;
  }

  const [info, setInfo] = useState<Info>({ treeModel: undefined });
  const dataProvider = useDisposable(useCallback(
    () => createDataProvider(props),
    [info, ...Object.values(props)], /* eslint-disable-line react-hooks/exhaustive-deps */ /* re-create the data-provider whenever any prop changes */
  ));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const modelSource = useMemo(() => new TreeModelSource(info.treeModel), [dataProvider, info]);

  const rerenderWithTreeModel = (treeModel?: MutableTreeModel) => setInfo({ treeModel });
  const modelSourceUpdateProps: ModelSourceUpdateProps = {
    enable: props.enableHierarchyAutoUpdate,
    modelSource,
    rerenderWithTreeModel,
    dataProvider,
    treeNodeItemCreationProps: { appendChildrenCountForGroupingNodes: props.appendChildrenCountForGroupingNodes },
  };
  useModelSourceUpdateOnIModelHierarchyUpdate(modelSourceUpdateProps);
  useModelSourceUpdateOnRulesetModification(modelSourceUpdateProps);
  useModelSourceUpdateOnRulesetVariablesChange(modelSourceUpdateProps);

  const nodeLoader = usePagedTreeNodeLoader(dataProvider, props.pagingSize, modelSource);
  // When node loader is changed, all node loads automatically get cancelled; need to resume
  useResumeNodeLoading(modelSource, nodeLoader);
  return nodeLoader;
}

/** Starts loading children for nodes that are marked as loading, each time arguments change. */
function useResumeNodeLoading(
  modelSource: TreeModelSource,
  nodeLoader: PagedTreeNodeLoader<IPresentationTreeDataProvider>,
): void {
  useEffect(
    () => {
      let subscriptions: Subscription | undefined;
      for (const node of modelSource.getModel().iterateTreeModelNodes()) {
        if (!node.isLoading) {
          continue;
        }

        if (subscriptions === undefined) {
          subscriptions = nodeLoader.loadNode(node, 0).subscribe();
        } else {
          subscriptions.add(nodeLoader.loadNode(node, 0).subscribe());
        }
      }

      return () => subscriptions?.unsubscribe();
    },
    [modelSource, nodeLoader],
  );
}

interface ModelSourceUpdateProps {
  enable?: boolean;
  modelSource: TreeModelSource;
  rerenderWithTreeModel: (treeModel?: MutableTreeModel) => void;
  dataProvider: IPresentationTreeDataProvider;
  treeNodeItemCreationProps: CreateTreeNodeItemProps;
}

function useModelSourceUpdateOnIModelHierarchyUpdate(props: ModelSourceUpdateProps) {
  const { modelSource, dataProvider, rerenderWithTreeModel } = props;
  useExpandedNodesTracking({ modelSource, dataProvider, enableAutoUpdate: props.enable ?? false });
  const onIModelHierarchyChanged = useCallback(
    async (args: IModelHierarchyChangeEventArgs) => {
      if (args.rulesetId === dataProvider.rulesetId && args.imodelKey === dataProvider.imodel.key) {
        if (args.updateInfo === UPDATE_FULL) {
          rerenderWithTreeModel(undefined);
        } else {
          updateModelSource(modelSource, rerenderWithTreeModel, args.updateInfo, props.treeNodeItemCreationProps);
        }
      }
    },
    [modelSource, dataProvider, rerenderWithTreeModel, props.treeNodeItemCreationProps],
  );
  useEffect(
    () => {
      return props.enable
        ? Presentation.presentation.onIModelHierarchyChanged.addListener(onIModelHierarchyChanged)
        : undefined;
    },
    [onIModelHierarchyChanged, props.enable],
  );
}

function useModelSourceUpdateOnRulesetModification(props: ModelSourceUpdateProps) {
  const onRulesetModified = useCallback(async (curr: RegisteredRuleset, prev: Ruleset) => {
    if (curr.id === props.dataProvider.rulesetId) {
      const compareResult = await Presentation.presentation.compareHierarchies({
        imodel: props.dataProvider.imodel,
        prev: {
          rulesetOrId: prev,
        },
        rulesetOrId: curr.toJSON(),
        expandedNodeKeys: getExpandedNodeKeys(props.modelSource, props.dataProvider),
      });
      updateModelSource(props.modelSource, props.rerenderWithTreeModel, compareResult, props.treeNodeItemCreationProps);
    }
  }, [props.dataProvider, props.modelSource, props.rerenderWithTreeModel, props.treeNodeItemCreationProps]);
  useEffect(() => {
    return props.enable ? Presentation.presentation.rulesets().onRulesetModified.addListener(onRulesetModified) : undefined;
  }, [onRulesetModified, props.enable]);
}

function useModelSourceUpdateOnRulesetVariablesChange(props: ModelSourceUpdateProps) {
  const onRulesetVariableChanged = useCallback(async (variableId: string, prevValue: VariableValue) => {
    // note: we should probably debounce these events while accumulating changed variables in case multiple vars are changed
    const prevVariables = (await Presentation.presentation.vars(props.dataProvider.rulesetId).getAllVariables())
      .map((v) => (v.id === variableId) ? { ...v, value: prevValue } : v);
    const compareResult = await Presentation.presentation.compareHierarchies({
      imodel: props.dataProvider.imodel,
      prev: {
        rulesetVariables: prevVariables,
      },
      rulesetOrId: props.dataProvider.rulesetId,
      expandedNodeKeys: getExpandedNodeKeys(props.modelSource, props.dataProvider),
    });
    updateModelSource(props.modelSource, props.rerenderWithTreeModel, compareResult, props.treeNodeItemCreationProps);
  }, [props.dataProvider, props.modelSource, props.rerenderWithTreeModel, props.treeNodeItemCreationProps]);
  useEffect(() => {
    return props.enable ? Presentation.presentation.vars(props.dataProvider.rulesetId).onVariableChanged.addListener(onRulesetVariableChanged) : undefined;
  }, [props.dataProvider.rulesetId, onRulesetVariableChanged, props.enable]);
}

function updateModelSource(
  modelSource: TreeModelSource,
  rerenderWithTreeModel: (treeModel?: MutableTreeModel) => void,
  hierarchyModifications: PartialHierarchyModification[],
  treeNodeItemCreationProps: CreateTreeNodeItemProps,
) {
  const newModel = updateTreeModel(modelSource.getModel(), hierarchyModifications, treeNodeItemCreationProps);
  if (newModel !== modelSource.getModel() || newModel === undefined) {
    rerenderWithTreeModel(newModel);
  }
}

/** @internal */
export function updateTreeModel(
  treeModel: TreeModel,
  hierarchyModifications: PartialHierarchyModification[],
  treeNodeItemCreationProps: CreateTreeNodeItemProps,
): MutableTreeModel | undefined {
  let encounteredAnError = false;
  const updatedTreeModel = immer.produce(treeModel as MutableTreeModel, (model) => {
    for (const modification of hierarchyModifications) {
      switch (modification.type) {
        case "Insert":
          const nodeInput = convertToTreeModelNodeInput(createTreeNodeItem(modification.node));
          const parentId = modification.parent === undefined ? undefined : createTreeNodeId(modification.parent);
          model.insertChild(parentId, nodeInput, modification.position);
          break;

        case "Update":
          const existingNode = model.getNode(createTreeNodeId(modification.target));
          if (existingNode === undefined) {
            break;
          }

          const updatedItem = {
            ...existingNode.item,
            ...createPartialTreeNodeItem(modification.changes, existingNode.parentId, treeNodeItemCreationProps),
          };

          delete existingNode.editingInfo;
          existingNode.item = updatedItem;
          existingNode.label = updatedItem.label;
          existingNode.description = updatedItem.description ?? "";

          if ("hasChildren" in modification.changes) {
            model.setNumChildren(existingNode.id, modification.changes.hasChildren ? undefined : 0);
            if (!modification.changes.hasChildren) {
              existingNode.isExpanded = false;
              existingNode.isLoading = false;
            }
          }

          if ("key" in modification.changes && existingNode.id !== updatedItem.id) {
            if (!model.changeNodeId(existingNode.id, updatedItem.id)) {
              encounteredAnError = true;
              return;
            }

            existingNode.isSelected = false;
          }

          break;

        case "Delete":
          const nodeToRemove = model.getNode(createTreeNodeId(modification.target));
          if (nodeToRemove === undefined) {
            return;
          }

          model.removeChild(nodeToRemove.parentId, nodeToRemove.id);
          break;
      }
    }
  });

  if (encounteredAnError) {
    return undefined;
  }

  return updatedTreeModel;
}

function convertToTreeModelNodeInput(item: TreeNodeItemData): TreeModelNodeInput {
  return {
    description: item.description,
    isExpanded: !!item.autoExpand,
    id: item.id,
    item,
    label: item.label,
    isLoading: false,
    numChildren: item.hasChildren ? undefined : 0,
    isSelected: false,
  };
}

function getExpandedNodeKeys(modelSource: TreeModelSource, dataProvider: IPresentationTreeDataProvider) {
  return getExpandedNodeItems(modelSource).map((item) => dataProvider.getNodeKey(item));
}

function createDataProvider(props: PresentationTreeNodeLoaderProps): IPresentationTreeDataProvider {
  let dataProvider: IPresentationTreeDataProvider;
  if (props.dataProvider) {
    dataProvider = props.dataProvider;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { dataProvider: testDataProvider, ...providerProps } = props;
    dataProvider = new PresentationTreeDataProvider(providerProps);
  }
  return dataProvider;
}
