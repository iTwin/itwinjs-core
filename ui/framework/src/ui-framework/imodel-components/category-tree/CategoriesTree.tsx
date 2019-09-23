/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelComponents */

import * as React from "react";
import * as _ from "lodash";
import { IModelApp, SpatialViewState, Viewport, IModelConnection } from "@bentley/imodeljs-frontend";
import { RegisteredRuleset, NodeKey, Ruleset } from "@bentley/presentation-common";
import { treeWithFilteringSupport, PresentationTreeDataProvider } from "@bentley/presentation-components";
import { Tree, TreeNodeItem, SelectionMode, FilteringInput } from "@bentley/ui-components";
import { CheckBoxInfo, CheckBoxState, isPromiseLike, NodeCheckboxRenderProps, ImageCheckBox } from "@bentley/ui-core";
import { Presentation } from "@bentley/presentation-frontend";
import "./CategoriesTree.scss";

/**
 * Tree component with support for filtering
 * @alpha
 */
// const CategoryFilterTree = treeWithFilteringSupport(treeWithUnifiedSelection(Tree)); // tslint:disable-line:variable-name
const CategoryFilterTree = treeWithFilteringSupport(Tree); // tslint:disable-line:variable-name
const RULESET: Ruleset = require("./Categories.json"); // tslint:disable-line: no-var-requires

interface Category {
  key: string;
  children?: string[];
}

/**
 * Information used for filtering in [[CategoryModelTree]]
 * @alpha
 */
export interface FilterInfo {
  filter?: string;
  filtering?: boolean;
  activeMatchIndex?: number;
  matchesCount?: number;
}

/**
 * Properties for the [[CategoryModelTree]] component
 * @alpha
 */
export interface CategoryTreeProps {
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
  /**
   * Start loading hierarchy as soon as the component is created
   * @alpha
   */
  enablePreloading?: boolean;
}

/**
 * State for the [[CategoryModelTree]] component
 * @alpha
 */
export interface CategoryTreeState {
  checkboxInfo: (node: TreeNodeItem) => CheckBoxInfo | Promise<CheckBoxInfo>;
  isLoading: boolean;
  filterInfo?: FilterInfo;
  selectedNodes: string[];
  dataProvider?: PresentationTreeDataProvider;
  categories: Category[];
  activeView?: Viewport;
}

/**
 * Tree which displays and manages models or categories contained in an iModel.
 * @alpha
 */
// istanbul ignore next
export class CategoryTree extends React.Component<CategoryTreeProps, CategoryTreeState> {
  private _isMounted = false;
  private _rulesetRegistration?: RegisteredRuleset;

  /**
   * Presentation rules used by this component
   * @internal
   */
  public static readonly RULESET: Ruleset = RULESET;

  constructor(props: CategoryTreeProps) {
    super(props);

    this.state = {
      checkboxInfo: this.createCheckBoxInfoCallback(),
      isLoading: false,
      filterInfo: {},
      selectedNodes: [],
      categories: [],
      activeView: (this.props.activeView || IModelApp.viewManager.getFirstOpenView())!,
    };
  }

  /** @internal */
  public async componentDidMount() {
    this._isMounted = true;

    await this._initialize();

    if (this.props.selectAll) {
      // tslint:disable-next-line: no-floating-promises
      this._onSelectAll();
    }

    if (this.props.clearAll) {
      // tslint:disable-next-line: no-floating-promises
      this._onClearAll();
    }
  }

  /** @internal */
  public componentWillUnmount() {
    this._isMounted = false;

    if (this._rulesetRegistration)
      Presentation.presentation.rulesets().remove(this._rulesetRegistration); // tslint:disable-line:no-floating-promises

    //  const provider = this.state.dataProvider;
    //  if (provider)
    //    provider.dispose();
  }

  public componentDidUpdate(prevProps: CategoryTreeProps) {
    if (prevProps.selectAll) {
      // tslint:disable-next-line: no-floating-promises
      this._onSelectAll();
    }

    if (prevProps.clearAll) {
      // tslint:disable-next-line: no-floating-promises
      this._onClearAll();
    }
  }

  private _initialize = async () => {
    this._rulesetRegistration = await Presentation.presentation.rulesets().add(RULESET);
    const dataProvider = new PresentationTreeDataProvider(this.props.iModel, RULESET.id);
    await this._setViewType();
    if (this.props.enablePreloading)
      await dataProvider.loadHierarchy();

    await this._loadCategoriesFromViewport(this.state.activeView);
    this.setState({ dataProvider });
  }

