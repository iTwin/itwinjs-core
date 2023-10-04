/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { IModelDb, RpcTrace } from "@itwin/core-backend";
import { assert, BeEvent, Id64String, IDisposable, Logger } from "@itwin/core-bentley";
import { IModelRpcProps } from "@itwin/core-common";
import {
  ClientDiagnostics, ComputeSelectionRequestOptions, ComputeSelectionRpcRequestOptions, ContentDescriptorRpcRequestOptions, ContentFlags,
  ContentInstanceKeysRpcRequestOptions, ContentRpcRequestOptions, ContentSourcesRpcRequestOptions, ContentSourcesRpcResult, DescriptorJSON,
  Diagnostics, DisplayLabelRpcRequestOptions, DisplayLabelsRpcRequestOptions, DisplayValueGroup, DisplayValueGroupJSON,
  DistinctValuesRpcRequestOptions, ElementProperties, FilterByInstancePathsHierarchyRpcRequestOptions, FilterByTextHierarchyRpcRequestOptions,
  HierarchyLevelDescriptorRpcRequestOptions, HierarchyLevelJSON, HierarchyRpcRequestOptions, isComputeSelectionRequestOptions, ItemJSON, KeySet,
  KeySetJSON, LabelDefinition, NodeJSON, NodeKey, NodeKeyJSON, NodePathElement, NodePathElementJSON, Paged, PagedResponse, PageOptions,
  PresentationError, PresentationRpcInterface, PresentationRpcResponse, PresentationRpcResponseData, PresentationStatus, RpcDiagnosticsOptions,
  Ruleset, RulesetVariable, RulesetVariableJSON, SelectClassInfo, SelectionScope, SelectionScopeRpcRequestOptions,
  SingleElementPropertiesRpcRequestOptions,
} from "@itwin/presentation-common";
import { PresentationBackendLoggerCategory } from "./BackendLoggerCategory";
import { Presentation } from "./Presentation";
import { PresentationManager } from "./PresentationManager";
import { TemporaryStorage } from "./TemporaryStorage";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJsonVersion = require("../../../package.json").version;

type ContentGetter<TResult = any, TOptions = any> = (requestOptions: TOptions) => TResult;

/** @internal */
export const MAX_ALLOWED_PAGE_SIZE = 1000;
/** @internal */
export const MAX_ALLOWED_KEYS_PAGE_SIZE = 10000;

const DEFAULT_REQUEST_TIMEOUT = 5000;

/**
 * The backend implementation of PresentationRpcInterface. All it's basically
 * responsible for is forwarding calls to [[Presentation.manager]].
 *
 * @internal
 */
export class PresentationRpcImpl extends PresentationRpcInterface implements IDisposable {

  private _requestTimeout: number;
  private _pendingRequests: TemporaryStorage<PresentationRpcResponse<any>>;
  private _cancelEvents: Map<string, BeEvent<() => void>>;

  public constructor(props?: { requestTimeout?: number }) {
    super();
    this._requestTimeout = props?.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;
    this._pendingRequests = new TemporaryStorage({
      // remove the pending request after request timeout + 10 seconds - this gives
      // frontend 10 seconds to re-send the request until it's removed from requests' cache
      unusedValueLifetime: (this._requestTimeout > 0) ? (this._requestTimeout + 10 * 1000) : undefined,

      // attempt to clean up every second
      cleanupInterval: 1000,

      cleanupHandler: (id, _, reason) => {
        if (reason !== "request") {
          Logger.logTrace(PresentationBackendLoggerCategory.Rpc, `Cleaning up request without frontend retrieving it: ${id}.`);
          // istanbul ignore next
          this._cancelEvents.get(id)?.raiseEvent();
        }
        this._cancelEvents.delete(id);
      },
    });
    this._cancelEvents = new Map<string, BeEvent<() => void>>();
  }

  public dispose() {
    this._pendingRequests.dispose();
  }

  public get requestTimeout() { return this._requestTimeout; }

  public get pendingRequests() { return this._pendingRequests; }

