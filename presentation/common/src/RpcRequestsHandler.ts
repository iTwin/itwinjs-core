/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { Guid } from "@bentley/bentleyjs-core";
import { IModelToken, RpcManager } from "@bentley/imodeljs-common";
import { Ruleset } from "./rules";
import KeySet from "./KeySet";
import { PresentationStatus } from "./Error";
import { InstanceKey } from "./EC";
import { NodeKey, Node, NodePathElement } from "./hierarchy";
import { SelectionInfo, Descriptor, Content } from "./content";
import { HierarchyRequestOptions, ContentRequestOptions, Paged } from "./IPresentationManager";
import { VariableValue, VariableValueTypes } from "./IRulesetVariablesManager";
import PresentationRpcInterface, { RpcRequestOptions } from "./PresentationRpcInterface";

/**
 * Configuration parameters for [[RpcRequestsHandler]].
 *
 * @hidden
 */
export interface Props {
  /**
   * Optional ID used to identify client that requests data. If not specified,
   * the handler creates a unique GUID as a client id.
   * @hidden
   */
  clientId?: string;
}

/**
 * RPC requests handler that wraps [[PresentationRpcInterface]] and
 * adds handling for cases when backend needs to be synced with client
 * state.
 *
 * @hidden
 */
export default class RpcRequestsHandler {

  /** ID that identifies this handler as a client */
  public readonly clientId: string;

  /** IDs of the backends known to this client */
  public readonly knownBackendIds = new Set<string>();

  /** A list of synchronization handlers which sync backends with client state */
  public readonly syncHandlers = new Array<() => Promise<void>>();

  public constructor(props?: Props) {
    this.clientId = (props && props.clientId) ? props.clientId : Guid.createValue();
  }

  private async sync(): Promise<void> {
    await Promise.all(this.syncHandlers.map((s) => s()));
  }

  /**
   * Send request to current backend. If the backend is unknown to the requestor,
   * the request is rejected with `PresentationStatus.UnknownBackend` status. In
   * such case the client is synced with the backend using registered `syncHandlers`
   * and the request is repeated.
   *
   * @hidden
   */
  public async doRequest<TResult>(request: () => Promise<TResult>, repeatRequest: boolean = true): Promise<TResult> {
    try {
      return await request();
    } catch (e) {
      if (e.errorNumber === PresentationStatus.UnknownBackend) {
        this.knownBackendIds.add(e.message); // note: e.message is the backend id
        await this.doRequest<void>(() => this.sync(), false);
        if (repeatRequest)
          return await this.doRequest(request);
        // note: we expect `repeatRequest` to be `false` only for `void`
        // requests - it's up to the caller to ensure that
        return undefined as any;
      } else {
        throw e;
      }
    }
  }

  /** Get the frontend client of this interface */
  private getClient(): PresentationRpcInterface { return RpcManager.getClientForInterface(PresentationRpcInterface); }

  /** WIP */
  private getIModelToken(): IModelToken { return new IModelToken(); }

  private createRequestOptions<T>(options: T & { imodel?: IModelToken }): RpcRequestOptions & T {
    return Object.assign({}, options, {
      clientId: this.clientId,
      knownBackendIds: [...this.knownBackendIds],
      imodel: options.imodel || this.getIModelToken(),
    });
  }

  public getRootNodes(options: Paged<HierarchyRequestOptions<IModelToken>>): Promise<Node[]> { return this.doRequest(() => this.getClient().getRootNodes(this.createRequestOptions(options))); }
  public getRootNodesCount(options: HierarchyRequestOptions<IModelToken>): Promise<number> { return this.doRequest(() => this.getClient().getRootNodesCount(this.createRequestOptions(options))); }
  public getChildren(options: Paged<HierarchyRequestOptions<IModelToken>>, parentKey: Readonly<NodeKey>): Promise<Node[]> { return this.doRequest(() => this.getClient().getChildren(this.createRequestOptions(options), parentKey)); }
  public getChildrenCount(options: HierarchyRequestOptions<IModelToken>, parentKey: Readonly<NodeKey>): Promise<number> { return this.doRequest(() => this.getClient().getChildrenCount(this.createRequestOptions(options), parentKey)); }
  public getNodePaths(options: HierarchyRequestOptions<IModelToken>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]> { return this.doRequest(() => this.getClient().getNodePaths(this.createRequestOptions(options), paths, markedIndex)); }
  public getFilteredNodePaths(options: HierarchyRequestOptions<IModelToken>, filterText: string): Promise<NodePathElement[]> { return this.doRequest(() => this.getClient().getFilteredNodePaths(this.createRequestOptions(options), filterText)); }

  public getContentDescriptor(options: ContentRequestOptions<IModelToken>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Descriptor | undefined> { return this.doRequest(() => this.getClient().getContentDescriptor(this.createRequestOptions(options), displayType, keys, selection)); }
  public getContentSetSize(options: ContentRequestOptions<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number> { return this.doRequest(() => this.getClient().getContentSetSize(this.createRequestOptions(options), descriptor, keys)); }
  public getContent(options: ContentRequestOptions<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Content> { return this.doRequest(() => this.getClient().getContent(this.createRequestOptions(options), descriptor, keys)); }
  public getDistinctValues(options: ContentRequestOptions<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number): Promise<string[]> { return this.doRequest(() => this.getClient().getDistinctValues(this.createRequestOptions(options), descriptor, keys, fieldName, maximumValueCount)); }

  public getRuleset(rulesetId: string): Promise<[Ruleset, string] | undefined> { return this.doRequest(() => this.getClient().getRuleset(this.createRequestOptions({}), rulesetId)); }
  public addRuleset(ruleset: Ruleset): Promise<string> { return this.doRequest(() => this.getClient().addRuleset(this.createRequestOptions({}), ruleset)); }
  public addRulesets(rulesets: Ruleset[]): Promise<string[]> { return this.doRequest(() => this.getClient().addRulesets(this.createRequestOptions({}), rulesets)); }
  public removeRuleset(rulesetId: string, hash: string): Promise<boolean> { return this.doRequest(() => this.getClient().removeRuleset(this.createRequestOptions({}), rulesetId, hash)); }
  public clearRulesets(): Promise<void> { return this.doRequest(() => this.getClient().clearRulesets(this.createRequestOptions({})), false); }

  public getRulesetVariableValue(rulesetId: string, varId: string, varType: VariableValueTypes): Promise<VariableValue> { return this.doRequest(() => this.getClient().getRulesetVariableValue(this.createRequestOptions({ rulesetId }), varId, varType)); }
  public setRulesetVariableValue(rulesetId: string, varId: string, varType: VariableValueTypes, value: VariableValue): Promise<void> { return this.doRequest(() => this.getClient().setRulesetVariableValue(this.createRequestOptions({ rulesetId }), varId, varType, value), false); }
  public setRulesetVariableValues(rulesetId: string, values: Array<[string, VariableValueTypes, VariableValue]>): Promise<void> { return this.doRequest(() => this.getClient().setRulesetVariableValues(this.createRequestOptions({ rulesetId }), values), false); }
}
