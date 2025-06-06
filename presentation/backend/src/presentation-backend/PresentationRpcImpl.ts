/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { IModelDb, RpcTrace } from "@itwin/core-backend";
import { BeEvent, ErrorCategory, Logger, omit, StatusCategory, SuccessCategory } from "@itwin/core-bentley";
import { IModelRpcProps, RpcPendingResponse } from "@itwin/core-common";
import {
  ClientDiagnostics,
  ComputeSelectionRpcRequestOptions,
  ContentDescriptorRpcRequestOptions,
  ContentFlags,
  ContentInstanceKeysRpcRequestOptions,
  ContentRpcRequestOptions,
  ContentSourcesRpcRequestOptions,
  ContentSourcesRpcResult,
  DescriptorJSON,
  Diagnostics,
  DisplayLabelRpcRequestOptions,
  DisplayLabelsRpcRequestOptions,
  DisplayValueGroup,
  DistinctValuesRpcRequestOptions,
  ElementProperties,
  FilterByInstancePathsHierarchyRpcRequestOptions,
  FilterByTextHierarchyRpcRequestOptions,
  HierarchyLevel,
  HierarchyLevelDescriptorRpcRequestOptions,
  HierarchyRpcRequestOptions,
  ItemJSON,
  KeySet,
  KeySetJSON,
  LabelDefinition,
  Node,
  NodePathElement,
  Paged,
  PagedResponse,
  PageOptions,
  PresentationError,
  PresentationRpcInterface,
  PresentationRpcResponse,
  PresentationRpcResponseData,
  PresentationStatus,
  RpcDiagnosticsOptions,
  Ruleset,
  RulesetVariable,
  RulesetVariableJSON,
  SelectClassInfo,
  SelectionScope,
  SelectionScopeRpcRequestOptions,
  SingleElementPropertiesRpcRequestOptions,
} from "@itwin/presentation-common";
import { createCancellableTimeoutPromise, deepReplaceNullsToUndefined } from "@itwin/presentation-common/internal";
// @ts-expect-error TS complains about `with` in CJS builds; The path is fine at runtime, but not at compile time
// eslint-disable-next-line @itwin/import-within-package
import packageJson from "../../../package.json" with { type: "json" };
import { PresentationBackendLoggerCategory } from "./BackendLoggerCategory.js";
import { _presentation_manager_detail } from "./InternalSymbols.js";
import { Presentation } from "./Presentation.js";
import { PresentationManager } from "./PresentationManager.js";
import { DESCRIPTOR_ONLY_CONTENT_FLAG, getRulesetIdObject } from "./PresentationManagerDetail.js";
import { TemporaryStorage } from "./TemporaryStorage.js";

const packageJsonVersion = packageJson.version;

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
export class PresentationRpcImpl extends PresentationRpcInterface implements Disposable {
  private _requestTimeout: number;
  private _pendingRequests: TemporaryStorage<PresentationRpcResponse<any>>;
  private _cancelEvents: Map<string, BeEvent<() => void>>;
  private _statusHandler: (e: Error) => StatusCategory | undefined;

  public constructor(props?: { requestTimeout?: number }) {
    super();
    this._requestTimeout = props?.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;
    this._pendingRequests = new TemporaryStorage({
      // remove the pending request after request timeout + 10 seconds - this gives
      // frontend 10 seconds to re-send the request until it's removed from requests' cache
      unusedValueLifetime: this._requestTimeout > 0 ? this._requestTimeout + 10 * 1000 : undefined,

      // attempt to clean up every second
      cleanupInterval: 1000,

      cleanupHandler: (id, _, reason) => {
        if (reason !== "request") {
          Logger.logTrace(PresentationBackendLoggerCategory.Rpc, `Cleaning up request without frontend retrieving it: ${id}.`);
          /* c8 ignore next */
          this._cancelEvents.get(id)?.raiseEvent();
        }
        this._cancelEvents.delete(id);
      },
    });
    this._cancelEvents = new Map<string, BeEvent<() => void>>();

    this._statusHandler = createStatusCategoryHandler();
    StatusCategory.handlers.add(this._statusHandler);
  }

  public [Symbol.dispose]() {
    this._pendingRequests[Symbol.dispose]();
    StatusCategory.handlers.delete(this._statusHandler);
  }

  public get requestTimeout() {
    return this._requestTimeout;
  }

