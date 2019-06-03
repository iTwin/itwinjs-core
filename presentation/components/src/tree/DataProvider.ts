/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as _ from "lodash";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Logger } from "@bentley/bentleyjs-core";
import { NodeKey, NodePathElement, HierarchyRequestOptions } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { DelayLoadedTreeNodeItem, TreeNodeItem, PageOptions } from "@bentley/ui-components";
import { PRESENTATION_TREE_NODE_KEY, createTreeNodeItems, pageOptionsUiToPresentation } from "./Utils";
import { IPresentationTreeDataProvider } from "./IPresentationTreeDataProvider";

/**
 * Presentation Rules-driven tree data provider.
 * @public
 */
export class PresentationTreeDataProvider implements IPresentationTreeDataProvider {
  private _rulesetId: string;
  private _imodel: IModelConnection;
  private _pagingSize?: number;

  /**
   * Constructor.
   * @param imodel Connection to an imodel to pull data from.
   * @param rulesetId Id of the ruleset used by this data provider.
   */
  public constructor(imodel: IModelConnection, rulesetId: string) {
    this._rulesetId = rulesetId;
    this._imodel = imodel;
  }

  /** Id of the ruleset used by this data provider */
  public get rulesetId(): string { return this._rulesetId; }

  /** [[IModelConnection]] used by this data provider */
  public get imodel(): IModelConnection { return this._imodel; }

  /**
   * Paging options for obtaining nodes.
   *
   * Presentation data providers, when used with paging, have ability to save one backend request for size / count. That
   * can only be achieved when `pagingSize` property is set on the data provider and it's value matches size which is used when
   * requesting nodes. To help developers notice this problem, data provider emits a warning similar to this:
   * ```
   * PresentationTreeDataProvider.pagingSize doesn't match pageOptions in PresentationTreeDataProvider.getNodes call. Make sure you set PresentationTreeDataProvider.pagingSize to avoid excessive backend requests.
   * ```
   * To fix the issue, developers should make sure the page size used for requesting data is also set for the data provider:
   * ```TS
   * const pageSize = 10;
   * const provider = new TreeDataProvider(imodel, rulesetId);
   * provider.pagingSize = pageSize;
   * // only one backend request is made for the two following requests:
   * provider.getNodesCount();
   * provider.getNodes({ start: 0, size: pageSize });
   * ```
   */
  public get pagingSize(): number | undefined { return this._pagingSize; }
  public set pagingSize(value: number | undefined) { this._pagingSize = value; }

  /** Called to get extended options for node requests */
  private createRequestOptions(): HierarchyRequestOptions<IModelConnection> {
    return {
      imodel: this._imodel,
      rulesetId: this._rulesetId,
    };
  }

  /**
   * Returns a [[NodeKey]] from given [[TreeNodeItem]].
   * **Warning:** the `node` must be created by this data provider.
   */
  public getNodeKey(node: TreeNodeItem): NodeKey {
    return (node as any)[PRESENTATION_TREE_NODE_KEY];
  }

  /**
   * Returns nodes
   * @param parentNode The parent node to return children for.
   * @param pageOptions Information about the requested page of data.
   */
  public async getNodes(parentNode?: TreeNodeItem, pageOptions?: PageOptions): Promise<DelayLoadedTreeNodeItem[]> {
    if (undefined !== pageOptions && pageOptions.size !== this.pagingSize) {
      const msg = `PresentationTreeDataProvider.pagingSize doesn't match pageOptions in PresentationTreeDataProvider.getNodes call.
        Make sure you set PresentationTreeDataProvider.pagingSize to avoid excessive backend requests.`;
      Logger.logWarning("Presentation.Components", msg);
    }

    if (parentNode)
      return (await this._getNodesAndCount(parentNode, pageOptions)).nodes;
    return (await this._getNodesAndCount(undefined, pageOptions)).nodes;
  }

  /**
   * Returns the total number of nodes
   * @param parentNode The parent node to return children count for.
   */
  public async getNodesCount(parentNode?: TreeNodeItem): Promise<number> {
    const pageOptions = undefined !== this.pagingSize ? { start: 0, size: this.pagingSize } : undefined;
    return (await this._getNodesAndCount(parentNode, pageOptions)).count!;
  }

  private _getNodesAndCount = _.memoize(async (parentNode?: TreeNodeItem, pageOptions?: PageOptions) => {
    const requestCount = undefined !== pageOptions && 0 === pageOptions.start && undefined !== pageOptions.size;
    const parentKey = parentNode ? this.getNodeKey(parentNode) : undefined;

    if (!requestCount) {
      const allNodes = await Presentation.presentation.getNodes({ ...this.createRequestOptions(), paging: pageOptionsUiToPresentation(pageOptions) }, parentKey);
      return { nodes: parentNode ? createTreeNodeItems(allNodes, parentNode.id) : createTreeNodeItems(allNodes), count: allNodes.length };
    }

    const nodesResponse = await Presentation.presentation.getNodesAndCount({ ...this.createRequestOptions(), paging: pageOptionsUiToPresentation(pageOptions) }, parentKey);
    return { nodes: parentNode ? createTreeNodeItems(nodesResponse.nodes, parentNode.id) : createTreeNodeItems(nodesResponse.nodes), count: nodesResponse.count };
  }, MemoizationHelpers.getNodesKeyResolver);

  /**
   * Returns filtered node paths.
   * @param filter Filter.
   */
  public getFilteredNodePaths = async (filter: string): Promise<NodePathElement[]> => {
    return Presentation.presentation.getFilteredNodePaths(this.createRequestOptions(), filter);
  }
}

class MemoizationHelpers {
  public static createKeyForPageOptions(pageOptions?: PageOptions) {
    if (!pageOptions)
      return "0/0";
    return `${(pageOptions.start) ? pageOptions.start : 0}/${(pageOptions.size) ? pageOptions.size : 0}`;
  }
  public static createKeyForTreeNodeItem(item?: TreeNodeItem) { return item ? item.id : ""; }
  public static getNodesKeyResolver(parent?: TreeNodeItem, pageOptions?: PageOptions) {
    return `${MemoizationHelpers.createKeyForTreeNodeItem(parent)}/${MemoizationHelpers.createKeyForPageOptions(pageOptions)}`;
  }
}
