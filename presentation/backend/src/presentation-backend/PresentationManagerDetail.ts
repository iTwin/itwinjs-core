/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/ban-ts-comment */

import * as hash from "object-hash";
import * as path from "path";
import { IModelDb, IModelJsNative, IpcHost } from "@itwin/core-backend";
import { BeEvent, Logger } from "@itwin/core-bentley";
import { UnitSystemKey } from "@itwin/core-quantity";
import {
  CompressedClassInfoJSON,
  Content,
  ContentDescriptorRequestOptions,
  ContentFlags,
  ContentRequestOptions,
  ContentSourcesRequestOptions,
  DefaultContentDisplayTypes,
  Descriptor,
  DescriptorOverrides,
  DiagnosticsOptions,
  DiagnosticsScopeLogs,
  DisplayLabelRequestOptions,
  DisplayLabelsRequestOptions,
  DisplayValueGroup,
  DistinctValuesRequestOptions,
  FilterByInstancePathsHierarchyRequestOptions,
  FilterByTextHierarchyRequestOptions,
  FormatsMap,
  HierarchyLevelDescriptorRequestOptions,
  HierarchyRequestOptions,
  InstanceKey,
  Item,
  ItemJSON,
  Key,
  KeySet,
  LabelDefinition,
  NodeKey,
  NodePathElement,
  Paged,
  PagedResponse,
  Prioritized,
  Ruleset,
  RulesetVariable,
  SelectClassInfo,
  SelectClassInfoJSON,
  UpdateInfo,
  WithCancelEvent,
} from "@itwin/presentation-common";
import { deepReplaceNullsToUndefined, PresentationIpcEvents } from "@itwin/presentation-common/internal";
import { normalizeFullClassName } from "@itwin/presentation-shared";
import { PresentationBackendLoggerCategory } from "./BackendLoggerCategory.js";
import {
  createDefaultNativePlatform,
  NativePlatformDefinition,
  NativePlatformRequestTypes,
  NativePlatformResponse,
  NativePresentationDefaultUnitFormats,
  NativePresentationKeySetJSON,
  NativePresentationUnitSystem,
  PresentationNativePlatformResponseError,
} from "./NativePlatform.js";
import { HierarchyCacheConfig, HierarchyCacheMode, PresentationManagerProps } from "./PresentationManager.js";
// @ts-ignore TS complains about `with` in CJS builds, but not ESM
import elementPropertiesRuleset from "./primary-presentation-rules/ElementProperties.PresentationRuleSet.json" with { type: "json" };
import { RulesetManager, RulesetManagerImpl } from "./RulesetManager.js";
// @ts-ignore TS complains about `with` in CJS builds, but not ESM
import bisSupplementalRuleset from "./supplemental-presentation-rules/BisCore.PresentationRuleSet.json" with { type: "json" };
// @ts-ignore TS complains about `with` in CJS builds, but not ESM
import funcSupplementalRuleset from "./supplemental-presentation-rules/Functional.PresentationRuleSet.json" with { type: "json" };
import { BackendDiagnosticsAttribute, BackendDiagnosticsOptions, combineDiagnosticsOptions, getElementKey, reportDiagnostics } from "./Utils.js";

/**
 * Produce content descriptor that is not intended for querying content. Allows the implementation to omit certain
 * operations to make obtaining content descriptor faster.
 * @internal
 */
export const DESCRIPTOR_ONLY_CONTENT_FLAG = 1 << 9;

interface PresentationManagerDetailProps extends PresentationManagerProps {
  id?: string;
  addon?: NativePlatformDefinition;
}

/** @internal */
export class PresentationManagerDetail implements Disposable {
  private _disposed: boolean;
  private _nativePlatform: NativePlatformDefinition | undefined;
  private _diagnosticsOptions: BackendDiagnosticsOptions | undefined;

  public rulesets: RulesetManager;
  public activeUnitSystem: UnitSystemKey | undefined;
  public readonly onUsed: BeEvent<() => void>;

