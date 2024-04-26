/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { Id64String } from "@itwin/core-bentley";
import { IModelRpcProps, RpcInterface, RpcOperation } from "@itwin/core-common";
import { DescriptorJSON, DescriptorOverrides, SelectClassInfoJSON } from "./content/Descriptor";
import { ItemJSON } from "./content/Item";
import { DisplayValueGroupJSON } from "./content/Value";
import { ClientDiagnostics, ClientDiagnosticsOptions } from "./Diagnostics";
import { CompressedClassInfoJSON, InstanceKey } from "./EC";
import { ElementProperties } from "./ElementProperties";
import { PresentationStatus } from "./Error";
import { NodeKey } from "./hierarchy/Key";
import { NodeJSON } from "./hierarchy/Node";
import { NodePathElementJSON } from "./hierarchy/NodePathElement";
import { KeySetJSON } from "./KeySet";
import { LabelDefinition } from "./LabelDefinition";
import {
  ComputeSelectionRequestOptions,
  ContentDescriptorRequestOptions,
  ContentInstanceKeysRequestOptions,
  ContentRequestOptions,
  ContentSourcesRequestOptions,
  DisplayLabelRequestOptions,
  DisplayLabelsRequestOptions,
  DistinctValuesRequestOptions,
  FilterByInstancePathsHierarchyRequestOptions,
  FilterByTextHierarchyRequestOptions,
  HierarchyLevelDescriptorRequestOptions,
  HierarchyRequestOptions,
  Paged,
  SelectionScopeRequestOptions,
  SingleElementPropertiesRequestOptions,
} from "./PresentationManagerOptions";
import { RulesetVariableJSON } from "./RulesetVariables";
import { SelectionScope } from "./selection/SelectionScope";
import { Omit, PagedResponse } from "./Utils";

/**
 * Base options for all presentation RPC requests.
 * @public
 */
export type PresentationRpcRequestOptions<TManagerRequestOptions> = Omit<TManagerRequestOptions, "imodel" | "diagnostics"> & {
  /** @internal ID of the client requesting data */
  clientId?: string;
  /**
   * RPC request diagnostics options.
   * @beta
   */
  diagnostics?: RpcDiagnosticsOptions;
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
  /**
   * Diagnostics response.
   * @beta
   */
  diagnostics?: ClientDiagnostics;
}

/**
 * Data structure for RPC diagnostics options.
 * @beta
 */
export type RpcDiagnosticsOptions = Omit<ClientDiagnosticsOptions, "handler">;

/**
 * A promise of [[PresentationRpcResponseData]].
 * @public
 */
export type PresentationRpcResponse<TResult = undefined> = Promise<PresentationRpcResponseData<TResult>>;

/**
 * Data structure for hierarchy request options.
 * @public
 */
export type HierarchyRpcRequestOptions = PresentationRpcRequestOptions<HierarchyRequestOptions<never, NodeKey, RulesetVariableJSON>>;

/**
 * Data structure for hierarchy level descriptor RPC request options.
 * @beta
 */
export type HierarchyLevelDescriptorRpcRequestOptions = PresentationRpcRequestOptions<
  HierarchyLevelDescriptorRequestOptions<never, NodeKey, RulesetVariableJSON>
>;

/**
 * Data structure for filtering hierarchy by ECInstance paths request options.
 * @public
 */
export type FilterByInstancePathsHierarchyRpcRequestOptions = PresentationRpcRequestOptions<
  FilterByInstancePathsHierarchyRequestOptions<never, RulesetVariableJSON>
>;

/**
 * Data structure for filtering hierarchy by text request options.
 * @public
 */
export type FilterByTextHierarchyRpcRequestOptions = PresentationRpcRequestOptions<FilterByTextHierarchyRequestOptions<never, RulesetVariableJSON>>;

/**
 * Data structure for content sources RPC request options.
 * @public
 */
export type ContentSourcesRpcRequestOptions = PresentationRpcRequestOptions<ContentSourcesRequestOptions<never>>;
/**
 * Data structure for content sources RPC response.
 * @public
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
 * @public
 */
