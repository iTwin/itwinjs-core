/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import * as path from "path";
import { IModelDb } from "@bentley/imodeljs-backend";
import {
  ECPresentationError, ECPresentationStatus,
  HierarchyRequestOptions, NodeKey, Node, NodePathElement,
  ContentRequestOptions, SelectionInfo, Content, Descriptor,
  IUserSettingsManager, IRulesetManager,
  RequestOptions, Paged, KeySet, InstanceKey,
} from "@bentley/ecpresentation-common";
import { listReviver as nodesListReviver } from "@bentley/ecpresentation-common/lib/hierarchy/Node";
import { listReviver as nodePathElementReviver } from "@bentley/ecpresentation-common/lib/hierarchy/NodePathElement";
import { NativePlatformDefinition, createDefaultNativePlatform, NativePlatformRequestTypes } from "./NativePlatform";
import UserSettingsManager from "./UserSettingsManager";
import RulesetManager from "./RulesetManager";
import IBackendECPresentationManager, { Props as IBackendECPresentationManagerProps } from "./IBackendECPresentationManager";

/**
 * Properties that can be used to configure [[SingleClientECPresentationManager]]
 *
 * @hidden
 */
export interface Props extends IBackendECPresentationManagerProps {
  /** @hidden */
  addon?: NativePlatformDefinition;
}

/**
 * Backend ECPresentation manager which pulls the presentation data from
 * an iModel using native platform.
 *
 * @hidden
 */
export default class SingleClientECPresentationManager implements IBackendECPresentationManager {

  private _nativePlatform?: NativePlatformDefinition;
  private _rulesets: RulesetManager;
  private _isDisposed: boolean;
  public activeLocale: string | undefined;

  /**
   * Creates an instance of ECPresentationManager.
   * @param props Optional configuration properties.
   */
  constructor(props?: Props) {
    this._isDisposed = false;
    if (props && props.addon)
      this._nativePlatform = props.addon;
    if (props && props.rulesetDirectories)
      this.getNativePlatform().setupRulesetDirectories(props.rulesetDirectories);
    if (props)
      this.activeLocale = props.activeLocale;
    this.setupLocaleDirectories(props);
    this._rulesets = new RulesetManager(this.getNativePlatform);
  }

  /**
   * Dispose the presentation manager. Must be called to clean up native resources.
   */
  public dispose() {
    if (this._nativePlatform) {
      this.getNativePlatform().dispose();
      this._nativePlatform = undefined;
    }
    this._isDisposed = true;
  }

  /**
   * Get rulesets manager
   */
  public rulesets(): IRulesetManager { return this._rulesets; }

  /**
   * Get settings manager for specific ruleset
   * @param rulesetId Id of the ruleset to get settings manager for
   */
  public settings(rulesetId: string): IUserSettingsManager {
    return new UserSettingsManager(this.getNativePlatform, rulesetId);
  }