  constructor(params: PresentationManagerDetailProps) {
    this._disposed = false;

    this._nativePlatform =
      params.addon ??
      createNativePlatform(
        params.id ?? "",
        params.workerThreadsCount ?? 2,
        IpcHost.isValid ? ipcUpdatesHandler : noopUpdatesHandler,
        params.caching,
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        params.defaultFormats,
        params.useMmap,
      );

    setupRulesets(this._nativePlatform, params.supplementalRulesetDirectories ?? [], params.rulesetDirectories ?? []);
    this.activeUnitSystem = params.defaultUnitSystem;

    this.onUsed = new BeEvent();
    this.rulesets = new RulesetManagerImpl(() => this.getNativePlatform());
    this._diagnosticsOptions = params.diagnostics;
  }

  public [Symbol.dispose](): void {
    if (this._disposed) {
      return;
    }

    this.getNativePlatform()[Symbol.dispose]();
    this._nativePlatform = undefined;
    this.onUsed.clear();

    this._disposed = true;
  }

  public getNativePlatform(): NativePlatformDefinition {
    if (this._disposed) {
      throw new Error("Attempting to use Presentation manager after disposal");
    }
    return this._nativePlatform!;
  }

  public async getNodes(
    requestOptions: WithCancelEvent<Prioritized<Paged<HierarchyRequestOptions<IModelDb, NodeKey, RulesetVariable>>>> & BackendDiagnosticsAttribute,
  ): Promise<string> {
    const { rulesetOrId, parentKey, ...strippedOptions } = requestOptions;
    const params = {
      requestId: parentKey ? NativePlatformRequestTypes.GetChildren : NativePlatformRequestTypes.GetRootNodes,
      rulesetId: this.registerRuleset(rulesetOrId),
      ...strippedOptions,
      nodeKey: parentKey,
    };
    return this.request(params);
  }

  public async getNodesCount(
    requestOptions: WithCancelEvent<Prioritized<HierarchyRequestOptions<IModelDb, NodeKey, RulesetVariable>>> & BackendDiagnosticsAttribute,
  ): Promise<number> {
    const { rulesetOrId, parentKey, ...strippedOptions } = requestOptions;
    const params = {
      requestId: parentKey ? NativePlatformRequestTypes.GetChildrenCount : NativePlatformRequestTypes.GetRootNodesCount,
      rulesetId: this.registerRuleset(rulesetOrId),
      ...strippedOptions,
      nodeKey: parentKey,
    };
    return JSON.parse(await this.request(params));
  }