export type SingleElementPropertiesRpcRequestOptions = PresentationRpcRequestOptions<SingleElementPropertiesRequestOptions<never>>;

/**
 * Data structure for distinct values' request options.
 * @public
 */
export type DistinctValuesRpcRequestOptions = PresentationRpcRequestOptions<
  DistinctValuesRequestOptions<never, DescriptorOverrides, KeySetJSON, RulesetVariableJSON>
>;

/**
 * Data structure for content instance keys' request options.
 * @public
 */
export type ContentInstanceKeysRpcRequestOptions = PresentationRpcRequestOptions<ContentInstanceKeysRequestOptions<never, KeySetJSON, RulesetVariableJSON>>;

/**
 * Data structure for label request options.
 * @public
 */
export type DisplayLabelRpcRequestOptions = PresentationRpcRequestOptions<DisplayLabelRequestOptions<never, InstanceKey>>;

/**
 * Data structure for labels request options.
 * @public
 */
export type DisplayLabelsRpcRequestOptions = PresentationRpcRequestOptions<DisplayLabelsRequestOptions<never, InstanceKey>>;

/**
 * Data structure for selection scope request options.
 * @public
 */
export type SelectionScopeRpcRequestOptions = PresentationRpcRequestOptions<SelectionScopeRequestOptions<never>>;

/**
 * Request options data structure for computing selection based on given selection scope and element IDs.
 * @public
 */
export type ComputeSelectionRpcRequestOptions = PresentationRpcRequestOptions<ComputeSelectionRequestOptions<never>>;

/**
 * Interface used for communication between Presentation backend and frontend.
 * @public
 */
export class PresentationRpcInterface extends RpcInterface {
  // eslint-disable-line deprecation/deprecation
  /** The immutable name of the interface. */
  public static readonly interfaceName = "PresentationRpcInterface"; // eslint-disable-line @typescript-eslint/naming-convention

  /** The semantic version of the interface. */
  public static interfaceVersion = "4.1.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in core/common/src/rpc for the semantic versioning rules.
  ===========================================================================================*/

  public async getNodesCount(_token: IModelRpcProps, _options: HierarchyRpcRequestOptions): PresentationRpcResponse<number> {
    return this.forward(arguments);
  }

  @RpcOperation.setPolicy({ allowResponseCompression: true })
  // eslint-disable-next-line deprecation/deprecation
  public async getPagedNodes(_token: IModelRpcProps, _options: Paged<HierarchyRpcRequestOptions>): PresentationRpcResponse<PagedResponse<NodeJSON>> {
    return this.forward(arguments);
  }

  /** @beta */
  @RpcOperation.setPolicy({ allowResponseCompression: true })
  public async getNodesDescriptor(
    _token: IModelRpcProps,
    _options: HierarchyLevelDescriptorRpcRequestOptions,
  ): PresentationRpcResponse<string | DescriptorJSON | undefined> {
    return this.forward(arguments);
  }

  // TODO: add paged version of this (#387280)
  @RpcOperation.setPolicy({ allowResponseCompression: true })
  // eslint-disable-next-line deprecation/deprecation
  public async getNodePaths(_token: IModelRpcProps, _options: FilterByInstancePathsHierarchyRpcRequestOptions): PresentationRpcResponse<NodePathElementJSON[]> {
    return this.forward(arguments);
  }

  // TODO: add paged version of this (#387280)
  @RpcOperation.setPolicy({ allowResponseCompression: true })
  // eslint-disable-next-line deprecation/deprecation
  public async getFilteredNodePaths(_token: IModelRpcProps, _options: FilterByTextHierarchyRpcRequestOptions): PresentationRpcResponse<NodePathElementJSON[]> {
    return this.forward(arguments);
  }

  @RpcOperation.setPolicy({ allowResponseCompression: true })
  public async getContentSources(_token: IModelRpcProps, _options: ContentSourcesRpcRequestOptions): PresentationRpcResponse<ContentSourcesRpcResult> {
    return this.forward(arguments);
  }

