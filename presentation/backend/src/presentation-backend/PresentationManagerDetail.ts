/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as hash from "object-hash";
import * as path from "path";
import { IModelDb, IModelJsNative, IpcHost } from "@itwin/core-backend";
import { IDisposable } from "@itwin/core-bentley";
import { UnitSystemKey } from "@itwin/core-quantity";
import {
  ContentDescriptorRequestOptions, ContentFlags, InstanceKey, Key, KeySet, PresentationError, PresentationStatus, Prioritized, Ruleset,
} from "@itwin/presentation-common";
import { PRESENTATION_BACKEND_ASSETS_ROOT, PRESENTATION_COMMON_ASSETS_ROOT } from "./Constants";
import {
  createDefaultNativePlatform, NativePlatformDefinition, NativePlatformRequestTypes, NativePresentationDefaultUnitFormats,
  NativePresentationKeySetJSON, NativePresentationUnitSystem,
} from "./NativePlatform";
import { HierarchyCacheConfig, HierarchyCacheMode, PresentationManagerMode, PresentationManagerProps, UnitSystemFormat } from "./PresentationManager";
import { RulesetManager, RulesetManagerImpl } from "./RulesetManager";
import { UpdatesTracker } from "./UpdatesTracker";
import { BackendDiagnosticsHandler, BackendDiagnosticsOptions, getElementKey, getLocalesDirectory } from "./Utils";

/** @internal */
export class PresentationManagerDetail implements IDisposable {
  private _disposed: boolean;
  private _nativePlatform: NativePlatformDefinition | undefined;
  private _updatesTracker: UpdatesTracker | undefined;
  private _onManagerUsed: (() => void) | undefined;

  public rulesets: RulesetManager;
  public activeLocale: string | undefined;
  public activeUnitSystem: UnitSystemKey | undefined;

  constructor(params: PresentationManagerProps) {
    this._disposed = false;

    const presentationAssetsRoot = params.presentationAssetsRoot ?? {
      common: PRESENTATION_COMMON_ASSETS_ROOT,
      backend: PRESENTATION_BACKEND_ASSETS_ROOT,
    };
    const mode = params.mode ?? PresentationManagerMode.ReadWrite;
    const changeTrackingEnabled = mode === PresentationManagerMode.ReadWrite && !!params.updatesPollInterval;
    this._nativePlatform = params.addon ?? createNativePlatform(
      params.id ?? "",
      typeof presentationAssetsRoot === "string" ? presentationAssetsRoot : presentationAssetsRoot.common,
      params.localeDirectories ?? [],
      params.workerThreadsCount ?? 2,
      mode,
      changeTrackingEnabled,
      params.caching,
      params.defaultFormats,
      params.useMmap,
    );

    const getNativePlatform = () => this.getNativePlatform();
    if (IpcHost.isValid && changeTrackingEnabled) {
      this._updatesTracker = UpdatesTracker.create({
        nativePlatformGetter: getNativePlatform,
        pollInterval: params.updatesPollInterval!,
      });
    } else {
      this._updatesTracker = undefined;
    }

    setupRulesetDirectories(
      this._nativePlatform,
      typeof presentationAssetsRoot === "string" ? presentationAssetsRoot : presentationAssetsRoot.backend,
      params.supplementalRulesetDirectories ?? [],
      params.rulesetDirectories ?? [],
    );
    this.activeLocale = params.defaultLocale;
    this.activeUnitSystem = params.defaultUnitSystem;

    this._onManagerUsed = undefined;
    this.rulesets = new RulesetManagerImpl(getNativePlatform);
  }

  public dispose(): void {
    if (this._disposed) {
      return;
    }

    this.getNativePlatform().dispose();
    this._nativePlatform = undefined;

    this._updatesTracker?.dispose();
    this._updatesTracker = undefined;

    this._disposed = true;
  }

  public getNativePlatform(): NativePlatformDefinition {
    if (this._disposed) {
      throw new PresentationError(
        PresentationStatus.NotInitialized,
        "Attempting to use Presentation manager after disposal",
      );
    }

    return this._nativePlatform!;
  }

  public setOnManagerUsedHandler(handler: () => void) {
    this._onManagerUsed = handler;
  }

