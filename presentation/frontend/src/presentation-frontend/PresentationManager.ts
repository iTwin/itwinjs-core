/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { BeEvent, CompressedId64Set, OrderedId64Iterable } from "@itwin/core-bentley";
import { IModelApp, IModelConnection, IpcApp } from "@itwin/core-frontend";
import { UnitSystemKey } from "@itwin/core-quantity";
import { SchemaContext } from "@itwin/ecschema-metadata";
import {
  ClientDiagnosticsAttribute,
  Content,
  ContentDescriptorRequestOptions,
  ContentFlags,
  ContentInstanceKeysRequestOptions,
  ContentRequestOptions,
  ContentSourcesRequestOptions,
  ContentUpdateInfo,
  DefaultContentDisplayTypes,
  Descriptor,
  DescriptorOverrides,
  DisplayLabelRequestOptions,
  DisplayLabelsRequestOptions,
  DisplayValueGroup,
  DistinctValuesRequestOptions,
  ElementProperties,
  FilterByInstancePathsHierarchyRequestOptions,
  FilterByTextHierarchyRequestOptions,
  FormatsMap,
  HierarchyLevelDescriptorRequestOptions,
  HierarchyRequestOptions,
  HierarchyUpdateInfo,
  InstanceKey,
  Item,
  ItemJSON,
  Key,
  KeySet,
  KoqPropertyValueFormatter,
  LabelDefinition,
  Node,
  NodeKey,
  NodePathElement,
  Paged,
  PagedResponse,
  PageOptions,
  Ruleset,
  RulesetVariable,
  SelectClassInfo,
  SingleElementPropertiesRequestOptions,
  UpdateInfo,
  VariableValueTypes,
} from "@itwin/presentation-common";
import {
  buildElementProperties,
  ContentFormatter,
  ContentPropertyValueFormatter,
  PresentationIpcEvents,
  RpcRequestsHandler,
} from "@itwin/presentation-common/internal";
import { TRANSIENT_ELEMENT_CLASSNAME } from "@itwin/unified-selection";
import { ensureIModelInitialized, startIModelInitialization } from "./IModelConnectionInitialization.js";
import { _presentation_manager_ipcRequestsHandler, _presentation_manager_rpcRequestsHandler } from "./InternalSymbols.js";
import { IpcRequestsHandler } from "./IpcRequestsHandler.js";
import { FrontendLocalizationHelper } from "./LocalizationHelper.js";
import { RulesetManager, RulesetManagerImpl } from "./RulesetManager.js";
import { RulesetVariablesManager, RulesetVariablesManagerImpl } from "./RulesetVariablesManager.js";
import { StreamedResponseGenerator } from "./StreamedResponseGenerator.js";

/**
 * Data structure that describes IModel hierarchy change event arguments.
 * @public
 * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
 */
export interface IModelHierarchyChangeEventArgs {
  /** Id of ruleset that was used to create hierarchy. */
  rulesetId: string;
  /** Hierarchy changes info. */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  updateInfo: HierarchyUpdateInfo;
  /** Key of iModel that was used to create hierarchy. It matches [[IModelConnection.key]] property. */
  imodelKey: string;
}

/**
 * Data structure that describes iModel content change event arguments.
 * @public
 */
export interface IModelContentChangeEventArgs {
  /** Id of ruleset that was used to create content. */
  rulesetId: string;
  /** Content changes info. */
  updateInfo: ContentUpdateInfo;
  /** Key of iModel that was used to create content. It matches [[IModelConnection.key]] property. */
  imodelKey: string;
}

/**
 * Options for requests that can return multiple pages of items concurrently.
 * @public
 */
export type MultipleValuesRequestOptions = Paged<{
  /**
   * Max number of requests that should be made to the backend to fulfill the whole request.
   * `undefined` means no limit, so in that case all requests are sent at once.
   */
  maxParallelRequests?: number;

  /**
   * Size of a single batch when fetching data through multiple requests. If not set,
   * the fall back is requested page size. If the page size is not set, the backend
   * decides how many items to return.
   */
  batchSize?: number;
}>;

/**
 * Options for requests that retrieve nodes.
 * @public
 * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
 */
