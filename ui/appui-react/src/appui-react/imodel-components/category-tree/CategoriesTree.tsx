/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import "./CategoriesTree.scss";
import * as React from "react";
import type { IModelConnection, SpatialViewState, ViewManager, Viewport } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type { Ruleset } from "@itwin/presentation-common";
import type { IPresentationTreeDataProvider} from "@itwin/presentation-components";
import { usePresentationTreeNodeLoader } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { ControlledTree, SelectionMode, useTreeModel } from "@itwin/components-react";
import { useDisposable } from "@itwin/core-react";
import { UiFramework } from "../../UiFramework";
import type { VisibilityTreeFilterInfo } from "../Common";
import { VisibilityTreeEventHandler } from "../VisibilityTreeEventHandler";
import { useVisibilityTreeFiltering, useVisibilityTreeRenderer, VisibilityTreeNoFilteredData } from "../VisibilityTreeRenderer";
import type { Category} from "./CategoryVisibilityHandler";
import { CategoryVisibilityHandler, loadCategoriesFromViewport, useCategories } from "./CategoryVisibilityHandler";

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
  /** Width of the component */
  width: number;
  /** Height of the component */
  height: number;
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

  const treeModel = useTreeModel(filteredNodeLoader.modelSource);
  const treeRenderer = useVisibilityTreeRenderer(false, true);
  const overlay = isFiltering ? <div className="filteredTreeOverlay" /> : undefined;
  const filterApplied = filteredNodeLoader !== nodeLoader;

  const noFilteredDataRenderer = React.useCallback(() => {
    return <VisibilityTreeNoFilteredData
      title={UiFramework.localization.getLocalizedString("UiFramework:categoriesTree.noCategoryFound")}
      message={UiFramework.localization.getLocalizedString("UiFramework:categoriesTree.noMatchingCategoryNames")}
    />;
  }, []);

  return (
    <div className="ui-fw-categories-tree">
      <ControlledTree
        nodeLoader={filteredNodeLoader}
        model={treeModel}
        selectionMode={SelectionMode.None}
        eventsHandler={eventHandler}
        treeRenderer={treeRenderer}
        descriptionsEnabled={true}
        nodeHighlightingProps={nodeHighlightingProps}
        noDataRenderer={filterApplied ? noFilteredDataRenderer : undefined}
        width={props.width}
        height={props.height}
      />
      {overlay}
    </div>
  );
}

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
