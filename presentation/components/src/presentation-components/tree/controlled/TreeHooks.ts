/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as React from "react";
import { Subscription } from "rxjs/internal/Subscription";
import { HierarchyUpdateRecord, PageOptions, UPDATE_FULL } from "@itwin/presentation-common";
import { IModelHierarchyChangeEventArgs, Presentation } from "@itwin/presentation-frontend";
import {
  computeVisibleNodes, isTreeModelNode, isTreeModelNodePlaceholder, MutableTreeModel, MutableTreeModelNode, PagedTreeNodeLoader, RenderedItemsRange,
  TreeModelNode, TreeModelNodeInput, TreeModelSource, TreeNodeItem, usePagedTreeNodeLoader, VisibleTreeNodes,
} from "@itwin/components-react";
import { RulesetRegistrationHelper } from "../../common/RulesetRegistrationHelper";
import { PresentationTreeDataProvider, PresentationTreeDataProviderProps } from "../DataProvider";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";
import { createTreeNodeId, createTreeNodeItem, CreateTreeNodeItemProps } from "../Utils";
import { reloadTree } from "./TreeReloader";
import { useExpandedNodesTracking } from "./UseExpandedNodesTracking";

/**
 * Properties for [[usePresentationTreeNodeLoader]] hook.
 * @public
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
   * Auto-update the hierarchy when ruleset, ruleset variables or data in the iModel changes.
   * @alpha
   */
  enableHierarchyAutoUpdate?: boolean;
}

/**
 * Return type for [[usePresentationTreeNodeLoader]] hook.
 * @public
 */
export interface PresentationTreeNodeLoaderResult {
  /** Tree node loader to be used with a tree component */
  nodeLoader: PagedTreeNodeLoader<IPresentationTreeDataProvider>;

  /**
   * Callback for when rendered tree node item range changes. This property should be passed to
   * [ControlledTree]($components-react) when property `enableHierarchyAutoUpdate` is `true`.
   * @alpha
   */
  onItemsRendered: (items: RenderedItemsRange) => void;
}

/**
 * Custom hooks which creates PagedTreeNodeLoader with PresentationTreeDataProvider using
 * supplied imodel and ruleset.
 * @public
 */
export function usePresentationTreeNodeLoader(
  props: PresentationTreeNodeLoaderProps,
): PresentationTreeNodeLoaderResult {
  const dataProviderProps: PresentationTreeDataProviderProps = React.useMemo(
    () => ({
      imodel: props.imodel,
      ruleset: props.ruleset,
      pagingSize: props.pagingSize,
      appendChildrenCountForGroupingNodes: props.appendChildrenCountForGroupingNodes,
      dataSourceOverrides: props.dataSourceOverrides,
      ruleDiagnostics: props.ruleDiagnostics,
      devDiagnostics: props.devDiagnostics,
    }),
    [
      props.appendChildrenCountForGroupingNodes,
      props.dataSourceOverrides,
      props.devDiagnostics,
      props.imodel,
      props.pagingSize,
      props.ruleDiagnostics,
      props.ruleset,
    ],
  );

  const [
    { modelSource, rulesetRegistration, dataProvider },
    setTreeNodeLoaderState,
  ] = useResettableState<TreeNodeLoaderState>(
    () => ({
      modelSource: new TreeModelSource(),
      rulesetRegistration: new RulesetRegistrationHelper(dataProviderProps.ruleset),
      dataProvider: new PresentationTreeDataProvider({
        ...dataProviderProps,
        ruleset: typeof dataProviderProps.ruleset === "string"
          ? dataProviderProps.ruleset
          : /* istanbul ignore next */ dataProviderProps.ruleset.id,
      }),
    }),
    [dataProviderProps],
  );
  React.useEffect(() => { return () => rulesetRegistration.dispose(); }, [rulesetRegistration]);
  React.useEffect(() => { return () => dataProvider.dispose(); }, [dataProvider]);

  const nodeLoader = usePagedTreeNodeLoader(dataProvider, props.pagingSize, modelSource);

  const params = {
    enable: !!props.enableHierarchyAutoUpdate,
    pageSize: props.pagingSize,
    modelSource,
    dataProviderProps,
    setTreeNodeLoaderState,
  };
  const onItemsRendered = useModelSourceUpdateOnIModelHierarchyUpdate({
    ...params,
    dataProvider,
    treeNodeItemCreationProps: { appendChildrenCountForGroupingNodes: props.appendChildrenCountForGroupingNodes },
  });
  useModelSourceUpdateOnRulesetModification(params);
  useModelSourceUpdateOnRulesetVariablesChange({ ...params, rulesetId: dataProvider.rulesetId });

  return { nodeLoader, onItemsRendered };
}