export type GetNodesRequestOptions = HierarchyRequestOptions<IModelConnection, NodeKey, RulesetVariable> & ClientDiagnosticsAttribute;

/**
 * Options for requests that retrieve content.
 * @public
 */
export type GetContentRequestOptions = ContentRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet, RulesetVariable> &
  ClientDiagnosticsAttribute;

/**
 * Options for requests that retrieve distinct values.
 * @public
 */
export type GetDistinctValuesRequestOptions = DistinctValuesRequestOptions<IModelConnection, Descriptor | DescriptorOverrides, KeySet, RulesetVariable> &
  ClientDiagnosticsAttribute;

/**
 * Properties used to configure [[PresentationManager]]
 * @public
 */
export interface PresentationManagerProps {
  /**
   * Sets the active locale to use when localizing presentation-related
   * strings. It can later be changed through [[PresentationManager]].
   */
  activeLocale?: string;

  /**
   * Sets the active unit system to use for formatting property values with
   * units. The  value can later be changed through [[PresentationManager.activeUnitSystem]] setter or
   * overriden for each request through request parameters. If not set, `IModelApp.quantityFormatter.activeUnitSystem`
   * is used by default.
   *
   * @deprecated in 4.0 - will not be removed until after 2026-06-13. Use [IModelApp.quantityFormatter]($core-frontend) to set the active unit system.
   */
  activeUnitSystem?: UnitSystemKey;

  /**
   * ID used to identify client that requests data. Generally, clients should
   * store this ID in their local storage so the ID can be reused across
   * sessions - this allows reusing some caches.
   *
   * Defaults to a unique GUID as a client id.
   */
  clientId?: string;

  /**
   * Timeout (in milliseconds) for how long we're going to wait for RPC request to be fulfilled before throwing
   * a timeout error.
   *
   * Defaults to 10 minutes.
   */
  requestTimeout?: number;

  /**
   * Callback that provides [SchemaContext]($ecschema-metadata) for supplied [IModelConnection]($core-frontend).
   * [SchemaContext]($ecschema-metadata) is used for getting metadata required for values formatting.
   *
   * @deprecated in 5.1 - will not be removed until after 2026-08-08. By default [IModelConnection.schemaContext]($core-frontend) is now used instead.
   */
  schemaContextProvider?: (imodel: IModelConnection) => SchemaContext;

  /**
   * A map of default unit formats to use for formatting properties that don't have a presentation format
   * in requested unit system.
   *
   * @note Only has effect when frontend value formatting is enabled by supplying the `schemaContextProvider` prop.
   *
   * @deprecated in 5.1 - will not be removed until after 2026-08-08. All formats' logic is now handled by [IModelApp.formatsProvider]($core-frontend). Until the prop is removed, when
   * supplied, this map will be used as a fallback if IModelApp's formats provider doesn't return anything for requested format.
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  defaultFormats?: FormatsMap;
}

/** @internal */
interface PresentationManagerInternalProps {
  rpcRequestsHandler?: RpcRequestsHandler;
  ipcRequestsHandler?: IpcRequestsHandler;
}

/**
 * Frontend Presentation manager which basically just forwards all calls to
 * the backend implementation.
 *
 * @public
 */
export class PresentationManager implements Disposable {
  private _requestsHandler: RpcRequestsHandler;
  private _rulesets: RulesetManager;
  private _localizationHelper: FrontendLocalizationHelper;
  private _explicitActiveUnitSystem: UnitSystemKey | undefined;
  private _rulesetVars: Map<string, RulesetVariablesManager>;
  private _clearEventListener?: () => void;
  private _schemaContextProvider: (imodel: IModelConnection) => SchemaContext;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  private _defaultFormats?: FormatsMap;
  private _ipcRequestsHandler?: IpcRequestsHandler;

  /**
   * An event raised when hierarchies created using specific ruleset change.
   *
   * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
   * package for creating hierarchies.
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public onIModelHierarchyChanged = new BeEvent<(args: IModelHierarchyChangeEventArgs) => void>();

  /**
   * An event raised when content created using specific ruleset changes
   */
  public onIModelContentChanged = new BeEvent<(args: IModelContentChangeEventArgs) => void>();

