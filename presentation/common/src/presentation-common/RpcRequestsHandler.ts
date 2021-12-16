/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { Guid, Id64String, IDisposable } from "@itwin/core-bentley";
import { IModelRpcProps, RpcManager } from "@itwin/core-common";
import { DescriptorJSON, DescriptorOverrides } from "./content/Descriptor";
import { ItemJSON } from "./content/Item";
import { DisplayValueGroupJSON } from "./content/Value";
import { DiagnosticsScopeLogs } from "./Diagnostics";
import { InstanceKeyJSON } from "./EC";
import { ElementProperties } from "./ElementProperties";
import { PresentationError, PresentationStatus } from "./Error";
import { NodeKeyJSON } from "./hierarchy/Key";
import { NodeJSON } from "./hierarchy/Node";
import { NodePathElementJSON } from "./hierarchy/NodePathElement";
import { KeySetJSON } from "./KeySet";
import { LabelDefinitionJSON } from "./LabelDefinition";
import {
  ContentDescriptorRequestOptions, ContentInstanceKeysRequestOptions, ContentRequestOptions, ContentSourcesRequestOptions, DisplayLabelRequestOptions,
  DisplayLabelsRequestOptions, DistinctValuesRequestOptions, FilterByInstancePathsHierarchyRequestOptions,
  FilterByTextHierarchyRequestOptions, HierarchyRequestOptions, Paged, RequestOptions,
  SelectionScopeRequestOptions, SingleElementPropertiesRequestOptions,
} from "./PresentationManagerOptions";
import {
  ContentSourcesRpcResult, PresentationRpcInterface, PresentationRpcRequestOptions, PresentationRpcResponse,
} from "./PresentationRpcInterface";
import { RulesetVariableJSON } from "./RulesetVariables";
import { SelectionScope } from "./selection/SelectionScope";
import { PagedResponse } from "./Utils";

/**
 * Configuration parameters for [[RpcRequestsHandler]].
 *
 * @internal
 */
export interface RpcRequestsHandlerProps {
  /**
   * Optional ID used to identify client that requests data. If not specified,
   * the handler creates a unique GUID as a client id.
   * @internal
   */
  clientId?: string;
}

/**
 * RPC requests handler that wraps [[PresentationRpcInterface]] and
 * adds handling for cases when backend needs to be synced with client
 * state.
 *
 * @internal
 */
export class RpcRequestsHandler implements IDisposable {
  private _maxRequestRepeatCount: number = 5;

  /** ID that identifies this handler as a client */
  public readonly clientId: string;

  public constructor(props?: RpcRequestsHandlerProps) {
    this.clientId = (props && props.clientId) ? props.clientId : Guid.createValue();
  }

