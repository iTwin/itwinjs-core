/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as _ from "lodash";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { NodeKey, NodePathElement, HierarchyRequestOptions } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { DelayLoadedTreeNodeItem, TreeNodeItem } from "@bentley/ui-components/lib/tree/TreeDataProvider";
import { PageOptions } from "@bentley/ui-components/lib/common/PageOptions";
import { createTreeNodeItems, pageOptionsUiToPresentation } from "./Utils";
import IPresentationTreeDataProvider from "./IPresentationTreeDataProvider";

/**
 * Presentation Rules-driven tree data provider.
 */
export default class PresentationTreeDataProvider implements IPresentationTreeDataProvider {
  private _rulesetId: string;
  private _connection: IModelConnection;

  /**
   * Constructor.
   * @param connection Connection to an imodel to pull data from.
   * @param rulesetId Id of the ruleset used by this data provider.
   */
  public constructor(connection: IModelConnection, rulesetId: string) {
    this._rulesetId = rulesetId;
    this._connection = connection;
  }

  /** Id of the ruleset used by this data provider */
  public get rulesetId(): string { return this._rulesetId; }

  /** [[IModelConnection]] used by this data provider */
  public get connection(): IModelConnection { return this._connection; }

  /** Called to get extended options for node requests */
  private createRequestOptions(): HierarchyRequestOptions<IModelConnection> {
    return {
      imodel: this._connection,
      rulesetId: this._rulesetId,
    };
  }

  /**
   * Returns a [[NodeKey]] from given [[TreeNodeItem]].
   * **Warning:** the `node` must be created by this data provider.
   */
  public getNodeKey(node: TreeNodeItem): NodeKey {
    return node.extendedData.key as NodeKey;
  }

  /**
   * Returns nodes
   * @param parentNode The parent node to return children for.
   * @param pageOptions Information about the requested page of data.
   */
  public getNodes = _.memoize(async (parentNode?: TreeNodeItem, pageOptions?: PageOptions): Promise<DelayLoadedTreeNodeItem[]> => {
    if (parentNode) {
      const parentKey = this.getNodeKey(parentNode);
      const childNodes = await Presentation.presentation.getChildren({ ...this.createRequestOptions(), paging: pageOptionsUiToPresentation(pageOptions) }, parentKey);
      return createTreeNodeItems(childNodes, parentNode.id);
    }
    const rootNodes = await Presentation.presentation.getRootNodes({ ...this.createRequestOptions(), paging: pageOptionsUiToPresentation(pageOptions) });
    return createTreeNodeItems(rootNodes);
  }, MemoizationHelpers.getNodesKeyResolver);

  /**
   * Returns the total number of nodes
   * @param parentNode The parent node to return children count for.
   */
  public getNodesCount = _.memoize(async (parentNode?: TreeNodeItem): Promise<number> => {
    if (parentNode) {
      const parentKey = this.getNodeKey(parentNode);
      return await Presentation.presentation.getChildrenCount(this.createRequestOptions(), parentKey);
    } else {
      return await Presentation.presentation.getRootNodesCount(this.createRequestOptions());
    }
  }, MemoizationHelpers.getNodesCountKeyResolver);

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
  public static getNodesCountKeyResolver(parent?: TreeNodeItem) { return MemoizationHelpers.createKeyForTreeNodeItem(parent); }
}