  public async getNodesDescriptor(
    requestOptions: WithCancelEvent<Prioritized<HierarchyLevelDescriptorRequestOptions<IModelDb, NodeKey, RulesetVariable>>> & BackendDiagnosticsAttribute,
  ): Promise<string> {
    const { rulesetOrId, parentKey, ...strippedOptions } = requestOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetNodesDescriptor,
      rulesetId: this.registerRuleset(rulesetOrId),
      ...strippedOptions,
      nodeKey: parentKey,
    };
    return this.request(params);
  }

  public async getNodePaths(
    requestOptions: WithCancelEvent<Prioritized<FilterByInstancePathsHierarchyRequestOptions<IModelDb, RulesetVariable>>> & BackendDiagnosticsAttribute,
  ): Promise<NodePathElement[]> {
    const { rulesetOrId, instancePaths, ...strippedOptions } = requestOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetNodePaths,
      rulesetId: this.registerRuleset(rulesetOrId),
      ...strippedOptions,
      paths: instancePaths,
    };
    const paths: NodePathElement[] = deepReplaceNullsToUndefined(JSON.parse(await this.request(params)));
    return paths;
  }

  public async getFilteredNodePaths(
    requestOptions: WithCancelEvent<Prioritized<FilterByTextHierarchyRequestOptions<IModelDb, RulesetVariable>>> & BackendDiagnosticsAttribute,
  ): Promise<NodePathElement[]> {
    const { rulesetOrId, ...strippedOptions } = requestOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetFilteredNodePaths,
      rulesetId: this.registerRuleset(rulesetOrId),
      ...strippedOptions,
    };
    const paths: NodePathElement[] = deepReplaceNullsToUndefined(JSON.parse(await this.request(params)));
    return paths;
  }

  public async getContentDescriptor(requestOptions: WithCancelEvent<Prioritized<ContentDescriptorRequestOptions<IModelDb, KeySet>>>): Promise<string> {
    const { rulesetOrId, contentFlags, ...strippedOptions } = requestOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetContentDescriptor,
      rulesetId: this.registerRuleset(rulesetOrId),
      ...strippedOptions,
      contentFlags: contentFlags ?? DESCRIPTOR_ONLY_CONTENT_FLAG, // only set "descriptor only" flag if there are no flags provided
      keys: getKeysForContentRequest(requestOptions.keys, (map) => bisElementInstanceKeysProcessor(requestOptions.imodel, map)),
    };
    return this.request(params);
  }

  public async getContentSources(
    requestOptions: WithCancelEvent<Prioritized<ContentSourcesRequestOptions<IModelDb>>> & BackendDiagnosticsAttribute,
  ): Promise<SelectClassInfo[]> {
    const params = {
      requestId: NativePlatformRequestTypes.GetContentSources,
      rulesetId: "ElementProperties",
      ...requestOptions,
    };
    const json: {
      sources: SelectClassInfoJSON<string>[];
      classesMap: { [id: string]: CompressedClassInfoJSON };
    } = JSON.parse(await this.request(params));
    return deepReplaceNullsToUndefined(json.sources.map((sourceJson) => SelectClassInfo.fromCompressedJSON(sourceJson, json.classesMap)));
  }

  public async getContentSetSize(
    requestOptions: WithCancelEvent<Prioritized<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>>> &
      BackendDiagnosticsAttribute,
  ): Promise<number> {
    const { rulesetOrId, descriptor, ...strippedOptions } = requestOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetContentSetSize,
      rulesetId: this.registerRuleset(rulesetOrId),
      ...strippedOptions,
      keys: getKeysForContentRequest(requestOptions.keys, (map) => bisElementInstanceKeysProcessor(requestOptions.imodel, map)),
      descriptorOverrides: createContentDescriptorOverrides(descriptor),
    };
    return JSON.parse(await this.request(params));
  }

  public async getContentSet(
    requestOptions: WithCancelEvent<Prioritized<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>>>> &
      BackendDiagnosticsAttribute,
  ): Promise<Item[]> {
    const { rulesetOrId, descriptor, ...strippedOptions } = requestOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetContentSet,
      rulesetId: this.registerRuleset(rulesetOrId),
      ...strippedOptions,
      keys: getKeysForContentRequest(requestOptions.keys, (map) => bisElementInstanceKeysProcessor(requestOptions.imodel, map)),
      descriptorOverrides: createContentDescriptorOverrides(descriptor),
    };
    return JSON.parse(await this.request(params))
      .map((json: ItemJSON) => Item.fromJSON(deepReplaceNullsToUndefined(json)))
      .filter((item: Item | undefined): item is Item => !!item);
  }

  public async getContent(
    requestOptions: WithCancelEvent<Prioritized<Paged<ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>>>> &
      BackendDiagnosticsAttribute,
  ): Promise<Content | undefined> {
    const { rulesetOrId, descriptor, ...strippedOptions } = requestOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetContent,
      rulesetId: this.registerRuleset(rulesetOrId),
      ...strippedOptions,
      keys: getKeysForContentRequest(requestOptions.keys, (map) => bisElementInstanceKeysProcessor(requestOptions.imodel, map)),
      descriptorOverrides: createContentDescriptorOverrides(descriptor),
    };
    return Content.fromJSON(deepReplaceNullsToUndefined(JSON.parse(await this.request(params))));
  }

  public async getPagedDistinctValues(
    requestOptions: WithCancelEvent<Prioritized<DistinctValuesRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet, RulesetVariable>>> &
      BackendDiagnosticsAttribute,
  ): Promise<PagedResponse<DisplayValueGroup>> {
    const { rulesetOrId, ...strippedOptions } = requestOptions;
    const { descriptor, keys, ...strippedOptionsNoDescriptorAndKeys } = strippedOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetPagedDistinctValues,
      rulesetId: this.registerRuleset(rulesetOrId),
      ...strippedOptionsNoDescriptorAndKeys,
      keys: getKeysForContentRequest(keys, (map) => bisElementInstanceKeysProcessor(requestOptions.imodel, map)),
      descriptorOverrides: createContentDescriptorOverrides(descriptor),
    };
    return deepReplaceNullsToUndefined(JSON.parse(await this.request(params)));
  }

  public async getDisplayLabelDefinition(
    requestOptions: WithCancelEvent<Prioritized<DisplayLabelRequestOptions<IModelDb, InstanceKey>>> & BackendDiagnosticsAttribute,
  ): Promise<LabelDefinition> {
    const params = {
      requestId: NativePlatformRequestTypes.GetDisplayLabel,
      ...requestOptions,
    };
    return deepReplaceNullsToUndefined(JSON.parse(await this.request(params)));
  }

  public async getDisplayLabelDefinitions(
    requestOptions: WithCancelEvent<Prioritized<Paged<DisplayLabelsRequestOptions<IModelDb, InstanceKey>>>> & BackendDiagnosticsAttribute,
  ): Promise<LabelDefinition[]> {
    const concreteKeys = requestOptions.keys
      .map((k) => {
        if (normalizeFullClassName(k.className).toLowerCase() === "BisCore.Element".toLowerCase()) {
          return getElementKey(requestOptions.imodel, k.id);
        }
        return k;
      })
      .filter<InstanceKey>((k): k is InstanceKey => !!k);
    const contentRequestOptions: ContentRequestOptions<IModelDb, Descriptor | DescriptorOverrides, KeySet> = {
      ...requestOptions,
      rulesetOrId: "RulesDrivenECPresentationManager_RulesetId_DisplayLabel",
      descriptor: {
        displayType: DefaultContentDisplayTypes.List,
        contentFlags: ContentFlags.ShowLabels | ContentFlags.NoFields,
      },
      keys: new KeySet(concreteKeys),
    };
    const content = await this.getContent(contentRequestOptions);
    return concreteKeys.map((key) => {
      const item = content ? content.contentSet.find((it) => it.primaryKeys.length > 0 && InstanceKey.compare(it.primaryKeys[0], key) === 0) : undefined;
      if (!item) {
        return { displayValue: "", rawValue: "", typeName: "" };
      }
      return item.label;
    });
  }

  /** Registers given ruleset and replaces the ruleset with its ID in the resulting object */
  public registerRuleset(rulesetOrId: Ruleset | string): string {
    if (typeof rulesetOrId === "object") {
      const rulesetWithNativeId = { ...rulesetOrId, id: this.getRulesetId(rulesetOrId) };
      return this.rulesets.add(rulesetWithNativeId).id;
    }

    return rulesetOrId;
  }

  /** @internal */
  public getRulesetId(rulesetOrId: Ruleset | string): string {
    return getRulesetIdObject(rulesetOrId).uniqueId;
  }

  public async request(params: RequestParams): Promise<string> {
    this.onUsed.raiseEvent();
    const { requestId, imodel, unitSystem, diagnostics: requestDiagnostics, cancelEvent, ...strippedParams } = params;
    const imodelAddon = this.getNativePlatform().getImodelAddon(imodel);
    const response = await withOptionalDiagnostics([this._diagnosticsOptions, requestDiagnostics], async (diagnosticsOptions) => {
      const nativeRequestParams: any = {
        requestId,
        params: {
          unitSystem: toOptionalNativeUnitSystem(unitSystem ?? this.activeUnitSystem),
          ...strippedParams,
          ...(diagnosticsOptions ? { diagnostics: diagnosticsOptions } : undefined),
        },
      };
      return this.getNativePlatform().handleRequest(imodelAddon, JSON.stringify(nativeRequestParams), cancelEvent);
    });
    return response.result;
  }
}

