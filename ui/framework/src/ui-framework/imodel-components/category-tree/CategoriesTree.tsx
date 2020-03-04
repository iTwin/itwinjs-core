/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import * as React from "react";
import { IModelConnection, Viewport, IModelApp, SpatialViewState, PerModelCategoryVisibility } from "@bentley/imodeljs-frontend";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { Ruleset, NodeKey } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { TreeNodeItem, useVisibleTreeNodes, ControlledTree, SelectionMode, FilteringInput } from "@bentley/ui-components";
import { IPresentationTreeDataProvider, usePresentationTreeNodeLoader, useControlledTreeFiltering } from "@bentley/presentation-components";
import { useDisposable } from "@bentley/ui-core";
import { connectIModelConnection } from "../../redux/connectIModel";
import { IVisibilityHandler, VisibilityStatus, VisibilityTreeEventHandler } from "../VisibilityTreeEventHandler";
import { useVisibilityTreeRenderer } from "../VisibilityTreeRenderer";

import "./CategoriesTree.scss";

const PAGING_SIZE = 20;

/**
 * Presentation rules used by ControlledCategoriesTree
 * @internal
 */
export const RULESET_CATEGORIES: Ruleset = require("./Categories.json"); // tslint:disable-line: no-var-requires

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
   * Indicates whether search box should be shown.
   */
  showSearchBox?: boolean;
  /**
   * Event indicating all instances represented by tree nodes should be shown.
   * @alpha
   */
  showAll?: BeUiEvent<void>;
  /**
   * Event indicating all instances represented by tree nodes should be hidden.
   * @alpha
   */
  hideAll?: BeUiEvent<void>;
  /**
   * Start loading hierarchy as soon as the component is created
   */
  enablePreloading?: boolean;
  /**
   * Custom data provider to use for testing
   * @internal
   */
  dataProvider?: IPresentationTreeDataProvider;
  /** @internal used for testing */
  categoryVisibilityHandler?: CategoryVisibilityHandler;
}

/**
 * Tree which displays and manages categories contained in an iModel.
 * @public
 */