interface TreeNodeLoaderState {
  modelSource: TreeModelSource;
  rulesetRegistration: RulesetRegistrationHelper;
  dataProvider: IPresentationTreeDataProvider;
}

/**
 * Resets state to `initialValue` when dependencies change. Avoid using in new places because this hook is only intended
 * for use in poorly designed custom hooks.
 */
function useResettableState<T>(initialValue: () => T, dependencies: unknown[]): [T, React.Dispatch<React.SetStateAction<T>>] {
  const stateRef = React.useRef<T>() as React.MutableRefObject<T>;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useMemo(() => stateRef.current = initialValue(), dependencies);

  const [_, setState] = React.useState({});
  const setNewStateRef = React.useRef((action: T | ((previousState: T) => T)) => {
    const newState = action instanceof Function ? action(stateRef.current) : /* istanbul ignore next */ action;
    // istanbul ignore else
    if (newState !== stateRef.current) {
      stateRef.current = newState;
      setState({});
    }
  });
  return [stateRef.current, setNewStateRef.current];
}

function useModelSourceUpdateOnIModelHierarchyUpdate(params: {
  enable: boolean;
  dataProvider: IPresentationTreeDataProvider;
  dataProviderProps: PresentationTreeDataProviderProps;
  pageSize: number;
  modelSource: TreeModelSource;
  setTreeNodeLoaderState: React.Dispatch<React.SetStateAction<TreeNodeLoaderState>>;
  treeNodeItemCreationProps: CreateTreeNodeItemProps;
}): (items: RenderedItemsRange) => void {
  const {
    enable,
    dataProvider,
    dataProviderProps,
    pageSize,
    modelSource,
    setTreeNodeLoaderState,
    treeNodeItemCreationProps,
  } = params;

  useExpandedNodesTracking({ modelSource, dataProvider, enableNodesTracking: enable });
  const renderedItems = React.useRef<RenderedItemsRange | undefined>(undefined);
  const onItemsRendered = React.useCallback((items: RenderedItemsRange) => { renderedItems.current = items; }, []);

  React.useEffect(
    () => {
      if (!enable) {
        return;
      }

      let subscription: Subscription | undefined;
      const removeListener = Presentation.presentation.onIModelHierarchyChanged.addListener(
        async (args: IModelHierarchyChangeEventArgs) => {
          if (args.rulesetId !== dataProvider.rulesetId || args.imodelKey !== dataProvider.imodel.key) {
            return;
          }

          const newDataProvider = new PresentationTreeDataProvider({ ...dataProviderProps, ruleset: args.rulesetId });
          if (args.updateInfo === UPDATE_FULL) {
            subscription = reloadTree(modelSource.getModel(), newDataProvider, pageSize).subscribe({
              next: (newModelSource) => setTreeNodeLoaderState((prevState) => ({
                modelSource: newModelSource,
                rulesetRegistration: prevState.rulesetRegistration,
                dataProvider: newDataProvider,
              })),
            });
          } else {
            const newModelSource = await updateModelSourceAfterIModelChange(
              modelSource,
              args.updateInfo,
              newDataProvider,
              treeNodeItemCreationProps,
              renderedItems.current,
            );
            setTreeNodeLoaderState((prevState) => ({
              modelSource: newModelSource,
              rulesetRegistration: prevState.rulesetRegistration,
              dataProvider: newDataProvider,
            }));
          }
        },
      );

      return () => {
        removeListener();
        subscription?.unsubscribe();
      };
    },
    [dataProvider, modelSource, enable, pageSize, treeNodeItemCreationProps, dataProviderProps, setTreeNodeLoaderState],
  );

  return onItemsRendered;
}

function useModelSourceUpdateOnRulesetModification(params: {
  enable: boolean;
  dataProviderProps: PresentationTreeDataProviderProps;
  pageSize: number;
  modelSource: TreeModelSource;
  setTreeNodeLoaderState: React.Dispatch<React.SetStateAction<TreeNodeLoaderState>>;
}): void {
  const { enable, dataProviderProps, pageSize, modelSource, setTreeNodeLoaderState } = params;

  React.useEffect(
    () => {
      if (!enable) {
        return;
      }

      let subscription: Subscription | undefined;
      const removeListener = Presentation.presentation.rulesets().onRulesetModified.addListener((ruleset) => {
        const dataProvider = new PresentationTreeDataProvider({ ...dataProviderProps, ruleset: ruleset.id });
        subscription = reloadTree(modelSource.getModel(), dataProvider, pageSize).subscribe({
          next: (newModelSource) => setTreeNodeLoaderState((prevState) => ({
            modelSource: newModelSource,
            rulesetRegistration: prevState.rulesetRegistration,
            dataProvider,
          })),
        });
      });

      return () => {
        removeListener();
        subscription?.unsubscribe();
      };
    },
    [dataProviderProps, enable, modelSource, pageSize, setTreeNodeLoaderState],
  );
}

