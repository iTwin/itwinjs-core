/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecificationBase } from "./ChildNodeSpecification";
import { PresentationRuleSpecificationTypes } from "../PresentationRuleSpecification";
import { QuerySpecification } from "./QuerySpecification";

/** Returns search results instance nodes. */
export interface SearchResultInstanceNodesSpecification extends ChildNodeSpecificationBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleSpecificationTypes.SearchResultInstanceNodesSpecification;

  /**
   * The actual search queries are specified here.
   *
   * **Note:**
   * If more than one search query is specified, the results get merged.
   */
  queries?: QuerySpecification[];

  /** Groups instances by ECClass. By default is set to true. */
  groupByClass?: boolean;

  /** Groups instances by display label. By default is set to true. */
  groupByLabel?: boolean;
}