export function CategoryTree(props: CategoryTreeProps) {
  const nodeLoader = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    dataProvider: props.dataProvider,
    ruleset: RULESET_CATEGORIES,
    pageSize: PAGING_SIZE,
    preloadingEnabled: props.enablePreloading,
  });

  const [filterString, setFilterString] = React.useState("");
  const [activeMatchIndex, setActiveMatchIndex] = React.useState<number>();
  const {
    filteredNodeLoader,
    isFiltering,
    matchesCount,
    nodeHighlightingProps,
  } = useControlledTreeFiltering({ nodeLoader, filter: filterString, activeMatchIndex });

  const { activeView, allViewports, categoryVisibilityHandler } = props;
  const currentActiveView = (activeView || IModelApp.viewManager.getFirstOpenView())!;
  const categories = useCategories(props.iModel, currentActiveView);
  const visibilityHandler = useCategoryVisibilityHandler(props.iModel, categories, currentActiveView, allViewports, categoryVisibilityHandler);

  const filteredDataProvider = nodeLoader !== filteredNodeLoader ? filteredNodeLoader.dataProvider : undefined;
  useShowHideAll(visibilityHandler, true, props.showAll, filteredDataProvider);
  useShowHideAll(visibilityHandler, false, props.hideAll, filteredDataProvider);
  React.useEffect(() => {
    setViewType(currentActiveView); // tslint:disable-line: no-floating-promises
  }, [currentActiveView]);

  const eventHandler = useDisposable(React.useCallback(() => new VisibilityTreeEventHandler({
    nodeLoader: filteredNodeLoader,
    visibilityHandler,
    collapsedChildrenDisposalEnabled: true,
  }), [filteredNodeLoader, visibilityHandler]));

  const visibleNodes = useVisibleTreeNodes(filteredNodeLoader.modelSource);

  const overlay = isFiltering ? <div className="filteredTreeOverlay" /> : undefined;

  const treeRenderer = useVisibilityTreeRenderer(false, true);

  return (
    <div className="ui-fw-categories-tree">
      {props.showSearchBox && <FilteringInput
        autoFocus={true}
        filteringInProgress={isFiltering}
        onFilterCancel={() => setFilterString("")}
        onFilterClear={() => setFilterString("")}
        onFilterStart={(newFilter) => setFilterString(newFilter)}
        resultSelectorProps={{
          onSelectedChanged: (index) => setActiveMatchIndex(index),
          resultCount: matchesCount || 0,
        }}
      />}
      <ControlledTree
        nodeLoader={filteredNodeLoader}
        visibleNodes={visibleNodes}
        selectionMode={SelectionMode.None}
        treeEvents={eventHandler}
        treeRenderer={treeRenderer}
        descriptionsEnabled={true}
        nodeHighlightingProps={nodeHighlightingProps}
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
export const IModelConnectedCategoryTree = connectIModelConnection(null, null)(CategoryTree); // tslint:disable-line:variable-name

function useShowHideAll(visibilityHandler: CategoryVisibilityHandler, showAll: boolean, event?: BeUiEvent<void>, filteredDataProvider?: IPresentationTreeDataProvider) {
  React.useEffect(() => {
    return event && event.addListener(async () => showAll ? visibilityHandler.showAll(filteredDataProvider) : visibilityHandler.hideAll(filteredDataProvider));
  }, [showAll, visibilityHandler, event, filteredDataProvider]);
}

function useCategoryVisibilityHandler(imodel: IModelConnection, categories: Category[], activeView?: Viewport, allViewports?: boolean, visibilityHandler?: CategoryVisibilityHandler) {
  return useDisposable(React.useCallback(
    () => visibilityHandler ?? new CategoryVisibilityHandler({ imodel, categories, activeView, allViewports }),
    [imodel, categories, activeView, allViewports, visibilityHandler]),
  );
}

function useCategories(iModel: IModelConnection, view?: Viewport) {
  const [categories, setCategories] = React.useState<Category[]>([]);

  React.useEffect(() => {
    loadCategoriesFromViewport(iModel, view).then(setCategories); // tslint:disable-line: no-floating-promises
  }, [iModel, view]);

  return categories;
}

async function loadCategoriesFromViewport(iModel?: IModelConnection, vp?: Viewport) {
  if (!vp) return [];

  // Query categories and add them to state
  const selectUsedSpatialCategoryIds = "SELECT DISTINCT Category.Id as id from BisCore.GeometricElement3d WHERE Category.Id IN (SELECT ECInstanceId from BisCore.SpatialCategory)";
  const selectUsedDrawingCategoryIds = "SELECT DISTINCT Category.Id as id from BisCore.GeometricElement2d WHERE Model.Id=? AND Category.Id IN (SELECT ECInstanceId from BisCore.DrawingCategory)";
  const ecsql = vp.view.is3d() ? selectUsedSpatialCategoryIds : selectUsedDrawingCategoryIds;
  const ecsql2 = "SELECT ECInstanceId as id, UserLabel as label, CodeValue as code FROM " + (vp.view.is3d() ? "BisCore.SpatialCategory" : "BisCore.DrawingCategory") + " WHERE ECInstanceId IN (" + ecsql + ")";

  const categories: Category[] = [];

  // istanbul ignore else
  if (iModel) {
    const rowIterator = iModel.query(ecsql2);
    // istanbul ignore next
    for await (const row of rowIterator) {
      const subCategoryIds = iModel.subcategories.getSubCategories(row.id);
      categories.push({ key: row.id, children: (subCategoryIds) ? [...subCategoryIds] : undefined });
    }
  }

  return categories;
}

async function setViewType(activeView?: Viewport) {
  if (!IModelApp.viewManager || !activeView)
    return;

  const view = activeView.view as SpatialViewState;
  const viewType = view.is3d() ? "3d" : "2d";
  await Presentation.presentation.vars(RULESET_CATEGORIES.id).setString("ViewType", viewType);
}

const getInstanceIdFromTreeNodeKey = (nodeKey: NodeKey) => {
  return (NodeKey.isInstancesNodeKey(nodeKey) && nodeKey.instanceKeys.length > 0) ? nodeKey.instanceKeys[0].id : "";
};

/** @internal */
export interface Category {
  key: string;
  children?: string[];
}

/** @internal */
export interface CategoryVisibilityHandlerParams {
  imodel: IModelConnection;
  categories: Category[];
  activeView?: Viewport;
  allViewports?: boolean;
  onVisibilityChange?: () => void;
}

/** @internal */
export class CategoryVisibilityHandler implements IVisibilityHandler {
  private _imodel: IModelConnection;
  private _pendingVisibilityChange: any | undefined;
  private _onVisibilityChange?: () => void;
  private _activeView?: Viewport;
  private _useAllViewports?: boolean;
  private _categories: Category[];

  constructor(params: CategoryVisibilityHandlerParams) {
    this._imodel = params.imodel;
    this._activeView = params.activeView;
    this._useAllViewports = params.allViewports;
    this._categories = params.categories;
    this._onVisibilityChange = params.onVisibilityChange;
    if (this._activeView) {
      this._activeView.onDisplayStyleChanged.addListener(this.onDisplayStyleChanged);
      this._activeView.onViewedCategoriesChanged.addListener(this.onViewedCategoriesChanged);
    }
  }

  public dispose() {
    if (this._activeView) {
      this._activeView.onDisplayStyleChanged.removeListener(this.onDisplayStyleChanged);
      this._activeView.onViewedCategoriesChanged.removeListener(this.onViewedCategoriesChanged);
    }
    clearTimeout(this._pendingVisibilityChange);
  }

  public get onVisibilityChange() {
    return this._onVisibilityChange;
  }
  public set onVisibilityChange(callback: (() => void) | undefined) {
    this._onVisibilityChange = callback;
  }

  public async showAll(filteredProvider?: IPresentationTreeDataProvider) {
    await this.setEnableAll(true, filteredProvider);
    this._onVisibilityChange && this._onVisibilityChange();
  }

  public async hideAll(filteredProvider?: IPresentationTreeDataProvider) {
    await this.setEnableAll(false, filteredProvider);
    this._onVisibilityChange && this._onVisibilityChange();
  }

  public getVisibilityStatus(node: TreeNodeItem, nodeKey: NodeKey): VisibilityStatus {
    const instanceId = getInstanceIdFromTreeNodeKey(nodeKey);
    return { isDisplayed: node.parentId ? this.isSubCategoryVisible(instanceId) : this.isCategoryVisible(instanceId) };
  }

  public async changeVisibility(node: TreeNodeItem, nodeKey: NodeKey, shouldDisplay: boolean): Promise<void> {
    // handle subcategory visibility change
    if (node.parentId) {
      const childId = getInstanceIdFromTreeNodeKey(nodeKey);
      const parentId = this.getParent(childId)?.key;

      // make sure parent category is enabled
      if (shouldDisplay && parentId)
        this.enableCategory([parentId], true, false);

      this.enableSubCategory(childId, shouldDisplay);
      return;
    }

    const instanceId = getInstanceIdFromTreeNodeKey(nodeKey);
    this.enableCategory([instanceId], shouldDisplay, true);
  }

  public async setEnableAll(enable: boolean, filteredProvider?: IPresentationTreeDataProvider) {
    let ids: string[];
    if (filteredProvider) {
      const nodes = await filteredProvider.getNodes();
      ids = nodes.map((node) => getInstanceIdFromTreeNodeKey(filteredProvider.getNodeKey(node)));
    } else
      ids = this._categories.map((category: Category) => category.key);

    // istanbul ignore else
    if (ids.length > 0) {
      this.enableCategory(ids, enable);
    }
  }

  /** Change category display in the viewport */
  public enableCategory(ids: string[], enabled: boolean, enableAllSubCategories = true) {
    if (!IModelApp.viewManager || !IModelApp.viewManager.selectedView)
      return;

    const updateViewport = (vp: Viewport) => {
      // Only act on viewports that are both 3D or both 2D. Important if we have multiple viewports opened and we
      // are using 'allViewports' property
      if (IModelApp.viewManager.selectedView && IModelApp.viewManager.selectedView.view.is3d() === vp.view.is3d()) {
        vp.changeCategoryDisplay(ids, enabled, enableAllSubCategories);

        // remove category overrides per model
        const modelsContainingOverrides: string[] = [];
        vp.perModelCategoryVisibility.forEachOverride((modelId: string, categoryId: string) => {
          // istanbul ignore else
          if (ids.findIndex((id) => id === categoryId) !== -1)
            modelsContainingOverrides.push(modelId);
          return true;
        });
        vp.perModelCategoryVisibility.setOverride(modelsContainingOverrides, ids, PerModelCategoryVisibility.Override.None);

        // changeCategoryDisplay only enables subcategories, it does not disabled them. So we must do that ourselves.
        if (false === enabled) {
          ids.forEach((id) => {
            const subCategoryIds = this._imodel.subcategories.getSubCategories(id);
            if (subCategoryIds) {
              subCategoryIds.forEach((subCategoryId) => this.enableSubCategory(subCategoryId, false));
            }
          });
        }
      }
    };

    // This property let us act on all viewports or just on the selected one, configurable by the app
    if (this._useAllViewports) {
      IModelApp.viewManager.forEachViewport(updateViewport);
    } else {
      updateViewport(IModelApp.viewManager.selectedView);
    }
  }

  /** Change subcategory display in the viewport */
  public enableSubCategory(key: string, enabled: boolean) {
    if (!IModelApp.viewManager || !IModelApp.viewManager.selectedView)
      return;

    const updateViewport = (vp: Viewport) => {
      // Only act on viewports that are both 3D or both 2D. Important if we have multiple viewports opened and we
      // are using 'allViewports' property
      if (IModelApp.viewManager.selectedView && IModelApp.viewManager.selectedView.view.is3d() === vp.view.is3d()) {
        vp.changeSubCategoryDisplay(key, enabled);
      }
    };

    // This property let us act on all viewports or just on the selected one, configurable by the app
    if (this._useAllViewports) {
      IModelApp.viewManager.forEachViewport(updateViewport);
    } else {
      updateViewport(IModelApp.viewManager.selectedView);
    }
  }

  public isSubCategoryVisible(id: string): boolean {
    const parentItem = this.getParent(id);
    if (!parentItem || !this._activeView)
      return false;
    return this._activeView.view.viewsCategory(parentItem.key) && this._activeView.isSubCategoryVisible(id);
  }

  public isCategoryVisible(id: string): boolean {
    return (this._activeView) ? this._activeView.view.viewsCategory(id) : false;
  }

  public getParent(key: string): Category | undefined {
    for (const category of this._categories) {
      if (category.children) {
        if (category.children.indexOf(key) !== -1)
          return category;
      }
    }

    return undefined;
  }

  // tslint:disable-next-line: naming-convention
  private onDisplayStyleChanged = () => {
    this.onVisibilityChangeInternal();
  }

  // tslint:disable-next-line: naming-convention
  private onViewedCategoriesChanged = () => {
    this.onVisibilityChangeInternal();
  }

  private onVisibilityChangeInternal() {
    if (this._pendingVisibilityChange)
      return;

    this._pendingVisibilityChange = setTimeout(() => {
      this._onVisibilityChange && this._onVisibilityChange();
      this._pendingVisibilityChange = undefined;
    }, 0);
  }
}
