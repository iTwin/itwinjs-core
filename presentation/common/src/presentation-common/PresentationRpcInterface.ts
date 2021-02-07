/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { IModelRpcProps, RpcInterface } from "@bentley/imodeljs-common";
import { ContentJSON } from "./content/Content";
import { DescriptorJSON, DescriptorOverrides, SelectionInfo } from "./content/Descriptor";
import { ItemJSON } from "./content/Item";
import { DisplayValueGroupJSON } from "./content/Value";
import { DiagnosticsOptions, DiagnosticsScopeLogs } from "./Diagnostics";
import { InstanceKeyJSON } from "./EC";
import { PresentationStatus } from "./Error";
import { NodeKeyJSON } from "./hierarchy/Key";
import { NodeJSON } from "./hierarchy/Node";
import { NodePathElementJSON } from "./hierarchy/NodePathElement";
import { KeySetJSON } from "./KeySet";
import { LabelDefinitionJSON } from "./LabelDefinition";
import {
  ContentDescriptorRequestOptions, ContentRequestOptions, DisplayLabelRequestOptions, DisplayLabelsRequestOptions, DistinctValuesRequestOptions,
  ExtendedContentRequestOptions, ExtendedHierarchyRequestOptions, HierarchyRequestOptions, LabelRequestOptions, Paged, PresentationDataCompareOptions,
  SelectionScopeRequestOptions,
} from "./PresentationManagerOptions";
import { SelectionScope } from "./selection/SelectionScope";
import { HierarchyCompareInfoJSON, PartialHierarchyModificationJSON } from "./Update";
import { Omit, PagedResponse } from "./Utils";

/**
 * Base options for all presentation RPC requests.
 * @public
 */
export type PresentationRpcRequestOptions<TManagerRequestOptions> = Omit<TManagerRequestOptions, "imodel"> & {
  /** ID of the client requesting data */
  clientId?: string;
  /** @alpha */
  diagnostics?: DiagnosticsOptions;
};

/**
 * Data structure for presentation RPC responses
 * @public
 */
export type PresentationRpcResponse<TResult = undefined> = Promise<{
  /** Response status code */
  statusCode: PresentationStatus;
  /** In case of an error response, the error message */
  errorMessage?: string;
  /** In case of a success response, the result */
  result?: TResult;
  /** @alpha */
  diagnostics?: DiagnosticsScopeLogs[];
}>;

/**
 * Data structure for base hierarchy request options.
 * @public
 */
export type HierarchyRpcRequestOptions = PresentationRpcRequestOptions<HierarchyRequestOptions<never>>;

/**
 * Data structure for hierarchy request options.
 * @beta
 */
export type ExtendedHierarchyRpcRequestOptions = PresentationRpcRequestOptions<ExtendedHierarchyRequestOptions<never, NodeKeyJSON>>;

/**
 * Data structure for content request options.
 * @public
 */
export type ContentRpcRequestOptions = PresentationRpcRequestOptions<ContentRequestOptions<never>>;

/**
 * Data structure for content descriptor RPC request options.
 * @beta
 */
export type ContentDescriptorRpcRequestOptions = PresentationRpcRequestOptions<ContentDescriptorRequestOptions<never, KeySetJSON>>;

/**
 * Data structure for content RPC request options.
 * @beta
 */
export type ExtendedContentRpcRequestOptions = PresentationRpcRequestOptions<ExtendedContentRequestOptions<never, DescriptorJSON, KeySetJSON>>;

/**
 * Data structure for distinct values' request options.
 * @alpha
 */
export type DistinctValuesRpcRequestOptions = PresentationRpcRequestOptions<DistinctValuesRequestOptions<never, DescriptorJSON, KeySetJSON>>;

/**
 * Data structure for label request options.
 * @public
 */
export type LabelRpcRequestOptions = PresentationRpcRequestOptions<LabelRequestOptions<never>>;

/**
 * Data structure for label request options.
 * @beta
 */
export type DisplayLabelRpcRequestOptions = PresentationRpcRequestOptions<DisplayLabelRequestOptions<never, InstanceKeyJSON>>;

/**
 * Data structure for labels request options.
 * @beta
 */
export type DisplayLabelsRpcRequestOptions = PresentationRpcRequestOptions<DisplayLabelsRequestOptions<never, InstanceKeyJSON>>;

/**
 * Data structure for selection scope request options.
 * @public
 */
export type SelectionScopeRpcRequestOptions = PresentationRpcRequestOptions<SelectionScopeRequestOptions<never>>;

/**
 * Data structure for ruleset variable request options.
 * @public
 */