  public dispose() {
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private get rpcClient(): PresentationRpcInterface { return RpcManager.getClientForInterface(PresentationRpcInterface); }

  private async requestRepeatedly<TResult>(func: () => PresentationRpcResponse<TResult>, diagnosticsHandler?: (logs: DiagnosticsScopeLogs[]) => void, repeatCount: number = 1): Promise<TResult> {
    let diagnostics: DiagnosticsScopeLogs[] | undefined;
    let error: unknown | undefined;
    let shouldRepeat = false;
    try {
      const response = await func();
      diagnostics = response.diagnostics;

      if (response.statusCode === PresentationStatus.Success)
        return response.result!;

      if (response.statusCode === PresentationStatus.BackendTimeout && repeatCount < this._maxRequestRepeatCount)
        shouldRepeat = true;
      else
        error = new PresentationError(response.statusCode, response.errorMessage);

    } catch (e) {
      error = e;
      if (repeatCount < this._maxRequestRepeatCount)
        shouldRepeat = true;

    } finally {
      if (diagnosticsHandler && diagnostics)
        diagnosticsHandler(diagnostics);
    }

    if (shouldRepeat) {
      ++repeatCount;
      return this.requestRepeatedly(func, diagnosticsHandler, repeatCount);
    }

    throw error;
  }

  /**
   * Send the request to backend.
   *
   * If the backend responds with [[PresentationStatus.BackendTimeout]] or there's an RPC-related error,
   * the request is repeated up to `this._maxRequestRepeatCount` times. If we fail to get a valid success or error
   * response from the backend, throw the last encountered error.
   *
   * @internal
   */
  public async request<TResult, TOptions extends RequestOptions<IModelRpcProps>, TArg = any>(
    func: (token: IModelRpcProps, options: PresentationRpcRequestOptions<TOptions>, ...args: TArg[]) => PresentationRpcResponse<TResult>,
    options: TOptions,
    ...additionalOptions: TArg[]): Promise<TResult> {
    const { imodel, diagnostics, ...optionsNoIModel } = options;
    const { handler: diagnosticsHandler, ...diagnosticsOptions } = diagnostics ?? {};
    const rpcOptions: PresentationRpcRequestOptions<TOptions> = {
      ...optionsNoIModel,
      clientId: this.clientId,
    };
    if (diagnostics)
      rpcOptions.diagnostics = diagnosticsOptions;
    const doRequest = async () => func(imodel, rpcOptions, ...additionalOptions);
    return this.requestRepeatedly(doRequest, diagnosticsHandler);
  }

  public async getNodesCount(options: HierarchyRequestOptions<IModelRpcProps, NodeKeyJSON, RulesetVariableJSON>): Promise<number> {
    return this.request<number, HierarchyRequestOptions<IModelRpcProps, NodeKeyJSON, RulesetVariableJSON>>(
      this.rpcClient.getNodesCount.bind(this.rpcClient), options);
  }
  public async getPagedNodes(options: Paged<HierarchyRequestOptions<IModelRpcProps, NodeKeyJSON, RulesetVariableJSON>>): Promise<PagedResponse<NodeJSON>> {
    return this.request<PagedResponse<NodeJSON>, Paged<HierarchyRequestOptions<IModelRpcProps, NodeKeyJSON, RulesetVariableJSON>>>(
      this.rpcClient.getPagedNodes.bind(this.rpcClient), options);
  }

  public async getNodePaths(options: FilterByInstancePathsHierarchyRequestOptions<IModelRpcProps, RulesetVariableJSON>): Promise<NodePathElementJSON[]> {
    return this.request<NodePathElementJSON[], FilterByInstancePathsHierarchyRequestOptions<IModelRpcProps, RulesetVariableJSON>>(
      this.rpcClient.getNodePaths.bind(this.rpcClient), options);
  }
  public async getFilteredNodePaths(options: FilterByTextHierarchyRequestOptions<IModelRpcProps, RulesetVariableJSON>): Promise<NodePathElementJSON[]> {
    return this.request<NodePathElementJSON[], FilterByTextHierarchyRequestOptions<IModelRpcProps, RulesetVariableJSON>>(
      this.rpcClient.getFilteredNodePaths.bind(this.rpcClient), options);
  }

  public async getContentSources(options: ContentSourcesRequestOptions<IModelRpcProps>): Promise<ContentSourcesRpcResult> {
    return this.request<ContentSourcesRpcResult, ContentSourcesRequestOptions<IModelRpcProps>>(
      this.rpcClient.getContentSources.bind(this.rpcClient), options);
  }
  public async getContentDescriptor(options: ContentDescriptorRequestOptions<IModelRpcProps, KeySetJSON, RulesetVariableJSON>): Promise<DescriptorJSON | undefined> {
    return this.request<DescriptorJSON | undefined, ContentDescriptorRequestOptions<IModelRpcProps, KeySetJSON, RulesetVariableJSON>>(
      this.rpcClient.getContentDescriptor.bind(this.rpcClient), options);
  }
  public async getContentSetSize(options: ContentRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON>): Promise<number> {
    return this.request<number, ContentRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON>>(
      this.rpcClient.getContentSetSize.bind(this.rpcClient), options);
  }
  public async getPagedContent(options: Paged<ContentRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON>>) {
    return this.request<{ descriptor: DescriptorJSON, contentSet: PagedResponse<ItemJSON> } | undefined, Paged<ContentRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON>>>(
      this.rpcClient.getPagedContent.bind(this.rpcClient), options);
  }
  public async getPagedContentSet(options: Paged<ContentRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON>>) {
    return this.request<PagedResponse<ItemJSON>, Paged<ContentRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON>>>(
      this.rpcClient.getPagedContentSet.bind(this.rpcClient), options);
  }

  public async getPagedDistinctValues(options: DistinctValuesRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON>): Promise<PagedResponse<DisplayValueGroupJSON>> {
    return this.request<PagedResponse<DisplayValueGroupJSON>, DistinctValuesRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON>>(
      this.rpcClient.getPagedDistinctValues.bind(this.rpcClient), options);
  }

  public async getElementProperties(options: SingleElementPropertiesRequestOptions<IModelRpcProps>): Promise<ElementProperties | undefined> {
    return this.request<ElementProperties | undefined, SingleElementPropertiesRequestOptions<IModelRpcProps>>(
      this.rpcClient.getElementProperties.bind(this.rpcClient), options);
  }

  public async getContentInstanceKeys(options: ContentInstanceKeysRequestOptions<IModelRpcProps, KeySetJSON, RulesetVariableJSON>): Promise<{ total: number, items: KeySetJSON }> {
    return this.request<{ total: number, items: KeySetJSON }, ContentInstanceKeysRequestOptions<IModelRpcProps, KeySetJSON, RulesetVariableJSON>>(
      this.rpcClient.getContentInstanceKeys.bind(this.rpcClient), options);
  }

  public async getDisplayLabelDefinition(options: DisplayLabelRequestOptions<IModelRpcProps, InstanceKeyJSON>): Promise<LabelDefinitionJSON> {
    return this.request<LabelDefinitionJSON, DisplayLabelRequestOptions<IModelRpcProps, InstanceKeyJSON>, any>(
      this.rpcClient.getDisplayLabelDefinition.bind(this.rpcClient), options);
  }
  public async getPagedDisplayLabelDefinitions(options: DisplayLabelsRequestOptions<IModelRpcProps, InstanceKeyJSON>): Promise<PagedResponse<LabelDefinitionJSON>> {
    return this.request<PagedResponse<LabelDefinitionJSON>, DisplayLabelsRequestOptions<IModelRpcProps, InstanceKeyJSON>, any>(
      this.rpcClient.getPagedDisplayLabelDefinitions.bind(this.rpcClient), options);
  }

  public async getSelectionScopes(options: SelectionScopeRequestOptions<IModelRpcProps>): Promise<SelectionScope[]> {
    return this.request<SelectionScope[], SelectionScopeRequestOptions<IModelRpcProps>>(
      this.rpcClient.getSelectionScopes.bind(this.rpcClient), options);
  }
  public async computeSelection(options: SelectionScopeRequestOptions<IModelRpcProps>, ids: Id64String[], scopeId: string): Promise<KeySetJSON> {
    return this.request<KeySetJSON, SelectionScopeRequestOptions<IModelRpcProps>>(
      this.rpcClient.computeSelection.bind(this.rpcClient), options, ids, scopeId);
  }
}