  private async _loadCategoriesFromViewport(vp?: Viewport) {
    if (!vp) return;

    // Query categories and add them to state
    const selectUsedSpatialCategoryIds = "SELECT DISTINCT Category.Id as id from BisCore.GeometricElement3d WHERE Category.Id IN (SELECT ECInstanceId from BisCore.SpatialCategory)";
    const selectUsedDrawingCategoryIds = "SELECT DISTINCT Category.Id as id from BisCore.GeometricElement2d WHERE Model.Id=? AND Category.Id IN (SELECT ECInstanceId from BisCore.DrawingCategory)";
    const ecsql = vp.view.is3d() ? selectUsedSpatialCategoryIds : selectUsedDrawingCategoryIds;
    const ecsql2 = "SELECT ECInstanceId as id, UserLabel as label, CodeValue as code FROM " + (vp.view.is3d() ? "BisCore.SpatialCategory" : "BisCore.DrawingCategory") + " WHERE ECInstanceId IN (" + ecsql + ")";

    const categories: Category[] = [];

    if (this.props.iModel) {
      const rowIterator = this.props.iModel.query(ecsql2);
      for await (const row of rowIterator) {
        const subCategoryIds = this.props.iModel.subcategories.getSubCategories(row.id);
        categories.push({ key: row.id, children: (subCategoryIds) ? [...subCategoryIds] : undefined });
      }
    }

    this.setState({ categories });
  }

