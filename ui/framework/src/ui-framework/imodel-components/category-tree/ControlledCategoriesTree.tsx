/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import * as React from "react";
import { IModelConnection, Viewport, IModelApp, SpatialViewState } from "@bentley/imodeljs-frontend";
import { Ruleset, NodeKey } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import {
  IPresentationTreeDataProvider, useControlledTreeFiltering, usePresentationNodeLoader,
  useRulesetRegistration,
} from "@bentley/presentation-components";
import {
  ControlledTree, TreeEventHandler, useVisibleTreeNodes, SelectionMode, TreeNodeRendererProps,
  TreeNodeRenderer, TreeRendererProps, TreeRenderer, TreeModelNode, TreeModelSource, CheckBoxInfo, TreeCheckboxStateChangeEvent,
  CheckboxStateChange, TreeSelectionReplacementEvent, ITreeNodeLoaderWithProvider, TreeImageLoader, FilteringInput, TreeNodeItem, TreeModelChanges,
} from "@bentley/ui-components";
import { NodeCheckboxRenderProps, ImageCheckBox, CheckBoxState, useEffectSkipFirst } from "@bentley/ui-core";

const PAGING_SIZE = 20;
/** Presentation rules used by ControlledCategoriesTree
 * @internal
 */
export const RULESET: Ruleset = require("./Categories.json"); // tslint:disable-line: no-var-requires

/**
 * Properties for the [[ControlledSpatialContainmentTree]] component
 * @internal
 */
export interface ControlledCategoryTreeProps {
  /** [[IModelConnection]] for current iModel */
  iModel: IModelConnection;
  /** Flag for accommodating all viewports */
  allViewports?: boolean;
  /** Active viewport */
  activeView?: Viewport;
  /** Show or hide the searchbox */
  showSearchBox?: boolean;
  /** select all */
  selectAll?: boolean;
  /** clear all */
  clearAll?: boolean;
  /** Start loading hierarchy as soon as the component is created */
  enablePreloading?: boolean;
  /** Used for testing */
  dataProvider?: IPresentationTreeDataProvider;
  /** Used for testing */
  categoryVisibilityHandler?: CategoryVisibilityHandler;
}

/**
 * Tree which displays and manages models or categories contained in an iModel.
 * @internal
 */
// tslint:disable-next-line:variable-name naming-convention
export const ControlledCategoryTree: React.FC<ControlledCategoryTreeProps> = (props: ControlledCategoryTreeProps) => {
  useRulesetRegistration(RULESET);
  const activeView = (props.activeView || IModelApp.viewManager.getFirstOpenView())!;
  const nodeLoader = usePresentationNodeLoader({
    imodel: props.iModel,
    rulesetId: RULESET.id,
    pageSize: PAGING_SIZE,
    preloadingEnabled: props.enablePreloading,
    dataProvider: props.dataProvider,
  });
  const modelSource = nodeLoader.modelSource;

  const [filter, setFilter] = React.useState("");
  const [activeMatch, setActiveMatch] = React.useState<number>();

  const {
    filteredModelSource,
    filteredNodeLoader,
    isFiltering,
    matchesCount,
    nodeHighlightingProps,
  } = useControlledTreeFiltering(nodeLoader, modelSource, filter, activeMatch);

  const categories = useCategories(props.iModel, activeView);

  const visibilityHandler = useCategoryVisibilityHandler(props.iModel, categories, filteredNodeLoader, props.allViewports, props.categoryVisibilityHandler);
  const eventHandler = useEventHandler(filteredModelSource, filteredNodeLoader, visibilityHandler, activeView);

  React.useEffect(() => {
    setViewType(activeView); // tslint:disable-line: no-floating-promises
  }, [activeView]);

  React.useEffect(() => {
    if (props.clearAll)
      eventHandler.clearAll(); // tslint:disable-line: no-floating-promises
    else if (props.selectAll)
      eventHandler.selectAll(); // tslint:disable-line: no-floating-promises
  }, [props.selectAll, props.clearAll, eventHandler]);

  const visibleNodes = useVisibleTreeNodes(filteredModelSource);
  const treeRenderer = useTreeRenderer();
  const overlay = isFiltering ? <div className="filteredTreeOverlay" /> : undefined;
  return (
    <div className="uifw-spatial-tree">
      {props.showSearchBox &&
        <FilteringInput
          autoFocus={true}
          filteringInProgress={isFiltering}
          onFilterCancel={() => setFilter("")}
          onFilterClear={() => setFilter("")}
          onFilterStart={(newFilter) => setFilter(newFilter)}
          resultSelectorProps={{
            onSelectedChanged: (index) => setActiveMatch(index),
            resultCount: matchesCount || 0,
          }}
        />
      }
      <div className="filteredTree">
        <ControlledTree
          visibleNodes={visibleNodes}
          nodeLoader={filteredNodeLoader}
          treeEvents={eventHandler}
          selectionMode={SelectionMode.Single}
          treeRenderer={treeRenderer}
          descriptionsEnabled={true}
          iconsEnabled={true}
          nodeHighlightingProps={nodeHighlightingProps}
        />
        {overlay}
      </div>
    </div>
  );
};

