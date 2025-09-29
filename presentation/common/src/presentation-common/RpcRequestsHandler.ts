/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */
/** @packageDocumentation
 * @module RPC
 */

import { Guid, Logger } from "@itwin/core-bentley";
import { IModelRpcProps, RpcManager, RpcRequest } from "@itwin/core-common";
import { PresentationCommonLoggerCategory } from "./CommonLoggerCategory.js";
import { DescriptorJSON, DescriptorOverrides } from "./content/Descriptor.js";
import { ItemJSON } from "./content/Item.js";
import { ClientDiagnostics, ClientDiagnosticsAttribute, ClientDiagnosticsHandler } from "./Diagnostics.js";
import { InstanceKey } from "./EC.js";
import { PresentationError, PresentationStatus } from "./Error.js";
import { NodeKey } from "./hierarchy/Key.js";
import { Node } from "./hierarchy/Node.js";
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
  RequestOptions,
  RequestOptionsWithRuleset,
  SelectionScopeRequestOptions,
} from "./PresentationManagerOptions.js";
import { ContentSourcesRpcResult, PresentationRpcInterface, PresentationRpcRequestOptions, PresentationRpcResponse } from "./PresentationRpcInterface.js";
import { Ruleset } from "./rules/Ruleset.js";
import { RulesetVariableJSON } from "./RulesetVariables.js";
import { SelectionScope } from "./selection/SelectionScope.js";
import { createCancellableTimeoutPromise, PagedResponse } from "./Utils.js";
import { NodePathElement } from "./hierarchy/NodePathElement.js";
import { DisplayValueGroup } from "./content/Value.js";

/**
 * Default timeout for how long we're going to wait for RPC request to be fulfilled before throwing
 * a timeout error.
 */
const DEFAULT_REQUEST_TIMEOUT = 10 * 60 * 1000; // 10 minutes

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

  /** @internal */
  timeout?: number;
}

/**
 * RPC requests handler that wraps [[PresentationRpcInterface]] and
 * adds handling for cases when backend needs to be synced with client
 * state.
 *
 * @internal
 */
export class RpcRequestsHandler {
  /** Timeout for how long the handler going to wait for RPC request to be fulfilled before throwing a timeout error. */
  public readonly timeout: number;

  /** ID that identifies this handler as a client */
  public readonly clientId: string;