  @RpcOperation.setPolicy({ allowResponseCompression: true })
  public async getContentDescriptor(_token: IModelRpcProps, _options: ContentDescriptorRpcRequestOptions): PresentationRpcResponse<DescriptorJSON | undefined> {
    arguments[1] = { ...arguments[1], transport: "unparsed-json" };
    const response: PresentationRpcResponseData<DescriptorJSON | string | undefined> = await this.forward(arguments);
    if (response.statusCode === PresentationStatus.Success && typeof response.result === "string") {
      response.result = JSON.parse(response.result);
    }
    return response as PresentationRpcResponseData<DescriptorJSON | undefined>;
  }

  public async getContentSetSize(_token: IModelRpcProps, _options: ContentRpcRequestOptions): PresentationRpcResponse<number> {
    return this.forward(arguments);
  }

  @RpcOperation.setPolicy({ allowResponseCompression: true })
  public async getPagedContent(
    _token: IModelRpcProps,
    _options: Paged<ContentRpcRequestOptions>,
  ): PresentationRpcResponse<{ descriptor: DescriptorJSON; contentSet: PagedResponse<ItemJSON> } | undefined> {
    return this.forward(arguments);
  }

  @RpcOperation.setPolicy({ allowResponseCompression: true })
  public async getPagedContentSet(_token: IModelRpcProps, _options: Paged<ContentRpcRequestOptions>): PresentationRpcResponse<PagedResponse<ItemJSON>> {
    return this.forward(arguments);
  }

  @RpcOperation.setPolicy({ allowResponseCompression: true })
  public async getElementProperties(
    _token: IModelRpcProps,
    _options: SingleElementPropertiesRpcRequestOptions,
  ): PresentationRpcResponse<ElementProperties | undefined> {
    return this.forward(arguments);
  }

  @RpcOperation.setPolicy({ allowResponseCompression: true })
  public async getPagedDistinctValues(
    _token: IModelRpcProps,
    _options: DistinctValuesRpcRequestOptions,
    // eslint-disable-next-line deprecation/deprecation
  ): PresentationRpcResponse<PagedResponse<DisplayValueGroupJSON>> {
    return this.forward(arguments);
  }

  public async getContentInstanceKeys(
    _token: IModelRpcProps,
    _options: ContentInstanceKeysRpcRequestOptions,
  ): PresentationRpcResponse<{ total: number; items: KeySetJSON }> {
    return this.forward(arguments);
  }

  public async getDisplayLabelDefinition(_token: IModelRpcProps, _options: DisplayLabelRpcRequestOptions): PresentationRpcResponse<LabelDefinition> {
    return this.forward(arguments);
  }

  @RpcOperation.setPolicy({ allowResponseCompression: true })
  public async getPagedDisplayLabelDefinitions(
    _token: IModelRpcProps,
    _options: DisplayLabelsRpcRequestOptions,
  ): PresentationRpcResponse<PagedResponse<LabelDefinition>> {
    return this.forward(arguments);
  }

  public async getSelectionScopes(_token: IModelRpcProps, _options: SelectionScopeRpcRequestOptions): PresentationRpcResponse<SelectionScope[]> {
    return this.forward(arguments);
  }

  /** @deprecated in 3.x. Use the override with [[ComputeSelectionRpcRequestOptions]]. */
  public async computeSelection(
    _token: IModelRpcProps,
    _options: SelectionScopeRpcRequestOptions,
    _ids: Id64String[],
    _scopeId: string,
  ): PresentationRpcResponse<KeySetJSON>;
  public async computeSelection(_token: IModelRpcProps, _options: ComputeSelectionRpcRequestOptions): PresentationRpcResponse<KeySetJSON>;
  @RpcOperation.setPolicy({ allowResponseCompression: true })
  public async computeSelection(
    _token: IModelRpcProps,
    _options: ComputeSelectionRpcRequestOptions | SelectionScopeRpcRequestOptions,
    _ids?: Id64String[],
    _scopeId?: string,
  ): PresentationRpcResponse<KeySetJSON> {
    return this.forward(arguments);
  }
}

/** @internal */
export enum PresentationIpcEvents {
  /**
   * ID of an event that's emitted when backend detects changes in presented data.
   */
  Update = "presentation.onUpdate",
}
