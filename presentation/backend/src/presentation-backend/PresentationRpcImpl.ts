/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { IModelDb } from "@itwin/core-backend";
import { Id64String, Logger } from "@itwin/core-bentley";
import { IModelRpcProps } from "@itwin/core-common";
import {
  ContentDescriptorRpcRequestOptions, ContentFlags, ContentInstanceKeysRpcRequestOptions, ContentRpcRequestOptions, ContentSourcesRpcRequestOptions,
  ContentSourcesRpcResult, DescriptorJSON, DiagnosticsOptions, DiagnosticsScopeLogs, DisplayLabelRpcRequestOptions, DisplayLabelsRpcRequestOptions,
  DisplayValueGroup, DisplayValueGroupJSON, DistinctValuesRpcRequestOptions, ElementProperties, ElementPropertiesRpcRequestOptions,
  ElementPropertiesRpcResult, FilterByInstancePathsHierarchyRpcRequestOptions, FilterByTextHierarchyRpcRequestOptions, HierarchyRpcRequestOptions,
  InstanceKey, isSingleElementPropertiesRequestOptions, ItemJSON, KeySet, KeySetJSON, LabelDefinition, LabelDefinitionJSON,
  MultiElementPropertiesRpcRequestOptions, Node, NodeJSON, NodeKey, NodeKeyJSON, NodePathElement, NodePathElementJSON, Paged, PagedResponse,
  PageOptions, PresentationError, PresentationRpcInterface, PresentationRpcResponse, PresentationStatus, Ruleset, RulesetVariable,
  RulesetVariableJSON, SelectClassInfo, SelectionScope, SelectionScopeRpcRequestOptions, SingleElementPropertiesRpcRequestOptions,
} from "@itwin/presentation-common";
import { PresentationBackendLoggerCategory } from "./BackendLoggerCategory";
import { Presentation } from "./Presentation";
import { PresentationManager } from "./PresentationManager";

type ContentGetter<TResult = any, TOptions = any> = (requestOptions: TOptions) => TResult;

/** @internal */
export const MAX_ALLOWED_PAGE_SIZE = 1000;
/** @internal */
export const MAX_ALLOWED_KEYS_PAGE_SIZE = 10000;

/**
 * The backend implementation of PresentationRpcInterface. All it's basically
 * responsible for is forwarding calls to [[Presentation.manager]].
 *
 * Consumers should not use this class. Instead, they should register
 * [PresentationRpcInterface]($presentation-common):
 * ``` ts
 * [[include:Backend.Initialization.RpcInterface]]
 * ```
 *
 * @internal
 */
export class PresentationRpcImpl extends PresentationRpcInterface {

  public constructor(_id?: string) {
    super();
  }

  /**
   * Get the maximum result waiting time.
   */
  public get requestTimeout(): number { return Presentation.getRequestTimeout(); }

  /** Returns an ok response with result inside */
  private successResponse<TResult>(result: TResult, diagnostics?: DiagnosticsScopeLogs[]) {
    return {
      statusCode: PresentationStatus.Success,
      result,
      diagnostics,
    };
  }

  /** Returns a bad request response with empty result and an error code */
  private errorResponse(errorCode: PresentationStatus, errorMessage?: string, diagnostics?: DiagnosticsScopeLogs[]) {
    return {
      statusCode: errorCode,
      result: undefined,
      errorMessage,
      diagnostics,
    };
  }

  /**
   * Get the [[PresentationManager]] used by this RPC impl.
   */
  public getManager(clientId?: string): PresentationManager {
    return Presentation.getManager(clientId);
  }

  private getIModel(token: IModelRpcProps): IModelDb {
    let imodel: IModelDb;
    try {
      imodel = IModelDb.findByKey(token.key);
    } catch {
      throw new PresentationError(PresentationStatus.InvalidArgument, "IModelRpcProps doesn't point to a valid iModel");
    }
    return imodel;
  }

