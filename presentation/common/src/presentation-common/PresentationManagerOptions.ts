/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { DescriptorOverrides, SelectionInfo } from "./content/Descriptor";
import { FieldDescriptor } from "./content/Fields";
import { Ruleset } from "./rules/Ruleset";
import { RulesetVariable } from "./RulesetVariables";

/**
 * Enumeration of standard request priorities.
 * @public
 */
export enum RequestPriority {
  /** Priority for pre-loading requests */
  Preload = 0,

  /** Priority for general requests */
  Normal = 1000,

  /** Max possible priority */
  Max = Number.MAX_SAFE_INTEGER,
}

/** @alpha */
export enum PresentationUnitSystem {
  Metric = "metric",
  BritishImperial = "british-imperial",
  UsCustomary = "us-customary",
  UsSurvey = "us-survey",
}

/**
 * A generic request options type used for both hierarchy and content requests
 * @public
 */
export interface RequestOptions<TIModel> {
  /** iModel to request data from */
  imodel: TIModel;

  /** Optional locale to use when formatting / localizing data */
  locale?: string;

  /**
   * Optional request priority. Higher priority requests are handled first.
   * Defaults to [[RequestPriority.Normal]]
   */
  priority?: number;
}

/**
 * Options for requests that require presentation ruleset. Not
 * meant to be used directly, see one of the subclasses.
 *
 * @public
 */
export interface RequestOptionsWithRuleset<TIModel> extends RequestOptions<TIModel> {
  /** Ruleset or id of the ruleset to use when requesting data */
  rulesetOrId: Ruleset | string;

  /** Ruleset variables to use when requesting data */
  rulesetVariables?: RulesetVariable[];
}

/**
 * Base request type for hierarchy requests
 * @public
 */
export interface HierarchyRequestOptions<TIModel> extends RequestOptionsWithRuleset<TIModel> { // eslint-disable-line @typescript-eslint/no-empty-interface
}

/**
 * Request type for hierarchy requests
 * @beta
 */
export interface ExtendedHierarchyRequestOptions<TIModel, TNodeKey> extends HierarchyRequestOptions<TIModel> {
  /** Key of the parent node to get children for */
  parentKey?: TNodeKey;
}
/** @internal */
export const isExtendedHierarchyRequestOptions = <TIModel, TNodeKey>(opts: HierarchyRequestOptions<TIModel> | ExtendedHierarchyRequestOptions<TIModel, TNodeKey>): opts is ExtendedHierarchyRequestOptions<TIModel, TNodeKey> => {
  return !!(opts as ExtendedHierarchyRequestOptions<TIModel, TNodeKey>).parentKey;
};

/**
 * Request type for content requests
 * @public
 */
export interface ContentRequestOptions<TIModel> extends RequestOptionsWithRuleset<TIModel> {
  /**
   * Unit system to use when formatting property values with units. Default presentation
   * unit is used if unit system is not specified.
   *
   * @alpha
   */
  unitSystem?: PresentationUnitSystem;
}

/**
 * Request type for content descriptor requests
 * @beta
 */
export interface ContentDescriptorRequestOptions<TIModel, TKeySet> extends ContentRequestOptions<TIModel> {
  /**
   * Content display type.
   * @see [[DefaultContentDisplayTypes]]
   */
  displayType: string;
  /** Input keys for getting the content */
  keys: TKeySet;
  /** Information about the selection event that was the cause of this content request */
  selection?: SelectionInfo;
}
/** @internal */
export const isContentDescriptorRequestOptions = <TIModel, TKeySet>(opts: ContentRequestOptions<TIModel> | ContentDescriptorRequestOptions<TIModel, TKeySet>): opts is ContentDescriptorRequestOptions<TIModel, TKeySet> => {
  return !!(opts as ContentDescriptorRequestOptions<TIModel, TKeySet>).keys;
};

/**
 * Request type for content requests
 * @beta
 */
