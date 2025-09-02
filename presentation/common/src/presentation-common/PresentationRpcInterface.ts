/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */
/** @packageDocumentation
 * @module RPC
 */

import { Id64String } from "@itwin/core-bentley";
import { IModelRpcProps, RpcInterface, RpcOperation } from "@itwin/core-common";
import { DescriptorJSON, DescriptorOverrides, SelectClassInfoJSON } from "./content/Descriptor.js";
import { ItemJSON } from "./content/Item.js";
import { DisplayValueGroup } from "./content/Value.js";
import { ClientDiagnostics, ClientDiagnosticsOptions } from "./Diagnostics.js";
import { CompressedClassInfoJSON, InstanceKey } from "./EC.js";
import { ElementProperties } from "./ElementProperties.js";
import { PresentationStatus } from "./Error.js";
import { NodeKey } from "./hierarchy/Key.js";
import { Node } from "./hierarchy/Node.js";
import { NodePathElement } from "./hierarchy/NodePathElement.js";
import { KeySetJSON } from "./KeySet.js";
import { LabelDefinition } from "./LabelDefinition.js";
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
} from "./PresentationManagerOptions.js";
import { RulesetVariableJSON } from "./RulesetVariables.js";
import { SelectionScope } from "./selection/SelectionScope.js";
import { deepReplaceNullsToUndefined, Omit, PagedResponse } from "./Utils.js";

/**
 * Base options for all presentation RPC requests.
 * @public
 */
export type PresentationRpcRequestOptions<TManagerRequestOptions> = Omit<TManagerRequestOptions, "imodel" | "diagnostics"> & {
  /** @internal ID of the client requesting data */
  clientId?: string;
  /** RPC request diagnostics options. */
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
  /** Diagnostics response. */
  diagnostics?: ClientDiagnostics;
}

/**
 * Data structure for RPC diagnostics options.
 * @public
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
 * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
 */
export type HierarchyRpcRequestOptions = PresentationRpcRequestOptions<HierarchyRequestOptions<never, NodeKey, RulesetVariableJSON>>;

/**
 * Data structure for hierarchy level descriptor RPC request options.
 * @public
 * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
 */
export type HierarchyLevelDescriptorRpcRequestOptions = PresentationRpcRequestOptions<
  HierarchyLevelDescriptorRequestOptions<never, NodeKey, RulesetVariableJSON>
>;

/**
 * Data structure for filtering hierarchy by ECInstance paths request options.
 * @public
 * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
 */
export type FilterByInstancePathsHierarchyRpcRequestOptions = PresentationRpcRequestOptions<
  FilterByInstancePathsHierarchyRequestOptions<never, RulesetVariableJSON>
>;

/**
 * Data structure for filtering hierarchy by text request options.
 * @public
 * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
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
export type SingleElementPropertiesRpcRequestOptions = PresentationRpcRequestOptions<
  Omit<SingleElementPropertiesRequestOptions<never, never>, "contentParser">
>;

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
 * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use `computeSelection` from [@itwin/unified-selection](https://github.com/iTwin/presentation/blob/master/packages/unified-selection/README.md#selection-scopes) package instead.
 */
export type SelectionScopeRpcRequestOptions = PresentationRpcRequestOptions<SelectionScopeRequestOptions<never>>;

/**
 * Request options data structure for computing selection based on given selection scope and element IDs.
 * @public
 * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use `computeSelection` from [@itwin/unified-selection](https://github.com/iTwin/presentation/blob/master/packages/unified-selection/README.md#selection-scopes) package instead.
 */
export type ComputeSelectionRpcRequestOptions = PresentationRpcRequestOptions<ComputeSelectionRequestOptions<never>>;

/**
 * Interface used for communication between Presentation backend and frontend.
 * @public
 */
@RpcOperation.setDefaultPolicy({ retryInterval: () => 0 })
export class PresentationRpcInterface extends RpcInterface {
  /** The immutable name of the interface. */
  public static readonly interfaceName = "PresentationRpcInterface";