  /** @hidden */
  public getNativePlatform = (): NativePlatformDefinition => {
    if (this._isDisposed)
      throw new ECPresentationError(ECPresentationStatus.UseAfterDisposal, "Attempting to use ECPresentation manager after disposal");
    if (!this._nativePlatform) {
      const nativePlatformImpl = createDefaultNativePlatform();
      this._nativePlatform = new nativePlatformImpl();
    }
    return this._nativePlatform!;
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

  public async getRootNodes(requestOptions: Paged<HierarchyRequestOptions<IModelDb>>): Promise<ReadonlyArray<Readonly<Node>>> {
    const params = this.createRequestParams(NativePlatformRequestTypes.GetRootNodes, requestOptions);
    return this.request<Node[]>(requestOptions.imodel, params, nodesListReviver);
  }

  public async getRootNodesCount(requestOptions: HierarchyRequestOptions<IModelDb>): Promise<number> {
    const params = this.createRequestParams(NativePlatformRequestTypes.GetRootNodesCount, requestOptions);
    return this.request<number>(requestOptions.imodel, params);
  }

  public async getChildren(requestOptions: Paged<HierarchyRequestOptions<IModelDb>>, parentKey: Readonly<NodeKey>): Promise<ReadonlyArray<Readonly<Node>>> {
    const params = this.createRequestParams(NativePlatformRequestTypes.GetChildren, requestOptions, {
      nodeKey: parentKey,
    });
    return this.request<Node[]>(requestOptions.imodel, params, nodesListReviver);
  }

  public async getChildrenCount(requestOptions: HierarchyRequestOptions<IModelDb>, parentKey: Readonly<NodeKey>): Promise<number> {
    const params = this.createRequestParams(NativePlatformRequestTypes.GetChildrenCount, requestOptions, {
      nodeKey: parentKey,
    });
    return this.request<number>(requestOptions.imodel, params);
  }

  public async getNodePaths(requestOptions: HierarchyRequestOptions<IModelDb>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    const params = this.createRequestParams(NativePlatformRequestTypes.GetNodePaths, requestOptions, {
      paths,
      markedIndex,
    });
    return this.request<NodePathElement[]>(requestOptions.imodel, params, nodePathElementReviver);
  }

  public async getFilteredNodePaths(requestOptions: HierarchyRequestOptions<IModelDb>, filterText: string): Promise<NodePathElement[]> {
    const params = this.createRequestParams(NativePlatformRequestTypes.GetFilteredNodePaths, requestOptions, {
      filterText,
    });
    return this.request<NodePathElement[]>(requestOptions.imodel, params, nodePathElementReviver);
  }

  public async getContentDescriptor(requestOptions: ContentRequestOptions<IModelDb>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined> {
    const params = this.createRequestParams(NativePlatformRequestTypes.GetContentDescriptor, requestOptions, {
      displayType,
      keys,
      selection,
    });
    return this.request<Descriptor | undefined>(requestOptions.imodel, params, Descriptor.reviver);
  }

  public async getContentSetSize(requestOptions: ContentRequestOptions<IModelDb>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number> {
    const params = this.createRequestParams(NativePlatformRequestTypes.GetContentSetSize, requestOptions, {
      keys,
      descriptorOverrides: descriptor.createDescriptorOverrides(),
    });
    return this.request<number>(requestOptions.imodel, params);
  }

  public async getContent(requestOptions: Paged<ContentRequestOptions<IModelDb>>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Readonly<Content>> {
    const params = this.createRequestParams(NativePlatformRequestTypes.GetContent, requestOptions, {
      keys,
      descriptorOverrides: descriptor.createDescriptorOverrides(),
    });
    return this.request<Content>(requestOptions.imodel, params, Content.reviver);
  }

  public async getDistinctValues(requestOptions: ContentRequestOptions<IModelDb>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number = 0): Promise<string[]> {
    const params = this.createRequestParams(NativePlatformRequestTypes.GetDistinctValues, requestOptions, {
      descriptorOverrides: descriptor.createDescriptorOverrides(),
      keys,
      fieldName,
      maximumValueCount,
    });
    return this.request<string[]>(requestOptions.imodel, params);
  }

  private async request<T>(imodel: IModelDb, params: string, reviver?: (key: string, value: any) => any): Promise<T> {
    const imodelAddon = this.getNativePlatform().getImodelAddon(imodel);
    const serializedResponse = await this.getNativePlatform().handleRequest(imodelAddon, params);
    if (!serializedResponse)
      throw new ECPresentationError(ECPresentationStatus.InvalidResponse, `Received invalid response from the addon: ${serializedResponse}`);
    return JSON.parse(serializedResponse, reviver);
  }

  private createRequestParams(requestId: string, genericOptions: Paged<RequestOptions<IModelDb>>, additionalOptions?: object): string {
    const { clientId, imodel, locale, ...genericOptionsStripped } = genericOptions;
    const request = {
      requestId,
      params: {
        locale: locale ? locale : this.activeLocale,
        ...genericOptionsStripped,
        ...additionalOptions,
      },
    };
    return JSON.stringify(request);
  }
}
