/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import memoize from "micro-memoize";
import { DelayLoadedTreeNodeItem, PageOptions, TreeNodeItem } from "@itwin/components-react";
import { IDisposable, Logger } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import {
  ClientDiagnosticsOptions, FilterByTextHierarchyRequestOptions, HierarchyRequestOptions, InstanceFilterDefinition, Node, NodeKey, NodePathElement, Paged, Ruleset,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { createDiagnosticsOptions, DiagnosticsProps } from "../common/Diagnostics";
import { RulesetRegistrationHelper } from "../common/RulesetRegistrationHelper";
import { PresentationComponentsLoggerCategory } from "../ComponentsLoggerCategory";
import { PresentationInstanceFilterInfo } from "../instance-filter-builder/PresentationInstanceFilterBuilder";
import { convertToInstanceFilterDefinition } from "../instance-filter-builder/InstanceFilterConverter";
import { IPresentationTreeDataProvider } from "./IPresentationTreeDataProvider";
import { CreateTreeNodeItemProps, createTreeNodeItems, pageOptionsUiToPresentation } from "./Utils";

/**
 * Properties for creating a `PresentationTreeDataProvider` instance.
 * @public
 */
export interface PresentationTreeDataProviderProps extends DiagnosticsProps {
  /** IModel to pull data from. */
  imodel: IModelConnection;

  /** Id of the ruleset to use when requesting content or a ruleset itself. */
  ruleset: string | Ruleset;

  /**
   * Paging size for obtaining nodes.
   *
   * Presentation data providers, when used with paging, have ability to save one backend request for size / count. That
   * can only be achieved when `pagingSize` property is set on the data provider and it's value matches size which is used when
   * requesting nodes. To help developers notice this problem, data provider emits a warning similar to this:
   * ```
   * PresentationTreeDataProvider.pagingSize doesn't match pageOptions in PresentationTreeDataProvider.getNodes call. Make sure you set PresentationTreeDataProvider.pagingSize to avoid excessive backend requests.
   * ```
   * To fix the issue, developers should make sure the page size used for requesting data is also set for the data provider:
   * ```TS
   * const pagingSize = 10;
   * const provider = new TreeDataProvider({imodel, ruleset, pagingSize});
   * // only one backend request is made for the two following requests:
   * provider.getNodesCount();
   * provider.getNodes({ start: 0, size: pagingSize });
   * ```
   */
  pagingSize?: number;

  /** Should grouping nodes have a suffix with grouped nodes count. Defaults to `false`. */
  appendChildrenCountForGroupingNodes?: boolean;

  /**
   * Callback which provides a way to customize how data is mapped between [Node]($presentation-common) and [TreeNodeItem]($components-react).
   * @beta
   */
  customizeTreeNodeItem?: (item: Partial<DelayLoadedTreeNodeItem>, node: Partial<Node>) => void;

  /**
   * By default the provider uses [PresentationManager]($presentation-frontend) accessed through `Presentation.presentation` to request
   * node counts, nodes and filter them. The overrides allow swapping some or all of the data source entry points thus
   * making the provider request data from custom sources.
   * @beta
   */
  dataSourceOverrides?: Partial<PresentationTreeDataProviderDataSourceEntryPoints>;
}

/**
 * Definitions of methods used by [[PresentationTreeDataProvider]] to get nodes' data.
 * @beta
 */
export interface PresentationTreeDataProviderDataSourceEntryPoints {
  getNodesCount: (requestOptions: HierarchyRequestOptions<IModelConnection, NodeKey>) => Promise<number>;
  getNodesAndCount: (requestOptions: Paged<HierarchyRequestOptions<IModelConnection, NodeKey>>) => Promise<{ nodes: Node[], count: number }>;
  getFilteredNodePaths: (requestOptions: FilterByTextHierarchyRequestOptions<IModelConnection>) => Promise<NodePathElement[]>;
}

/**
 * Presentation Rules-driven tree data provider.
 * @public
 */
export class PresentationTreeDataProvider implements IPresentationTreeDataProvider, IDisposable {
  private _imodel: IModelConnection;
  private _rulesetRegistration: RulesetRegistrationHelper;
  private _pagingSize?: number;
  private _disposeVariablesChangeListener: () => void;
  private _dataSource: PresentationTreeDataProviderDataSourceEntryPoints;
  private _diagnosticsOptions?: ClientDiagnosticsOptions;
  private _nodesCreateProps: CreateTreeNodeItemProps;

  /** Constructor. */
  public constructor(props: PresentationTreeDataProviderProps) {
    this._rulesetRegistration = new RulesetRegistrationHelper(props.ruleset);
    this._imodel = props.imodel;
    this._pagingSize = props.pagingSize;
    this._nodesCreateProps = {
      appendChildrenCountForGroupingNodes: props.appendChildrenCountForGroupingNodes,
      customizeTreeNodeItem: props.customizeTreeNodeItem,
    };

    this._dataSource = {
      getNodesCount: async (requestOptions: HierarchyRequestOptions<IModelConnection, NodeKey>) => Presentation.presentation.getNodesCount(requestOptions),
      getNodesAndCount: async (requestOptions: Paged<HierarchyRequestOptions<IModelConnection, NodeKey>>) => Presentation.presentation.getNodesAndCount(requestOptions),
      getFilteredNodePaths: async (requestOptions: FilterByTextHierarchyRequestOptions<IModelConnection>) => Presentation.presentation.getFilteredNodePaths(requestOptions),
      ...props.dataSourceOverrides,
    };
    this._disposeVariablesChangeListener = Presentation.presentation.vars(this._rulesetRegistration.rulesetId).onVariableChanged.addListener(() => {
      this._getNodesAndCount.cache.values.length = 0;
      this._getNodesAndCount.cache.keys.length = 0;
    });
    this._diagnosticsOptions = createDiagnosticsOptions(props);
  }

  /** Destructor. Must be called to clean up.  */
  public dispose() {
    this._rulesetRegistration.dispose();
    this._disposeVariablesChangeListener && this._disposeVariablesChangeListener();
  }

  /** Id of the ruleset used by this data provider */
  public get rulesetId(): string { return this._rulesetRegistration.rulesetId; }

  /** [[IModelConnection]] used by this data provider */
  public get imodel(): IModelConnection { return this._imodel; }

  /**
   * Paging options for obtaining nodes.
   * @see `PresentationTreeDataProviderProps.pagingSize`
   */
  public get pagingSize(): number | undefined { return this._pagingSize; }
  public set pagingSize(value: number | undefined) { this._pagingSize = value; }

  /** Called to get  options for node requests */
  private createRequestOptions<TNodeKey = NodeKey>(parentKey: TNodeKey | undefined): HierarchyRequestOptions<IModelConnection, TNodeKey> {
    return {
      imodel: this._imodel,
      rulesetOrId: this._rulesetRegistration.rulesetId,
      ...(parentKey ? { parentKey } : undefined),
      ...(this._diagnosticsOptions ? { diagnostics: this._diagnosticsOptions } : undefined),
    };
  }

  /**
   * Returns a [[NodeKey]] from given [[TreeNodeItem]].
   * **Warning:** the `node` must be created by this data provider.
   */
  public getNodeKey(node: TreeNodeItem): NodeKey {
    return (node as PresentationTreeNodeItem).key;
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
      Logger.logWarning(PresentationComponentsLoggerCategory.Hierarchy, msg);
    }
    const instanceFilter = await getFilterDefinition(this.imodel, parentNode);
    return (await this._getNodesAndCount(parentNode, pageOptions, instanceFilter)).nodes;
  }

  /**
   * Returns the total number of nodes
   * @param parentNode The parent node to return children count for.
   */
  public async getNodesCount(parentNode?: TreeNodeItem): Promise<number> {
    const instanceFilter = await getFilterDefinition(this.imodel, parentNode);
    if (this.pagingSize !== undefined)
      return (await this._getNodesAndCount(parentNode, { start: 0, size: this.pagingSize }, instanceFilter)).count;

    const parentKey = parentNode ? this.getNodeKey(parentNode) : undefined;
    // TODO: pass complex instance filter
    const requestOptions: HierarchyRequestOptions<IModelConnection, NodeKey> = { ...this.createRequestOptions(parentKey), instanceFilter: instanceFilter?.expression };
    return this._dataSource.getNodesCount(requestOptions);
  }

  private _getNodesAndCount = memoize(async (parentNode?: TreeNodeItem, pageOptions?: PageOptions, instanceFilter?: InstanceFilterDefinition): Promise<{ nodes: TreeNodeItem[], count: number }> => {
    const parentKey = parentNode ? this.getNodeKey(parentNode) : undefined;
    // TODO: pass complex instance filter
    const requestOptions: Paged<HierarchyRequestOptions<IModelConnection, NodeKey>> = { ...this.createRequestOptions(parentKey), paging: pageOptionsUiToPresentation(pageOptions), instanceFilter: instanceFilter?.expression };
    const result = await this._dataSource.getNodesAndCount(requestOptions);
    return { nodes: createTreeNodeItems(result.nodes, parentNode?.id, this._nodesCreateProps), count: result.count };
  }, { isMatchingKey: MemoizationHelpers.areNodesRequestsEqual as any });

  /**
   * Returns filtered node paths.
   * @param filter Filter.
   */
  public async getFilteredNodePaths(filter: string): Promise<NodePathElement[]> {
    return this._dataSource.getFilteredNodePaths({
      ...this.createRequestOptions<never>(undefined),
      filterText: filter,
    });
  }
}