  /** The semantic version of the interface. */
  public static interfaceVersion = "5.0.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in core/common/src/rpc for the semantic versioning rules.
  ===========================================================================================*/

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getNodesCount(_token: IModelRpcProps, _options: HierarchyRpcRequestOptions): PresentationRpcResponse<number> {
    return this.forward(arguments);
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getPagedNodes(_token: IModelRpcProps, _options: Paged<HierarchyRpcRequestOptions>): PresentationRpcResponse<PagedResponse<Node>> {
    return deepReplaceNullsToUndefined(await this.forward(arguments));
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getNodesDescriptor(
    _token: IModelRpcProps,
    _options: HierarchyLevelDescriptorRpcRequestOptions,
  ): PresentationRpcResponse<string | DescriptorJSON | undefined> {
    return deepReplaceNullsToUndefined(await this.forward(arguments));
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  // TODO: add paged version of this (#387280)
  public async getNodePaths(_token: IModelRpcProps, _options: FilterByInstancePathsHierarchyRpcRequestOptions): PresentationRpcResponse<NodePathElement[]> {
    return deepReplaceNullsToUndefined(await this.forward(arguments));
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  // TODO: add paged version of this (#387280)
  public async getFilteredNodePaths(_token: IModelRpcProps, _options: FilterByTextHierarchyRpcRequestOptions): PresentationRpcResponse<NodePathElement[]> {
    return deepReplaceNullsToUndefined(await this.forward(arguments));
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getContentSources(_token: IModelRpcProps, _options: ContentSourcesRpcRequestOptions): PresentationRpcResponse<ContentSourcesRpcResult> {
    return deepReplaceNullsToUndefined(await this.forward(arguments));
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getContentDescriptor(_token: IModelRpcProps, _options: ContentDescriptorRpcRequestOptions): PresentationRpcResponse<DescriptorJSON | undefined> {
    const response: PresentationRpcResponseData<string | undefined> = await this.forward(arguments);
    return {
      ...response,
      ...(response.result ? { result: JSON.parse(response.result) } : {}),
    };
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getContentSetSize(_token: IModelRpcProps, _options: ContentRpcRequestOptions): PresentationRpcResponse<number> {
    return this.forward(arguments);
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getPagedContent(
    _token: IModelRpcProps,
    _options: Paged<ContentRpcRequestOptions>,
  ): PresentationRpcResponse<{ descriptor: DescriptorJSON; contentSet: PagedResponse<ItemJSON> } | undefined> {
    const rpcResponse = await this.forward(arguments);
    return {
      ...rpcResponse,
      ...(rpcResponse.result
        ? /* c8 ignore next */ { result: { ...rpcResponse.result, contentSet: deepReplaceNullsToUndefined(rpcResponse.result.contentSet) } }
        : {}),
    };
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getPagedContentSet(_token: IModelRpcProps, _options: Paged<ContentRpcRequestOptions>): PresentationRpcResponse<PagedResponse<ItemJSON>> {
    return deepReplaceNullsToUndefined(await this.forward(arguments));
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getElementProperties(
    _token: IModelRpcProps,
    _options: SingleElementPropertiesRpcRequestOptions,
  ): PresentationRpcResponse<ElementProperties | undefined> {
    return deepReplaceNullsToUndefined(await this.forward(arguments));
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getPagedDistinctValues(
    _token: IModelRpcProps,
    _options: DistinctValuesRpcRequestOptions,
  ): PresentationRpcResponse<PagedResponse<DisplayValueGroup>> {
    return deepReplaceNullsToUndefined(await this.forward(arguments));
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getContentInstanceKeys(
    _token: IModelRpcProps,
    _options: ContentInstanceKeysRpcRequestOptions,
  ): PresentationRpcResponse<{ total: number; items: KeySetJSON }> {
    return this.forward(arguments);
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getDisplayLabelDefinition(_token: IModelRpcProps, _options: DisplayLabelRpcRequestOptions): PresentationRpcResponse<LabelDefinition> {
    return deepReplaceNullsToUndefined(await this.forward(arguments));
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getPagedDisplayLabelDefinitions(
    _token: IModelRpcProps,
    _options: DisplayLabelsRpcRequestOptions,
  ): PresentationRpcResponse<PagedResponse<LabelDefinition>> {
    return deepReplaceNullsToUndefined(await this.forward(arguments));
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async getSelectionScopes(_token: IModelRpcProps, _options: SelectionScopeRpcRequestOptions): PresentationRpcResponse<SelectionScope[]> {
    return this.forward(arguments);
  }

  /** @deprecated in 4.10 - will not be removed until after 2026-06-13. Use [PresentationManager]($presentation-frontend) instead of calling the RPC interface directly. */
  public async computeSelection(_token: IModelRpcProps, _options: ComputeSelectionRpcRequestOptions): PresentationRpcResponse<KeySetJSON> {
    return this.forward(arguments);
  }
}
