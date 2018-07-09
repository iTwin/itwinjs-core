/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import * as path from "path";
import { IDisposable } from "@bentley/bentleyjs-core";
import { IModelDb } from "@bentley/imodeljs-backend";
import {
  ECPresentationManager as ECPresentationManagerDefinition,
  ECPresentationError, ECPresentationStatus,
  HierarchyRequestOptions, NodeKey, Node, NodePathElement,
  ContentRequestOptions, SelectionInfo, Content, Descriptor,
  RequestOptions, Paged, KeySet, InstanceKey, PresentationRuleSet,
} from "@bentley/ecpresentation-common";
import { listReviver as nodesListReviver } from "@bentley/ecpresentation-common/lib/hierarchy/Node";
import { listReviver as nodePathElementReviver } from "@bentley/ecpresentation-common/lib/hierarchy/NodePathElement";
import { NativePlatformDefinition, createDefaultNativePlatform, NativePlatformRequestTypes } from "./NativePlatform"
import UserSettingsManager from "./UserSettingsManager";

/**
 * Properties that can be used to configure [[ECPresentationManager]]
 */
export interface Props {
  /** @hidden */
  addon?: NativePlatformDefinition;

  /**
   * A list of directories containing presentation rulesets.
   */
  rulesetDirectories?: string[];

  /**
   * A list of directories containing locale-specific localized
   * string files (in simplified i18next v3 format)
   */
  localeDirectories?: string[];

  /**
   * Sets the active locale to use when localizing presentation-related
   * strings. It can later be changed through ECPresentationManager.
   */
  activeLocale?: string;
}

/**
 * Backend ECPresentation manager which pulls the presentation data from
 * an iModel.
 */
export default class ECPresentationManager implements ECPresentationManagerDefinition<IModelDb>, IDisposable {

  private _addon?: NativePlatformDefinition;
  private _settings: UserSettingsManager;
  private _activeLocale?: string;
  private _isDisposed: boolean;

  /**
   * Creates an instance of ECPresentationManager.
   * @param props Optional configuration properties.
   */
  constructor(props?: Props) {
    this._isDisposed = false;
    if (props && props.addon)
      this._addon = props.addon;
    if (props && props.rulesetDirectories)
      this.getNativePlatform().setupRulesetDirectories(props.rulesetDirectories);
    if (props)
      this.activeLocale = props.activeLocale;
    this.setupLocaleDirectories(props);
    this._settings = new UserSettingsManager(this.getNativePlatform);
  }

  /**
   * Dispose the presentation manager. Must be called to clean up native resources.
   */
  public dispose() {
    if (this._addon) {
      this.getNativePlatform().dispose();
      this._addon = undefined;
    }
    this._isDisposed = true;
  }

  public get settings(): UserSettingsManager {
    return this._settings;
  }

  /** @hidden */
  public getNativePlatform = (): NativePlatformDefinition => {
    if (this._isDisposed)
      throw new ECPresentationError(ECPresentationStatus.UseAfterDisposal, "Attempting to use ECPresentation manager after disposal");
    if (!this._addon) {
      const addonImpl = createDefaultNativePlatform();
      this._addon = new addonImpl();
    }
    return this._addon!;
  }

  private setupLocaleDirectories(props?: Props) {
    const localeDirectories = [path.join(__dirname, "assets", "locales")];
    if (props && props.localeDirectories) {
      props.localeDirectories.forEach((dir) => {
        if (-1 === localeDirectories.indexOf(dir))
          localeDirectories.push(dir);
      });
    }
    this.getNativePlatform().setupLocaleDirectories(localeDirectories);
  }

  /**
   * Get currently active locale
   */
  public get activeLocale(): string | undefined {
    return this._activeLocale;
  }

  /**
   * Set active locale
   */
  public set activeLocale(locale: string | undefined) {
    if (this.activeLocale !== locale) {
      this._activeLocale = locale;
      this.getNativePlatform().setActiveLocale(locale ? locale : "");
    }
  }