  public get pendingRequests() {
    return this._pendingRequests;
  }

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
    const imodel = IModelDb.findByKey(token.key);
    // call refreshContainer, just in case this is a V2 checkpoint whose sasToken is about to expire, or its default transaction is about to be restarted.
    await imodel.refreshContainerForRpc(RpcTrace.expectCurrentActivity.accessToken);
    return imodel;
  }

  private async makeRequest<
    TRpcOptions extends { rulesetOrId?: Ruleset | string; clientId?: string; diagnostics?: RpcDiagnosticsOptions; rulesetVariables?: RulesetVariableJSON[] },
    TResult,
  >(token: IModelRpcProps, requestId: string, requestOptions: TRpcOptions, request: ContentGetter<Promise<TResult>>): PresentationRpcResponse<TResult> {
    const serializedRequestOptionsForLogging = JSON.stringify({
      ...omit(requestOptions, ["rulesetOrId"]),
      ...(requestOptions.rulesetOrId ? { rulesetId: getRulesetIdObject(requestOptions.rulesetOrId).uniqueId } : undefined),
    });
    Logger.logInfo(PresentationBackendLoggerCategory.Rpc, `Received '${requestId}' request. Params: ${serializedRequestOptionsForLogging}`);

    const imodel = await this.getIModel(token);
    const requestKey = JSON.stringify({ iModelKey: token.key, requestId, requestOptions });
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
      if (rulesetVariables) {
        managerRequestOptions.rulesetVariables = rulesetVariables.map(RulesetVariable.fromJSON);
      }

      // set up diagnostics listener
      let diagnostics: ClientDiagnostics | undefined;
      const getDiagnostics = (): ClientDiagnostics => {
        if (!diagnostics) {
          diagnostics = {};
        }
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
              if (target.logs) {
                target.logs.push(...d.logs);
              } else {
                target.logs = [...d.logs];
              }
            }
          },
        };
      }

      // initiate request
      resultPromise = request(managerRequestOptions).then((result) => this.successResponse(result, diagnostics));

      // store the request promise
      this._pendingRequests.addValue(requestKey, resultPromise);
      this._cancelEvents.set(requestKey, managerRequestOptions.cancelEvent);
    }

    if (this._requestTimeout === 0) {
      Logger.logTrace(PresentationBackendLoggerCategory.Rpc, `Request timeout not configured, returning promise without a timeout.`);
      void resultPromise.finally(() => {
        this._pendingRequests.deleteValue(requestKey);
      });
      return resultPromise;
    }

    Logger.logTrace(PresentationBackendLoggerCategory.Rpc, `Returning a promise with a timeout of ${this._requestTimeout}.`);
    const timeout = createCancellableTimeoutPromise(this._requestTimeout);
    return Promise.race([
      resultPromise,
      timeout.promise.then(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw new RpcPendingResponse("Timeout");
      }),
    ])
      .then((response: PresentationRpcResponseData<TResult>) => {
        Logger.logTrace(PresentationBackendLoggerCategory.Rpc, `Request completed, returning result.`);
        this._pendingRequests.deleteValue(requestKey);
        return response;
      })
      .finally(() => {
        timeout.cancel();
      });
  }

  public override async getNodesCount(token: IModelRpcProps, requestOptions: HierarchyRpcRequestOptions): PresentationRpcResponse<number> {
    return this.makeRequest(token, "getNodesCount", requestOptions, async (options) => {
      return this.getManager(requestOptions.clientId).getNodesCount(options);
    });
  }

  public override async getPagedNodes(token: IModelRpcProps, requestOptions: Paged<HierarchyRpcRequestOptions>): PresentationRpcResponse<PagedResponse<Node>> {
    return this.makeRequest(token, "getPagedNodes", requestOptions, async (options) => {
      options = enforceValidPageSize(options);
      const [serializedHierarchyLevel, count] = await Promise.all([
        this.getManager(requestOptions.clientId)[_presentation_manager_detail].getNodes(options),
        this.getManager(requestOptions.clientId).getNodesCount(options),
      ]);
      const hierarchyLevel: HierarchyLevel = deepReplaceNullsToUndefined(JSON.parse(serializedHierarchyLevel));
      return {
        total: count,
        items: hierarchyLevel.nodes,
      };
    });
  }

  public override async getNodesDescriptor(
    token: IModelRpcProps,
    requestOptions: HierarchyLevelDescriptorRpcRequestOptions,
  ): PresentationRpcResponse<string | DescriptorJSON | undefined> {
    return this.makeRequest(token, "getNodesDescriptor", requestOptions, async (options) => {
      return this.getManager(requestOptions.clientId)[_presentation_manager_detail].getNodesDescriptor(options);
    });
  }

  public override async getNodePaths(
    token: IModelRpcProps,
    requestOptions: FilterByInstancePathsHierarchyRpcRequestOptions,
  ): PresentationRpcResponse<NodePathElement[]> {
    return this.makeRequest(token, "getNodePaths", requestOptions, async (options) => {
      return this.getManager(requestOptions.clientId)[_presentation_manager_detail].getNodePaths(options);
    });
  }

  public override async getFilteredNodePaths(
    token: IModelRpcProps,
    requestOptions: FilterByTextHierarchyRpcRequestOptions,
  ): PresentationRpcResponse<NodePathElement[]> {
    return this.makeRequest(token, "getFilteredNodePaths", requestOptions, async (options) => {
      return this.getManager(requestOptions.clientId)[_presentation_manager_detail].getFilteredNodePaths(options);
    });
  }

  public override async getContentSources(
    token: IModelRpcProps,
    requestOptions: ContentSourcesRpcRequestOptions,
  ): PresentationRpcResponse<ContentSourcesRpcResult> {
    return this.makeRequest(token, "getContentSources", requestOptions, async (options) => {
      const result = await this.getManager(requestOptions.clientId).getContentSources(options);
      const classesMap = {};
      const selectClasses = result.map((sci) => SelectClassInfo.toCompressedJSON(sci, classesMap));
      return { sources: selectClasses, classesMap };
    });
  }

  public override async getContentDescriptor(
    token: IModelRpcProps,
    requestOptions: ContentDescriptorRpcRequestOptions,
  ): PresentationRpcResponse<DescriptorJSON | undefined> {
    return this.makeRequest(token, "getContentDescriptor", requestOptions, async (options) => {
      options = {
        ...options,
        contentFlags: (options.contentFlags ?? 0) | DESCRIPTOR_ONLY_CONTENT_FLAG, // always append the "descriptor only" flag when handling request from the frontend
        keys: KeySet.fromJSON(options.keys),
      };
      // Here we send a plain JSON string but we will parse it to DescriptorJSON on the frontend. This way we are
      // bypassing unnecessary deserialization and serialization.
      return Presentation.getManager(requestOptions.clientId)[_presentation_manager_detail].getContentDescriptor(options) as unknown as
        | DescriptorJSON
        | undefined;
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

  public override async getPagedContent(
    token: IModelRpcProps,
    requestOptions: Paged<ContentRpcRequestOptions>,
  ): PresentationRpcResponse<{ descriptor: DescriptorJSON; contentSet: PagedResponse<ItemJSON> } | undefined> {
    return this.makeRequest(token, "getPagedContent", requestOptions, async (options) => {
      options = enforceValidPageSize({
        ...options,
        keys: KeySet.fromJSON(options.keys),
      });

      const [size, content] = await Promise.all([
        this.getManager(requestOptions.clientId).getContentSetSize(options),
        this.getManager(requestOptions.clientId)[_presentation_manager_detail].getContent(options),
      ]);

      if (!content) {
        return undefined;
      }

      return {
        descriptor: content.descriptor.toJSON(),
        contentSet: {
          total: size,
          items: content.contentSet.map((i) => i.toJSON()),
        },
      };
    });
  }

  public override async getPagedContentSet(
    token: IModelRpcProps,
    requestOptions: Paged<ContentRpcRequestOptions>,
  ): PresentationRpcResponse<PagedResponse<ItemJSON>> {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const response = await this.getPagedContent(token, requestOptions);
    if (response.statusCode !== PresentationStatus.Success) {
      return this.errorResponse(response.statusCode, response.errorMessage, response.diagnostics);
    }
    if (!response.result) {
      return this.errorResponse(PresentationStatus.Error, `Failed to get content set (received a success response with empty result)`, response.diagnostics);
    }
    return {
      ...response,
      result: response.result.contentSet,
    };
  }

  public override async getElementProperties(
    token: IModelRpcProps,
    requestOptions: SingleElementPropertiesRpcRequestOptions,
  ): PresentationRpcResponse<ElementProperties | undefined> {
    return this.makeRequest(token, "getElementProperties", { ...requestOptions }, async (options) => {
      const { clientId, ...restOptions } = options;
      return this.getManager(clientId).getElementProperties(restOptions);
    });
  }

  public override async getPagedDistinctValues(
    token: IModelRpcProps,
    requestOptions: DistinctValuesRpcRequestOptions,
  ): PresentationRpcResponse<PagedResponse<DisplayValueGroup>> {
    return this.makeRequest(token, "getPagedDistinctValues", requestOptions, async (options) => {
      options = enforceValidPageSize({
        ...options,
        keys: KeySet.fromJSON(options.keys),
      });
      return this.getManager(requestOptions.clientId)[_presentation_manager_detail].getPagedDistinctValues(options);
    });
  }

  public override async getContentInstanceKeys(
    token: IModelRpcProps,
    requestOptions: ContentInstanceKeysRpcRequestOptions,
  ): PresentationRpcResponse<{ total: number; items: KeySetJSON }> {
    return this.makeRequest(token, "getContentInstanceKeys", requestOptions, async (options) => {
      const { displayType, ...optionsNoDisplayType } = options;
      options = enforceValidPageSize(
        {
          ...optionsNoDisplayType,
          keys: KeySet.fromJSON(optionsNoDisplayType.keys),
          descriptor: {
            displayType,
            contentFlags: ContentFlags.KeysOnly,
          },
        },
        MAX_ALLOWED_KEYS_PAGE_SIZE,
      );

      const [size, content] = await Promise.all([
        this.getManager(requestOptions.clientId).getContentSetSize(options),
        this.getManager(requestOptions.clientId)[_presentation_manager_detail].getContent(options),
      ]);

      if (size === 0 || !content) {
        return { total: 0, items: new KeySet().toJSON() };
      }

      return {
        total: size,
        items: content.contentSet.reduce((keys, item) => keys.add(item.primaryKeys), new KeySet()).toJSON(),
      };
    });
  }

  public override async getDisplayLabelDefinition(
    token: IModelRpcProps,
    requestOptions: DisplayLabelRpcRequestOptions,
  ): PresentationRpcResponse<LabelDefinition> {
    return this.makeRequest(token, "getDisplayLabelDefinition", requestOptions, async (options) => {
      const label = await this.getManager(requestOptions.clientId)[_presentation_manager_detail].getDisplayLabelDefinition(options);
      return label;
    });
  }

  public override async getPagedDisplayLabelDefinitions(
    token: IModelRpcProps,
    requestOptions: DisplayLabelsRpcRequestOptions,
  ): PresentationRpcResponse<PagedResponse<LabelDefinition>> {
    const pageOpts = enforceValidPageSize({ paging: { start: 0, size: requestOptions.keys.length } });
    if (pageOpts.paging.size < requestOptions.keys.length) {
      requestOptions.keys.splice(pageOpts.paging.size);
    }
    return this.makeRequest(token, "getPagedDisplayLabelDefinitions", requestOptions, async (options) => {
      const labels = await this.getManager(requestOptions.clientId)[_presentation_manager_detail].getDisplayLabelDefinitions({
        ...options,
        keys: options.keys,
      });
      return {
        total: options.keys.length,
        items: labels,
      };
    });
  }

  /* eslint-disable @typescript-eslint/no-deprecated */
  public override async getSelectionScopes(token: IModelRpcProps, requestOptions: SelectionScopeRpcRequestOptions): PresentationRpcResponse<SelectionScope[]> {
    return this.makeRequest(token, "getSelectionScopes", requestOptions, async (options) =>
      this.getManager(requestOptions.clientId).getSelectionScopes(options),
    );
  }

  public override async computeSelection(token: IModelRpcProps, requestOptions: ComputeSelectionRpcRequestOptions): PresentationRpcResponse<KeySetJSON> {
    return this.makeRequest(token, "computeSelection", requestOptions, async (options) => {
      const keys = await this.getManager(requestOptions.clientId).computeSelection(options);
      return keys.toJSON();
    });
  }
  /* eslint-enable @typescript-eslint/no-deprecated */
}

const enforceValidPageSize = <TOptions extends Paged<object>>(
  requestOptions: TOptions,
  maxPageSize = MAX_ALLOWED_PAGE_SIZE,
): TOptions & { paging: PageOptions } => {
  const validPageSize = getValidPageSize(requestOptions.paging?.size, maxPageSize);
  if (!requestOptions.paging || requestOptions.paging.size !== validPageSize) {
    return { ...requestOptions, paging: { ...requestOptions.paging, size: validPageSize } };
  }
  return requestOptions as TOptions & { paging: PageOptions };
};

const getValidPageSize = (size: number | undefined, maxPageSize: number) => {
  const requestedSize = size ?? 0;
  return requestedSize === 0 || requestedSize > maxPageSize ? maxPageSize : requestedSize;
};

// not testing temporary solution
/* c8 ignore start */
function createStatusCategoryHandler() {
  return (e: Error) => {
    if (e instanceof PresentationError) {
      switch (e.errorNumber) {
        case PresentationStatus.NotInitialized:
          return new (class extends ErrorCategory {
            public name = "Internal server error";
            public code = 500;
          })();
        case PresentationStatus.Canceled:
          return new (class extends SuccessCategory {
            public name = "Cancelled";
            public code = 204;
          })();
        case PresentationStatus.ResultSetTooLarge:
          return new (class extends ErrorCategory {
            public name = "Result set is too large";
            public code = 413;
          })();
        case PresentationStatus.Error:
        case PresentationStatus.InvalidArgument:
          return new (class extends ErrorCategory {
            public name = "Invalid request props";
            public code = 422;
          })();
      }
    }
    return undefined;
  };
}
/* c8 ignore end */