  /** Returns an ok response with result inside */
  private successResponse<TResult>(result: TResult, diagnostics?: ClientDiagnostics) {
    return {
      statusCode: PresentationStatus.Success,
      result,
      diagnostics,
    };
  }

  /** Returns a bad request response with empty result and an error code */
  private errorResponse(errorCode: PresentationStatus, errorMessage?: string, diagnostics?: ClientDiagnostics) {
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

  private async getIModel(token: IModelRpcProps): Promise<IModelDb> {
    let imodel: IModelDb;
    try {
      imodel = IModelDb.findByKey(token.key);
      // call refreshContainer, just in case this is a V2 checkpoint whose sasToken is about to expire, or its default transaction is about to be restarted.
      await imodel.refreshContainer(RpcTrace.expectCurrentActivity.accessToken);
    } catch {
      throw new PresentationError(PresentationStatus.InvalidArgument, "IModelRpcProps doesn't point to a valid iModel");
    }
    return imodel;
  }

  private async makeRequest<TRpcOptions extends { rulesetOrId?: Ruleset | string, clientId?: string, diagnostics?: RpcDiagnosticsOptions, rulesetVariables?: RulesetVariableJSON[] }, TResult>(token: IModelRpcProps, requestId: string, requestOptions: TRpcOptions, request: ContentGetter<Promise<TResult>>): PresentationRpcResponse<TResult> {
    const requestKey = JSON.stringify({ iModelKey: token.key, requestId, requestOptions });

    Logger.logInfo(PresentationBackendLoggerCategory.Rpc, `Received '${requestId}' request. Params: ${requestKey}`);

    let imodel: IModelDb;
    try {
      imodel = await this.getIModel(token);
    } catch (e) {
      assert(e instanceof Error);
      return this.errorResponse(PresentationStatus.InvalidArgument, e.message);
    }

    let resultPromise = this._pendingRequests.getValue(requestKey);
    if (resultPromise) {
      Logger.logTrace(PresentationBackendLoggerCategory.Rpc, `Request already pending`);
    } else {
      Logger.logTrace(PresentationBackendLoggerCategory.Rpc, `Request not found, creating a new one`);
      const { clientId: _, diagnostics: diagnosticsOptions, rulesetVariables, ...options } = requestOptions;
      const managerRequestOptions: any = {
        ...options,
        imodel,
        cancelEvent: new BeEvent<() => void>(),
      };

      // set up ruleset variables
      if (rulesetVariables)
        managerRequestOptions.rulesetVariables = rulesetVariables.map(RulesetVariable.fromJSON);

      // set up diagnostics listener
      let diagnostics: ClientDiagnostics | undefined;
      const getDiagnostics = (): ClientDiagnostics => {
        if (!diagnostics)
          diagnostics = {};
        return diagnostics;
      };
      if (diagnosticsOptions) {
        if (diagnosticsOptions.backendVersion) {
          getDiagnostics().backendVersion = packageJsonVersion;
        }
        managerRequestOptions.diagnostics = {
          ...diagnosticsOptions,
          handler: (d: Diagnostics) => {
            if (d.logs) {
              const target = getDiagnostics();
              if (target.logs)
                target.logs.push(...d.logs);
              else
                target.logs = [...d.logs];
            }
          },
        };
      }

      // initiate request
      resultPromise = request(managerRequestOptions)
        .then((result) => this.successResponse(result, diagnostics))
        .catch((e: PresentationError) => this.errorResponse(e.errorNumber, e.message, diagnostics));

      // store the request promise
      this._pendingRequests.addValue(requestKey, resultPromise);
      this._cancelEvents.set(requestKey, managerRequestOptions.cancelEvent);
    }

    if (this._requestTimeout === 0) {
      Logger.logTrace(PresentationBackendLoggerCategory.Rpc, `Request timeout not configured, returning promise without a timeout.`);
      resultPromise.finally(() => {
        this._pendingRequests.deleteValue(requestKey);
      });
      return resultPromise;
    }

    let timeout: NodeJS.Timeout;
    const timeoutPromise = new Promise<any>((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject();
      }, this._requestTimeout);
    });