  /** Change category display in the viewport */
  private _enableCategory = (ids: string[], enabled: boolean, enableAllSubCategories = true) => {
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
            const subCategoryIds = this.props.iModel.subcategories.getSubCategories(id);
            if (subCategoryIds) {
              subCategoryIds.forEach((subCategoryId) => this._enableSubCategory(subCategoryId, false));
            }
          });
        }
      }
    };

    // This property let us act on all viewports or just on the selected one, configurable by the app
    if (this.props.allViewports) {
      IModelApp.viewManager.forEachViewport(updateViewport);
    } else if (IModelApp.viewManager.selectedView) {
      updateViewport(IModelApp.viewManager.selectedView);
    }
  }

  /** Change subcategory display in the viewport */
  private _enableSubCategory = (key: string, enabled: boolean) => {
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
    if (this.props.allViewports) {
      IModelApp.viewManager.forEachViewport(updateViewport);
    } else if (IModelApp.viewManager.selectedView) {
      updateViewport(IModelApp.viewManager.selectedView);
    }
  }

  /**
   * Sets provided ruleset as new ruleset for tree.
   * @param activeRuleset Ruleset to provide to tree.
   */
  private _setViewType = async () => {
    if (!IModelApp.viewManager || !this.state.activeView)
      return;

    const view = this.state.activeView.view as SpatialViewState;
    const viewType = view.is3d() ? "3d" : "2d";
    await Presentation.presentation.vars(RULESET.id).setString("ViewType", viewType); // tslint:disable-line:no-floating-promises
  }

  private _getIdFromTreeNode = (node: TreeNodeItem) => {
    const key = this.state.dataProvider!.getNodeKey(node);
    if (NodeKey.isInstanceNodeKey(key) && key.instanceKey)
      return key.instanceKey.id;

    return "";
  }

  private createCheckBoxInfoCallback() {
    const combine = (status: CheckBoxInfo) => ({
      isVisible: true,
      ...status,
    });
    return (node: TreeNodeItem): CheckBoxInfo | Promise<CheckBoxInfo> => {
      const status = this.getNodeCheckBoxInfo(node);
      if (isPromiseLike(status))
        return status.then(combine);
      return combine(status);
    };
  }

  private getNodeCheckBoxInfo(node: TreeNodeItem): CheckBoxInfo | Promise<CheckBoxInfo> {
    const id = this._getIdFromTreeNode(node);
    if (this.props.activeView) {
      let state = CheckBoxState.Off;
      if (node.parentId) {
        if (this._isSubCategoryVisible(id))
          state = CheckBoxState.On;
      } else {
        if (this._isCategoryVisible(id))
          state = CheckBoxState.On;
      }
      return { isDisabled: false, isVisible: true, state };
    }
    return {};
  }

  // tslint:disable-next-line: naming-convention
  private onCheckboxStateChange = async (stateChanges: Array<{ node: TreeNodeItem, newState: CheckBoxState }>) => {
    for (const { node, newState } of stateChanges) {
      newState === CheckBoxState.On ? this._onNodesSelected([node]) : this._onNodesDeselected([node]);
    }
  }

  // tslint:disable-next-line:naming-convention
  private onFilterApplied = (_filter?: string): void => {
    if (this.state.filterInfo && this.state.filterInfo.filtering)
      this.setState((prev) => ({
        filterInfo: {
          ...prev.filterInfo,
          filtering: false,
        },
      }));
  }

  private _onMatchesCounted = (count: number) => {
    if (this.state.filterInfo && count !== this.state.filterInfo.matchesCount)
      this.setState((prev) => ({
        filterInfo: {
          ...prev.filterInfo,
          matchesCount: count,
        },
      }));
  }

  private _onNodesSelected = (items: TreeNodeItem[]) => {
    items.forEach((node) => {
      const id = this._getIdFromTreeNode(node);
      let enable = false;
      if (node.parentId) {
        enable = !this._isSubCategoryVisible(id);
      } else {
        enable = !this._isCategoryVisible(id);
      }
      this._manageSelection(items, enable); // tslint:disable-line:no-floating-promises
    });
  }

  private _onNodesDeselected = (items: TreeNodeItem[]) => {
    this._manageSelection(items, false); // tslint:disable-line:no-floating-promises
  }

  private _isSubCategoryVisible(id: string): boolean {
    const parentItem = this._getParent(id);
    const activeView = this.props.activeView;
    if (!parentItem || !activeView)
      return false;
    return activeView.view.viewsCategory(parentItem.key) && activeView.isSubCategoryVisible(id);
  }

  private _isCategoryVisible(id: string): boolean {
    const activeView = this.props.activeView;
    return (activeView) ? activeView.view.viewsCategory(id) : false;
  }

  private _getParent(key: string): Category | undefined {
    const categories = this.state.categories;
    for (const category of categories) {
      if (category.children) {
        if (category.children.indexOf(key) !== -1)
          return category;
      }
    }

    return undefined;
  }

  private _manageSelection = async (nodes: TreeNodeItem[], enable: boolean) => {
    nodes.forEach(async (node) => {
      const id = this._getIdFromTreeNode(node);
      if (node.parentId) {
        if (enable) {
          const parent = this._getParent(id);
          if (parent) {
            // when enabling a subcategory, ensure the parent is enabled
            this._enableCategory([parent.key], enable, false);
          }
        }
        this._enableSubCategory(id, enable);
      } else {
        this._enableCategory([id], enable);
      }
    });

    if (this._isMounted)
      this.setState({ checkboxInfo: this.createCheckBoxInfoCallback() });
  }

  private _onSelectAll = async () => {
    this._onSetEnableAll(true); // tslint:disable-line:no-floating-promises
  }

  private _onClearAll = async () => {
    this._onSetEnableAll(false); // tslint:disable-line:no-floating-promises
  }

  private _onSetEnableAll = async (enable: boolean) => {
    const ids = this.state.categories.map((category: Category) => category.key);
    if (ids.length > 0) {
      this.setState({ isLoading: true });

      this._enableCategory(ids, enable);

      if (this._isMounted)
        this.setState({ isLoading: false, checkboxInfo: this.createCheckBoxInfoCallback() });
    }
  }

  private _onFilterCancel = () => {
    if (!this.state.filterInfo)
      return;

    this.setState((prev) => ({
      filterInfo: {
        ...prev.filterInfo,
        filter: "",
        filtering: false,
      },
    }));
  }

  private _onFilterClear = () => {
    if (!this.state.filterInfo)
      return;

    this.setState((prev) => ({
      filterInfo: {
        ...prev.filterInfo,
        filter: "",
        filtering: false,
      },
    }));
  }

  private _onFilterStart = (filter: string) => {
    if (!this.state.filterInfo)
      return;

    this.setState((prev) => ({
      filterInfo: {
        ...prev.filterInfo,
        filter,
        filtering: true,
      },
    }));
  }

  // tslint:disable-next-line: naming-convention
  private renderNodeCheckbox = (props: NodeCheckboxRenderProps): React.ReactNode => {
    return (
      <ImageCheckBox
        checked={props.checked}
        disabled={props.disabled}
        imageOn="icon-visibility"
        imageOff="icon-visibility-hide-2"
        onClick={props.onChange}
      />
    );
  }

  private _onSelectedMatchChanged = (index: number) => {
    if (this.state.filterInfo && index !== this.state.filterInfo.activeMatchIndex)
      this.setState((prev) => ({
        filterInfo: {
          ...prev.filterInfo,
          activeMatchIndex: index,
        },
      }));

  }

  /** @internal */
  public render() {
    const { showSearchBox } = this.props;
    const { dataProvider, filterInfo, checkboxInfo } = this.state;

    if (!dataProvider)
      return (
        <div />
      );
    else {
      return (
        <div className="uifw-categories-tree">
          {showSearchBox &&
            <FilteringInput
              autoFocus={true}
              filteringInProgress={this.state.filterInfo && this.state.filterInfo.filtering || false}
              onFilterCancel={this._onFilterCancel}
              onFilterClear={this._onFilterClear}
              onFilterStart={this._onFilterStart}
              resultSelectorProps={{
                onSelectedChanged: this._onSelectedMatchChanged,
                resultCount: this.state.filterInfo && this.state.filterInfo.matchesCount || 0,
              }}
            />
          }
          <CategoryFilterTree
            dataProvider={dataProvider}
            filter={filterInfo ? filterInfo!.filter : ""}
            onFilterApplied={this.onFilterApplied}
            onMatchesCounted={this._onMatchesCounted}
            activeMatchIndex={filterInfo ? filterInfo.activeMatchIndex : 0}
            selectionMode={SelectionMode.Single}
            onNodesSelected={this._onNodesSelected}
            showDescriptions={true}
            checkboxInfo={checkboxInfo}
            onCheckboxClick={this.onCheckboxStateChange}
            showIcons={true}
            renderOverrides={{ renderCheckbox: this.renderNodeCheckbox }}
            pageSize={5}
          />
        </div>
      );
    }
  }
}

// selectedNodes={this._getSelectedNodes}
// onNodesSelected={this._onNodesSelected}
// onNodesDeselected={this._onNodesDeselected
