/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IModelDb } from "@bentley/imodeljs-backend";
import {
  IRulesetManager, IRulesetVariablesManager,
  HierarchyRequestOptions, NodeKey, Node, NodePathElement,
  ContentRequestOptions, SelectionInfo, Content, Descriptor,
  RequestOptions, Paged, KeySet, InstanceKey,
} from "@bentley/ecpresentation-common";
import IBackendECPresentationManager, { Props as IBackendECPresentationManagerProps } from "./IBackendECPresentationManager";
import SingleClientECPresentationManager from "./SingleClientECPresentationManager";
import TemporaryStorage from "./TemporaryStorage";

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

  /**
   * How much time should an unused client manager be stored in memory
   * before it's disposed.
   */
  unusedClientLifetime?: number;
}

/**
 * Backend ECPresentation manager which creates a separate presentation manager
 * for every client. This allows clients to configure managers independently, e.g.
 * have separate rulesets with same ids, ruleset vars, etc.
 *
 * @hidden
 */
export default class MultiClientECPresentationManager implements IBackendECPresentationManager {

  private _clientsStorage: TemporaryStorage<IBackendECPresentationManager>;
  private _props: Props;

  /**
   * Creates an instance of [[MultiClientECPresentationManager]].
   * @param props Optional configuration properties.
   */
  constructor(props?: Props) {
    this._props = props || {};
    this._clientsStorage = new TemporaryStorage<IBackendECPresentationManager>({
      factory: this.createClientManager,
      cleanupHandler: this.disposeClientManager,
      // cleanup unused managers every minute
      cleanupInterval: 60 * 1000,
      // by default, manager is disposed after 1 hour of being unused
      valueLifetime: (props && props.unusedClientLifetime) ? props.unusedClientLifetime : 60 * 60 * 1000,
    });
  }

  /**
   * Dispose the presentation manager. Must be called to clean up native resources.
   */
  public dispose() {
    this._clientsStorage.dispose();
  }

  // tslint:disable-next-line:naming-convention
  private createClientManager = (clientId: string): IBackendECPresentationManager => {
    const props: IBackendECPresentationManagerProps = {
      localeDirectories: this._props.localeDirectories,
      rulesetDirectories: this._props.rulesetDirectories,
      activeLocale: this._props.activeLocale,
    };
    if (this._props.clientManagerFactory)
      return this._props.clientManagerFactory(clientId, props);
    return new SingleClientECPresentationManager(props);
  }

  // tslint:disable-next-line:naming-convention
  private disposeClientManager = (manager: IBackendECPresentationManager) => {
    manager.dispose();
  }

  private getClientManager(clientId: string): IBackendECPresentationManager {
    return this._clientsStorage.getValue(clientId);
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
    this._clientsStorage.values.forEach((mgr) => mgr.activeLocale = value);
  }

  /**
   * Get rulesets manager for specific client
   */
  public rulesets(clientId?: string): IRulesetManager {
    return this.getClientManager(this.getClientId(clientId)).rulesets();
  }

  /**
   * Get ruleset variables manager for specific ruleset and client
   * @param rulesetId Id of the ruleset to get variables manager for
   */
  public vars(rulesetId: string, clientId?: string): IRulesetVariablesManager {
    return this.getClientManager(this.getClientId(clientId)).vars(rulesetId);
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