    /* eslint-disable @typescript-eslint/indent */
    Logger.logTrace(PresentationBackendLoggerCategory.Rpc, `Returning a promise with a timeout of ${this._requestTimeout}.`);
    return Promise
      .race([resultPromise, timeoutPromise])
      .catch<PresentationRpcResponseData>(() => {
        // note: error responses from the manager get handled when creating `resultPromise`, so we can only get here due
        // to a timeout exception
        Logger.logTrace(PresentationBackendLoggerCategory.Rpc, `Request timeout, returning "BackendTimeout" status.`);
        return this.errorResponse(PresentationStatus.BackendTimeout);
      })
      .then((response: PresentationRpcResponseData<TResult>) => {
        if (response.statusCode !== PresentationStatus.BackendTimeout) {
          Logger.logTrace(PresentationBackendLoggerCategory.Rpc, `Request completed, returning result.`);
          this._pendingRequests.deleteValue(requestKey);
        }
        clearTimeout(timeout);
        return response;
      });
    /* eslint-enable @typescript-eslint/indent */
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

  // eslint-disable-next-line deprecation/deprecation
  public override async getPagedNodes(token: IModelRpcProps, requestOptions: Paged<HierarchyRpcRequestOptions>): PresentationRpcResponse<PagedResponse<NodeJSON>> {
    return this.makeRequest(token, "getPagedNodes", requestOptions, async (options) => {
      options = enforceValidPageSize({
        ...options,
        parentKey: nodeKeyFromJson(options.parentKey),
      });
      const [serializedNodesJson, count] = await Promise.all([
        this.getManager(requestOptions.clientId).getDetail().getNodes(options),
        this.getManager(requestOptions.clientId).getNodesCount(options),
      ]);
      // eslint-disable-next-line deprecation/deprecation
      const nodesJson = JSON.parse(serializedNodesJson) as HierarchyLevelJSON;
      return {
        total: count,
        items: nodesJson.nodes,
      };
    });
  }

  public override async getNodesDescriptor(token: IModelRpcProps, requestOptions: HierarchyLevelDescriptorRpcRequestOptions): PresentationRpcResponse<string | DescriptorJSON | undefined> {
    return this.makeRequest(token, "getNodesDescriptor", requestOptions, async (options) => {
      options = {
        ...options,
        parentKey: nodeKeyFromJson(options.parentKey),
      };
      return this.getManager(requestOptions.clientId).getDetail().getNodesDescriptor(options);
    });
  }

  // eslint-disable-next-line deprecation/deprecation
  public override async getNodePaths(token: IModelRpcProps, requestOptions: FilterByInstancePathsHierarchyRpcRequestOptions): PresentationRpcResponse<NodePathElementJSON[]> {
    return this.makeRequest(token, "getNodePaths", requestOptions, async (options) => {
      const result = await this.getManager(requestOptions.clientId).getNodePaths(options);
      // eslint-disable-next-line deprecation/deprecation
      return result.map(NodePathElement.toJSON);
    });
  }