async function withOptionalDiagnostics(
  diagnosticsOptions: Array<BackendDiagnosticsOptions | undefined>,
  nativePlatformRequestHandler: (combinedDiagnosticsOptions: DiagnosticsOptions | undefined) => Promise<NativePlatformResponse<string>>,
): Promise<NativePlatformResponse<string>> {
  const contexts = diagnosticsOptions.map((d) => d?.requestContextSupplier?.());
  const combinedOptions = combineDiagnosticsOptions(...diagnosticsOptions);
  let responseDiagnostics: DiagnosticsScopeLogs | undefined;
  try {
    const response = await nativePlatformRequestHandler(combinedOptions);
    responseDiagnostics = response.diagnostics;
    return response;
  } catch (e) {
    if (e instanceof PresentationNativePlatformResponseError) {
      responseDiagnostics = e.diagnostics;
    }
    throw e;
    /* c8 ignore next */
  } finally {
    if (responseDiagnostics) {
      const diagnostics = { logs: [responseDiagnostics] };
      diagnosticsOptions.forEach((options, i) => {
        options && reportDiagnostics(diagnostics, options, contexts[i]);
      });
    }
  }
}

interface RequestParams {
  diagnostics?: BackendDiagnosticsOptions;
  requestId: string;
  imodel: IModelDb;
  unitSystem?: UnitSystemKey;
  cancelEvent?: BeEvent<() => void>;
}