  public async getContentDescriptor(requestOptions: Prioritized<ContentDescriptorRequestOptions<IModelDb, KeySet>>): Promise<string> {
    const { rulesetOrId, ...strippedOptions } = requestOptions;
    const params = {
      requestId: NativePlatformRequestTypes.GetContentDescriptor,
      rulesetId: this.registerRuleset(rulesetOrId),
      ...strippedOptions,
      contentFlags: ContentFlags.DescriptorOnly,
      keys: getKeysForContentRequest(requestOptions.keys, (map) => bisElementInstanceKeysProcessor(requestOptions.imodel, map)),
    };
    return this.request(params);
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
    const { requestId, imodel, locale, unitSystem, diagnostics, ...strippedParams } = params;
    this._onManagerUsed?.();

    const imodelAddon = this.getNativePlatform().getImodelAddon(imodel);
    const nativeRequestParams: any = {
      requestId,
      params: {
        locale: (locale ?? this.activeLocale)?.toLocaleLowerCase(),
        unitSystem: toOptionalNativeUnitSystem(unitSystem ?? this.activeUnitSystem),
        ...strippedParams,
      },
    };

    let diagnosticsListener: BackendDiagnosticsHandler | undefined;
    if (diagnostics) {
      const { handler: tempDiagnosticsListener, ...diagnosticsOptions } = diagnostics;
      diagnosticsListener = tempDiagnosticsListener;
      nativeRequestParams.params.diagnostics = diagnosticsOptions;
    }

    const response = await this.getNativePlatform().handleRequest(imodelAddon, JSON.stringify(nativeRequestParams));
    diagnosticsListener && response.diagnostics && diagnosticsListener({ logs: [response.diagnostics] });
    return response.result;
  }
}

interface RequestParams {
  diagnostics?: BackendDiagnosticsOptions;
  requestId: string;
  imodel: IModelDb;
  locale?: string;
  unitSystem?: UnitSystemKey;
}

function setupRulesetDirectories(
  nativePlatform: NativePlatformDefinition,
  presentationAssetsRoot: string,
  supplementalRulesetDirectoriesOverrides: string[],
  rulesetDirectories: string[],
): void {
  const supplementalRulesetDirectories = collateAssetDirectories(
    path.join(presentationAssetsRoot, "supplemental-presentation-rules"),
    supplementalRulesetDirectoriesOverrides,
  );
  nativePlatform.setupSupplementalRulesetDirectories(supplementalRulesetDirectories);

  const primaryRulesetDirectories = collateAssetDirectories(
    path.join(presentationAssetsRoot, "primary-presentation-rules"),
    rulesetDirectories,
  );
  nativePlatform.setupRulesetDirectories(primaryRulesetDirectories);
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
  // istanbul ignore else
  if (!set) {
    set = new Set();
    classInstancesMap.set(key.className, set);
  }
  set.add(key.id);
}

interface UnitFormatMap {
  [phenomenon: string]: UnitSystemFormat;
}

function createNativePlatform(
  id: string,
  presentationAssetsRoot: string,
  localeDirectories: string[],
  workerThreadsCount: number,
  mode: PresentationManagerMode,
  changeTrackingEnabled: boolean,
  caching: PresentationManagerProps["caching"],
  defaultFormats: UnitFormatMap | undefined,
  useMmap: boolean | number | undefined,
): NativePlatformDefinition {
  const collatedLocaleDirectories = collateAssetDirectories(
    getLocalesDirectory(presentationAssetsRoot),
    localeDirectories,
  );
  return new (createDefaultNativePlatform({
    id,
    localeDirectories: collatedLocaleDirectories,
    taskAllocationsMap: { [Number.MAX_SAFE_INTEGER]: workerThreadsCount },
    mode,
    isChangeTrackingEnabled: changeTrackingEnabled,
    cacheConfig: createCacheConfig(caching?.hierarchies),
    contentCacheSize: caching?.content?.size,
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

  function toNativeUnitFormatsMap(map: UnitFormatMap | undefined): NativePresentationDefaultUnitFormats | undefined {
    if (!map) {
      return undefined;
    }

    const nativeFormatsMap: NativePresentationDefaultUnitFormats = {};
    Object.keys(map).forEach((phenomenon) => {
      const unitSystemsFormat = map[phenomenon];
      nativeFormatsMap[phenomenon] = {
        unitSystems: unitSystemsFormat.unitSystems.map(toNativeUnitSystem),
        format: unitSystemsFormat.format,
      };
    });
    return nativeFormatsMap;
  }
}

function toOptionalNativeUnitSystem(unitSystem: UnitSystemKey | undefined): NativePresentationUnitSystem | undefined {
  return unitSystem ? toNativeUnitSystem(unitSystem) : undefined;
}

function toNativeUnitSystem(unitSystem: UnitSystemKey): NativePresentationUnitSystem {
  switch (unitSystem) {
    case "imperial": return NativePresentationUnitSystem.BritishImperial;
    case "metric": return NativePresentationUnitSystem.Metric;
    case "usCustomary": return NativePresentationUnitSystem.UsCustomary;
    case "usSurvey": return NativePresentationUnitSystem.UsSurvey;
  }
}

function collateAssetDirectories(mainDirectory: string, additionalDirectories: string[]): string[] {
  return [...new Set([mainDirectory, ...additionalDirectories])];
}