  // eslint-disable-next-line deprecation/deprecation
  public override async getFilteredNodePaths(token: IModelRpcProps, requestOptions: FilterByTextHierarchyRpcRequestOptions): PresentationRpcResponse<NodePathElementJSON[]> {
    return this.makeRequest(token, "getFilteredNodePaths", requestOptions, async (options) => {
      const result = await this.getManager(requestOptions.clientId).getFilteredNodePaths(options);
      // eslint-disable-next-line deprecation/deprecation
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
      if (options.transport === "unparsed-json") {
        // Here we send a plain JSON string but we will parse it to DescriptorJSON on the frontend. This way we are
        // bypassing unnecessary deserialization and serialization.
        return Presentation.getManager(requestOptions.clientId).getDetail().getContentDescriptor(options) as unknown as DescriptorJSON | undefined;
      } else {
        // Support for older frontends that still expect a parsed descriptor
        const descriptor = await Presentation.getManager(requestOptions.clientId).getContentDescriptor(options);
        return descriptor?.toJSON();
      }
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
        this.getManager(requestOptions.clientId).getDetail().getContent(options),
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

  public override async getElementProperties(token: IModelRpcProps, requestOptions: SingleElementPropertiesRpcRequestOptions): PresentationRpcResponse<ElementProperties | undefined> {
    return this.makeRequest(token, "getElementProperties", { ...requestOptions }, async (options) => {
      return this.getManager(requestOptions.clientId).getDetail().getElementProperties(options);
    });
  }

  // eslint-disable-next-line deprecation/deprecation
  public override async getPagedDistinctValues(token: IModelRpcProps, requestOptions: DistinctValuesRpcRequestOptions): PresentationRpcResponse<PagedResponse<DisplayValueGroupJSON>> {
    return this.makeRequest(token, "getPagedDistinctValues", requestOptions, async (options) => {
      options = enforceValidPageSize({
        ...options,
        keys: KeySet.fromJSON(options.keys),
      });
      const response = await this.getManager(requestOptions.clientId).getPagedDistinctValues(options);
      return {
        ...response,
        // eslint-disable-next-line deprecation/deprecation
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
        this.getManager(requestOptions.clientId).getDetail().getContent(options),
      ]);

      if (size === 0 || !content)
        return { total: 0, items: new KeySet().toJSON() };

      return {
        total: size,
        items: content.contentSet.reduce((keys, item) => keys.add(item.primaryKeys), new KeySet()).toJSON(),
      };
    });
  }

  public override async getDisplayLabelDefinition(token: IModelRpcProps, requestOptions: DisplayLabelRpcRequestOptions): PresentationRpcResponse<LabelDefinition> {
    return this.makeRequest(token, "getDisplayLabelDefinition", requestOptions, async (options) => {
      const label = await this.getManager(requestOptions.clientId).getDetail().getDisplayLabelDefinition(options);
      return label;
    });
  }

  public override async getPagedDisplayLabelDefinitions(token: IModelRpcProps, requestOptions: DisplayLabelsRpcRequestOptions): PresentationRpcResponse<PagedResponse<LabelDefinition>> {
    const pageOpts = enforceValidPageSize({ paging: { start: 0, size: requestOptions.keys.length } });
    if (pageOpts.paging.size < requestOptions.keys.length)
      requestOptions.keys.splice(pageOpts.paging.size);
    return this.makeRequest(token, "getPagedDisplayLabelDefinitions", requestOptions, async (options) => {
      const labels = await this.getManager(requestOptions.clientId).getDetail().getDisplayLabelDefinitions({ ...options, keys: options.keys });
      return {
        total: options.keys.length,
        items: labels,
      };
    });
  }

  public override async getSelectionScopes(token: IModelRpcProps, requestOptions: SelectionScopeRpcRequestOptions): PresentationRpcResponse<SelectionScope[]> {
    return this.makeRequest(token, "getSelectionScopes", requestOptions, async (options) =>
      this.getManager(requestOptions.clientId).getSelectionScopes(options),
    );
  }

  public override async computeSelection(token: IModelRpcProps, requestOptions: ComputeSelectionRpcRequestOptions | SelectionScopeRpcRequestOptions, ids?: Id64String[], scopeId?: string): PresentationRpcResponse<KeySetJSON> {
    return this.makeRequest(token, "computeSelection", requestOptions, async (options) => {
      if (!isComputeSelectionRequestOptions(options)) {
        options = {
          ...options,
          elementIds: ids!,
          scope: { id: scopeId! },
        };
      }
      const keys = await this.getManager(requestOptions.clientId).computeSelection(options as ComputeSelectionRequestOptions<IModelDb>);
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

// eslint-disable-next-line deprecation/deprecation
const nodeKeyFromJson = (json: NodeKeyJSON | undefined): NodeKey | undefined => {
  if (!json)
    return undefined;
  // eslint-disable-next-line deprecation/deprecation
  return NodeKey.fromJSON(json);
};
