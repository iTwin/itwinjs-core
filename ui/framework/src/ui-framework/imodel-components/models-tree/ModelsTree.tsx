/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import "./ModelsTree.scss";
import * as React from "react";
import { Id64Array } from "@bentley/bentleyjs-core";
import { IModelConnection, Viewport } from "@bentley/imodeljs-frontend";
import { NodeKey, Ruleset } from "@bentley/presentation-common";
import {
  IFilteredPresentationTreeDataProvider, IPresentationTreeDataProvider, usePresentationTreeNodeLoader,
} from "@bentley/presentation-components";
import { Presentation } from "@bentley/presentation-frontend";
import { ControlledTree, SelectionMode, TreeNodeItem, useVisibleTreeNodes } from "@bentley/ui-components";
import { useDisposable, useOptionalDisposable } from "@bentley/ui-core";
import { connectIModelConnection } from "../../../ui-framework/redux/connectIModel";
import { UiFramework } from "../../../ui-framework/UiFramework";
import { ClassGroupingOption, VisibilityTreeFilterInfo } from "../Common";
import { VisibilityTreeEventHandler } from "../VisibilityTreeEventHandler";
import { useVisibilityTreeFiltering, useVisibilityTreeRenderer, VisibilityTreeNoFilteredData } from "../VisibilityTreeRenderer";
import { ModelsTreeSelectionPredicate, ModelsVisibilityHandler } from "./ModelsVisibilityHandler";

const PAGING_SIZE = 20;

/** @internal */
export const RULESET_MODELS: Ruleset = require("./Hierarchy.json"); // eslint-disable-line @typescript-eslint/no-var-requires
/** @internal */
export const RULESET_MODELS_GROUPED_BY_CLASS: Ruleset = require("./Hierarchy.GroupedByClass.json"); // eslint-disable-line @typescript-eslint/no-var-requires

const RULESET_MODELS_SEARCH: Ruleset = require("./ModelsTreeSearch.json"); // eslint-disable-line @typescript-eslint/no-var-requires

/** Props for [[ModelsTree]] component
 * @public
 */
export interface ModelsTreeProps {
  /**
   * An IModel to pull data from
   */
  iModel: IModelConnection;
  /**
   * Selection mode in the tree
   */
  selectionMode?: SelectionMode;
  /**
   * Predicate which indicates whether node can be selected or no
   * @alpha
   */
  selectionPredicate?: ModelsTreeSelectionPredicate;
  /**
   * Start loading hierarchy as soon as the component is created
   * @deprecated Going to be removed due to too high pressure on the backend
   */
  enablePreloading?: boolean;
  /**
   * Active view used to determine and control visibility
   */
  activeView?: Viewport;
  /**
   * Ref to the root HTML element used by this component
   */
  rootElementRef?: React.Ref<HTMLDivElement>;
  /**
   * Information for tree filtering.
   * @alpha
   */
  filterInfo?: VisibilityTreeFilterInfo;
  /**
   * Filter the hierarchy by given element IDs.
   * @alpha
   */
  filteredElementIds?: Id64Array;
  /**
   * Callback invoked when tree is filtered.
   */
  onFilterApplied?: (filteredDataProvider: IPresentationTreeDataProvider, matchesCount: number) => void;
  /**
   * Should the tree group displayed element nodes by class.
   * @beta
   */
  enableElementsClassGrouping?: ClassGroupingOption;
  /**
   * Auto-update the hierarchy when data in the iModel changes.
   * @alpha
   */
  enableHierarchyAutoUpdate?: boolean;
  /**
   * Custom visibility handler.
   * @alpha
   */
  modelsVisibilityHandler?: ModelsVisibilityHandler;
}

/**
 * A tree component that shows a subject - model - category - element
 * hierarchy along with checkboxes that represent and allow changing
 * the display of those instances.
 * @public
 */
export function ModelsTree(props: ModelsTreeProps) {
  const { nodeLoader, onItemsRendered } = useModelsTreeNodeLoader(props);
  const { filteredNodeLoader, isFiltering, nodeHighlightingProps } = useVisibilityTreeFiltering(nodeLoader, props.filterInfo, props.onFilterApplied);
  const filterApplied = filteredNodeLoader !== nodeLoader;

  const { activeView, modelsVisibilityHandler, selectionPredicate } = props;
  const nodeSelectionPredicate = React.useCallback((key: NodeKey, node: TreeNodeItem) => {
    return !selectionPredicate ? true : selectionPredicate(key, ModelsVisibilityHandler.getNodeType(node, nodeLoader.dataProvider));
  }, [selectionPredicate, nodeLoader.dataProvider]);

  const visibilityHandler = useVisibilityHandler(
    nodeLoader.dataProvider.rulesetId,
    activeView,
    modelsVisibilityHandler,
    getFilteredDataProvider(filteredNodeLoader.dataProvider),
    props.enableHierarchyAutoUpdate);
  const eventHandler = useDisposable(React.useCallback(() => new VisibilityTreeEventHandler({
    nodeLoader: filteredNodeLoader,
    visibilityHandler,
    collapsedChildrenDisposalEnabled: true,
    selectionPredicate: nodeSelectionPredicate,
  }), [filteredNodeLoader, visibilityHandler, nodeSelectionPredicate]));

  const visibleNodes = useVisibleTreeNodes(filteredNodeLoader.modelSource);
  const treeRenderer = useVisibilityTreeRenderer(true, false);

  const overlay = isFiltering ? <div className="filteredTreeOverlay" /> : undefined;

  // istanbul ignore next
  const noFilteredDataRenderer = React.useCallback(() => {
    return <VisibilityTreeNoFilteredData
      title={UiFramework.i18n.translate("UiFramework:modelTree.noModelFound")}
      message={UiFramework.i18n.translate("UiFramework:modelTree.noMatchingModelNames")}
    />;
  }, []);

  return (
    <div className="ui-fw-models-tree" ref={props.rootElementRef}>
      <ControlledTree
        nodeLoader={filteredNodeLoader}
        visibleNodes={visibleNodes}
        selectionMode={props.selectionMode || SelectionMode.None}
        treeEvents={eventHandler}
        treeRenderer={treeRenderer}
        nodeHighlightingProps={nodeHighlightingProps}
        noDataRenderer={filterApplied ? noFilteredDataRenderer : undefined}
        onItemsRendered={onItemsRendered}
      />
      {overlay}
    </div>
  );
}

