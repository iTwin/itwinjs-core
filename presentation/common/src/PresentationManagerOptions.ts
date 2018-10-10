/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

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