function useModelSourceUpdateOnRulesetVariablesChange(params: {
  enable: boolean;
  dataProviderProps: PresentationTreeDataProviderProps;
  pageSize: number;
  rulesetId: string;
  modelSource: TreeModelSource;
  setTreeNodeLoaderState: React.Dispatch<React.SetStateAction<TreeNodeLoaderState>>;
}): void {
  const { enable, dataProviderProps, pageSize, rulesetId, modelSource, setTreeNodeLoaderState } = params;

  React.useEffect(
    () => {
      if (!enable) {
        return;
      }

      let subscription: Subscription | undefined;
      const removeListener = Presentation.presentation.vars(rulesetId).onVariableChanged.addListener(() => {
        // note: we should probably debounce these events while accumulating changed variables in case multiple vars are changed
        const dataProvider = new PresentationTreeDataProvider({ ...dataProviderProps, ruleset: rulesetId });
        subscription = reloadTree(modelSource.getModel(), dataProvider, pageSize).subscribe({
          next: (newModelSource) => setTreeNodeLoaderState((prevState) => ({
            modelSource: newModelSource,
            rulesetRegistration: prevState.rulesetRegistration,
            dataProvider,
          })),
        });
      });

      return () => {
        removeListener();
        subscription?.unsubscribe();
      };
    },
    [dataProviderProps, enable, modelSource, pageSize, rulesetId, setTreeNodeLoaderState],
  );
}

async function updateModelSourceAfterIModelChange(
  modelSource: TreeModelSource,
  hierarchyUpdateRecords: HierarchyUpdateRecord[],
  dataProvider: IPresentationTreeDataProvider,
  treeNodeItemCreationProps: CreateTreeNodeItemProps,
  renderedItems?: RenderedItemsRange,
): Promise<TreeModelSource> {
  const modelWithUpdateRecords = applyHierarchyChanges(
    modelSource.getModel() as MutableTreeModel,
    hierarchyUpdateRecords,
    [],
    treeNodeItemCreationProps,
  );
  if (modelWithUpdateRecords === modelSource.getModel()) {
    return modelSource;
  }

  if (!renderedItems) {
    return new TreeModelSource(modelWithUpdateRecords);
  }

  const reloadedHierarchyParts = await reloadVisibleHierarchyParts(computeVisibleNodes(modelWithUpdateRecords), renderedItems, dataProvider);
  const newModel = applyHierarchyChanges(modelSource.getModel() as MutableTreeModel, hierarchyUpdateRecords, reloadedHierarchyParts, treeNodeItemCreationProps);
  return new TreeModelSource(newModel);
}

/** @internal */
export interface ReloadedHierarchyPart {
  parentId: string | undefined;
  nodeItems: TreeNodeItem[];
  offset: number;
}

/** @internal */
export function applyHierarchyChanges(
  treeModel: MutableTreeModel,
  hierarchyUpdateRecords: HierarchyUpdateRecord[],
  reloadedHierarchyParts: ReloadedHierarchyPart[],
  treeNodeItemCreationProps: CreateTreeNodeItemProps
) {
  const modelSource = new TreeModelSource(treeModel);
  modelSource.modifyModel((model: MutableTreeModel) => {
    const updateParentIds = hierarchyUpdateRecords
      .map((record) => record.parent ? createTreeNodeId(record.parent) : undefined);
    for (const record of hierarchyUpdateRecords) {
      const parentNodeId = record.parent ? createTreeNodeId(record.parent) : undefined;
      const parentNode = parentNodeId ? model.getNode(parentNodeId) : model.getRootNode();
      if (!parentNode) {
        continue;
      }

      model.clearChildren(parentNodeId);
      model.setNumChildren(parentNodeId, record.nodesCount);
      if (isTreeModelNode(parentNode) && !parentNode.isExpanded)
        continue;

      for (const expandedNode of record.expandedNodes ?? []) {
        const treeItem = createTreeNodeItem(expandedNode.node, parentNodeId, treeNodeItemCreationProps);
        const existingNode = treeModel.getNode(treeItem.id);
        model.setChildren(parentNodeId, [createModelNodeInput(existingNode, treeItem)], expandedNode.position);
        if (existingNode) {
          rebuildSubTree(treeModel, model, existingNode, updateParentIds);
        }
      }
    }

    for (const reloadedHierarchyPart of reloadedHierarchyParts) {
      let offset = reloadedHierarchyPart.offset;
      for (const item of reloadedHierarchyPart.nodeItems) {
        const newItem = createModelNodeInput(undefined, item);
        const existingItem = model.getNode(newItem.id);
        if (!existingItem) {
          model.setChildren(reloadedHierarchyPart.parentId, [newItem], offset);
        }
        offset++;
      }
    }
  });
  return modelSource.getModel() as MutableTreeModel;
}