  public constructor(props?: RpcRequestsHandlerProps) {
    this.clientId = props?.clientId ?? Guid.createValue();
    this.timeout = props?.timeout ?? DEFAULT_REQUEST_TIMEOUT;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private get rpcClient(): PresentationRpcInterface {
    return RpcManager.getClientForInterface(PresentationRpcInterface);
  }

  private async requestWithTimeout<TResult>(func: () => PresentationRpcResponse<TResult>, diagnosticsHandler?: ClientDiagnosticsHandler): Promise<TResult> {
    const rpcResponsePromise = func();
    const rpcRequest: RpcRequest | undefined = RpcRequest.current(this.rpcClient);
    const timeout = createCancellableTimeoutPromise(this.timeout);
    return Promise.race([
      (async () => {
        let diagnostics: ClientDiagnostics | undefined;
        try {
          const response = await rpcResponsePromise;
          diagnostics = response.diagnostics;
          switch (response.statusCode) {
            case PresentationStatus.Success:
              return response.result!;
            default:
              throw new PresentationError(response.statusCode, response.errorMessage);
          }
        } finally {
          diagnosticsHandler && diagnostics && diagnosticsHandler(diagnostics);
        }
      })(),
      timeout.promise.then(() => {
        throw new Error(`Processing the request took longer than the configured limit of ${this.timeout} ms`);
      }),
    ]).finally(() => {
      rpcRequest?.cancel();
      timeout.cancel();
    });
  }

  /**
   * Send the request to backend. We'll wait for the response for `this.timeout` ms, and if we don't get the response by
   * then, we'll throw an error.
   */
  public async request<TResult, TOptions extends RequestOptions<IModelRpcProps> & ClientDiagnosticsAttribute, TArg = any>(
    func: (token: IModelRpcProps, options: PresentationRpcRequestOptions<TOptions>, ...args: TArg[]) => PresentationRpcResponse<TResult>,
    options: TOptions,
    ...additionalOptions: TArg[]
  ): Promise<TResult> {
    const { imodel, diagnostics, ...optionsNoIModel } = options;
    const { handler: diagnosticsHandler, ...diagnosticsOptions } = diagnostics ?? {};
    if (isOptionsWithRuleset(optionsNoIModel)) {
      optionsNoIModel.rulesetOrId = cleanupRuleset(optionsNoIModel.rulesetOrId);
    }
    const rpcOptions: PresentationRpcRequestOptions<TOptions> = {
      ...optionsNoIModel,
      clientId: this.clientId,
    };
    if (diagnostics) {
      rpcOptions.diagnostics = diagnosticsOptions;
    }
    const doRequest = async () => func(imodel, rpcOptions, ...additionalOptions);
    const result = await this.requestWithTimeout(doRequest, diagnosticsHandler);
    return result;
  }

  public async getNodesCount(options: HierarchyRequestOptions<IModelRpcProps, NodeKey, RulesetVariableJSON> & ClientDiagnosticsAttribute): Promise<number> {
    return this.request<number, typeof options>(this.rpcClient.getNodesCount.bind(this.rpcClient), options);
  }

  public async getPagedNodes(
    options: Paged<HierarchyRequestOptions<IModelRpcProps, NodeKey, RulesetVariableJSON>> & ClientDiagnosticsAttribute,
  ): Promise<PagedResponse<Node>> {
    return this.request<PagedResponse<Node>, typeof options>(this.rpcClient.getPagedNodes.bind(this.rpcClient), options);
  }

  public async getNodesDescriptor(
    options: HierarchyLevelDescriptorRequestOptions<IModelRpcProps, NodeKey, RulesetVariableJSON> & ClientDiagnosticsAttribute,
  ): Promise<DescriptorJSON | undefined> {
    const response = await this.request<string | DescriptorJSON | undefined, typeof options>(this.rpcClient.getNodesDescriptor.bind(this.rpcClient), options);
    if (typeof response === "string") {
      return JSON.parse(response);
    }
    return response;
  }

  public async getNodePaths(
    options: FilterByInstancePathsHierarchyRequestOptions<IModelRpcProps, RulesetVariableJSON> & ClientDiagnosticsAttribute,
  ): Promise<NodePathElement[]> {
    return this.request<NodePathElement[], typeof options>(this.rpcClient.getNodePaths.bind(this.rpcClient), options);
  }

  public async getFilteredNodePaths(
    options: FilterByTextHierarchyRequestOptions<IModelRpcProps, RulesetVariableJSON> & ClientDiagnosticsAttribute,
  ): Promise<NodePathElement[]> {
    return this.request<NodePathElement[], typeof options>(this.rpcClient.getFilteredNodePaths.bind(this.rpcClient), options);
  }

  public async getContentSources(options: ContentSourcesRequestOptions<IModelRpcProps> & ClientDiagnosticsAttribute): Promise<ContentSourcesRpcResult> {
    return this.request<ContentSourcesRpcResult, typeof options>(this.rpcClient.getContentSources.bind(this.rpcClient), options);
  }
  public async getContentDescriptor(
    options: ContentDescriptorRequestOptions<IModelRpcProps, KeySetJSON, RulesetVariableJSON> & ClientDiagnosticsAttribute,
  ): Promise<DescriptorJSON | undefined> {
    return this.request<DescriptorJSON | undefined, typeof options>(this.rpcClient.getContentDescriptor.bind(this.rpcClient), options);
  }
  public async getContentSetSize(
    options: ContentRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON> & ClientDiagnosticsAttribute,
  ): Promise<number> {
    return this.request<number, typeof options>(this.rpcClient.getContentSetSize.bind(this.rpcClient), options);
  }
  public async getPagedContent(
    options: Paged<ContentRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON> & ClientDiagnosticsAttribute>,
  ) {
    return this.request<{ descriptor: DescriptorJSON; contentSet: PagedResponse<ItemJSON> } | undefined, typeof options>(
      this.rpcClient.getPagedContent.bind(this.rpcClient),
      options,
    );
  }
  public async getPagedContentSet(
    options: Paged<ContentRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON> & ClientDiagnosticsAttribute>,
  ) {
    return this.request<PagedResponse<ItemJSON>, typeof options>(this.rpcClient.getPagedContentSet.bind(this.rpcClient), options);
  }

  public async getPagedDistinctValues(
    options: DistinctValuesRequestOptions<IModelRpcProps, DescriptorOverrides, KeySetJSON, RulesetVariableJSON> & ClientDiagnosticsAttribute,
  ): Promise<PagedResponse<DisplayValueGroup>> {
    return this.request<PagedResponse<DisplayValueGroup>, typeof options>(this.rpcClient.getPagedDistinctValues.bind(this.rpcClient), options);
  }

  public async getContentInstanceKeys(
    options: ContentInstanceKeysRequestOptions<IModelRpcProps, KeySetJSON, RulesetVariableJSON> & ClientDiagnosticsAttribute,
  ): Promise<{ total: number; items: KeySetJSON }> {
    return this.request<{ total: number; items: KeySetJSON }, typeof options>(this.rpcClient.getContentInstanceKeys.bind(this.rpcClient), options);
  }

  public async getDisplayLabelDefinition(
    options: DisplayLabelRequestOptions<IModelRpcProps, InstanceKey> & ClientDiagnosticsAttribute,
  ): Promise<LabelDefinition> {
    return this.request<LabelDefinition, typeof options>(this.rpcClient.getDisplayLabelDefinition.bind(this.rpcClient), options);
  }
  public async getPagedDisplayLabelDefinitions(
    options: DisplayLabelsRequestOptions<IModelRpcProps, InstanceKey> & ClientDiagnosticsAttribute,
  ): Promise<PagedResponse<LabelDefinition>> {
    return this.request<PagedResponse<LabelDefinition>, typeof options>(this.rpcClient.getPagedDisplayLabelDefinitions.bind(this.rpcClient), options);
  }

  /* eslint-disable @typescript-eslint/no-deprecated */
  public async getSelectionScopes(options: SelectionScopeRequestOptions<IModelRpcProps> & ClientDiagnosticsAttribute): Promise<SelectionScope[]> {
    return this.request<SelectionScope[], typeof options>(this.rpcClient.getSelectionScopes.bind(this.rpcClient), options);
  }
  public async computeSelection(options: ComputeSelectionRequestOptions<IModelRpcProps> & ClientDiagnosticsAttribute): Promise<KeySetJSON> {
    return this.request<KeySetJSON, typeof options>(this.rpcClient.computeSelection.bind(this.rpcClient), options);
  }
  /* eslint-enable @typescript-eslint/no-deprecated */
}

function isOptionsWithRuleset(options: object): options is { rulesetOrId: Ruleset } {
  return typeof (options as RequestOptionsWithRuleset<any, any>).rulesetOrId === "object";
}

type RulesetWithRequiredProperties = {
  [key in keyof Ruleset]-?: true;
};

const RULESET_SUPPORTED_PROPERTIES_OBJ: RulesetWithRequiredProperties = {
  id: true,
  rules: true,
  version: true,
  requiredSchemas: true,
  supplementationInfo: true,
  vars: true,
};

function cleanupRuleset(ruleset: Ruleset): Ruleset {
  const cleanedUpRuleset: Ruleset = { ...ruleset };

  for (const propertyKey of Object.keys(cleanedUpRuleset)) {
    if (!RULESET_SUPPORTED_PROPERTIES_OBJ.hasOwnProperty(propertyKey)) {
      if (propertyKey === "$schema") {
        delete (cleanedUpRuleset as any)[propertyKey];
      } else {
        Logger.logWarning(
          PresentationCommonLoggerCategory.Package,
          `Provided ruleset contains unrecognized attribute '${propertyKey}'. It either doesn't exist or may be no longer supported.`,
        );
      }
    }
  }

  return cleanedUpRuleset;
}
