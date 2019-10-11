/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { Observable } from "./Observable";
import {
  MutableTreeModel,
  TreeModel,
  TreeModelNodeInput,
  TreeNodeItemData,
  VisibleTreeNodes,
  isTreeModelNode,
} from "./TreeModel";
import { SubscriptionScheduler, scheduleSubscription } from "./internal/SubscriptionScheduler";
import {
  TreeDataChangesListener,
  TreeDataProvider,
  TreeNodeItem,
  isTreeDataProviderInterface,
  isTreeDataProviderMethod,
  isTreeDataProviderPromise,
  isTreeDataProviderRaw,
} from "../TreeDataProvider";
import { UiComponents } from "../../UiComponents";

import { BeUiEvent } from "@bentley/bentleyjs-core";
import { UiError } from "@bentley/ui-core";

import { produce } from "immer";

import { Observable as RxjsObservable } from "rxjs/internal/Observable";
import { EMPTY } from "rxjs/internal/observable/empty";
import { defer } from "rxjs/internal/observable/defer";
import { from } from "rxjs/internal/observable/from";
import { of } from "rxjs/internal/observable/of";
import { concatMap } from "rxjs/internal/operators/concatMap";
import { finalize } from "rxjs/internal/operators/finalize";
import { map } from "rxjs/internal/operators/map";
import { publish } from "rxjs/internal/operators/publish";
import { toArray } from "rxjs/internal/operators/toArray";
import { refCount } from "rxjs/internal/operators/refCount";

/** @internal */
export interface TreeModelUpdaterParams {
  dataSource: TreeDataSource;
  pageSize: number;
  collapsedChildrenDisposal: boolean;
}

/**
 * Data structure that describes tree node load result.
 * @alpha
 */
export interface TreeNodeLoadResult {
  model: TreeModel;
  loadedNodes: string[];
}

/**
 * Default implementation of tree node loader.
 * It is used to load nodes and modify tree model which is rendered.
 * @alpha
 */
export class TreeModelSource implements TreeNodeLoader {
  private _model = new MutableTreeModel();
  private _pageLoader: PageLoader<TreeNodeLoadResult>;
  private _loadScheduler = new SubscriptionScheduler<TreeNodeLoadResult>();

  private _visibleNodes?: VisibleTreeNodes;

  constructor(dataProvider: TreeDataProvider, pageSize: number) {
    this._pageLoader = new PageLoader(new TreeDataSource(dataProvider), pageSize, this._onPageLoaded);
    this.onModelChanged.addListener(() => this._visibleNodes = undefined);
  }

  public onModelChanged = new BeUiEvent<TreeModel>();

  public modifyModel(callback: (model: MutableTreeModel) => void): void {
    const newModel = produce(this._model, (draft: MutableTreeModel) => callback(draft));
    if (newModel !== this._model) {
      this._model = newModel;
      this.onModelChanged.emit(this._model);
    }
  }

  public getModel(): TreeModel { return this._model; }

  public getVisibleNodes(): VisibleTreeNodes {
    if (!this._visibleNodes) {
      this._visibleNodes = this._model.computeVisibleNodes();
    }

    return this._visibleNodes;
  }

  public loadNode(parentId: string | undefined, childIndex: number): Observable<TreeNodeLoadResult> {
    const parentNode = parentId === undefined ? this._model.getRootNode() : this._model.getNode(parentId);
    // if parent node is disposed do not make request for children
    if (parentNode === undefined)
      return EMPTY;
    const parentItem = isTreeModelNode(parentNode) ? parentNode.item : undefined;
    return this._pageLoader.loadPageWithItem(parentItem, childIndex, parentNode.numChildren === undefined)
      .pipe(scheduleSubscription(this._loadScheduler));
  }

  private _onPageLoaded = (page: LoadedNodeHierarchy): TreeNodeLoadResult => {
    this.modifyModel((model) => {
      if (page.parentId !== undefined) {
        // Make sure the model sill contains the parent node
        if (model.getNode(page.parentId) === undefined)
          return;
      }

      TreeModelSource.updateChildren(model, page.parentId, page.hierarchyItems, page.offset, page.numChildren);
      if (page.parentId !== undefined) {
        const parentNode = model.getNode(page.parentId);
        if (parentNode && parentNode.isLoading && parentNode.numChildren !== undefined) {
          parentNode.isLoading = false;
        }
      }
    });

    function collectNodeIds(items: LoadedNodeHierarchyItem[], result: string[] = []): string[] {
      for (const { item, children } of items) {
        result.push(item.id);
        if (children) {
          collectNodeIds(children, result);
        }
      }

      return result;
    }

    return {
      loadedNodes: collectNodeIds(page.hierarchyItems),
      model: this.getModel(),
    };
  }

  private static updateChildren(
    model: MutableTreeModel,
    parentId: string | undefined,
    hierarchyItems: LoadedNodeHierarchyItem[],
    startIndex: number,
    numChildren?: number,
  ) {
    if (numChildren !== undefined) {
      model.setNumChildren(parentId, numChildren);
    }

    model.setChildren(
      parentId,
      hierarchyItems.map(({ item }) => TreeModelSource.convertToTreeModelNodeInput(item)),
      startIndex,
    );

    for (const item of hierarchyItems) {
      if (item.children) {
        TreeModelSource.updateChildren(model, item.item.id, item.children, 0, item.numChildren);
      }
    }
  }

