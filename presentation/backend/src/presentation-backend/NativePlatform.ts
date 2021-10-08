/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { IModelDb, IModelHost, IModelJsNative } from "@itwin/core-backend";
import { IDisposable } from "@itwin/core-bentley";
import { FormatProps } from "@itwin/core-quantity";
import {
  DiagnosticsScopeLogs, NodeKeyJSON, PresentationError, PresentationStatus, UpdateInfoJSON, VariableValue, VariableValueJSON, VariableValueTypes,
} from "@itwin/presentation-common";
import { HierarchyCacheMode, PresentationManagerMode } from "./PresentationManager";

/** @internal */
export enum NativePlatformRequestTypes {
  GetRootNodes = "GetRootNodes",
  GetRootNodesCount = "GetRootNodesCount",
  GetChildren = "GetChildren",
  GetChildrenCount = "GetChildrenCount",
  GetNodePaths = "GetNodePaths",
  GetFilteredNodePaths = "GetFilteredNodePaths",
  GetContentSources = "GetContentSources",
  GetContentDescriptor = "GetContentDescriptor",
  GetContentSetSize = "GetContentSetSize",
  GetContent = "GetContent",
  GetDistinctValues = "GetDistinctValues",
  GetPagedDistinctValues = "GetPagedDistinctValues",
  GetDisplayLabel = "GetDisplayLabel",
  CompareHierarchies = "CompareHierarchies",
}

/**
 * Enumeration of unit systems supported by native presentation manager.
 * @internal
 */
export enum NativePresentationUnitSystem {
  Metric = "metric",
  BritishImperial = "british-imperial",
  UsCustomary = "us-customary",
  UsSurvey = "us-survey",
}

/** @internal */
export interface NativePresentationDefaultUnitFormats {
  [phenomenon: string]: {
    unitSystems: NativePresentationUnitSystem[];
    format: FormatProps;
  };
}

/** @internal */
export interface NativePresentationKeySetJSON {
  instanceKeys: Array<[string, string[]]>;
  nodeKeys: NodeKeyJSON[];
}

/** @internal */
export interface NativePlatformResponse<TResult> {
  result: TResult;
  diagnostics?: DiagnosticsScopeLogs;
}

/** @internal */
export interface NativePlatformDefinition extends IDisposable {
  getImodelAddon(imodel: IModelDb): any;

  setupRulesetDirectories(directories: string[]): NativePlatformResponse<void>;
  setupSupplementalRulesetDirectories(directories: string[]): NativePlatformResponse<void>;

  forceLoadSchemas(db: any): Promise<NativePlatformResponse<void>>;

  getRulesets(rulesetId: string): NativePlatformResponse<string>;
  addRuleset(serializedRulesetJson: string): NativePlatformResponse<string>;
  removeRuleset(rulesetId: string, hash: string): NativePlatformResponse<boolean>;
  clearRulesets(): NativePlatformResponse<void>;

  handleRequest(db: any, options: string): Promise<NativePlatformResponse<string>>;

  getRulesetVariableValue(rulesetId: string, variableId: string, type: VariableValueTypes): NativePlatformResponse<VariableValue>;
  setRulesetVariableValue(rulesetId: string, variableId: string, type: VariableValueTypes, value: VariableValue): NativePlatformResponse<void>;
  unsetRulesetVariableValue(rulesetId: string, variableId: string): NativePlatformResponse<void>;

  getUpdateInfo(): NativePlatformResponse<UpdateInfoJSON | undefined>;
  updateHierarchyState(db: any, rulesetId: string, changeType: "nodesExpanded" | "nodesCollapsed", serializedKeys: string): NativePlatformResponse<void>;
}

/** @internal */
export interface DefaultNativePlatformProps {
  id: string;
  localeDirectories: string[];
  taskAllocationsMap: { [priority: number]: number };
  mode: PresentationManagerMode;
  isChangeTrackingEnabled: boolean;
  cacheConfig?: IModelJsNative.ECPresentationHierarchyCacheConfig;
  contentCacheSize?: number;
  defaultFormats?: NativePresentationDefaultUnitFormats;
  useMmap?: boolean | number;
}