  /**
   * Register a presentation rule set.
   */
  public async addRuleSet(ruleSet: PresentationRuleSet): Promise<void> {
    return this.getNativePlatform().addRuleSet(JSON.stringify(ruleSet));
  }

  /**
   * Register presentation rule set with the specified ID.
   */
  public async removeRuleSet(ruleSetId: string): Promise<void> {
    return this.getNativePlatform().removeRuleSet(ruleSetId);
  }

  /**
   * Unregister all presentation rule sets.
   */
  public async clearRuleSets(): Promise<void> {
    return this.getNativePlatform().clearRuleSets();
  }

  public async getRootNodes(imodel: IModelDb, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetRootNodes, {
      pageOptions,
      options,
    });
    return this.request<Node[]>(imodel, params, nodesListReviver);
  }

  public async getRootNodesCount(imodel: IModelDb, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetRootNodesCount, {
      options,
    });
    return this.request<number>(imodel, params);
  }

  public async getChildren(imodel: IModelDb, parentKey: Readonly<NodeKey>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetChildren, {
      nodeKey: parentKey,
      pageOptions,
      options,
    });
    return this.request<Node[]>(imodel, params, nodesListReviver);
  }

  public async getChildrenCount(imodel: IModelDb, parentKey: Readonly<NodeKey>, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetChildrenCount, {
      nodeKey: parentKey,
      options,
    });
    return this.request<number>(imodel, params);
  }

  public getNodePaths(imodel: IModelDb, paths: InstanceKey[][], markedIndex: number, options: object): Promise<NodePathElement[]> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetNodePaths, { paths, markedIndex, options });
    return this.request<NodePathElement[]>(imodel, params, nodePathElementReviver);
  }

  public getFilteredNodePaths(imodel: IModelDb, filterText: string, options: object): Promise<NodePathElement[]> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetFilteredNodePaths, { filterText, options });
    return this.request<NodePathElement[]>(imodel, params, nodePathElementReviver);
  }

  public async getContentDescriptor(imodel: IModelDb, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined, options: object): Promise<Readonly<Descriptor> | undefined> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContentDescriptor, {
      displayType,
      keys,
      selection,
      options,
    });
    return this.request<Descriptor | undefined>(imodel, params, Descriptor.reviver);
  }

  public async getContentSetSize(imodel: IModelDb, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContentSetSize, {
      keys,
      descriptorOverrides: descriptor.createDescriptorOverrides(),
      options,
    });
    return this.request<number>(imodel, params);
  }

  public async getContent(imodel: IModelDb, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<Readonly<Content>> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContent, {
      keys,
      descriptorOverrides: descriptor.createDescriptorOverrides(),
      pageOptions,
      options,
    });
    return this.request<Content>(imodel, params, Content.reviver);
  }

  public async getDistinctValues(imodel: IModelDb, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, options: object, maximumValueCount: number = 0): Promise<string[]> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetDistinctValues, {
      descriptorOverrides: descriptor.createDescriptorOverrides(),
      keys,
      fieldName,
      maximumValueCount,
      options,
    });
    return this.request<string[]>(imodel, params);
  }

  private async request<T>(imodel: IModelDb, params: string, reviver?: (key: string, value: any) => any): Promise<T> {
    const imodelAddon = this.getNativePlatform().getImodelAddon(imodel);
    const serializedResponse = await this.getNativePlatform().handleRequest(imodelAddon, params);
    if (!serializedResponse)
      throw new ECPresentationError(ECPresentationStatus.InvalidResponse, `Received invalid response from the addon: ${serializedResponse}`);
    return JSON.parse(serializedResponse, reviver);
  }

  private createRequestParams(requestId: string, requestParams: object): string {
    const request = {
      requestId,
      params: requestParams,
    };
    return JSON.stringify(request);
  }
}