function setupRulesets(nativePlatform: NativePlatformDefinition, supplementalRulesetDirectories: string[], primaryRulesetDirectories: string[]): void {
  nativePlatform.addRuleset(JSON.stringify(elementPropertiesRuleset));
  nativePlatform.registerSupplementalRuleset(JSON.stringify(bisSupplementalRuleset));
  nativePlatform.registerSupplementalRuleset(JSON.stringify(funcSupplementalRuleset));
  nativePlatform.setupSupplementalRulesetDirectories(collateAssetDirectories(supplementalRulesetDirectories));
  nativePlatform.setupRulesetDirectories(collateAssetDirectories(primaryRulesetDirectories));
}

interface RulesetIdObject {
  uniqueId: string;
  parts: {
    id: string;
    hash?: string;
  };
}

/** @internal */
export function getRulesetIdObject(rulesetOrId: Ruleset | string): RulesetIdObject {
  if (typeof rulesetOrId === "object") {
    if (IpcHost.isValid) {
      // in case of native apps we don't want to enforce ruleset id uniqueness as ruleset variables
      // are stored on a backend and creating new id will lose those variables
      return {
        uniqueId: rulesetOrId.id,
        parts: { id: rulesetOrId.id },
      };
    }

    const hashedId = hash.MD5(rulesetOrId);
    return {
      uniqueId: `${rulesetOrId.id}-${hashedId}`,
      parts: {
        id: rulesetOrId.id,
        hash: hashedId,
      },
    };
  }

  return { uniqueId: rulesetOrId, parts: { id: rulesetOrId } };
}

/** @internal */
export function getKeysForContentRequest(
  keys: Readonly<KeySet>,
  classInstanceKeysProcessor?: (keys: Map<string, Set<string>>) => void,
): NativePresentationKeySetJSON {
  const result: NativePresentationKeySetJSON = {
    instanceKeys: [],
    nodeKeys: [],
  };
  const classInstancesMap = new Map<string, Set<string>>();
  keys.forEach((key) => {
    if (Key.isNodeKey(key)) {
      result.nodeKeys.push(key);
    }

    if (Key.isInstanceKey(key)) {
      addInstanceKey(classInstancesMap, key);
    }
  });

  if (classInstanceKeysProcessor) {
    classInstanceKeysProcessor(classInstancesMap);
  }

  for (const entry of classInstancesMap) {
    if (entry[1].size > 0) {
      result.instanceKeys.push([entry["0"], [...entry[1]]]);
    }
  }

  return result;
}

/** @internal */
export function bisElementInstanceKeysProcessor(imodel: IModelDb, classInstancesMap: Map<string, Set<string>>) {
  const elementClassName = "BisCore:Element";
  const elementIds = classInstancesMap.get(elementClassName);
  if (elementIds) {
    const deleteElementIds = new Array<string>();
    elementIds.forEach((elementId) => {
      const concreteKey = getElementKey(imodel, elementId);
      if (concreteKey && concreteKey.className !== elementClassName) {
        deleteElementIds.push(elementId);
        addInstanceKey(classInstancesMap, { className: concreteKey.className, id: elementId });
      }
    });
    for (const id of deleteElementIds) {
      elementIds.delete(id);
    }
  }
}

function addInstanceKey(classInstancesMap: Map<string, Set<string>>, key: InstanceKey): void {
  let set = classInstancesMap.get(key.className);
  if (!set) {
    set = new Set();
    classInstancesMap.set(key.className, set);
  }
  set.add(key.id);
}

