/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import type { Id64String } from "@itwin/core-bentley";
import type { IModelRpcProps} from "@itwin/core-common";
import { RpcInterface } from "@itwin/core-common";
import type { DescriptorJSON, DescriptorOverrides, SelectClassInfoJSON } from "./content/Descriptor";
import type { ItemJSON } from "./content/Item";
import type { DisplayValueGroupJSON } from "./content/Value";
import type { DiagnosticsOptions, DiagnosticsScopeLogs } from "./Diagnostics";
import type { CompressedClassInfoJSON, InstanceKeyJSON } from "./EC";
import type { ElementProperties } from "./ElementProperties";
import type { PresentationStatus } from "./Error";
import type { NodeKeyJSON } from "./hierarchy/Key";
import type { NodeJSON } from "./hierarchy/Node";
import type { NodePathElementJSON } from "./hierarchy/NodePathElement";
import type { KeySetJSON } from "./KeySet";
import type { LabelDefinitionJSON } from "./LabelDefinition";
import type {
  ContentDescriptorRequestOptions, ContentInstanceKeysRequestOptions, ContentRequestOptions, ContentSourcesRequestOptions, DisplayLabelRequestOptions,
  DisplayLabelsRequestOptions, DistinctValuesRequestOptions, FilterByInstancePathsHierarchyRequestOptions, FilterByTextHierarchyRequestOptions,
  HierarchyRequestOptions, Paged, SelectionScopeRequestOptions, SingleElementPropertiesRequestOptions,
} from "./PresentationManagerOptions";
import type { RulesetVariableJSON } from "./RulesetVariables";
import type { SelectionScope } from "./selection/SelectionScope";
import type { Omit, PagedResponse } from "./Utils";

/**
 * Base options for all presentation RPC requests.
 * @public
 */
export type PresentationRpcRequestOptions<TManagerRequestOptions> = Omit<TManagerRequestOptions, "imodel" | "diagnostics"> & {
  /** @internal ID of the client requesting data */
  clientId?: string;
  /** @alpha */
  diagnostics?: DiagnosticsOptions;
};

/**
 * Data structure for presentation RPC responses
 * @public
 */
export interface PresentationRpcResponseData<TResult = undefined> {
  /** Response status code */
  statusCode: PresentationStatus;
  /** In case of an error response, the error message */
  errorMessage?: string;
  /** In case of a success response, the result */
  result?: TResult;
  /** @alpha */
  diagnostics?: DiagnosticsScopeLogs[];
}

/**
 * A promise of [[PresentationRpcResponseData]].
 * @public
 */
export type PresentationRpcResponse<TResult = undefined> = Promise<PresentationRpcResponseData<TResult>>;

/**
 * Data structure for hierarchy request options.
 * @public
 */
export type HierarchyRpcRequestOptions = PresentationRpcRequestOptions<HierarchyRequestOptions<never, NodeKeyJSON, RulesetVariableJSON>>;

/**
 * Data structure for filtering hierarchy by ECInstance paths request options.
 * @public
 */
export type FilterByInstancePathsHierarchyRpcRequestOptions = PresentationRpcRequestOptions<FilterByInstancePathsHierarchyRequestOptions<never, RulesetVariableJSON>>;

/**
 * Data structure for filtering hierarchy by text request options.
 * @public
 */
export type FilterByTextHierarchyRpcRequestOptions = PresentationRpcRequestOptions<FilterByTextHierarchyRequestOptions<never, RulesetVariableJSON>>;

/**
 * Data structure for content sources RPC request options.
 * @beta
 */
export type ContentSourcesRpcRequestOptions = PresentationRpcRequestOptions<ContentSourcesRequestOptions<never>>;
/**
 * Data structure for content sources RPC response.
 * @beta
 */
export interface ContentSourcesRpcResult {
  /** A list of objects containing content source information. */
  sources: SelectClassInfoJSON<Id64String>[];
  /** An `ECClassId` => [[CompressedClassInfoJSON]] map for deserializing [[sources]]. */
  classesMap: { [id: string]: CompressedClassInfoJSON };
}

/**
 * Data structure for content descriptor RPC request options.
 * @public
 */
export type ContentDescriptorRpcRequestOptions = PresentationRpcRequestOptions<ContentDescriptorRequestOptions<never, KeySetJSON, RulesetVariableJSON>>;

/**
 * Data structure for content RPC request options.
 * @public
 */
export type ContentRpcRequestOptions = PresentationRpcRequestOptions<ContentRequestOptions<never, DescriptorOverrides, KeySetJSON, RulesetVariableJSON>>;

/**
 * Data structure for single element properties RPC request options.
 * @beta
 */
export type SingleElementPropertiesRpcRequestOptions = PresentationRpcRequestOptions<SingleElementPropertiesRequestOptions<never>>;

/**
 * Data structure for distinct values' request options.
 * @public
 */
export type DistinctValuesRpcRequestOptions = PresentationRpcRequestOptions<DistinctValuesRequestOptions<never, DescriptorOverrides, KeySetJSON, RulesetVariableJSON>>;

