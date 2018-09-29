/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IDisposable } from "@bentley/bentleyjs-core";
import { NativeECPresentationManager, NativeECPresentationStatus, ErrorStatusOrResult } from "@bentley/imodeljs-backend/lib/imodeljs-native-platform-api";
import { IModelDb, NativePlatformRegistry } from "@bentley/imodeljs-backend";
import { PresentationError, PresentationStatus } from "@bentley/presentation-common";
import { VariableValueJSON, VariableValueTypes } from "@bentley/presentation-common/lib/IRulesetVariablesManager";

/** @hidden */
export enum NativePlatformRequestTypes {
  GetRootNodes = "GetRootNodes",
  GetRootNodesCount = "GetRootNodesCount",
  GetChildren = "GetChildren",
  GetChildrenCount = "GetChildrenCount",
  GetNodePaths = "GetNodePaths",
  GetFilteredNodePaths = "GetFilteredNodePaths",
  GetContentDescriptor = "GetContentDescriptor",
  GetContentSetSize = "GetContentSetSize",
  GetContent = "GetContent",
  GetDistinctValues = "GetDistinctValues",
}

/** @hidden */
export interface NativePlatformDefinition extends IDisposable {
  setupRulesetDirectories(directories: string[]): void;
  setupLocaleDirectories(directories: string[]): void;
  getImodelAddon(imodel: IModelDb): any;
  getRulesets(rulesetId: string): string;
  addRuleset(serializedRulesetJson: string): string;
  removeRuleset(rulesetId: string, hash: string): boolean;
  clearRulesets(): void;
  handleRequest(db: any, options: string): Promise<string>;
  getRulesetVariableValue(rulesetId: string, variableId: string, type: VariableValueTypes): VariableValueJSON;
  setRulesetVariableValue(rulesetId: string, variableId: string, type: VariableValueTypes, value: VariableValueJSON): void;
}

/** @hidden */
export const createDefaultNativePlatform = (): { new(): NativePlatformDefinition; } => {
  // note the implementation is constructed here to make PresentationManager
  // usable without loading the actual addon (if addon is set to something other)
  return class implements NativePlatformDefinition {
    private _nativeAddon: NativeECPresentationManager = new (NativePlatformRegistry.getNativePlatform()).NativeECPresentationManager();
    private getStatus(responseStatus: NativeECPresentationStatus): PresentationStatus {
      switch (responseStatus) {
        case NativeECPresentationStatus.InvalidArgument: return PresentationStatus.InvalidArgument;
        default: return PresentationStatus.Error;
      }
    }
    private handleResult<T>(response: ErrorStatusOrResult<NativeECPresentationStatus, T>): T {
      if (!response)
        throw new PresentationError(PresentationStatus.InvalidResponse);
      if (response.error)
        throw new PresentationError(this.getStatus(response.error.status), response.error.message);
      if (response.result === undefined)
        throw new PresentationError(PresentationStatus.InvalidResponse);
      return response.result;
    }
    private handleVoidResult(response: ErrorStatusOrResult<NativeECPresentationStatus, void>): void {
      if (!response)
        throw new PresentationError(PresentationStatus.InvalidResponse);
      if (response.error)
        throw new PresentationError(this.getStatus(response.error.status), response.error.message);
    }
    public dispose() {
      this._nativeAddon.dispose();
    }
    public setupRulesetDirectories(directories: string[]): void {
      this.handleVoidResult(this._nativeAddon.setupRulesetDirectories(directories));
    }
    public setupLocaleDirectories(directories: string[]): void {
      this.handleVoidResult(this._nativeAddon.setupLocaleDirectories(directories));
    }
    public getImodelAddon(imodel: IModelDb): any {
      if (!imodel.briefcase || !imodel.nativeDb)
        throw new PresentationError(PresentationStatus.InvalidArgument, "imodel");
      return imodel.nativeDb;
    }
    public getRulesets(rulesetId: string): string {
      return this.handleResult(this._nativeAddon.getRulesets(rulesetId));
    }
    public addRuleset(serializedRulesetJson: string): string {
      return this.handleResult(this._nativeAddon.addRuleset(serializedRulesetJson));
    }
    public removeRuleset(rulesetId: string, hash: string): boolean {
      return this.handleResult(this._nativeAddon.removeRuleset(rulesetId, hash));
    }
    public clearRulesets(): void {
      this.handleVoidResult(this._nativeAddon.clearRulesets());
    }
    public handleRequest(db: any, options: string): Promise<string> {
      return new Promise((resolve, reject) => {
        this._nativeAddon.handleRequest(db, options, (response) => {
          try {
            resolve(this.handleResult(response));
          } catch (error) {
            reject(error);
          }
        });
      });
    }
    public getRulesetVariableValue(rulesetId: string, variableId: string, type: VariableValueTypes): VariableValueJSON {
      return this.handleResult(this._nativeAddon.getRulesetVariableValue(rulesetId, variableId, type));
    }
    public setRulesetVariableValue(rulesetId: string, variableId: string, type: VariableValueTypes, value: VariableValueJSON): void {
      this.handleVoidResult(this._nativeAddon.setRulesetVariableValue(rulesetId, variableId, type, value));
    }
  };
};
