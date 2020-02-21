/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

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
 * Request type for hierarchy requests
 * @public
 */
export interface HierarchyRequestOptions<TIModel> extends RequestOptionsWithRuleset<TIModel> { }

/**
 * Request type for content requests
 * @public
 */
export interface ContentRequestOptions<TIModel> extends RequestOptionsWithRuleset<TIModel> { }

/**
 * Request type for label requests
 * @public
 */
export interface LabelRequestOptions<TIModel> extends RequestOptions<TIModel> { }

/**
 * Request options used for selection scope related requests
 * @public
 */
export interface SelectionScopeRequestOptions<TIModel> extends RequestOptions<TIModel> { }

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