/**
 * Data structure for content instance keys' request options.
 * @beta
 */
export type ContentInstanceKeysRpcRequestOptions = PresentationRpcRequestOptions<ContentInstanceKeysRequestOptions<never, KeySetJSON, RulesetVariableJSON>>;

/**
 * Data structure for label request options.
 * @public
 */
export type DisplayLabelRpcRequestOptions = PresentationRpcRequestOptions<DisplayLabelRequestOptions<never, InstanceKeyJSON>>;

/**
 * Data structure for labels request options.
 * @public
 */
export type DisplayLabelsRpcRequestOptions = PresentationRpcRequestOptions<DisplayLabelsRequestOptions<never, InstanceKeyJSON>>;

/**
 * Data structure for selection scope request options.
 * @public
 */
export type SelectionScopeRpcRequestOptions = PresentationRpcRequestOptions<SelectionScopeRequestOptions<never>>;

/**
 * Interface used for communication between Presentation backend and frontend.
 * @public
 */
export class PresentationRpcInterface extends RpcInterface {
  /** The immutable name of the interface. */
  public static readonly interfaceName = "PresentationRpcInterface"; // eslint-disable-line @typescript-eslint/naming-convention

  /** The semantic version of the interface. */
  public static interfaceVersion = "3.0.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in core/common/src/rpc for the semantic versioning rules.
  ===========================================================================================*/

  public async getNodesCount(_token: IModelRpcProps, _options: HierarchyRpcRequestOptions): PresentationRpcResponse<number> { return this.forward(arguments); }
  public async getPagedNodes(_token: IModelRpcProps, _options: Paged<HierarchyRpcRequestOptions>): PresentationRpcResponse<PagedResponse<NodeJSON>> { return this.forward(arguments); }

  // TODO: add paged version of this (#387280)
  public async getNodePaths(_token: IModelRpcProps, _options: FilterByInstancePathsHierarchyRpcRequestOptions): PresentationRpcResponse<NodePathElementJSON[]> { return this.forward(arguments); }
  // TODO: add paged version of this (#387280)
  public async getFilteredNodePaths(_token: IModelRpcProps, _options: FilterByTextHierarchyRpcRequestOptions): PresentationRpcResponse<NodePathElementJSON[]> { return this.forward(arguments); }

  /** @beta */
  public async getContentSources(_token: IModelRpcProps, _options: ContentSourcesRpcRequestOptions): PresentationRpcResponse<ContentSourcesRpcResult> { return this.forward(arguments); }

  public async getContentDescriptor(_token: IModelRpcProps, _options: ContentDescriptorRpcRequestOptions): PresentationRpcResponse<DescriptorJSON | undefined> { return this.forward(arguments); }
  public async getContentSetSize(_token: IModelRpcProps, _options: ContentRpcRequestOptions): PresentationRpcResponse<number> { return this.forward(arguments); }
  public async getPagedContent(_token: IModelRpcProps, _options: Paged<ContentRpcRequestOptions>): PresentationRpcResponse<{ descriptor: DescriptorJSON, contentSet: PagedResponse<ItemJSON> } | undefined> { return this.forward(arguments); }
  public async getPagedContentSet(_token: IModelRpcProps, _options: Paged<ContentRpcRequestOptions>): PresentationRpcResponse<PagedResponse<ItemJSON>> { return this.forward(arguments); }

  /** @beta */
  public async getElementProperties(_token: IModelRpcProps, _options: SingleElementPropertiesRpcRequestOptions): PresentationRpcResponse<ElementProperties | undefined> { return this.forward(arguments); }

  public async getPagedDistinctValues(_token: IModelRpcProps, _options: DistinctValuesRpcRequestOptions): PresentationRpcResponse<PagedResponse<DisplayValueGroupJSON>> { return this.forward(arguments); }

  /** @beta */
  public async getContentInstanceKeys(_token: IModelRpcProps, _options: ContentInstanceKeysRpcRequestOptions): PresentationRpcResponse<{ total: number, items: KeySetJSON }> { return this.forward(arguments); }

  public async getDisplayLabelDefinition(_token: IModelRpcProps, _options: DisplayLabelRpcRequestOptions): PresentationRpcResponse<LabelDefinitionJSON> { return this.forward(arguments); }
  public async getPagedDisplayLabelDefinitions(_token: IModelRpcProps, _options: DisplayLabelsRpcRequestOptions): PresentationRpcResponse<PagedResponse<LabelDefinitionJSON>> { return this.forward(arguments); }

  public async getSelectionScopes(_token: IModelRpcProps, _options: SelectionScopeRpcRequestOptions): PresentationRpcResponse<SelectionScope[]> { return this.forward(arguments); }
  // TODO: need to enforce paging on this
  public async computeSelection(_token: IModelRpcProps, _options: SelectionScopeRpcRequestOptions, _ids: Id64String[], _scopeId: string): PresentationRpcResponse<KeySetJSON> { return this.forward(arguments); }
}

/** @alpha */
export enum PresentationIpcEvents {
  /**
   * ID of an event that's emitted when backend detects changes in presented data.
   */
  Update = "presentation.onUpdate",
}