/**
 * ModelsTree that is connected to the IModelConnection property in the Redux store. The
 * application must set up the Redux store and include the FrameworkReducer.
 * @alpha
 */
export const IModelConnectedModelsTree = connectIModelConnection(null, null)(ModelsTree); // eslint-disable-line @typescript-eslint/naming-convention

function useModelsTreeNodeLoader(props: ModelsTreeProps) {
  // note: this is a temporary workaround for auto-update not working on ruleset variable changes - instead
  // of auto-updating we just re-create the node loader by re-creating the ruleset
  const rulesets = React.useMemo(() => {
    return {
      general: (!props.enableElementsClassGrouping) ? { ...RULESET_MODELS } : /* istanbul ignore next */ { ...RULESET_MODELS_GROUPED_BY_CLASS },
      search: { ...RULESET_MODELS_SEARCH },
    };
  }, [props.filteredElementIds]); // eslint-disable-line react-hooks/exhaustive-deps
  // const rulesets = {
  //   general: (!props.enableElementsClassGrouping) ? RULESET_MODELS : /* istanbul ignore next */ RULESET_MODELS_GROUPED_BY_CLASS,
  //   search: RULESET_MODELS_SEARCH,
  // };

  const { nodeLoader, onItemsRendered } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: rulesets.general,
    appendChildrenCountForGroupingNodes: (props.enableElementsClassGrouping === ClassGroupingOption.YesWithCounts),
    pagingSize: PAGING_SIZE,
    enableHierarchyAutoUpdate: props.enableHierarchyAutoUpdate,
  });
  const { nodeLoader: searchNodeLoader, onItemsRendered: onSearchItemsRendered } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: rulesets.search,
    pagingSize: PAGING_SIZE,
    enableHierarchyAutoUpdate: props.enableHierarchyAutoUpdate,
  });

  const activeNodeLoader = props.filterInfo?.filter ? searchNodeLoader : nodeLoader;
  const activeItemsRenderedCallback = props.filterInfo?.filter ? onSearchItemsRendered : onItemsRendered;

  const vars = Presentation.presentation.vars(activeNodeLoader.dataProvider.rulesetId);
  if (props.filteredElementIds) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vars.setId64s("filtered-element-ids", props.filteredElementIds);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vars.unset("filtered-element-ids");
  }

  return {
    nodeLoader: activeNodeLoader,
    onItemsRendered: activeItemsRenderedCallback,
  };
}

function useVisibilityHandler(
  rulesetId: string,
  activeView?: Viewport,
  visibilityHandler?: ModelsVisibilityHandler,
  filteredDataProvider?: IFilteredPresentationTreeDataProvider,
  hierarchyAutoUpdateEnabled?: boolean,
) {
  const defaultVisibilityHandler = useOptionalDisposable(React.useCallback(() => {
    return visibilityHandler ? undefined : createVisibilityHandler(rulesetId, activeView, hierarchyAutoUpdateEnabled);
  }, [visibilityHandler, rulesetId, activeView, hierarchyAutoUpdateEnabled]));

  const handler = visibilityHandler ?? defaultVisibilityHandler;

  React.useEffect(() => {
    handler && handler.setFilteredDataProvider(filteredDataProvider);
  }, [handler, filteredDataProvider]);

  return handler;
}

const createVisibilityHandler = (rulesetId: string, activeView?: Viewport, hierarchyAutoUpdateEnabled?: boolean): ModelsVisibilityHandler | undefined => {
  // istanbul ignore next
  return activeView ? new ModelsVisibilityHandler({ rulesetId, viewport: activeView, hierarchyAutoUpdateEnabled }) : undefined;
};

const isFilteredDataProvider = (dataProvider: IPresentationTreeDataProvider | IFilteredPresentationTreeDataProvider): dataProvider is IFilteredPresentationTreeDataProvider => {
  const filteredProvider = dataProvider as IFilteredPresentationTreeDataProvider;
  return filteredProvider.nodeMatchesFilter !== undefined && filteredProvider.getActiveMatch !== undefined && filteredProvider.countFilteringResults !== undefined;
};

const getFilteredDataProvider = (dataProvider: IPresentationTreeDataProvider | IFilteredPresentationTreeDataProvider): IFilteredPresentationTreeDataProvider | undefined => {
  return isFilteredDataProvider(dataProvider) ? dataProvider : undefined;
};
