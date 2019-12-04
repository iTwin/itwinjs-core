/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { Observable as RxjsObservable } from "rxjs/internal/Observable";
import { defer } from "rxjs/internal/observable/defer";
import { from } from "rxjs/internal/observable/from";
import { of } from "rxjs/internal/observable/of";
import { concatMap } from "rxjs/internal/operators/concatMap";
import { finalize } from "rxjs/internal/operators/finalize";
import { map } from "rxjs/internal/operators/map";
import { tap } from "rxjs/internal/operators/tap";
import { publish } from "rxjs/internal/operators/publish";
import { toArray } from "rxjs/internal/operators/toArray";
import { refCount } from "rxjs/internal/operators/refCount";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { UiError } from "@bentley/ui-abstract";
import { Observable } from "./Observable";
import { SubscriptionScheduler, scheduleSubscription } from "./internal/SubscriptionScheduler";
import {
  TreeNodeItemData, isTreeModelNode, TreeModelNode, TreeModelRootNode,
} from "./TreeModel";
import {
  TreeDataChangesListener, TreeDataProvider, TreeNodeItem, isTreeDataProviderInterface,
  isTreeDataProviderMethod, isTreeDataProviderPromise, isTreeDataProviderRaw,
} from "../TreeDataProvider";
import { UiComponents } from "../../UiComponents";

/**
 * Tree node loader which is used to load tree nodes.
 * @beta
 */
export interface ITreeNodeLoader {
  /** Event that is raised when hierarchy for a node is loaded. */
  onNodeLoaded: BeUiEvent<LoadedNodeHierarchy>;
  /** Loads node at specified place in tree.
   *
   * @param parentId specifies tree branch
   * @param childIndex specifies offset in the branch.
   */
  loadNode(parentId: TreeModelNode | TreeModelRootNode, childIndex: number): Observable<LoadedNodeHierarchy>;
}

/**
 * Tree node loader which uses TreeDataProvider to load nodes.
 * @beta
 */
export interface ITreeNodeLoaderWithProvider<TDataProvider extends TreeDataProvider> extends ITreeNodeLoader {
  /** Returns TreeDataProvider used to load nodes. */
  getDataProvider(): TDataProvider;
}

/**
 * Default tree node loader with TreeDataProvider implementation.
 * @beta
 */
export class TreeNodeLoader<TDataProvider extends TreeDataProvider> implements ITreeNodeLoaderWithProvider<TDataProvider> {
  private _treeDataSource: TreeDataSource;
  private _loadScheduler = new SubscriptionScheduler<LoadedNodeHierarchy>();
  private _dataProvider: TDataProvider;
  private _activeRequests = new Map<string | undefined, RxjsObservable<LoadedNodeHierarchy>>();

  public onNodeLoaded = new BeUiEvent<LoadedNodeHierarchy>();

  constructor(dataProvider: TDataProvider) {
    this._treeDataSource = new TreeDataSource(dataProvider);
    this._dataProvider = dataProvider;
  }

  /** Returns TreeDataProvider used to load nodes. */
  public getDataProvider(): TDataProvider { return this._dataProvider; }

  /**
   * Schedules to load children of node and returns an Observable.
   *
   * **Note:** It does not start loading node until '.subscribe()' is called
   * on returned Observable. If called multiple times to load children for same node it will return same Observable.
   */
  public loadNode(parentNode: TreeModelNode | TreeModelRootNode): Observable<LoadedNodeHierarchy> {
    const parentItem = isTreeModelNode(parentNode) ? parentNode.item : undefined;
    return this.loadForParent(parentItem, parentNode.numChildren === undefined)
      .pipe(
        tap((loadedHierarchy) => {
          this.onNodeLoaded.emit(loadedHierarchy);
        }),
        scheduleSubscription(this._loadScheduler),
      );
  }

  private loadForParent(parentItem: TreeNodeItem | undefined, requestNumChildren: boolean): RxjsObservable<LoadedNodeHierarchy> {
    const parentId = parentItem && parentItem.id;
    const activeRequest = this._activeRequests.get(parentId);
    if (activeRequest) {
      return activeRequest;
    }

    const newRequest = requestLoadedHierarchy(parentItem, this._treeDataSource, 0, 0, requestNumChildren, () => {
      this._activeRequests.delete(parentId);
    });

    this._activeRequests.set(parentId, newRequest);
    return newRequest;
  }
}

/**
 * Default paged tree node loader with TreeDataProvider implementation.
 * @beta
 */
export class PagedTreeNodeLoader<TDataProvider extends TreeDataProvider> implements ITreeNodeLoaderWithProvider<TDataProvider> {
  private _pageLoader: PageLoader;
  private _loadScheduler = new SubscriptionScheduler<LoadedNodeHierarchy>();
  private _dataProvider: TDataProvider;
  private _pageSize: number;

  public onNodeLoaded = new BeUiEvent<LoadedNodeHierarchy>();

  constructor(dataProvider: TDataProvider, pageSize: number) {
    this._pageLoader = new PageLoader(new TreeDataSource(dataProvider), pageSize);
    this._pageSize = pageSize;
    this._dataProvider = dataProvider;
  }

  /** Returns page size used by tree node loader. */
  public getPageSize(): number { return this._pageSize; }