  /**
   * Get / set active unit system used to format property values with units.
   *
   * @deprecated in 4.0 - will not be removed until after 2026-06-13. `IModelApp.quantityFormatter` should be used to get/set the active unit system. At the moment
   * [[PresentationManager]] allows overriding it, but returns `IModelApp.quantityFormatter.activeUnitSystem` if override
   * is not set.
   */
  public get activeUnitSystem(): UnitSystemKey {
    return this._explicitActiveUnitSystem ?? IModelApp.quantityFormatter.activeUnitSystem;
  }
  public set activeUnitSystem(value: UnitSystemKey | undefined) {
    this._explicitActiveUnitSystem = value;
  }

  private constructor(props?: PresentationManagerProps) {
    if (props) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      this._explicitActiveUnitSystem = props.activeUnitSystem;
    }

    this._requestsHandler =
      (props as PresentationManagerInternalProps)?.rpcRequestsHandler ??
      new RpcRequestsHandler(props ? { clientId: props.clientId, timeout: props.requestTimeout } : undefined);
    this._rulesetVars = new Map<string, RulesetVariablesManager>();
    this._rulesets = RulesetManagerImpl.create();
    this._localizationHelper = new FrontendLocalizationHelper(props?.activeLocale);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this._schemaContextProvider = props?.schemaContextProvider ?? ((imodel: IModelConnection) => imodel.schemaContext);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this._defaultFormats = props?.defaultFormats;

    if (IpcApp.isValid) {
      // Ipc only works in ipc apps, so the `onUpdate` callback will only be called there.
      this._clearEventListener = IpcApp.addListener(PresentationIpcEvents.Update, this.onUpdate);
      this._ipcRequestsHandler = (props as PresentationManagerInternalProps)?.ipcRequestsHandler ?? new IpcRequestsHandler(this._requestsHandler.clientId);
    }
  }

  /** Get / set active locale used for localizing presentation data */
  public get activeLocale(): string | undefined {
    return this._localizationHelper.locale;
  }
  public set activeLocale(locale: string | undefined) {
    this._localizationHelper.locale = locale;
  }

  public [Symbol.dispose]() {
    if (this._clearEventListener) {
      this._clearEventListener();
      this._clearEventListener = undefined;
    }
  }

  /** @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [Symbol.dispose] instead. */
  /* c8 ignore next 3 */
  public dispose() {
    this[Symbol.dispose]();
  }