function useTreeRenderer() {
  const renderNodeCheckbox = React.useCallback((props: NodeCheckboxRenderProps): React.ReactNode => (
    <ImageCheckBox
      checked={props.checked}
      disabled={props.disabled}
      imageOn="icon-visibility"
      imageOff="icon-visibility-hide-2"
      onClick={props.onChange}
    />
  ), []);

  const imageLoader = React.useMemo(() => new TreeImageLoader(), []);
  const nodeRenderer = React.useCallback((props: TreeNodeRendererProps) => (
    <TreeNodeRenderer
      {...props}
      checkboxRenderer={renderNodeCheckbox}
      descriptionEnabled={true}
      imageLoader={imageLoader}
    />
  ), [renderNodeCheckbox, imageLoader]);

  return React.useCallback((props: TreeRendererProps) => (
    <TreeRenderer
      {...props}
      nodeRenderer={nodeRenderer}
    />
  ), [nodeRenderer]);
}

function useEventHandler(
  modelSource: TreeModelSource,
  nodeLoader: ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>,
  visibilityHandler: CategoryVisibilityHandler,
  activeView: Viewport,
) {
  const [eventHandler, setEventHandler] = React.useState(() => new EventHandler(modelSource, nodeLoader, visibilityHandler, activeView));

  React.useEffect(() => () => eventHandler.dispose(), [eventHandler]);

  useEffectSkipFirst(() => {
    setEventHandler(new EventHandler(modelSource, nodeLoader, visibilityHandler, activeView));
  }, [modelSource, nodeLoader, visibilityHandler, activeView]);

  return eventHandler;
}

function useCategoryVisibilityHandler(imodel: IModelConnection, categories: Category[], filteredNodeLoader?: ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>, allViewports?: boolean, visibilityHandler?: CategoryVisibilityHandler) {
  const [handler, setHandler] = React.useState(() => createCategoryVisibilityHandler(imodel, categories, filteredNodeLoader, allViewports, visibilityHandler));

  useEffectSkipFirst(() => {
    setHandler(() => createCategoryVisibilityHandler(imodel, categories, filteredNodeLoader, allViewports, visibilityHandler));
  }, [imodel, categories, filteredNodeLoader, allViewports, visibilityHandler]);

  return handler;
}

function createCategoryVisibilityHandler(imodel: IModelConnection, categories: Category[], filteredNodeLoader?: ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>, allViewports?: boolean, visibilityHandler?: CategoryVisibilityHandler) {
  const filteredProvider = filteredNodeLoader ? filteredNodeLoader.getDataProvider() : undefined;
  if (visibilityHandler) {
    visibilityHandler.categories = categories;
    visibilityHandler.filteredProvider = filteredProvider;
    visibilityHandler.allViewports = allViewports;
    return visibilityHandler;
  }

  return new CategoryVisibilityHandler(imodel, categories, filteredProvider, allViewports);
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
  await Presentation.presentation.vars(RULESET.id).setString("ViewType", viewType);
}