  /** Returns TreeDataProvider used to load nodes. */
  public getDataProvider(): TDataProvider { return this._dataProvider; }

  /**
   * Schedules to load one page of node children and returns an Observable.
   *
   * **Note:** It does not start loading node page until '.subscribe()' is called
   * on returned Observable. If called multiple times to load same page it will return same Observable.
   */
  public loadNode(parentNode: TreeModelNode | TreeModelRootNode, childIndex: number): Observable<LoadedNodeHierarchy> {
    const parentItem = isTreeModelNode(parentNode) ? parentNode.item : undefined;
    return this._pageLoader.loadPageWithItem(parentItem, childIndex, parentNode.numChildren === undefined)
      .pipe(
        tap((loadedHierarchy) => {
          this.onNodeLoaded.emit(loadedHierarchy);
        }),
        scheduleSubscription(this._loadScheduler),
      );
  }
}

/** Data structure that describes hierarchy loaded for parent node.
 * @beta
 */
export interface LoadedNodeHierarchy {
  /** Node id of the parent node for loaded hierarchy. */
  parentId: string | undefined;
  /** Hierarchy items offset in parent node children array. */
  offset: number;
  /** Loaded hierarchy items. */
  hierarchyItems: LoadedNodeHierarchyItem[];
  /** Number of children parent node has. */
  numChildren?: number;
}

/** Data structure that describes one loaded hierarchy item.
 * @beta
 */
export interface LoadedNodeHierarchyItem {
  /** Loaded tree node item. */
  item: TreeNodeItemData;
  /** Children of loaded tree node item. */
  children?: LoadedNodeHierarchyItem[];
  /** Number of children tree node item has. */
  numChildren?: number;
}

class PageLoader {
  private _dataSource: TreeDataSource;
  private _pageSize: number;
  private _activePageRequests = new Map<string | undefined, Map<number, RxjsObservable<LoadedNodeHierarchy>>>();

  constructor(
    dataSource: TreeDataSource,
    pageSize: number,
  ) {
    this._dataSource = dataSource;
    this._pageSize = pageSize;
  }

  public loadPageWithItem(
    parentItem: TreeNodeItem | undefined,
    itemIndex: number,
    requestNumChildren: boolean,
  ): RxjsObservable<LoadedNodeHierarchy> {
    const parentId = parentItem && parentItem.id;
    const parentPageRequests = this._activePageRequests.get(parentId) || new Map<number, RxjsObservable<LoadedNodeHierarchy>>();
    const page = Math.trunc(itemIndex / this._pageSize);
    const activeRequest = parentPageRequests.get(page);
    if (activeRequest) {
      return activeRequest;
    }

    const startIndex = page * this._pageSize;
    const newRequest = requestLoadedHierarchy(parentItem, this._dataSource, startIndex, this._pageSize, requestNumChildren, () => {
      parentPageRequests.delete(page);
      if (parentPageRequests.size === 0) {
        this._activePageRequests.delete(parentId);
      }
    });

    parentPageRequests.set(page, newRequest);
    this._activePageRequests.set(parentId, parentPageRequests);
    return newRequest;
  }
}

function requestLoadedHierarchy(
  parentItem: TreeNodeItem | undefined,
  dataSource: TreeDataSource,
  start: number,
  take: number,
  requestNumChildren: boolean,
  finalizeCallback: () => void,
) {
  const parentId = parentItem && parentItem.id;
  return dataSource.requestItems(parentItem, start, take, requestNumChildren)
    .pipe(
      concatMap(({ numChildren, loadedItems }) => loadHierarchy(loadedItems, dataSource, take)
        .pipe(
          map((hierarchyItems) => ({
            parentId,
            offset: start,
            hierarchyItems,
            numChildren,
          })),
        ),
      ),
      finalize(finalizeCallback),
      publish(),
      refCount(),
    );
}

function loadHierarchy(rootItems: TreeNodeItemData[], dataSource: TreeDataSource, take: number): RxjsObservable<LoadedNodeHierarchyItem[]> {
  return from(rootItems)
    .pipe(
      concatMap((item) => {
        if (!item.autoExpand) {
          return of({ item });
        }

        return dataSource.requestItems(item, 0, take, true)
          .pipe(
            concatMap(({ numChildren, loadedItems }) => loadHierarchy(loadedItems, dataSource, take)
              .pipe(
                map((children) => ({ item, children, numChildren })),
              ),
            ),
          );
      }),
      toArray(),
    );
}

interface TreeDataSourceResult {
  loadedItems: TreeNodeItemData[];
  numChildren?: number;
}

/**
 * Wrapper to handle different types of TreeDataProvider. Provides one method
 * to request items from TreeDataProviderRaw, TreeDataProviderMethod,
 * TreeDataProviderPromise or TreeDataProviderInterface.
 * @internal
 */
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
          loadedItems: (await this._dataProvider.getNodes(parent, numItems !== 0 ? { size: numItems, start: firstItemIndex } : undefined)),
          numChildren,
        };
      }

      const loadedItems = await this.getItems(parent);

      return {
        loadedItems: numItems !== 0 ? loadedItems.slice(firstItemIndex, firstItemIndex + numItems) : loadedItems,
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