export interface ExtendedContentRequestOptions<TIModel, TDescriptor, TKeySet> extends ContentRequestOptions<TIModel> {
  /** Content descriptor or overrides for customizing the returned content */
  descriptor: TDescriptor | DescriptorOverrides;
  /** Input keys for getting the content */
  keys: TKeySet;
}
/** @internal */
export const isExtendedContentRequestOptions = <TIModel, TDescriptor, TKeySet>(opts: ContentRequestOptions<TIModel> | ExtendedContentRequestOptions<TIModel, TDescriptor, TKeySet>): opts is ExtendedContentRequestOptions<TIModel, TDescriptor, TKeySet> => {
  return !!(opts as ExtendedContentRequestOptions<TIModel, TDescriptor, TKeySet>).descriptor
    && !!(opts as ExtendedContentRequestOptions<TIModel, TDescriptor, TKeySet>).keys;
};

/**
 * Request type for distinct values' requests
 * @alpha
 */
export interface DistinctValuesRequestOptions<TIModel, TDescriptor, TKeySet> extends Paged<ContentRequestOptions<TIModel>> {
  /** Content descriptor for content we're requesting distinct values for or overrides for customizing the returned content */
  descriptor: TDescriptor | DescriptorOverrides;
  /** Input keys for getting the content */
  keys: TKeySet;
  /** Descriptor for a field distinct values are requested for */
  fieldDescriptor: FieldDescriptor;
}

/**
 * Request type for label requests
 * @public
 */
export interface LabelRequestOptions<TIModel> extends RequestOptions<TIModel> { } // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * Request type for label requests
 * @beta
 */
export interface DisplayLabelRequestOptions<TIModel, TInstanceKey> extends RequestOptions<TIModel> {
  /** Key of ECInstance to get label for */
  key: TInstanceKey;
}
/** @internal */
export const isDisplayLabelRequestOptions = <TIModel, TInstanceKey>(opts: LabelRequestOptions<TIModel> | DisplayLabelRequestOptions<TIModel, TInstanceKey>): opts is DisplayLabelRequestOptions<TIModel, TInstanceKey> => {
  return !!(opts as DisplayLabelRequestOptions<TIModel, TInstanceKey>).key;
};

/**
 * Request type for labels requests
 * @beta
 */
export interface DisplayLabelsRequestOptions<TIModel, TInstanceKey> extends RequestOptions<TIModel> {
  /** Keys of ECInstances to get labels for */
  keys: TInstanceKey[];
}
/** @internal */
export const isDisplayLabelsRequestOptions = <TIModel, TInstanceKey>(opts: LabelRequestOptions<TIModel> | DisplayLabelsRequestOptions<TIModel, TInstanceKey>): opts is DisplayLabelsRequestOptions<TIModel, TInstanceKey> => {
  return !!(opts as DisplayLabelsRequestOptions<TIModel, TInstanceKey>).keys;
};

/**
 * Request options used for selection scope related requests
 * @public
 */
export interface SelectionScopeRequestOptions<TIModel> extends RequestOptions<TIModel> { } // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * Data structure for comparing presentation data after ruleset or ruleset variable changes.
 * @alpha
 */
export interface PresentationDataCompareOptions<TIModel, TNodeKey> extends RequestOptionsWithRuleset<TIModel> {
  prev: {
    rulesetOrId?: Ruleset | string;
    rulesetVariables?: RulesetVariable[];
  };
  expandedNodeKeys?: TNodeKey[];
  continuationToken?: {
    prevHierarchyNode: string;
    currHierarchyNode: string;
  };
  resultSetSize?: number;
}

/**
 * Paging options
 * @public
 */
export interface PageOptions {
  /** Inclusive start 0-based index of the page */
  start?: number;
  /** Maximum size of the page */
  size?: number;
}

/**
 * A wrapper type that injects [[PageOptions]] into supplied type
 * @public
 */
export type Paged<TOptions extends {}> = TOptions & {
  /** Optional paging parameters */
  paging?: PageOptions;
};
