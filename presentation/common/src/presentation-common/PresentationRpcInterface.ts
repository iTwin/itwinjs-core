/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { RpcInterface, IModelRpcProps } from "@bentley/imodeljs-common";
import { NodeKeyJSON } from "./hierarchy/Key";
import { NodePathElementJSON } from "./hierarchy/NodePathElement";
import { NodeJSON } from "./hierarchy/Node";
import { LabelDefinitionJSON } from "./LabelDefinition";
import { SelectionInfo, DescriptorJSON, DescriptorOverrides } from "./content/Descriptor";
import { ContentJSON } from "./content/Content";
import {
  HierarchyRequestOptions, ContentRequestOptions,
  LabelRequestOptions, SelectionScopeRequestOptions, Paged,
} from "./PresentationManagerOptions";
import { KeySetJSON } from "./KeySet";
import { InstanceKeyJSON } from "./EC";
import { Omit } from "./Utils";
import { SelectionScope } from "./selection/SelectionScope";
import { PresentationStatus } from "./Error";

/**
 * Base options for all presentation RPC requests.
 * @public
 */
export type PresentationRpcRequestOptions<TManagerRequestOptions> = Omit<TManagerRequestOptions, "imodel"> & {
  /** ID of the client requesting data */
  clientId?: string;
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
}>;

/**
 * Data structure for hierarchy request options.
 * @public
 */
export type HierarchyRpcRequestOptions = PresentationRpcRequestOptions<HierarchyRequestOptions<any>>;
/**
 * Data structure for content request options.
 * @public
 */
export type ContentRpcRequestOptions = PresentationRpcRequestOptions<ContentRequestOptions<any>>;
/**
 * Data structure for label request options.
 * @public
 */
export type LabelRpcRequestOptions = PresentationRpcRequestOptions<LabelRequestOptions<any>>;
/**
 * Data structure for selection scope request options.
 * @public
 */
export type SelectionScopeRpcRequestOptions = PresentationRpcRequestOptions<SelectionScopeRequestOptions<any>>;
/**
 * Data structure for ruleset variable request options.
 * @public
 */
export type RulesetVariableRpcRequestOptions = PresentationRpcRequestOptions<{ rulesetId: string }>;

/**
 * Interface used for communication between Presentation backend and frontend.
 *
 * @public
 */
export class PresentationRpcInterface extends RpcInterface {
  /** The immutable name of the interface. */
  public static readonly interfaceName = "PresentationRpcInterface"; // tslint:disable-line: naming-convention

  /** The semantic version of the interface. */
  public static interfaceVersion = "2.0.1";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in core/common/src/rpc for the semantic versioning rules.
  ===========================================================================================*/

  public async getNodesAndCount(_token: IModelRpcProps, _options: Paged<HierarchyRpcRequestOptions>, _parentKey?: NodeKeyJSON): PresentationRpcResponse<{ nodes: NodeJSON[], count: number }> { return this.forward(arguments); }
  public async getNodes(_token: IModelRpcProps, _options: Paged<HierarchyRpcRequestOptions>, _parentKey?: NodeKeyJSON): PresentationRpcResponse<NodeJSON[]> { return this.forward(arguments); }
  public async getNodesCount(_token: IModelRpcProps, _options: HierarchyRpcRequestOptions, _parentKey?: NodeKeyJSON): PresentationRpcResponse<number> { return this.forward(arguments); }
  public async getNodePaths(_token: IModelRpcProps, _options: HierarchyRpcRequestOptions, _paths: InstanceKeyJSON[][], _markedIndex: number): PresentationRpcResponse<NodePathElementJSON[]> { return this.forward(arguments); }
  public async getFilteredNodePaths(_token: IModelRpcProps, _options: HierarchyRpcRequestOptions, _filterText: string): PresentationRpcResponse<NodePathElementJSON[]> { return this.forward(arguments); }
  /** @alpha Hierarchy loading performance needs to be improved before this becomes publicly available. */
  public async loadHierarchy(_token: IModelRpcProps, _options: HierarchyRpcRequestOptions): PresentationRpcResponse<void> { return this.forward(arguments); }

  public async getContentDescriptor(_token: IModelRpcProps, _options: ContentRpcRequestOptions, _displayType: string, _keys: KeySetJSON, _selection: SelectionInfo | undefined): PresentationRpcResponse<DescriptorJSON | undefined> { return this.forward(arguments); }
  public async getContentSetSize(_token: IModelRpcProps, _options: ContentRpcRequestOptions, _descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, _keys: KeySetJSON): PresentationRpcResponse<number> { return this.forward(arguments); }
  public async getContent(_token: IModelRpcProps, _options: ContentRpcRequestOptions, _descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, _keys: KeySetJSON): PresentationRpcResponse<ContentJSON | undefined> { return this.forward(arguments); }
  public async getContentAndSize(_token: IModelRpcProps, _options: ContentRpcRequestOptions, _descriptorOrOverrides: DescriptorJSON | DescriptorOverrides, _keys: KeySetJSON): PresentationRpcResponse<{ content?: ContentJSON, size: number }> { return this.forward(arguments); }
  public async getDistinctValues(_token: IModelRpcProps, _options: ContentRpcRequestOptions, _descriptor: DescriptorJSON, _keys: KeySetJSON, _fieldName: string, _maximumValueCount: number): PresentationRpcResponse<string[]> { return this.forward(arguments); }

  public async getDisplayLabelDefinition(_token: IModelRpcProps, _options: LabelRpcRequestOptions, _key: InstanceKeyJSON): PresentationRpcResponse<LabelDefinitionJSON> { return this.forward(arguments); }
  public async getDisplayLabelDefinitions(_token: IModelRpcProps, _options: LabelRpcRequestOptions, _keys: InstanceKeyJSON[]): PresentationRpcResponse<LabelDefinitionJSON[]> { return this.forward(arguments); }

  public async getSelectionScopes(_token: IModelRpcProps, _options: SelectionScopeRpcRequestOptions): PresentationRpcResponse<SelectionScope[]> { return this.forward(arguments); }
  public async computeSelection(_token: IModelRpcProps, _options: SelectionScopeRpcRequestOptions, _ids: Id64String[], _scopeId: string): PresentationRpcResponse<KeySetJSON> { return this.forward(arguments); }
}

/** @alpha */
export enum PresentationRpcEvents {
  /**
   * ID of an event that's emitted when backend detects changes in presented data.
   */
  Update = "OnUpdate",
}