/** @alpha */
export interface PresentationTreeNodeItem extends DelayLoadedTreeNodeItem {
  key: NodeKey;
  filterInfo?: PresentationInstanceFilterInfo;
  filteringDisabled?: boolean;
  tooManyChildren?: boolean;
}

/** @alpha */
export function isPresentationTreeNodeItem(item: TreeNodeItem): item is PresentationTreeNodeItem {
  return (item as PresentationTreeNodeItem).key !== undefined;
}

function getFilterDefinition(imodel: IModelConnection, node?: TreeNodeItem) {
  if (!node || !isPresentationTreeNodeItem(node) || !node.filterInfo)
    return undefined;
  return convertToInstanceFilterDefinition(node.filterInfo.filter, imodel);
}

class MemoizationHelpers {
  public static areNodesRequestsEqual(lhsArgs: [TreeNodeItem?, PageOptions?, InstanceFilterDefinition?], rhsArgs: [TreeNodeItem?, PageOptions?, InstanceFilterDefinition?]): boolean {
    if (lhsArgs[0]?.id !== rhsArgs[0]?.id)
      return false;
    if ((lhsArgs[1]?.start ?? 0) !== (rhsArgs[1]?.start ?? 0))
      return false;
    if ((lhsArgs[1]?.size ?? 0) !== (rhsArgs[1]?.size ?? 0))
      return false;
    if (lhsArgs[2]?.expression !== rhsArgs[2]?.expression)
      return false;
    return true;
  }
}