export type RulesetVariableRpcRequestOptions = PresentationRpcRequestOptions<{ rulesetId: string }>;

/**
 * Data structure for comparing presentation data after ruleset or ruleset variable changes.
 * @alpha
 */
export type PresentationDataCompareRpcOptions = PresentationRpcRequestOptions<PresentationDataCompareOptions<any, NodeKeyJSON>>;

/**
 * Interface used for communication between Presentation backend and frontend.
 *
 * @public
 */
export class PresentationRpcInterface extends RpcInterface {
  /** The immutable name of the interface. */
  public static readonly interfaceName = "PresentationRpcInterface"; // eslint-disable-line @typescript-eslint/naming-convention

  /** The semantic version of the interface. */
  public static interfaceVersion = "2.7.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in core/common/src/rpc for the semantic versioning rules.
  ===========================================================================================*/

  /** @deprecated Use [[getPagedNodes]] */
  public async getNodesAndCount(_token: IModelRpcProps, _options: Paged<HierarchyRpcRequestOptions>, _parentKey?: NodeKeyJSON): PresentationRpcResponse<{ nodes: NodeJSON[], count: number }> { return this.forward(arguments); }
  /** @deprecated Use [[getPagedNodes]] */
  public async getNodes(_token: IModelRpcProps, _options: Paged<HierarchyRpcRequestOptions>, _parentKey?: NodeKeyJSON): PresentationRpcResponse<NodeJSON[]> { return this.forward(arguments); }
  /** @deprecated Use an overload with [[ExtendedHierarchyRpcRequestOptions]] */
  public async getNodesCount(_token: IModelRpcProps, _options: HierarchyRpcRequestOptions, _parentKey: NodeKeyJSON | undefined): PresentationRpcResponse<number>;
  /** @beta */
  public async getNodesCount(_token: IModelRpcProps, _options: ExtendedHierarchyRpcRequestOptions): PresentationRpcResponse<number>;
  public async getNodesCount(_token: IModelRpcProps, _options: HierarchyRpcRequestOptions | ExtendedHierarchyRpcRequestOptions, _parentKey?: NodeKeyJSON): PresentationRpcResponse<number> { return this.forward(arguments); }
  /** @beta */
  public async getPagedNodes(_token: IModelRpcProps, _options: Paged<ExtendedHierarchyRpcRequestOptions>): PresentationRpcResponse<PagedResponse<NodeJSON>> { return this.forward(arguments); }

  // TODO: add paged version of this (#387280)
  public async getNodePaths(_token: IModelRpcProps, _options: HierarchyRpcRequestOptions, _paths: InstanceKeyJSON[][], _markedIndex: number): PresentationRpcResponse<NodePathElementJSON[]> { return this.forward(arguments); }
  // TODO: add paged version of this (#387280)
  public async getFilteredNodePaths(_token: IModelRpcProps, _options: HierarchyRpcRequestOptions, _filterText: string): PresentationRpcResponse<NodePathElementJSON[]> { return this.forward(arguments); }

  /** @alpha Will be removed in 3.0 */
  public async loadHierarchy(_token: IModelRpcProps, _options: HierarchyRpcRequestOptions): PresentationRpcResponse<void> { return this.forward(arguments); }

  /** @deprecated Use an overload with [[ContentDescriptorRpcRequestOptions]] */
  public async getContentDescriptor(_token: IModelRpcProps, _options: ContentRpcRequestOptions, _displayType: string, _keys: KeySetJSON, _selection: SelectionInfo | undefined): PresentationRpcResponse<DescriptorJSON | undefined>;
  /** @beta */
  public async getContentDescriptor(_token: IModelRpcProps, _options: ContentDescriptorRpcRequestOptions): PresentationRpcResponse<DescriptorJSON | undefined>;
  public async getContentDescriptor(_token: IModelRpcProps, _options: ContentRpcRequestOptions | ContentDescriptorRpcRequestOptions, _displayType?: string, _keys?: KeySetJSON, _selection?: SelectionInfo): PresentationRpcResponse<DescriptorJSON | undefined> { return this.forward(arguments); }

  /** @deprecated Use an overload with [[ExtendedContentRpcRequestOptions]] */
  public async getContentSetSize(_token: IModelRpcProps, _options: ContentRpcRequestOptions, _descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, _keys: KeySetJSON): PresentationRpcResponse<number>;
  /** @beta */
  public async getContentSetSize(_token: IModelRpcProps, _options: ExtendedContentRpcRequestOptions): PresentationRpcResponse<number>;
  public async getContentSetSize(_token: IModelRpcProps, _options: ContentRpcRequestOptions | ExtendedContentRpcRequestOptions, _descriptorOrOverrides?: DescriptorJSON | DescriptorOverrides, _keys?: KeySetJSON): PresentationRpcResponse<number> { return this.forward(arguments); }