function rebuildSubTree(oldModel: MutableTreeModel, newModel: MutableTreeModel, parentNode: TreeModelNode, excludedNodeIds: Array<string | undefined>) {
  const oldChildren = oldModel.getChildren(parentNode.id);
  if (!oldChildren || !parentNode.isExpanded || excludedNodeIds.includes(parentNode.id))
    return;

  newModel.setNumChildren(parentNode.id, oldChildren.getLength());
  for (const [childId, index] of oldChildren.iterateValues()) {
    const childNode = oldModel.getNode(childId);
    // istanbul ignore else
    if (childNode) {
      newModel.setChildren(parentNode.id, [{ ...childNode }], index);
      rebuildSubTree(oldModel, newModel, childNode, excludedNodeIds);
    }
  }
}

function createModelNodeInput(oldNode: MutableTreeModelNode | undefined, newNode: TreeNodeItem): TreeModelNodeInput {
  const newInput = {
    description: newNode.description,
    isExpanded: !!newNode.autoExpand,
    id: newNode.id,
    item: newNode,
    label: newNode.label,
    isLoading: false,
    numChildren: 0,
    isSelected: false,
  };
  if (!oldNode) {
    return newInput;
  }

  return {
    ...newInput,
    isExpanded: oldNode.isExpanded,
    isSelected: oldNode.isSelected,
    isLoading: oldNode.isLoading,
  };
}

/** @internal */
export async function reloadVisibleHierarchyParts(
  visibleNodes: VisibleTreeNodes,
  renderedItems: RenderedItemsRange,
  dataProvider: IPresentationTreeDataProvider,
) {
  const itemsRange = getItemsRange(renderedItems, visibleNodes);

  interface ChildRange {
    parentItem: TreeNodeItem | undefined;
    startIndex: number;
    endIndex: number;
  }

  const partsToReload = new Map<string | undefined, ChildRange>();

  for (let i = itemsRange.startIndex; i <= itemsRange.endIndex; i++) {
    const node = visibleNodes.getAtIndex(i);
    if (!node || !isTreeModelNodePlaceholder(node))
      continue;

    const parentNode = node.parentId ? visibleNodes.getModel().getNode(node.parentId) : visibleNodes.getModel().getRootNode();
    // istanbul ignore if
    if (!parentNode || isTreeModelNodePlaceholder(parentNode))
      continue;

    const partToReload = partsToReload.get(parentNode.id);
    if (!partToReload) {
      partsToReload.set(parentNode.id, { parentItem: isTreeModelNode(parentNode) ? parentNode.item : undefined, startIndex: node.childIndex, endIndex: node.childIndex });
      continue;
    }
    partToReload.endIndex = node.childIndex;
  }

  const reloadedHierarchyParts = new Array<ReloadedHierarchyPart>();
  for (const [parentId, hierarchyPart] of partsToReload) {
    const pageOptions: PageOptions = {
      start: hierarchyPart.startIndex,
      size: hierarchyPart.endIndex - hierarchyPart.startIndex + 1,
    };
    const reloadedPart: ReloadedHierarchyPart = {
      parentId,
      offset: hierarchyPart.startIndex,
      nodeItems: await dataProvider.getNodes(hierarchyPart.parentItem, pageOptions),
    };
    reloadedHierarchyParts.push(reloadedPart);
  }

  return reloadedHierarchyParts;
}

function getItemsRange(renderedNodes: RenderedItemsRange, visibleNodes: VisibleTreeNodes) {
  if (renderedNodes.visibleStopIndex < visibleNodes.getNumNodes())
    return { startIndex: renderedNodes.visibleStartIndex, endIndex: renderedNodes.visibleStopIndex };

  const visibleNodesCount = renderedNodes.visibleStopIndex - renderedNodes.visibleStartIndex;
  const endPosition = visibleNodes.getNumNodes() - 1;
  const startPosition = endPosition - visibleNodesCount;
  return {
    startIndex: startPosition < 0 ? 0 : startPosition,
    endIndex: endPosition < 0 ? 0 : endPosition,
  };
}