/** @internal */
export interface Category {
  key: string;
  children?: string[];
}

/** @internal */
export class CategoryVisibilityHandler {
  private _imodel: IModelConnection;
  private _categories: Category[];
  private _filteredProvider?: IPresentationTreeDataProvider;
  private _allViewports?: boolean;

  constructor(imodel: IModelConnection, categories: Category[], filteredProvider?: IPresentationTreeDataProvider, allViewports?: boolean) {
    this._imodel = imodel;
    this._categories = categories;
    this._filteredProvider = filteredProvider;
    this._allViewports = allViewports;
  }

  public set categories(categories: Category[]) {
    this._categories = categories;
  }

  public set filteredProvider(filteredProvider: IPresentationTreeDataProvider | undefined) {
    this._filteredProvider = filteredProvider;
  }

  public set allViewports(allViewports: boolean | undefined) {
    this._allViewports = allViewports;
  }

  public async setEnableAll(enable: boolean) {
    let ids: string[];
    if (this._filteredProvider) {
      const nodes = await this._filteredProvider.getNodes();
      ids = nodes.map((node) => this.getIdFromTreeNodeItem(node, this._filteredProvider!));
    } else
      ids = this._categories.map((category: Category) => category.key);

    // istanbul ignore else
    if (ids.length > 0) {
      this.enableCategory(ids, enable);
    }
  }