  /** @deprecated Use [[getPagedContent]] or [[getPagedContentSet]] */
  public async getContent(_token: IModelRpcProps, _options: ContentRpcRequestOptions, _descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, _keys: KeySetJSON): PresentationRpcResponse<ContentJSON | undefined> { return this.forward(arguments); }
  /** @deprecated Use [[getPagedContent]] or [[getPagedContentSet]] */
  public async getContentAndSize(_token: IModelRpcProps, _options: ContentRpcRequestOptions, _descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, _keys: KeySetJSON): PresentationRpcResponse<{ content?: ContentJSON, size: number }> { return this.forward(arguments); }
  /** @beta */
  public async getPagedContent(_token: IModelRpcProps, _options: Paged<ExtendedContentRpcRequestOptions>): PresentationRpcResponse<{ descriptor: DescriptorJSON, contentSet: PagedResponse<ItemJSON> } | undefined> { return this.forward(arguments); }
  /** @beta */
  public async getPagedContentSet(_token: IModelRpcProps, _options: Paged<ExtendedContentRpcRequestOptions>): PresentationRpcResponse<PagedResponse<ItemJSON>> { return this.forward(arguments); }

  // TODO: deprecate when [[getPagedDistinctValues]] starts supporting related content and becomes @beta (#370762)
  public async getDistinctValues(_token: IModelRpcProps, _options: ContentRpcRequestOptions, _descriptor: DescriptorJSON | DescriptorOverrides, _keys: KeySetJSON, _fieldName: string, _maximumValueCount: number): PresentationRpcResponse<string[]> { return this.forward(arguments); }
  /** @alpha */
  public async getPagedDistinctValues(_token: IModelRpcProps, _options: DistinctValuesRpcRequestOptions): PresentationRpcResponse<PagedResponse<DisplayValueGroupJSON>> { return this.forward(arguments); }

  /** @deprecated Use an overload with [[DisplayLabelRpcRequestOptions]] */
  public async getDisplayLabelDefinition(_token: IModelRpcProps, _options: LabelRpcRequestOptions, _key: InstanceKeyJSON): PresentationRpcResponse<LabelDefinitionJSON>;
  /** @beta */
  public async getDisplayLabelDefinition(_token: IModelRpcProps, _options: DisplayLabelRpcRequestOptions): PresentationRpcResponse<LabelDefinitionJSON>;
  public async getDisplayLabelDefinition(_token: IModelRpcProps, _options: LabelRpcRequestOptions | DisplayLabelRpcRequestOptions, _key?: InstanceKeyJSON): PresentationRpcResponse<LabelDefinitionJSON> { return this.forward(arguments); }

  /** @deprecated Use [[getPagedDisplayLabelDefinitions]] */
  public async getDisplayLabelDefinitions(_token: IModelRpcProps, _options: LabelRpcRequestOptions, _keys: InstanceKeyJSON[]): PresentationRpcResponse<LabelDefinitionJSON[]> { return this.forward(arguments); }
  /** @beta */
  public async getPagedDisplayLabelDefinitions(_token: IModelRpcProps, _options: DisplayLabelsRpcRequestOptions): PresentationRpcResponse<PagedResponse<LabelDefinitionJSON>> { return this.forward(arguments); }

  public async getSelectionScopes(_token: IModelRpcProps, _options: SelectionScopeRpcRequestOptions): PresentationRpcResponse<SelectionScope[]> { return this.forward(arguments); }
  // TODO: need to enforce paging on this
  public async computeSelection(_token: IModelRpcProps, _options: SelectionScopeRpcRequestOptions, _ids: Id64String[], _scopeId: string): PresentationRpcResponse<KeySetJSON> { return this.forward(arguments); }

  /** @alpha @deprecated Use [[compareHierarchiesPaged]] */
  public async compareHierarchies(_token: IModelRpcProps, _options: PresentationDataCompareRpcOptions): PresentationRpcResponse<PartialHierarchyModificationJSON[]> { return this.forward(arguments); }

  /** @alpha */
  public async compareHierarchiesPaged(_token: IModelRpcProps, _options: PresentationDataCompareRpcOptions): PresentationRpcResponse<HierarchyCompareInfoJSON> { return this.forward(arguments); }
}

/** @alpha */
export enum PresentationIpcEvents {
  /**
   * ID of an event that's emitted when backend detects changes in presented data.
   */
  Update = "presentation.onUpdate",
}
