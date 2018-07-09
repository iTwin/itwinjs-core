/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RPC */

import { Id64 } from "@bentley/bentleyjs-core";
import { RpcInterface, IModelToken, RpcManager } from "@bentley/imodeljs-common";
import { PresentationRuleSet } from "./rules";
import { Node, NodeKey, NodePathElement } from "./hierarchy";
import { SelectionInfo, Descriptor, Content, Field, Item, PropertiesField, NestedContentField } from "./content";
import { HierarchyRequestOptions, ContentRequestOptions, Paged } from "./ECPresentationManager";
import KeySet from "./KeySet";
import { SettingValue, SettingValueTypes } from "./UserSettingsManager";
import { InstanceKey } from "./EC";

/** Interface used for communication between ECPresentation backend and frontend. */
export default class ECPresentationRpcInterface extends RpcInterface {
  // developer note: It's called an interface but actually it's a real implemented
  // frontend-specific class. It's setup that way to keep consistency with imodeljs-core.

  /** The version of the interface. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the interface. */
  /* istanbul ignore next */
  public static types = () => [
    Descriptor,
    Content,
    Field,
    PropertiesField,
    NestedContentField,
    Item,
    Id64,
  ]

  /** Get the frontend client of this interface */
  public static getClient(): ECPresentationRpcInterface { return RpcManager.getClientForInterface(ECPresentationRpcInterface); }

  /** See [[ECPresentationManager.addRuleSet]] */
  public addRuleSet(_ruleSet: PresentationRuleSet): Promise<void> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.removeRuleSet]] */
  public removeRuleSet(_ruleSetId: string): Promise<void> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.clearRuleSets]] */
  public clearRuleSets(): Promise<void> { return this.forward.apply(this, arguments); }

  /** See [[ECPresentationManager.getRootNodes]] */
  public getRootNodes(_options: Paged<HierarchyRequestOptions<IModelToken>>): Promise<ReadonlyArray<Readonly<Node>>> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.getRootNodesCount]] */
  public getRootNodesCount(_options: HierarchyRequestOptions<IModelToken>): Promise<number> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.getChildren]] */
  public getChildren(_options: Paged<HierarchyRequestOptions<IModelToken>>, _parentKey: Readonly<NodeKey>): Promise<ReadonlyArray<Readonly<Node>>> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.getChildrenCount]] */
  public getChildrenCount(_options: HierarchyRequestOptions<IModelToken>, _parentKey: Readonly<NodeKey>): Promise<number> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.getNodePaths]] */
  public getNodePaths(_options: HierarchyRequestOptions<IModelToken>, _paths: InstanceKey[][], _markedIndex: number): Promise<NodePathElement[]> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.getFilteredNodePaths]] */
  public getFilteredNodePaths(_options: HierarchyRequestOptions<IModelToken>, _filterText: string): Promise<NodePathElement[]> { return this.forward.apply(this, arguments); }

  /** See [[ECPresentationManager.getContentDescriptor]] */
  public getContentDescriptor(_options: ContentRequestOptions<IModelToken>, _displayType: string, _keys: Readonly<KeySet>, _selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.getContentSetSize]] */
  public getContentSetSize(_options: ContentRequestOptions<IModelToken>, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>): Promise<number> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.getContent]] */
  public getContent(_options: ContentRequestOptions<IModelToken>, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>): Promise<Readonly<Content>> { return this.forward.apply(this, arguments); }
  /** See [[ECPresentationManager.getDistinctValues]] */
  public getDistinctValues(_options: ContentRequestOptions<IModelToken>, _descriptor: Readonly<Descriptor>, _keys: Readonly<KeySet>, _fieldName: string, _maximumValueCount: number): Promise<string[]> { return this.forward.apply(this, arguments); }

  /** Sets user setting value */
  public setUserSettingValue(_ruleSetId: string, _settingId: string, _value: SettingValue): Promise<void> { return this.forward.apply(this, arguments); }
  /** Retrieves setting value. Returns default value if setting does not exist or does not convert to specified type. */
  public getUserSettingValue(_ruleSetId: string, _settingId: string, _settingType: SettingValueTypes): Promise<any> { return this.forward.apply(this, arguments); }
}