  private static convertToTreeModelNodeInput(item: TreeNodeItemData): TreeModelNodeInput {
    let numChildren: number | undefined;
    if (item.children) {
      numChildren = item.children.length;
    } else if (!item.hasChildren) {
      numChildren = 0;
    }

    return {
      description: item.description,
      isExpanded: !!item.autoExpand,
      id: item.id,
      item,
      label: item.label,
      isLoading: false,
      numChildren,
      isSelected: false,
    };
  }
}

/**
 * Tree node loader which is used to load tree nodes.
 * @alpha
 */
export interface TreeNodeLoader {
  loadNode(parentId: string | undefined, childIndex: number): Observable<TreeNodeLoadResult>;
}

/** @internal */
export interface LoadedNodeHierarchy {
  parentId: string | undefined;
  offset: number;
  hierarchyItems: LoadedNodeHierarchyItem[];
  numChildren?: number;
}

/** @internal */
export interface LoadedNodeHierarchyItem {
  item: TreeNodeItemData;
  children?: LoadedNodeHierarchyItem[];
  numChildren?: number;
}

class PageLoader<T> {
  private _dataSource: TreeDataSource;
  private _pageSize: number;
  private _activePageRequests = new Map<string | undefined, Map<number, RxjsObservable<T>>>();
  private _onPageLoaded: (page: LoadedNodeHierarchy) => T;

  constructor(
    dataSource: TreeDataSource,
    pageSize: number,
    onPageLoaded: (page: LoadedNodeHierarchy) => T,
  ) {
    this._dataSource = dataSource;
    this._pageSize = pageSize;
    this._onPageLoaded = onPageLoaded;
  }

  public loadPageWithItem(
    parentItem: TreeNodeItem | undefined,
    itemIndex: number,
    requestNumChildren: boolean,
  ): RxjsObservable<T> {
    const parentId = parentItem && parentItem.id;
    const parentPageRequests = this._activePageRequests.get(parentId) || new Map<number, RxjsObservable<T>>();
    const page = Math.trunc(itemIndex / this._pageSize);
    const activeRequest = parentPageRequests.get(page);
    if (activeRequest) {
      return activeRequest;
    }

    const startIndex = page * this._pageSize;
    const newRequest = this._dataSource.requestItems(parentItem, startIndex, this._pageSize, requestNumChildren)
      .pipe(
        concatMap(({ numChildren, loadedItems }) => this.loadHierarchy(loadedItems)
          .pipe(
            map((hierarchyItems) => ({
              parentId,
              offset: startIndex,
              hierarchyItems,
              numChildren,
            })),
          ),
        ),
        map((result) => this._onPageLoaded(result)),
        finalize(() => {
          parentPageRequests.delete(page);
          if (parentPageRequests.size === 0) {
            this._activePageRequests.delete(parentId);
          }
        }),
        publish(),
        refCount(),
      );

    parentPageRequests.set(page, newRequest);
    this._activePageRequests.set(parentId, parentPageRequests);
    return newRequest;
  }

  private loadHierarchy(rootItems: TreeNodeItemData[]): RxjsObservable<LoadedNodeHierarchyItem[]> {
    return from(rootItems)
      .pipe(
        concatMap((item) => {
          if (!item.autoExpand) {
            return of({ item });
          }

          return this._dataSource.requestItems(item, 0, this._pageSize, true)
            .pipe(
              concatMap(({ numChildren, loadedItems }) => this.loadHierarchy(loadedItems)
                .pipe(
                  map((children) => ({ item, children, numChildren })),
                ),
              ),
            );
        }),
        toArray(),
      );
  }
}

interface TreeDataSourceResult {
  loadedItems: TreeNodeItemData[];
  numChildren?: number;
}

/** @internal */
export class TreeDataSource {
  private _dataProvider: TreeDataProvider;

  public readonly onItemsChanged = new BeUiEvent<TreeDataChangesListener>();

  constructor(dataProvider: TreeDataProvider) {
    this._dataProvider = dataProvider;

    if (isTreeDataProviderInterface(this._dataProvider) && this._dataProvider.onTreeNodeChanged) {
      this._dataProvider.onTreeNodeChanged!.addListener(
        (changedItems) => this.onItemsChanged.raiseEvent(changedItems),
      );
    }
  }

  public requestItems(
    parent: TreeNodeItem | undefined,
    firstItemIndex: number,
    numItems: number,
    requestNumChildren: boolean,
  ): RxjsObservable<TreeDataSourceResult> {
    return defer(async (): Promise<TreeDataSourceResult> => {
      if (isTreeDataProviderInterface(this._dataProvider)) {
        let numChildren: number | undefined;
        if (requestNumChildren) {
          numChildren = await this._dataProvider.getNodesCount(parent);
        }

        return {
          loadedItems: (await this._dataProvider.getNodes(parent, { size: numItems, start: firstItemIndex })),
          numChildren,
        };
      }

      const loadedItems = await this.getItems(parent);

      return {
        loadedItems: loadedItems.slice(firstItemIndex, firstItemIndex + numItems),
        numChildren: loadedItems.length,
      };
    })
      .pipe(
        publish(),
        refCount(),
      );
  }

  private async getItems(parent: TreeNodeItem | undefined): Promise<TreeNodeItemData[]> {
    if (isTreeDataProviderRaw(this._dataProvider)) {
      return this._dataProvider;
    }

    if (isTreeDataProviderMethod(this._dataProvider)) {
      return this._dataProvider(parent);
    }

    if (isTreeDataProviderPromise(this._dataProvider)) {
      this._dataProvider = await this._dataProvider;
      return this._dataProvider;
    }

    throw new UiError(UiComponents.loggerCategory(this), "Unsupported TreeDataProvider.");
  }
}
