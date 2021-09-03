/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import "./CategoriesTree.scss";
import * as React from "react";
import { IModelApp, IModelConnection, SpatialViewState, ViewManager, Viewport } from "@bentley/imodeljs-frontend";
import { Ruleset } from "@bentley/presentation-common";
import { IPresentationTreeDataProvider, usePresentationTreeNodeLoader } from "@bentley/presentation-components";
import { Presentation } from "@bentley/presentation-frontend";
import { ControlledTree, SelectionMode, useVisibleTreeNodes } from "@bentley/ui-components";
import { useDisposable } from "@bentley/ui-core";
import { connectIModelConnection } from "../../redux/connectIModel";
import { UiFramework } from "../../UiFramework";
import { VisibilityTreeFilterInfo } from "../Common";
import { VisibilityTreeEventHandler } from "../VisibilityTreeEventHandler";
import { useVisibilityTreeFiltering, useVisibilityTreeRenderer, VisibilityTreeNoFilteredData } from "../VisibilityTreeRenderer";
import { Category, CategoryVisibilityHandler, loadCategoriesFromViewport, useCategories } from "./CategoryVisibilityHandler";

const PAGING_SIZE = 20;

/**
 * Presentation rules used by ControlledCategoriesTree
 * @internal
 */
export const RULESET_CATEGORIES: Ruleset = require("./Categories.json"); // eslint-disable-line @typescript-eslint/no-var-requires

/**
 * Properties for the [[CategoryTree]] component
 * @public
 */
export interface CategoryTreeProps {
  /** Flag for accommodating all viewports */
  allViewports?: boolean;
  /** Active viewport */
  activeView?: Viewport;
  /**
   * An IModel to pull data from
   */
  iModel: IModelConnection;
  /**
   * Start loading hierarchy as soon as the component is created
   */
  enablePreloading?: boolean;
  /**
   * Information for tree filtering.
   * @alpha
   */
  filterInfo?: VisibilityTreeFilterInfo;
  /**
   * Callback invoked when tree is filtered.
   */
  onFilterApplied?: (filteredDataProvider: IPresentationTreeDataProvider, matchesCount: number) => void;
  /**
   * Custom category visibility handler to use for testing
   * @internal
   */
  categoryVisibilityHandler?: CategoryVisibilityHandler;
  /**
   * Custom view manager to use for testing
   * @internal
   */
  viewManager?: ViewManager;
}

/**
 * Tree which displays and manages categories contained in an iModel.
 * @public
 */
export function CategoryTree(props: CategoryTreeProps) {
  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: RULESET_CATEGORIES,
    pagingSize: PAGING_SIZE,
    preloadingEnabled: props.enablePreloading,
  });

  const { filteredNodeLoader, isFiltering, nodeHighlightingProps } = useVisibilityTreeFiltering(nodeLoader, props.filterInfo, props.onFilterApplied);
  // istanbul ignore next
  const viewManager = props.viewManager ?? IModelApp.viewManager;
  const { activeView, allViewports, categoryVisibilityHandler } = props;
  const currentActiveView = activeView ?? viewManager.getFirstOpenView();
  const categories = useCategories(viewManager, props.iModel, currentActiveView);
  const visibilityHandler = useCategoryVisibilityHandler(viewManager, props.iModel, categories, currentActiveView, allViewports, categoryVisibilityHandler);

  React.useEffect(() => {
    setViewType(currentActiveView); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [currentActiveView]);

  const eventHandler = useDisposable(React.useCallback(() => new VisibilityTreeEventHandler({
    nodeLoader: filteredNodeLoader,
    visibilityHandler,
    collapsedChildrenDisposalEnabled: true,
  }), [filteredNodeLoader, visibilityHandler]));

  const visibleNodes = useVisibleTreeNodes(filteredNodeLoader.modelSource);

  const treeRenderer = useVisibilityTreeRenderer(false, true);
  const overlay = isFiltering ? <div className="filteredTreeOverlay" /> : undefined;
  const filterApplied = filteredNodeLoader !== nodeLoader;

  const noFilteredDataRenderer = React.useCallback(() => {
    return <VisibilityTreeNoFilteredData
      title={UiFramework.i18n.translate("UiFramework:categoriesTree.noCategoryFound")}
      message={UiFramework.i18n.translate("UiFramework:categoriesTree.noMatchingCategoryNames")}
    />;
  }, []);

  return (
    <div className="ui-fw-categories-tree">
      <ControlledTree
        nodeLoader={filteredNodeLoader}
        visibleNodes={visibleNodes}
        selectionMode={SelectionMode.None}
        treeEvents={eventHandler}
        treeRenderer={treeRenderer}
        descriptionsEnabled={true}
        nodeHighlightingProps={nodeHighlightingProps}
        noDataRenderer={filterApplied ? noFilteredDataRenderer : undefined}
      />
      {overlay}
    </div>
  );
}

/**
 * CategoryTree that is connected to the IModelConnection property in the Redux store. The
 * application must set up the Redux store and include the FrameworkReducer.
 * @beta
 */
export const IModelConnectedCategoryTree = connectIModelConnection(null, null)(CategoryTree); // eslint-disable-line @typescript-eslint/naming-convention

function useCategoryVisibilityHandler(viewManager: ViewManager, imodel: IModelConnection, categories: Category[], activeView?: Viewport, allViewports?: boolean, visibilityHandler?: CategoryVisibilityHandler) {
  return useDisposable(React.useCallback(
    () =>
      // istanbul ignore next
      visibilityHandler ?? new CategoryVisibilityHandler({ viewManager, imodel, categories, activeView, allViewports }),
    [viewManager, imodel, categories, activeView, allViewports, visibilityHandler]),
  );
}

async function setViewType(activeView?: Viewport) {
  if (!activeView)
    return;

  const view = activeView.view as SpatialViewState;
  const viewType = view.is3d() ? "3d" : "2d";
  await Presentation.presentation.vars(RULESET_CATEGORIES.id).setString("ViewType", viewType);
}

/**
 * Toggles visibility of categories to show or hide.
 * @alpha
 */
export async function toggleAllCategories(viewManager: ViewManager, imodel: IModelConnection, display: boolean, viewport?: Viewport, forAllViewports?: boolean, filteredProvider?: IPresentationTreeDataProvider) {
  // istanbul ignore next
  const activeView = viewport ?? viewManager.getFirstOpenView();
  const ids = await getCategories(imodel, activeView, filteredProvider);

  // istanbul ignore else
  if (ids.length > 0) {
    CategoryVisibilityHandler.enableCategory(viewManager, imodel, ids, display, forAllViewports ?? false);
  }
}

/**
 * Gets ids of all categories or categories from filtered data provider.
 * @alpha
 */
export async function getCategories(imodel: IModelConnection, viewport?: Viewport, filteredProvider?: IPresentationTreeDataProvider) {
  if (filteredProvider) {
    const nodes = await filteredProvider.getNodes();
    return nodes.map((node) => CategoryVisibilityHandler.getInstanceIdFromTreeNodeKey(filteredProvider.getNodeKey(node)));
  }

  const categories = await loadCategoriesFromViewport(imodel, viewport);
  return categories.map((category) => category.key);
}