  private getIdFromTreeNodeItem(node: TreeNodeItem, dataProvider: IPresentationTreeDataProvider) {
    const key = dataProvider.getNodeKey(node);
    // istanbul ignore else
    if (NodeKey.isInstancesNodeKey(key) && key.instanceKey)
      return key.instanceKey.id;

    // istanbul ignore next
    return "";
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
    if (this._allViewports) {
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
    if (this._allViewports) {
      IModelApp.viewManager.forEachViewport(updateViewport);
    } else {
      updateViewport(IModelApp.viewManager.selectedView);
    }
  }

  public isSubCategoryVisible(id: string, activeView?: Viewport): boolean {
    const parentItem = this.getParent(id);
    if (!parentItem || !activeView)
      return false;
    return activeView.view.viewsCategory(parentItem.key) && activeView.isSubCategoryVisible(id);
  }

  public isCategoryVisible(id: string, activeView?: Viewport): boolean {
    return (activeView) ? activeView.view.viewsCategory(id) : false;
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
}

class EventHandler extends TreeEventHandler {
  private _dataProvider: IPresentationTreeDataProvider;
  private _activeView?: Viewport;
  private _visibilityHandler: CategoryVisibilityHandler;
  private _modelSource: TreeModelSource;
  private _removeListener: () => void;

  constructor(
    modelSource: TreeModelSource,
    nodeLoader: ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>,
    visibilityHandler: CategoryVisibilityHandler,
    activeView?: Viewport) {
    super({ modelSource, nodeLoader, collapsedChildrenDisposalEnabled: true });
    this._modelSource = modelSource;
    this._dataProvider = nodeLoader.getDataProvider();
    this._activeView = activeView;
    this._visibilityHandler = visibilityHandler;

    this._removeListener = this._modelSource.onModelChanged.addListener((args) => this.updateCheckboxes(args[1]));
  }

  public dispose() {
    super.dispose();
    this._removeListener();
  }

  public async selectAll() {
    await this._visibilityHandler.setEnableAll(true);
    this.updateCheckboxes();
  }

  public async clearAll() {
    await this._visibilityHandler.setEnableAll(false);
    this.updateCheckboxes();
  }

  public onSelectionReplaced(event: TreeSelectionReplacementEvent) {
    event.replacements.subscribe({
      next: ({ selectedNodeItems }) => {
        this.onNodesSelected(selectedNodeItems);
      },
      complete: () => this.updateCheckboxes(),
    });

    return undefined;
  }

  public onCheckboxStateChanged(event: TreeCheckboxStateChangeEvent) {
    event.stateChanges.subscribe({
      next: (changes: CheckboxStateChange[]) => {
        for (const { nodeItem, newState } of changes) {
          newState === CheckBoxState.On ? this.onNodesSelected([nodeItem]) : this.onNodesDeselected([nodeItem]);
        }
      },
      complete: () => this.updateCheckboxes(),
    });

    return undefined;
  }

  private updateCheckboxes(modelChanges?: TreeModelChanges) {
    // if handling model change event only need to update newly added nodes
    if (modelChanges) {
      this.updateNewNodeCheckboxes(modelChanges.addedNodeIds);
    } else {
      this.updateAllNodeCheckboxes();
    }
  }

  private updateAllNodeCheckboxes() {
    this._modelSource.modifyModel((model) => {
      for (const node of model.iterateTreeModelNodes()) {
        node.checkbox = this.getNodeCheckBoxInfo(node);
      }
    });
  }
  private updateNewNodeCheckboxes(newNodeIds: string[]) {
    if (newNodeIds.length === 0)
      return;

    this._modelSource.modifyModel((model) => {
      for (const nodeId of newNodeIds) {
        const node = model.getNode(nodeId);
        // istanbul ignore if
        if (!node)
          continue;
        node.checkbox = this.getNodeCheckBoxInfo(node);
      }
    });
  }

  private onNodesSelected(nodeItems: TreeNodeItem[]) {
    for (const nodeItem of nodeItems) {
      const id = this.getIdFromTreeNodeItem(nodeItem);
      let enable = false;
      if (nodeItem.parentId) {
        enable = !this._visibilityHandler.isSubCategoryVisible(id, this._activeView);
      } else {
        enable = !this._visibilityHandler.isCategoryVisible(id, this._activeView);
      }

      this.manageSelection(nodeItem, enable);
    }
  }

  private onNodesDeselected(nodeItems: TreeNodeItem[]) {
    for (const nodeItem of nodeItems) {
      this.manageSelection(nodeItem, false);
    }
  }

  private manageSelection(node: TreeNodeItem, enable: boolean) {
    const id = this.getIdFromTreeNodeItem(node);
    if (node.parentId) {
      if (enable) {
        const parent = this._visibilityHandler.getParent(id);
        if (parent) {
          // when enabling a subcategory, ensure the parent is enabled
          this._visibilityHandler.enableCategory([parent.key], enable, false);
        }
      }
      this._visibilityHandler.enableSubCategory(id, enable);
    } else {
      this._visibilityHandler.enableCategory([id], enable);
    }
  }

  private getNodeCheckBoxInfo(node: TreeModelNode): CheckBoxInfo {
    const id = this.getIdFromTreeNodeItem(node.item);
    if (this._activeView) {
      let state = CheckBoxState.Off;
      if (node.item.parentId) {
        if (this._visibilityHandler.isSubCategoryVisible(id, this._activeView))
          state = CheckBoxState.On;
      } else {
        if (this._visibilityHandler.isCategoryVisible(id, this._activeView))
          state = CheckBoxState.On;
      }
      return { isDisabled: false, isVisible: true, state };
    }
    return node.checkbox.isVisible ? node.checkbox : /* istanbul ignore next */ { ...node.checkbox, isVisible: true };
  }

  private getIdFromTreeNodeItem(node: TreeNodeItem) {
    const key = this._dataProvider!.getNodeKey(node);
    // istanbul ignore else
    if (NodeKey.isInstanceNodeKey(key) && key.instanceKey)
      return key.instanceKey.id;

    // istanbul ignore next
    return "";
  }
}
