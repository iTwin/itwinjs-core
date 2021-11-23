/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { Id64String } from "@itwin/core-bentley";
import { UnitSystemKey } from "@itwin/core-quantity";
import { SelectionInfo } from "./content/Descriptor";
import { FieldDescriptor } from "./content/Fields";
import { DiagnosticsOptionsWithHandler } from "./Diagnostics";
import { InstanceKey } from "./EC";
import { Ruleset } from "./rules/Ruleset";
import { RulesetVariable } from "./RulesetVariables";

/**
 * A generic request options type used for both hierarchy and content requests.
 * @public
 */
export interface RequestOptions<TIModel> {
  /** iModel to request data from */
  imodel: TIModel;

  /** Optional locale to use when formatting / localizing data */
  locale?: string;

  /**
   * Unit system to use when formatting property values with units. Default presentation
   * unit is used if unit system is not specified.
   */
  unitSystem?: UnitSystemKey;

  /** @alpha */
  diagnostics?: DiagnosticsOptionsWithHandler;
}

/**
 * Options for requests that require presentation ruleset. Not
 * meant to be used directly, see one of the subclasses.
 *
 * @public
 */
export interface RequestOptionsWithRuleset<TIModel, TRulesetVariable = RulesetVariable> extends RequestOptions<TIModel> {
  /** Ruleset or id of the ruleset to use when requesting data */
  rulesetOrId: Ruleset | string;

  /** Ruleset variables to use when requesting data */
  rulesetVariables?: TRulesetVariable[];
}

/**
 * Request type for hierarchy requests.
 * @public
 */
export interface HierarchyRequestOptions<TIModel, TNodeKey, TRulesetVariable = RulesetVariable> extends RequestOptionsWithRuleset<TIModel, TRulesetVariable> {
  /** Key of the parent node to get children for */
  parentKey?: TNodeKey;
}

/**
 * Request type of filtering hierarchies by given ECInstance paths.
 * @public
 */
export interface FilterByInstancePathsHierarchyRequestOptions<TIModel, TRulesetVariable = RulesetVariable> extends RequestOptionsWithRuleset<TIModel, TRulesetVariable> {
  /** A list of paths from root ECInstance to target ECInstance. */
  instancePaths: InstanceKey[][];

  /**
   * An optional index (`0 <= markedIndex < instancePaths.length`) to mark one of the instance paths. The
   * path is marked using `NodePathElement.isMarked` flag in the result.
   */
  markedIndex?: number;
}

/**
 * Request type of filtering hierarchies by given text.
 * @public
 */
export interface FilterByTextHierarchyRequestOptions<TIModel, TRulesetVariable = RulesetVariable> extends RequestOptionsWithRuleset<TIModel, TRulesetVariable> {
  /** Text to filter the hierarchy by. */
  filterText: string;
}

/**
 * Request type for content sources requests.
 * @beta
 */
export interface ContentSourcesRequestOptions<TIModel> extends RequestOptions<TIModel> {
  /** Full names of classes to get content sources for. */
  classes: string[];
}

/**
 * Request type for content descriptor requests.
 * @public
 */
export interface ContentDescriptorRequestOptions<TIModel, TKeySet, TRulesetVariable = RulesetVariable> extends RequestOptionsWithRuleset<TIModel, TRulesetVariable> {
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

/**
 * Request type for content requests.
 * @public
 */
export interface ContentRequestOptions<TIModel, TDescriptor, TKeySet, TRulesetVariable = RulesetVariable> extends RequestOptionsWithRuleset<TIModel, TRulesetVariable> {
  /** Content descriptor for customizing the returned content */
  descriptor: TDescriptor;
  /** Input keys for getting the content */
  keys: TKeySet;
}

/**
 * Request type for distinct values' requests.
 * @public
 */
export interface DistinctValuesRequestOptions<TIModel, TDescriptor, TKeySet, TRulesetVariable = RulesetVariable> extends Paged<RequestOptionsWithRuleset<TIModel, TRulesetVariable>> {
  /** Content descriptor for customizing the returned content */
  descriptor: TDescriptor;
  /** Input keys for getting the content */
  keys: TKeySet;
  /** Descriptor for a field distinct values are requested for */
  fieldDescriptor: FieldDescriptor;
}

/**
 * Request type for element properties requests
 * @beta
 */
export type ElementPropertiesRequestOptions<TIModel> = SingleElementPropertiesRequestOptions<TIModel> | MultiElementPropertiesRequestOptions<TIModel>;

/**
 * Request type for single element properties requests.
 * @beta
 */
export interface SingleElementPropertiesRequestOptions<TIModel> extends RequestOptions<TIModel> {
  /** ID of the element to get properties for. */
  elementId: Id64String;
}

/**
 * Request type for multiple elements properties requests.
 * @beta
 */
export interface MultiElementPropertiesRequestOptions<TIModel> extends RequestOptions<TIModel> {
  /** Classes of the elements to get properties for. If `elementClasses` is undefined all classes
   * are used. Classes should be specified in one of these formats: "<schema name or alias>.<class_name>",
   * "<schema name or alias>:<class_name>".
   */
  elementClasses?: string[];
}

/**
 * Request type for content instance keys' requests.
 * @alpha
 */
export interface ContentInstanceKeysRequestOptions<TIModel, TKeySet, TRulesetVariable = RulesetVariable> extends Paged<RequestOptionsWithRuleset<TIModel, TRulesetVariable>> {
  /**
   * Content display type.
   * @see [[DefaultContentDisplayTypes]]
   */
  displayType?: string;
  /** Input keys for getting the content. */
  keys: TKeySet;
}

/**
 * Request type for label requests
 * @public
 */
export interface DisplayLabelRequestOptions<TIModel, TInstanceKey> extends RequestOptions<TIModel> {
  /** Key of ECInstance to get label for */
  key: TInstanceKey;
}

/**
 * Request type for labels requests
 * @public
 */
export interface DisplayLabelsRequestOptions<TIModel, TInstanceKey> extends RequestOptions<TIModel> {
  /** Keys of ECInstances to get labels for */
  keys: TInstanceKey[];
}

/**
 * Request options used for selection scope related requests
 * @public
 */
export interface SelectionScopeRequestOptions<TIModel> extends RequestOptions<TIModel> { } // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * Data structure for comparing a hierarchy after ruleset or ruleset variable changes.
 * @public
 */
export interface HierarchyCompareOptions<TIModel, TNodeKey, TRulesetVariable = RulesetVariable> extends RequestOptionsWithRuleset<TIModel, TRulesetVariable> {
  prev: {
    rulesetOrId?: Ruleset | string;
    rulesetVariables?: TRulesetVariable[];
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

/**
 * A wrapper type that injects priority into supplied type.
 * @public
 */
export type Prioritized<TOptions extends {}> = TOptions & {
  /** Optional priority */
  priority?: number;
};

/**
 * Checks if supplied request options are for single or multiple element properties.
 * @beta
 */
export function isSingleElementPropertiesRequestOptions<TIModel>(options: ElementPropertiesRequestOptions<TIModel>): options is SingleElementPropertiesRequestOptions<TIModel> {
  return (options as SingleElementPropertiesRequestOptions<TIModel>).elementId !== undefined;
}