  private async makeRequest<TRpcOptions extends { rulesetOrId?: Ruleset | string, clientId?: string, diagnostics?: DiagnosticsOptions, rulesetVariables?: RulesetVariableJSON[] }, TResult>(token: IModelRpcProps, requestId: string, requestOptions: TRpcOptions, request: ContentGetter<Promise<TResult>>): PresentationRpcResponse<TResult> {
    Logger.logInfo(PresentationBackendLoggerCategory.Rpc, `Received '${requestId}' request. Params: ${JSON.stringify(requestOptions)}`);
    let imodel: IModelDb;
    try {
      imodel = this.getIModel(token);
    } catch (e) {
      return this.errorResponse((e as PresentationError).errorNumber, (e as PresentationError).message);
    }

    const { clientId, diagnostics: diagnosticsOptions, rulesetVariables, ...options } = requestOptions; // eslint-disable-line @typescript-eslint/no-unused-vars
    const managerRequestOptions: any = {
      ...options,
      imodel,
    };

    // set up ruleset variables
    if (rulesetVariables)
      managerRequestOptions.rulesetVariables = rulesetVariables.map(RulesetVariable.fromJSON);

    // set up diagnostics listener
    let diagnosticLogs: DiagnosticsScopeLogs[] | undefined;
    if (diagnosticsOptions) {
      managerRequestOptions.diagnostics = {
        ...diagnosticsOptions,
        handler: (logs: DiagnosticsScopeLogs[]) => {
          // istanbul ignore else
          if (!diagnosticLogs)
            diagnosticLogs = [];
          diagnosticLogs.push(...logs);
        },
      };
    }

    // initiate request
    const resultPromise = request(managerRequestOptions)
      .then((result) => this.successResponse(result, diagnosticLogs))
      .catch((e: PresentationError) => this.errorResponse(e.errorNumber, e.message, diagnosticLogs));

    if (this.requestTimeout === 0)
      return resultPromise;

    let timeout: NodeJS.Timeout;
    const timeoutPromise = new Promise<any>((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject("Timed out");
      }, this.requestTimeout);
    });

    return Promise.race([resultPromise, timeoutPromise])
      .catch(() => this.errorResponse(PresentationStatus.BackendTimeout))
      .finally(() => clearTimeout(timeout));
  }

  public override async getNodesCount(token: IModelRpcProps, requestOptions: HierarchyRpcRequestOptions): PresentationRpcResponse<number> {
    return this.makeRequest(token, "getNodesCount", requestOptions, async (options) => {
      options = {
        ...options,
        parentKey: nodeKeyFromJson(options.parentKey),
      };
      return this.getManager(requestOptions.clientId).getNodesCount(options);
    });
  }

  public override async getPagedNodes(token: IModelRpcProps, requestOptions: Paged<HierarchyRpcRequestOptions>): PresentationRpcResponse<PagedResponse<NodeJSON>> {
    return this.makeRequest(token, "getPagedNodes", requestOptions, async (options) => {
      options = enforceValidPageSize({
        ...options,
        parentKey: nodeKeyFromJson(options.parentKey),
      });
      const [nodes, count] = await Promise.all([
        this.getManager(requestOptions.clientId).getNodes(options),
        this.getManager(requestOptions.clientId).getNodesCount(options),
      ]);
      return { total: count, items: nodes.map(Node.toJSON) };
    });
  }

  public override async getNodePaths(token: IModelRpcProps, requestOptions: FilterByInstancePathsHierarchyRpcRequestOptions): PresentationRpcResponse<NodePathElementJSON[]> {
    return this.makeRequest(token, "getNodePaths", requestOptions, async (options) => {
      const result = await this.getManager(requestOptions.clientId).getNodePaths(options);
      return result.map(NodePathElement.toJSON);
    });
  }

  public override async getFilteredNodePaths(token: IModelRpcProps, requestOptions: FilterByTextHierarchyRpcRequestOptions): PresentationRpcResponse<NodePathElementJSON[]> {
    return this.makeRequest(token, "getFilteredNodePaths", requestOptions, async (options) => {
      const result = await this.getManager(requestOptions.clientId).getFilteredNodePaths(options);
      return result.map(NodePathElement.toJSON);
    });
  }

  public override async getContentSources(token: IModelRpcProps, requestOptions: ContentSourcesRpcRequestOptions): PresentationRpcResponse<ContentSourcesRpcResult> {
    return this.makeRequest(token, "getContentSources", requestOptions, async (options) => {
      const result = await this.getManager(requestOptions.clientId).getContentSources(options);
      const classesMap = {};
      const selectClasses = result.map((sci) => SelectClassInfo.toCompressedJSON(sci, classesMap));
      return { sources: selectClasses, classesMap };
    });
  }

  public override async getContentDescriptor(token: IModelRpcProps, requestOptions: ContentDescriptorRpcRequestOptions): PresentationRpcResponse<DescriptorJSON | undefined> {
    return this.makeRequest(token, "getContentDescriptor", requestOptions, async (options) => {
      options = {
        ...options,
        keys: KeySet.fromJSON(options.keys),
      };
      const descriptor = await this.getManager(requestOptions.clientId).getContentDescriptor(options);
      if (descriptor)
        return descriptor.toJSON();
      return undefined;
    });
  }

  public override async getContentSetSize(token: IModelRpcProps, requestOptions: ContentRpcRequestOptions): PresentationRpcResponse<number> {
    return this.makeRequest(token, "getContentSetSize", requestOptions, async (options) => {
      options = {
        ...options,
        keys: KeySet.fromJSON(options.keys),
      };
      return this.getManager(requestOptions.clientId).getContentSetSize(options);
    });
  }

  public override async getPagedContent(token: IModelRpcProps, requestOptions: Paged<ContentRpcRequestOptions>): PresentationRpcResponse<{ descriptor: DescriptorJSON, contentSet: PagedResponse<ItemJSON> } | undefined> {
    return this.makeRequest(token, "getPagedContent", requestOptions, async (options) => {
      options = enforceValidPageSize({
        ...options,
        keys: KeySet.fromJSON(options.keys),
      });

      const [size, content] = await Promise.all([
        this.getManager(requestOptions.clientId).getContentSetSize(options),
        this.getManager(requestOptions.clientId).getContent(options),
      ]);

      if (!content)
        return undefined;

      return {
        descriptor: content.descriptor.toJSON(),
        contentSet: {
          total: size,
          items: content.contentSet.map((i) => i.toJSON()),
        },
      };
    });
  }

  public override async getPagedContentSet(token: IModelRpcProps, requestOptions: Paged<ContentRpcRequestOptions>): PresentationRpcResponse<PagedResponse<ItemJSON>> {
    const content = await this.getPagedContent(token, requestOptions);
    return this.successResponse(content.result ? content.result.contentSet : { total: 0, items: [] });
  }

  public override async getElementProperties(token: IModelRpcProps, requestOptions: SingleElementPropertiesRpcRequestOptions): PresentationRpcResponse<ElementProperties | undefined>;
  public override async getElementProperties(token: IModelRpcProps, requestOptions: MultiElementPropertiesRpcRequestOptions): PresentationRpcResponse<PagedResponse<ElementProperties>>;
  public override async getElementProperties(token: IModelRpcProps, requestOptions: ElementPropertiesRpcRequestOptions): PresentationRpcResponse<ElementPropertiesRpcResult> {
    return this.makeRequest(token, "getElementProperties", { ...requestOptions }, async (options) => {
      if (!isSingleElementPropertiesRequestOptions(options)) {
        options = enforceValidPageSize(options);
      }
      return this.getManager(requestOptions.clientId).getElementProperties(options);
    });
  }

  public override async getPagedDistinctValues(token: IModelRpcProps, requestOptions: DistinctValuesRpcRequestOptions): PresentationRpcResponse<PagedResponse<DisplayValueGroupJSON>> {
    return this.makeRequest(token, "getPagedDistinctValues", requestOptions, async (options) => {
      options = enforceValidPageSize({
        ...options,
        keys: KeySet.fromJSON(options.keys),
      });
      const response = await this.getManager(requestOptions.clientId).getPagedDistinctValues(options);
      return {
        ...response,
        items: response.items.map(DisplayValueGroup.toJSON),
      };
    });
  }

  public override async getContentInstanceKeys(token: IModelRpcProps, requestOptions: ContentInstanceKeysRpcRequestOptions): PresentationRpcResponse<{ total: number, items: KeySetJSON }> {
    return this.makeRequest(token, "getContentInstanceKeys", requestOptions, async (options) => {
      const { displayType, ...optionsNoDisplayType } = options;
      options = enforceValidPageSize({
        ...optionsNoDisplayType,
        keys: KeySet.fromJSON(optionsNoDisplayType.keys),
        descriptor: {
          displayType,
          contentFlags: ContentFlags.KeysOnly,
        },
      }, MAX_ALLOWED_KEYS_PAGE_SIZE);

      const [size, content] = await Promise.all([
        this.getManager(requestOptions.clientId).getContentSetSize(options),
        this.getManager(requestOptions.clientId).getContent(options),
      ]);

      if (size === 0 || !content)
        return { total: 0, items: new KeySet().toJSON() };

      return {
        total: size,
        items: content.contentSet.reduce((keys, item) => keys.add(item.primaryKeys), new KeySet()).toJSON(),
      };
    });
  }

  public override async getDisplayLabelDefinition(token: IModelRpcProps, requestOptions: DisplayLabelRpcRequestOptions): PresentationRpcResponse<LabelDefinitionJSON> {
    return this.makeRequest(token, "getDisplayLabelDefinition", requestOptions, async (options) => {
      const label = await this.getManager(requestOptions.clientId).getDisplayLabelDefinition(options);
      return LabelDefinition.toJSON(label);
    });
  }

  public override async getPagedDisplayLabelDefinitions(token: IModelRpcProps, requestOptions: DisplayLabelsRpcRequestOptions): PresentationRpcResponse<PagedResponse<LabelDefinitionJSON>> {
    const pageOpts = enforceValidPageSize({ paging: { start: 0, size: requestOptions.keys.length } });
    if (pageOpts.paging.size < requestOptions.keys.length)
      requestOptions.keys.splice(pageOpts.paging.size);
    return this.makeRequest(token, "getPagedDisplayLabelDefinitions", requestOptions, async (options) => {
      const labels = await this.getManager(requestOptions.clientId).getDisplayLabelDefinitions({ ...options, keys: options.keys.map(InstanceKey.fromJSON) });
      return {
        total: options.keys.length,
        items: labels.map(LabelDefinition.toJSON),
      };
    });
  }

  public override async getSelectionScopes(token: IModelRpcProps, requestOptions: SelectionScopeRpcRequestOptions): PresentationRpcResponse<SelectionScope[]> {
    return this.makeRequest(token, "getSelectionScopes", requestOptions, async (options) =>
      this.getManager(requestOptions.clientId).getSelectionScopes(options),
    );
  }

  public override async computeSelection(token: IModelRpcProps, requestOptions: SelectionScopeRpcRequestOptions, ids: Id64String[], scopeId: string): PresentationRpcResponse<KeySetJSON> {
    return this.makeRequest(token, "computeSelection", { ...requestOptions, ids, scopeId }, async (options) => {
      const keys = await this.getManager(requestOptions.clientId).computeSelection(options);
      return keys.toJSON();
    });
  }
}

const enforceValidPageSize = <TOptions extends Paged<object>>(requestOptions: TOptions, maxPageSize = MAX_ALLOWED_PAGE_SIZE): TOptions & { paging: PageOptions } => {
  const validPageSize = getValidPageSize(requestOptions.paging?.size, maxPageSize);
  if (!requestOptions.paging || requestOptions.paging.size !== validPageSize)
    return { ...requestOptions, paging: { ...requestOptions.paging, size: validPageSize } };
  return requestOptions as (TOptions & { paging: PageOptions });
};

const getValidPageSize = (size: number | undefined, maxPageSize: number) => {
  const requestedSize = size ?? 0;
  return (requestedSize === 0 || requestedSize > maxPageSize) ? maxPageSize : requestedSize;
};

const nodeKeyFromJson = (json: NodeKeyJSON | undefined): NodeKey | undefined => {
  if (!json)
    return undefined;
  return NodeKey.fromJSON(json);
};