/** @internal */
export const createDefaultNativePlatform = (props: DefaultNativePlatformProps): new () => NativePlatformDefinition => {
  // note the implementation is constructed here to make PresentationManager
  // usable without loading the actual addon (if addon is set to something other)
  return class implements NativePlatformDefinition {
    private _nativeAddon: IModelJsNative.ECPresentationManager;
    public constructor() {
      const mode = (props.mode === PresentationManagerMode.ReadOnly) ? IModelJsNative.ECPresentationManagerMode.ReadOnly : IModelJsNative.ECPresentationManagerMode.ReadWrite;
      const cacheConfig = props.cacheConfig ?? { mode: HierarchyCacheMode.Disk, directory: "" };
      const defaultFormats = props.defaultFormats ? this.getSerializedDefaultFormatsMap(props.defaultFormats) : {};
      this._nativeAddon = new IModelHost.platform.ECPresentationManager({ ...props, mode, cacheConfig, defaultFormats });
    }
    private getStatus(responseStatus: IModelJsNative.ECPresentationStatus): PresentationStatus {
      switch (responseStatus) {
        case IModelJsNative.ECPresentationStatus.InvalidArgument: return PresentationStatus.InvalidArgument;
        case IModelJsNative.ECPresentationStatus.Canceled: return PresentationStatus.Canceled;
        default: return PresentationStatus.Error;
      }
    }
    private getSerializedDefaultFormatsMap(defaultMap: NativePresentationDefaultUnitFormats) {
      const res: {
        [phenomenon: string]: {
          unitSystems: string[];
          serializedFormat: string;
        };
      } = {};
      Object.keys(defaultMap).forEach((key) => {
        const value = defaultMap[key];
        res[key] = { unitSystems: value.unitSystems, serializedFormat: JSON.stringify(value.format) };
      });

      return res;
    }
    private createSuccessResponse<T>(response: IModelJsNative.ECPresentationManagerResponse<T>): NativePlatformResponse<T> {
      const retValue: NativePlatformResponse<T> = { result: response.result! };
      if (response.diagnostics)
        retValue.diagnostics = response.diagnostics;
      return retValue;
    }
    private handleResult<T>(response: IModelJsNative.ECPresentationManagerResponse<T>): NativePlatformResponse<T> {
      if (response.error)
        throw new PresentationError(this.getStatus(response.error.status), response.error.message);
      return this.createSuccessResponse(response);
    }
    private handleVoidResult(response: IModelJsNative.ECPresentationManagerResponse<void>): NativePlatformResponse<void> {
      if (response.error)
        throw new PresentationError(this.getStatus(response.error.status), response.error.message);
      return this.createSuccessResponse(response);
    }
    public dispose() {
      this._nativeAddon.dispose();
    }
    public async forceLoadSchemas(db: any): Promise<NativePlatformResponse<void>> {
      const response = await this._nativeAddon.forceLoadSchemas(db);
      if (response.error)
        throw new PresentationError(PresentationStatus.Error, response.error.message);
      return this.createSuccessResponse(response);
    }
    public setupRulesetDirectories(directories: string[]) {
      return this.handleVoidResult(this._nativeAddon.setupRulesetDirectories(directories));
    }
    public setupSupplementalRulesetDirectories(directories: string[]) {
      return this.handleVoidResult(this._nativeAddon.setupSupplementalRulesetDirectories(directories));
    }
    public getImodelAddon(imodel: IModelDb): any {
      if (!imodel.nativeDb)
        throw new PresentationError(PresentationStatus.InvalidArgument, "imodel");
      return imodel.nativeDb;
    }
    public getRulesets(rulesetId: string) {
      return this.handleResult(this._nativeAddon.getRulesets(rulesetId));
    }
    public addRuleset(serializedRulesetJson: string) {
      return this.handleResult(this._nativeAddon.addRuleset(serializedRulesetJson));
    }
    public removeRuleset(rulesetId: string, hash: string) {
      return this.handleResult(this._nativeAddon.removeRuleset(rulesetId, hash));
    }
    public clearRulesets() {
      return this.handleVoidResult(this._nativeAddon.clearRulesets());
    }
    public async handleRequest(db: any, options: string) {
      const requestGuid = this.handleResult(this._nativeAddon.queueRequest(db, options)).result;
      return new Promise((resolve: (result: NativePlatformResponse<any>) => void, reject) => {
        const interval = setInterval(() => {
          const pollResult = this._nativeAddon.pollResponse(requestGuid);
          if (pollResult.error) {
            if (pollResult.error.status !== IModelJsNative.ECPresentationStatus.Pending) {
              reject(new PresentationError(this.getStatus(pollResult.error.status), pollResult.error.message));
              clearInterval(interval);
            }
            return; // ignore 'pending' responses
          }
          resolve(this.createSuccessResponse(pollResult));
          clearInterval(interval);
        }, 20);
      });
    }
    public getRulesetVariableValue(rulesetId: string, variableId: string, type: VariableValueTypes) {
      return this.handleResult(this._nativeAddon.getRulesetVariableValue(rulesetId, variableId, type));
    }
    public setRulesetVariableValue(rulesetId: string, variableId: string, type: VariableValueTypes, value: VariableValueJSON) {
      return this.handleVoidResult(this._nativeAddon.setRulesetVariableValue(rulesetId, variableId, type, value));
    }
    public unsetRulesetVariableValue(rulesetId: string, variableId: string) {
      return this.handleVoidResult(this._nativeAddon.unsetRulesetVariableValue(rulesetId, variableId));
    }
    public getUpdateInfo() {
      return this.handleResult(this._nativeAddon.getUpdateInfo());
    }
    public updateHierarchyState(db: any, rulesetId: string, changeType: "nodesExpanded" | "nodesCollapsed", serializedKeys: string) {
      return this.handleResult(this._nativeAddon.updateHierarchyState(db, rulesetId, changeType, serializedKeys));
    }
  };
};