  private onUpdate = (_evt: Event, report: UpdateInfo) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.handleUpdateAsync(report);
  };

  /** @note This is only called in native apps after changes in iModels */
  private async handleUpdateAsync(report: UpdateInfo) {
    for (const imodelKey in report) {
      /* c8 ignore next 3 */
      if (!report.hasOwnProperty(imodelKey)) {
        continue;
      }

      const imodelReport = report[imodelKey];
      for (const rulesetId in imodelReport) {
        /* c8 ignore next 3 */
        if (!imodelReport.hasOwnProperty(rulesetId)) {
          continue;
        }

        const updateInfo = imodelReport[rulesetId];
        if (updateInfo.content) {
          this.onIModelContentChanged.raiseEvent({ rulesetId, updateInfo: updateInfo.content, imodelKey });
        }
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        if (updateInfo.hierarchy) {
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          this.onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: updateInfo.hierarchy, imodelKey });
        }
      }
    }
  }

  /**
   * Create a new PresentationManager instance
   * @param props Optional properties used to configure the manager
   */
  public static create(props?: PresentationManagerProps) {
    return new PresentationManager(props);
  }

  /** @internal */
  public get [_presentation_manager_rpcRequestsHandler]() {
    return this._requestsHandler;
  }

  /** @internal */
  public get [_presentation_manager_ipcRequestsHandler]() {
    return this._ipcRequestsHandler;
  }

  /**
   * Get rulesets manager
   */
  public rulesets() {
    return this._rulesets;
  }

  /**
   * Get ruleset variables manager for specific ruleset
   * @param rulesetId Id of the ruleset to get the vars manager for
   */
  public vars(rulesetId: string) {
    if (!this._rulesetVars.has(rulesetId)) {
      const varsManager = new RulesetVariablesManagerImpl(rulesetId, this._ipcRequestsHandler);
      this._rulesetVars.set(rulesetId, varsManager);
    }
    return this._rulesetVars.get(rulesetId)!;
  }

  private toRpcTokenOptions<TOptions extends { imodel: IModelConnection; locale?: string; unitSystem?: UnitSystemKey; rulesetVariables?: RulesetVariable[] }>(
    requestOptions: TOptions,
  ) {
    // 1. put default `locale` and `unitSystem`
    // 2. put all `requestOptions` members (if `locale` or `unitSystem` are set, they'll override the defaults put at #1)
    // 3. put `imodel` of type `IModelRpcProps` which overwrites the `imodel` from `requestOptions` put at #2
    const defaultOptions: Pick<TOptions, "locale" | "unitSystem"> = {};
    if (this.activeLocale) {
      defaultOptions.locale = this.activeLocale;
    }
    defaultOptions.unitSystem = this.activeUnitSystem; // eslint-disable-line @typescript-eslint/no-deprecated

    const { imodel, rulesetVariables, ...rpcRequestOptions } = requestOptions;
    return {
      ...defaultOptions,
      ...rpcRequestOptions,
      ...(rulesetVariables ? { rulesetVariables: rulesetVariables.map(RulesetVariable.toJSON) } : {}),
      imodel: imodel.getRpcProps(),
    };
  }

  private async addRulesetAndVariablesToOptions<TOptions extends { rulesetOrId: Ruleset | string; rulesetVariables?: RulesetVariable[] }>(options: TOptions) {
    const { rulesetOrId, rulesetVariables } = options;
    let foundRulesetOrId: Ruleset | string;
    if (typeof rulesetOrId === "object") {
      foundRulesetOrId = rulesetOrId;
    } else {
      const foundRuleset = await this._rulesets.get(rulesetOrId);
      foundRulesetOrId = foundRuleset ? foundRuleset.toJSON() : rulesetOrId;
    }
    const rulesetId = typeof foundRulesetOrId === "object" ? foundRulesetOrId.id : foundRulesetOrId;

    // All Id64Array variable values must be sorted for serialization to JSON to work. RulesetVariablesManager
    // sorts them before storing, so that part is taken care of, but we need to ensure that variables coming from
    // request options are also sorted.
    const variables = (rulesetVariables ?? []).map((variable) => {
      if (variable.type === VariableValueTypes.Id64Array) {
        return { ...variable, value: OrderedId64Iterable.sortArray(variable.value) };
      }
      return variable;
    });
    if (!this._ipcRequestsHandler) {
      // only need to add variables from variables manager if there's no IPC
      // handler - if there is one, the variables are already known by the backend
      variables.push(...this.vars(rulesetId).getAllVariables());
    }

    return { ...options, rulesetOrId: foundRulesetOrId, rulesetVariables: variables };
  }

  /* eslint-disable @typescript-eslint/no-deprecated */

  /**
   * Returns an iterator that polls nodes asynchronously.
   * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
   * package for creating hierarchies.
   */
  public async getNodesIterator(
    requestOptions: GetNodesRequestOptions & MultipleValuesRequestOptions,
  ): Promise<{ total: number; items: AsyncIterableIterator<Node> }> {
    startIModelInitialization(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options });

    const generator = new StreamedResponseGenerator({
      ...requestOptions,
      getBatch: async (paging) => {
        const result = await this._requestsHandler.getPagedNodes({ ...rpcOptions, paging });
        return {
          total: result.total,
          items: this._localizationHelper.getLocalizedNodes(result.items),
        };
      },
    });

    return generator.createAsyncIteratorResponse();
  }

  /**
   * Retrieves nodes.
   * @deprecated in 4.5 - will not be removed until after 2026-06-13. Use [[getNodesIterator]] instead.
   */
  public async getNodes(requestOptions: GetNodesRequestOptions & MultipleValuesRequestOptions): Promise<Node[]> {
    const result = await this.getNodesIterator(requestOptions);
    return collect(result.items);
  }

  /**
   * Retrieves nodes count.
   * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
   * package for creating hierarchies.
   */
  public async getNodesCount(requestOptions: GetNodesRequestOptions): Promise<number> {
    startIModelInitialization(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options });
    return this._requestsHandler.getNodesCount(rpcOptions);
  }

  /**
   * Retrieves total nodes count and a single page of nodes.
   * @deprecated in 4.5 - will not be removed until after 2026-06-13. Use [[getNodesIterator]] instead.
   */
  public async getNodesAndCount(requestOptions: GetNodesRequestOptions & MultipleValuesRequestOptions): Promise<{ count: number; nodes: Node[] }> {
    const result = await this.getNodesIterator(requestOptions);
    return {
      count: result.total,
      nodes: await collect(result.items),
    };
  }

  /**
   * Retrieves hierarchy level descriptor.
   * @public
   * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
   * package for creating hierarchies.
   */
  public async getNodesDescriptor(
    requestOptions: HierarchyLevelDescriptorRequestOptions<IModelConnection, NodeKey, RulesetVariable> & ClientDiagnosticsAttribute,
  ): Promise<Descriptor | undefined> {
    startIModelInitialization(requestOptions.imodel);
    try {
      const options = await this.addRulesetAndVariablesToOptions(requestOptions);
      const rpcOptions = this.toRpcTokenOptions({ ...options });
      const result = await this._requestsHandler.getNodesDescriptor(rpcOptions);
      const descriptor = Descriptor.fromJSON(result);
      return descriptor ? this._localizationHelper.getLocalizedContentDescriptor(descriptor) : undefined;
    } finally {
      await ensureIModelInitialized(requestOptions.imodel);
    }
  }

  /**
   * Retrieves paths from root nodes to children nodes according to specified keys. Intersecting paths will be merged.
   * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
   * package for creating hierarchies.
   */
  public async getNodePaths(
    requestOptions: FilterByInstancePathsHierarchyRequestOptions<IModelConnection, RulesetVariable> & ClientDiagnosticsAttribute,
  ): Promise<NodePathElement[]> {
    startIModelInitialization(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({ ...options });
    const result = await this._requestsHandler.getNodePaths(rpcOptions);
    return result.map((npe) => this._localizationHelper.getLocalizedNodePathElement(npe));
  }

  /**
   * Retrieves paths from root nodes to nodes containing filter text in their label.
   * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
   * package for creating hierarchies.
   */
  public async getFilteredNodePaths(
    requestOptions: FilterByTextHierarchyRequestOptions<IModelConnection, RulesetVariable> & ClientDiagnosticsAttribute,
  ): Promise<NodePathElement[]> {
    startIModelInitialization(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const result = await this._requestsHandler.getFilteredNodePaths(this.toRpcTokenOptions(options));
    return result.map((npe) => this._localizationHelper.getLocalizedNodePathElement(npe));
  }

  /* eslint-enable @typescript-eslint/no-deprecated */

  /**
   * Get information about the sources of content when building it for specific ECClasses. Sources involve classes of the primary select instance,
   * its related instances for loading related and navigation properties.
   * @public
   */
  public async getContentSources(requestOptions: ContentSourcesRequestOptions<IModelConnection> & ClientDiagnosticsAttribute): Promise<SelectClassInfo[]> {
    startIModelInitialization(requestOptions.imodel);
    const rpcOptions = this.toRpcTokenOptions(requestOptions);
    const result = await this._requestsHandler.getContentSources(rpcOptions);
    return result.sources.map((sourceJson) => SelectClassInfo.fromCompressedJSON(sourceJson, result.classesMap));
  }

  /** Retrieves the content descriptor which describes the content and can be used to customize it. */
  public async getContentDescriptor(
    requestOptions: ContentDescriptorRequestOptions<IModelConnection, KeySet, RulesetVariable> & ClientDiagnosticsAttribute,
  ): Promise<Descriptor | undefined> {
    startIModelInitialization(requestOptions.imodel);
    try {
      const options = await this.addRulesetAndVariablesToOptions(requestOptions);
      const rpcOptions = this.toRpcTokenOptions({
        ...options,
        keys: stripTransientElementKeys(options.keys).toJSON(),
      });
      const result = await this._requestsHandler.getContentDescriptor(rpcOptions);
      const descriptor = Descriptor.fromJSON(result);
      return descriptor ? this._localizationHelper.getLocalizedContentDescriptor(descriptor) : undefined;
    } finally {
      await ensureIModelInitialized(requestOptions.imodel);
    }
  }

  /** Retrieves overall content set size. */
  public async getContentSetSize(requestOptions: GetContentRequestOptions): Promise<number> {
    startIModelInitialization(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = this.toRpcTokenOptions({
      ...options,
      descriptor: getDescriptorOverrides(requestOptions.descriptor),
      keys: stripTransientElementKeys(requestOptions.keys).toJSON(),
    });
    return this._requestsHandler.getContentSetSize(rpcOptions);
  }

  private async getContentIteratorInternal(
    requestOptions: GetContentRequestOptions & MultipleValuesRequestOptions,
  ): Promise<{ descriptor: Descriptor; total: number; items: AsyncIterableIterator<Item> } | undefined> {
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const firstPageSize = options.batchSize ?? requestOptions.paging?.size;
    const rpcOptions = this.toRpcTokenOptions({
      ...options,
      descriptor: getDescriptorOverrides(requestOptions.descriptor),
      keys: stripTransientElementKeys(requestOptions.keys).toJSON(),
      omitFormattedValues: true,
      ...(firstPageSize ? { paging: { ...requestOptions.paging, size: firstPageSize } } : undefined),
    });

    let contentFormatter: ContentFormatter | undefined;
    if (!requestOptions.omitFormattedValues) {
      const schemaContext = this._schemaContextProvider(requestOptions.imodel);
      const unitSystem = requestOptions.unitSystem ?? this._explicitActiveUnitSystem ?? IModelApp.quantityFormatter.activeUnitSystem;
      const koqPropertyFormatter = new KoqPropertyValueFormatter({
        schemaContext,
        formatsProvider: IModelApp.formatsProvider,
      });
      koqPropertyFormatter.defaultFormats = this._defaultFormats;
      contentFormatter = new ContentFormatter(new ContentPropertyValueFormatter(koqPropertyFormatter), unitSystem);
    }

    let descriptor = requestOptions.descriptor instanceof Descriptor ? requestOptions.descriptor : undefined;
    let firstPage: PagedResponse<ItemJSON> | undefined;
    if (!descriptor) {
      const firstPageResponse = await this._requestsHandler.getPagedContent(rpcOptions);
      if (!firstPageResponse?.descriptor || !firstPageResponse.contentSet) {
        return undefined;
      }
      descriptor = Descriptor.fromJSON(firstPageResponse?.descriptor);
      firstPage = firstPageResponse?.contentSet;
    }

    /* c8 ignore next 3 */
    if (!descriptor) {
      return undefined;
    }

    descriptor = this._localizationHelper.getLocalizedContentDescriptor(descriptor);

    const getPage = async (paging: Required<PageOptions>, requestIndex: number) => {
      let contentSet = requestIndex === 0 ? firstPage : undefined;
      contentSet ??= await this._requestsHandler.getPagedContentSet({ ...rpcOptions, paging });

      let items = contentSet.items.map((x) => Item.fromJSON(x)).filter((x): x is Item => x !== undefined);
      if (contentFormatter) {
        items = await contentFormatter.formatContentItems(items, descriptor);
      }

      items = this._localizationHelper.getLocalizedContentItems(items);
      return {
        total: contentSet.total,
        items,
      };
    };

    const generator = new StreamedResponseGenerator({
      ...requestOptions,
      getBatch: getPage,
    });

    return {
      ...(await generator.createAsyncIteratorResponse()),
      descriptor,
    };
  }

  /** Retrieves a content descriptor, item count and async generator for the items themselves. */
  public async getContentIterator(
    requestOptions: GetContentRequestOptions & MultipleValuesRequestOptions,
  ): Promise<{ descriptor: Descriptor; total: number; items: AsyncIterableIterator<Item> } | undefined> {
    startIModelInitialization(requestOptions.imodel);
    const response = await this.getContentIteratorInternal(requestOptions);
    if (!response) {
      return undefined;
    }

    await ensureIModelInitialized(requestOptions.imodel);
    return response;
  }

  /**
   * Retrieves content which consists of a content descriptor and a page of records.
   * @deprecated in 4.5 - will not be removed until after 2026-06-13. Use [[getContentIterator]] instead.
   */
  public async getContent(requestOptions: GetContentRequestOptions & MultipleValuesRequestOptions): Promise<Content | undefined> {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return (await this.getContentAndSize(requestOptions))?.content;
  }

  /**
   * Retrieves content set size and content which consists of a content descriptor and a page of records.
   * @deprecated in 4.5 - will not be removed until after 2026-06-13. Use [[getContentIterator]] instead.
   */
  public async getContentAndSize(
    requestOptions: GetContentRequestOptions & MultipleValuesRequestOptions,
  ): Promise<{ content: Content; size: number } | undefined> {
    const response = await this.getContentIterator(requestOptions);
    if (!response) {
      return undefined;
    }

    const { descriptor, total } = response;
    const items = await collect(response.items);
    return {
      content: new Content(descriptor, items),
      size: total,
    };
  }

  /** Returns an iterator that asynchronously polls distinct values of specific field from the content. */
  public async getDistinctValuesIterator(
    requestOptions: GetDistinctValuesRequestOptions & MultipleValuesRequestOptions,
  ): Promise<{ total: number; items: AsyncIterableIterator<DisplayValueGroup> }> {
    startIModelInitialization(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = {
      ...this.toRpcTokenOptions(options),
      descriptor: getDescriptorOverrides(options.descriptor),
      keys: stripTransientElementKeys(options.keys).toJSON(),
    };

    const generator = new StreamedResponseGenerator({
      ...requestOptions,
      getBatch: async (paging) => {
        const response = await this._requestsHandler.getPagedDistinctValues({ ...rpcOptions, paging });
        return {
          total: response.total,
          items: response.items.map((x) => this._localizationHelper.getLocalizedDisplayValueGroup(x)),
        };
      },
    });

    return generator.createAsyncIteratorResponse();
  }

  /**
   * Retrieves distinct values of specific field from the content.
   * @deprecated in 4.5 - will not be removed until after 2026-06-13. Use [[getDistinctValuesIterator]] instead.
   */
  public async getPagedDistinctValues(
    requestOptions: GetDistinctValuesRequestOptions & MultipleValuesRequestOptions,
  ): Promise<PagedResponse<DisplayValueGroup>> {
    const result = await this.getDistinctValuesIterator(requestOptions);
    return {
      total: result.total,
      items: await collect(result.items),
    };
  }

  /**
   * Retrieves property data in a simplified format for a single element specified by ID.
   * @public
   */
  public async getElementProperties<TParsedContent = ElementProperties>(
    requestOptions: SingleElementPropertiesRequestOptions<IModelConnection, TParsedContent> & ClientDiagnosticsAttribute,
  ): Promise<TParsedContent | undefined> {
    startIModelInitialization(requestOptions.imodel);
    type TParser = Required<typeof requestOptions>["contentParser"];
    const { elementId, contentParser, ...optionsNoElementId } = requestOptions;
    const parser: TParser = contentParser ?? (buildElementProperties as TParser);
    const iter = await this.getContentIterator({
      ...optionsNoElementId,
      descriptor: {
        displayType: DefaultContentDisplayTypes.PropertyPane,
        contentFlags: ContentFlags.ShowLabels,
      },
      rulesetOrId: "ElementProperties",
      keys: new KeySet([{ className: "BisCore:Element", id: elementId }]),
    });
    if (!iter || iter.total === 0) {
      return undefined;
    }
    return parser(iter.descriptor, (await iter.items.next()).value);
  }

  /**
   * Retrieves content item instance keys.
   * @public
   */
  public async getContentInstanceKeys(
    requestOptions: ContentInstanceKeysRequestOptions<IModelConnection, KeySet, RulesetVariable> & ClientDiagnosticsAttribute & MultipleValuesRequestOptions,
  ): Promise<{ total: number; items: () => AsyncGenerator<InstanceKey> }> {
    startIModelInitialization(requestOptions.imodel);
    const options = await this.addRulesetAndVariablesToOptions(requestOptions);
    const rpcOptions = {
      ...this.toRpcTokenOptions(options),
      keys: stripTransientElementKeys(options.keys).toJSON(),
    };

    const generator = new StreamedResponseGenerator({
      ...requestOptions,
      getBatch: async (page) => {
        const keys = await this._requestsHandler.getContentInstanceKeys({ ...rpcOptions, paging: page });
        return {
          total: keys.total,
          items: keys.items.instanceKeys.reduce((instanceKeys, entry) => {
            for (const id of CompressedId64Set.iterable(entry[1])) {
              instanceKeys.push({ className: entry[0], id });
            }
            return instanceKeys;
          }, new Array<InstanceKey>()),
        };
      },
    });

    const { total, items } = await generator.createAsyncIteratorResponse();
    return {
      total,
      async *items() {
        yield* items;
      },
    };
  }

  /** Retrieves display label definition of specific item. */
  public async getDisplayLabelDefinition(
    requestOptions: DisplayLabelRequestOptions<IModelConnection, InstanceKey> & ClientDiagnosticsAttribute,
  ): Promise<LabelDefinition> {
    startIModelInitialization(requestOptions.imodel);
    const rpcOptions = this.toRpcTokenOptions({ ...requestOptions });
    const result = await this._requestsHandler.getDisplayLabelDefinition(rpcOptions);
    return this._localizationHelper.getLocalizedLabelDefinition(result);
  }

  /** Retrieves display label definition of specific items. */
  public async getDisplayLabelDefinitionsIterator(
    requestOptions: DisplayLabelsRequestOptions<IModelConnection, InstanceKey> & ClientDiagnosticsAttribute & MultipleValuesRequestOptions,
  ): Promise<{ total: number; items: AsyncIterableIterator<LabelDefinition> }> {
    startIModelInitialization(requestOptions.imodel);
    const rpcOptions = this.toRpcTokenOptions({ ...requestOptions });
    const generator = new StreamedResponseGenerator({
      ...requestOptions,
      getBatch: async (page) => {
        const partialKeys = !page.start ? rpcOptions.keys : rpcOptions.keys.slice(page.start);
        const result = await this._requestsHandler.getPagedDisplayLabelDefinitions({ ...rpcOptions, keys: partialKeys });
        result.items = this._localizationHelper.getLocalizedLabelDefinitions(result.items);
        return result;
      },
    });

    return generator.createAsyncIteratorResponse();
  }

  /**
   * Retrieves display label definition of specific items.
   * @deprecated in 4.5 - will not be removed until after 2026-06-13. Use [[getDisplayLabelDefinitionsIterator]] instead.
   */
  public async getDisplayLabelDefinitions(
    requestOptions: DisplayLabelsRequestOptions<IModelConnection, InstanceKey> & ClientDiagnosticsAttribute & MultipleValuesRequestOptions,
  ): Promise<LabelDefinition[]> {
    const { items } = await this.getDisplayLabelDefinitionsIterator(requestOptions);
    return collect(items);
  }
}

const getDescriptorOverrides = (descriptorOrOverrides: Descriptor | DescriptorOverrides): DescriptorOverrides => {
  if (descriptorOrOverrides instanceof Descriptor) {
    return descriptorOrOverrides.createDescriptorOverrides();
  }
  return descriptorOrOverrides;
};

const stripTransientElementKeys = (keys: KeySet) => {
  if (!keys.some((key) => Key.isInstanceKey(key) && key.className === TRANSIENT_ELEMENT_CLASSNAME)) {
    return keys;
  }

  const copy = new KeySet();
  copy.add(keys, (key) => {
    // the callback is not going to be called with EntityProps as KeySet converts them
    // to InstanceKeys, but we want to keep the EntityProps case for correctness
    /* c8 ignore next 3 */
    const isTransient =
      (Key.isInstanceKey(key) && key.className === TRANSIENT_ELEMENT_CLASSNAME) ||
      (Key.isEntityProps(key) && key.classFullName === TRANSIENT_ELEMENT_CLASSNAME);
    return !isTransient;
  });
  return copy;
};

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const result = new Array<T>();
  for await (const value of iter) {
    result.push(value);
  }
  return result;
}