function createNativePlatform(
  id: string,
  workerThreadsCount: number,
  updateCallback: (updateInfo: UpdateInfo | undefined) => void,
  caching: PresentationManagerProps["caching"],
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  defaultFormats: FormatsMap | undefined,
  useMmap: boolean | number | undefined,
): NativePlatformDefinition {
  return new (createDefaultNativePlatform({
    id,
    taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: workerThreadsCount },
    updateCallback,
    cacheConfig: createCacheConfig(caching?.hierarchies),
    contentCacheSize: caching?.content?.size,
    workerConnectionCacheSize: caching?.workerConnectionCacheSize,
    defaultFormats: toNativeUnitFormatsMap(defaultFormats),
    useMmap,
  }))();

  function createCacheConfig(config?: HierarchyCacheConfig): IModelJsNative.ECPresentationHierarchyCacheConfig {
    switch (config?.mode) {
      case HierarchyCacheMode.Disk:
        return { ...config, directory: normalizeDirectory(config.directory) };

      case HierarchyCacheMode.Hybrid:
        return {
          ...config,
          disk: config.disk ? { ...config.disk, directory: normalizeDirectory(config.disk.directory) } : undefined,
        };

      case HierarchyCacheMode.Memory:
        return config;

      default:
        return { mode: HierarchyCacheMode.Disk, directory: "" };
    }
  }

  function normalizeDirectory(directory?: string): string {
    return directory ? path.resolve(directory) : "";
  }

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  function toNativeUnitFormatsMap(map: FormatsMap | undefined): NativePresentationDefaultUnitFormats | undefined {
    if (!map) {
      return undefined;
    }

    const nativeFormatsMap: NativePresentationDefaultUnitFormats = {};
    Object.entries(map).forEach(([phenomenon, formats]) => {
      nativeFormatsMap[phenomenon] = (Array.isArray(formats) ? formats : [formats]).map((unitSystemsFormat) => ({
        unitSystems: unitSystemsFormat.unitSystems.map(toNativeUnitSystem),
        format: unitSystemsFormat.format,
      }));
    });
    return nativeFormatsMap;
  }
}

function toOptionalNativeUnitSystem(unitSystem: UnitSystemKey | undefined): NativePresentationUnitSystem | undefined {
  return unitSystem ? toNativeUnitSystem(unitSystem) : undefined;
}

function toNativeUnitSystem(unitSystem: UnitSystemKey): NativePresentationUnitSystem {
  switch (unitSystem) {
    case "imperial":
      return NativePresentationUnitSystem.BritishImperial;
    case "metric":
      return NativePresentationUnitSystem.Metric;
    case "usCustomary":
      return NativePresentationUnitSystem.UsCustomary;
    case "usSurvey":
      return NativePresentationUnitSystem.UsSurvey;
  }
}

function collateAssetDirectories(dirs: string[]): string[] {
  return [...new Set(dirs)];
}
const createContentDescriptorOverrides = (descriptorOrOverrides: Descriptor | DescriptorOverrides): DescriptorOverrides => {
  if (descriptorOrOverrides instanceof Descriptor) {
    return descriptorOrOverrides.createDescriptorOverrides();
  }
  return descriptorOrOverrides;
};

function parseUpdateInfo(info: UpdateInfo | undefined) {
  if (info === undefined) {
    return undefined;
  }

  const parsedInfo: UpdateInfo = {};
  for (const fileName in info) {
    /* c8 ignore next 3 */
    if (!info.hasOwnProperty(fileName)) {
      continue;
    }

    const imodelDb = IModelDb.findByFilename(fileName);
    if (!imodelDb) {
      Logger.logError(PresentationBackendLoggerCategory.PresentationManager, `Update records IModelDb not found with path ${fileName}`);
      continue;
    }

    parsedInfo[imodelDb.getRpcProps().key] = info[fileName];
  }
  return Object.keys(parsedInfo).length > 0 ? parsedInfo : undefined;
}

/** @internal */
export function ipcUpdatesHandler(info: UpdateInfo | undefined) {
  const parsed = parseUpdateInfo(info);
  if (parsed) {
    IpcHost.send(PresentationIpcEvents.Update, parsed);
  }
}

/** @internal */
/* c8 ignore next */
export function noopUpdatesHandler(_info: UpdateInfo | undefined) {}
