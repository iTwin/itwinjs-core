/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Node, NodeKey, NodePathElement } from "./hierarchy";
import { SelectionInfo, Descriptor, Content } from "./content";
import { IModel } from "@bentley/imodeljs-common";
import { InstanceKey } from "./EC";
import KeySet from "./KeySet";
import { IRulesetVariablesManager } from "./IRulesetVariablesManager";
import { IRulesetManager } from "./IRulesetManager";

/** A generic request options type used for both hierarchy and content requests */
export interface RequestOptions<TIModel> {
  /** iModel to request data from */
  imodel: TIModel;

  /** Id of the ruleset to use when requesting data */
  rulesetId: string;

  /** Optional locale to use when formatting / localizing data */
  locale?: string;
}
/** Request type for hierarchy requests */
export interface HierarchyRequestOptions<TIModel> extends RequestOptions<TIModel> { }
/** Request type for content requests */
export interface ContentRequestOptions<TIModel> extends RequestOptions<TIModel> { }

/** Paging options. */
export interface PageOptions {
  /** Inclusive start 0-based index of the page */
  start?: number;

  /** Maximum size of the page */
  size?: number;
}
/** A wrapper type that injects [[PageOptions]] into supplied type */
export type Paged<TOptions extends {}> = TOptions & {
  /** Optional paging parameters */
  paging?: PageOptions;
};

/**
 * An interface of presentation manager which provides presentation services for
 * tree and content components
 */
export interface IPresentationManager<TIModel extends IModel> {
  /**
   * Get / set active locale used for localizing presentation data
   */
  activeLocale: string | undefined;

  /**
   * Get rulesets manager
   */
  rulesets(): IRulesetManager;

  /**
   * Get ruleset variables manager for specific ruleset
   * @param rulesetId Id of the ruleset to get the vars manager for
   */
  vars(rulesetId: string): IRulesetVariablesManager;

  /**
   * Retrieves root nodes.
   * @param imodel iModel to pull data from.
   * @return A promise object that returns either an array of nodes on success or an error string on error.
   */
  getRootNodes(requestOptions: Paged<HierarchyRequestOptions<TIModel>>): Promise<ReadonlyArray<Readonly<Node>>>;

  /**
   * Retrieves root nodes count.
   * @param imodel iModel to pull data from.
   * @return A promise object that returns the number of root nodes.
   */
  getRootNodesCount(requestOptions: HierarchyRequestOptions<TIModel>): Promise<number>;

  /**
   * Retrieves children of the specified parent node.
   * @param imodel iModel to pull data from.
   * @param parentKey    Key of the parent node.
   * @return A promise object that returns either an array of nodes on success or an error string on error.
   */
  getChildren(requestOptions: Paged<HierarchyRequestOptions<TIModel>>, parentKey: Readonly<NodeKey>): Promise<ReadonlyArray<Readonly<Node>>>;

  /**
   * Retrieves children count for the specified parent node.
   * @param imodel iModel to pull data from.
   * @param parentKey Key of the parent node.
   * @return A promise object that returns the number of child nodes.
   */
  getChildrenCount(requestOptions: HierarchyRequestOptions<TIModel>, parentKey: Readonly<NodeKey>): Promise<number>;

  /**
   * Retrieves paths from root nodes to children nodes according to specified keys. Intersecting paths will be merged.
   * @param imodel iModel to pull data from.
   * @param paths Paths from root node to some child node.
   * @param markedIndex Index of the path in `paths` that will be marked.
   * @return A promise object that returns either an array of paths on success or an error string on error.
   */
  getNodePaths(requestOptions: HierarchyRequestOptions<TIModel>, paths: InstanceKey[][], markedIndex: number): Promise<NodePathElement[]>;

  /**
   * Retrieves paths from root nodes to nodes containing filter text in their label.
   * @param imodel iModel to pull data from.
   * @param filterText Text to filter nodes against.
   * @return A promise object that returns either an array of paths on success or an error string on error.
   */
  getFilteredNodePaths(requestOptions: HierarchyRequestOptions<TIModel>, filterText: string): Promise<NodePathElement[]>;

  /**
   * Retrieves the content descriptor which can be used to get content.
   * @param imodel iModel to pull data from.
   * @param displayType  The preferred display type of the return content.
   * @param keys         Keys of ECInstances to get the content for.
   * @param selection    Optional selection info in case the content is being requested due to selection change.
   * @return A promise object that returns either a descriptor on success or an error string on error.
   */
  getContentDescriptor(requestOptions: HierarchyRequestOptions<TIModel>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined): Promise<Readonly<Descriptor> | undefined>;

  /**
   * Retrieves the content set size based on the supplied content descriptor override.
   * @param imodel iModel to pull data from
   * @param descriptor           Content descriptor which specifies how the content should be returned.
   * @param keys                 Keys of ECInstances to get the content for.
   * @return A promise object that returns either a number on success or an error string on error.
   * Even if concrete implementation returns content in pages, this function returns the total
   * number of records in the content set.
   */
  getContentSetSize(requestOptions: HierarchyRequestOptions<TIModel>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<number>;

  /**
   * Retrieves the content based on the supplied content descriptor override.
   * @param imodel iModel to pull data from
   * @param descriptor           Content descriptor which specifies how the content should be returned.
   * @param keys                 Keys of ECInstances to get the content for.
   * @return A promise object that returns either content on success or an error string on error.
   */
  getContent(requestOptions: Paged<HierarchyRequestOptions<TIModel>>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>): Promise<Readonly<Content>>;

  /**
   * Retrieves distinct values of specific field from the content based on the supplied content descriptor override.
   * @param imodel               iModel to pull data from
   * @param descriptor           Content descriptor which specifies how the content should be returned.
   * @param keys                 Keys of ECInstances to get the content for.
   * @param fieldName            Name of the field from which to take values.
   * @param maximumValueCount    Maximum numbers of values that can be returned. Unlimited if 0.
   * @return A promise object that returns either distinct values on success or an error string on error.
   */
  getDistinctValues(requestOptions: HierarchyRequestOptions<TIModel>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, fieldName: string, maximumValueCount: number): Promise<string[]>;
}
