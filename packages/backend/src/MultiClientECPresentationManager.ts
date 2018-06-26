/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IModelDb } from "@bentley/imodeljs-backend";
import {
  IRulesetManager, IUserSettingsManager,
  HierarchyRequestOptions, NodeKey, Node, NodePathElement,
  ContentRequestOptions, SelectionInfo, Content, Descriptor,
  RequestOptions, Paged, KeySet, InstanceKey,
} from "@bentley/ecpresentation-common";
import IBackendECPresentationManager, { Props as IBackendECPresentationManagerProps } from "./IBackendECPresentationManager";
import SingleClientECPresentationManager from "./SingleClientECPresentationManager";

/**
 * Properties that can be used to configure [[MultiClientECPresentationManager]]
 *
 * @hidden
 */
export interface Props extends IBackendECPresentationManagerProps {
  /**
   * Factory method for creating separate managers for each client
   * @hidden
   */
  clientManagerFactory?: (clientId: string, props: IBackendECPresentationManagerProps) => IBackendECPresentationManager;
}

/**
 * Backend ECPresentation manager which creates a separate presentation manager
 * for every client. This allows clients to configure managers independently, e.g.
 * have separate rulesets with same ids, user settings, etc.
 *
 * @hidden
 */
export default class MultiClientECPresentationManager implements IBackendECPresentationManager {

  private _clientManagers: Map<string, IBackendECPresentationManager>;
  private _props: Props;

  /**
   * Creates an instance of [[MultiClientECPresentationManager]].
   * @param props Optional configuration properties.
   */
  constructor(props?: Props) {
    this._props = props || {};
    this._clientManagers = new Map<string, IBackendECPresentationManager>();
  }

  /**
   * Dispose the presentation manager. Must be called to clean up native resources.
   */
  public dispose() {
    this._clientManagers.forEach((mgr) => mgr.dispose());
    this._clientManagers.clear();
  }

  private createClientManager(clientId: string): IBackendECPresentationManager {
    const props: IBackendECPresentationManagerProps = {
      localeDirectories: this._props.localeDirectories,
      rulesetDirectories: this._props.rulesetDirectories,
      activeLocale: this._props.activeLocale,
    };
    if (this._props.clientManagerFactory)
      return this._props.clientManagerFactory(clientId, props);
    return new SingleClientECPresentationManager(props);
  }

  private getClientManager(clientId: string): IBackendECPresentationManager {
    if (!this._clientManagers.has(clientId)) {
      this._clientManagers.set(clientId, this.createClientManager(clientId));
    }
    return this._clientManagers.get(clientId)!;
  }

  private getClientId(input: RequestOptions<IModelDb> | string | undefined): string {
    const clientId: string | undefined = (!input || typeof input === "string") ? input : input.clientId;
    return clientId || "";
  }

  /**
   * Currently active locale used to localize presentation data.
   */
  public get activeLocale() { return this._props.activeLocale; }
  public set activeLocale(value: string | undefined) {
    this._props.activeLocale = value;
    this._clientManagers.forEach((mgr) => mgr.activeLocale = value);
  }

  /**
   * Get rulesets manager for specific client
   */
  public rulesets(clientId?: string): IRulesetManager {
    return this.getClientManager(this.getClientId(clientId)).rulesets();
  }

  /**
   * Get settings manager for specific ruleset and client
   * @param rulesetId Id of the ruleset to get settings manager for
   */
  public settings(rulesetId: string, clientId?: string): IUserSettingsManager {
    return this.getClientManager(this.getClientId(clientId)).settings(rulesetId);
  }

  public async getRootNodes(requestOptions: Paged<HierarchyRequestOptions<IModelDb>>): Promise<ReadonlyArray<Readonly<Node>>> {
    return this.getClientManager(this.getClientId(requestOptions)).getRootNodes(requestOptions);
  }

  public async getRootNodesCount(requestOptions: HierarchyRequestOptions<IModelDb>): Promise<number> {
    return this.getClientManager(this.getClientId(requestOptions)).getRootNodesCount(requestOptions);
  }

  public async getChildren(requestOptions: Paged<HierarchyRequestOptions<IModelDb>>, parentKey: Readonly<NodeKey>): Promise<ReadonlyArray<Readonly<Node>>> {
    return this.getClientManager(this.getClientId(requestOptions)).getChildren(requestOptions, parentKey);
  }

  public async getChildrenCount(requestOptions: HierarchyRequestOptions<IModelDb>, parentKey: Readonly<NodeKey>): Promise<number> {
    return this.getClientManager(this.getClientId(requestOptions)).getChildrenCount(requestOptions, parentKey);
  }

  public async getNodePaths(requestOptions: HierarchyRequestOptions<IModelDb>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> {
    return this.getClientManager(this.getClientId(requestOptions)).getNodePaths(requestOptions, paths, markedIndex);
  }

  public async getFilteredNodePaths(requestOptions: HierarchyRequestOptions<IModelDb>, filterText: string): Promise<NodePathElement[]> {
    return this.getClientManager(this.getClientId(requestOptions)).getFilteredNodePaths(requestOptions, filterText);
  }

  public async getContentDescriptor(requestOptions: ContentRequestOptions<IModelDb>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined> {
    return this.getClientManager(this.getClientId(requestOptions)).getContentDescriptor(requestOptions, displayType, keys, selection);
  }

  public async getContentSetSize(requestOptions: ContentRequestOptions<IModelDb>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number> {
    return this.getClientManager(this.getClientId(requestOptions)).getContentSetSize(requestOptions, descriptor, keys);
  }

  public async getContent(requestOptions: Paged<ContentRequestOptions<IModelDb>>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Readonly<Content>> {
    return this.getClientManager(this.getClientId(requestOptions)).getContent(requestOptions, descriptor, keys);
  }

  public async getDistinctValues(requestOptions: ContentRequestOptions<IModelDb>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number = 0): Promise<string[]> {
    return this.getClientManager(this.getClientId(requestOptions)).getDistinctValues(requestOptions, descriptor, keys, fieldName, maximumValueCount);
  }
}
