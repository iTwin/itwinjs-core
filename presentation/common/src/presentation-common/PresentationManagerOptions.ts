/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { BeEvent, Id64String } from "@itwin/core-bentley";
import { UnitSystemKey } from "@itwin/core-quantity";
import { Descriptor, SelectionInfo } from "./content/Descriptor";
import { FieldDescriptor } from "./content/Fields";
import { Item } from "./content/Item";
import { InstanceKey } from "./EC";
import { ElementProperties } from "./ElementProperties";
import { InstanceFilterDefinition } from "./InstanceFilterDefinition";
import { Ruleset } from "./rules/Ruleset";
import { RulesetVariable } from "./RulesetVariables";
import { SelectionScopeProps } from "./selection/SelectionScope";

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

  /**
   * Expected form of response. This property is set automatically on newer frontends.
   * `unparsed-json` — deliver response from native addon without parsing it.
   * @internal
   */
  transport?: "unparsed-json";
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

  /**
   * An instance filter that should be applied for this hierarchy level.
   *
   * **Note:** May only be used on hierarchy levels that support filtering - check [[NavNode.supportsFiltering]] before
   * requesting filtered children.
   */
  instanceFilter?: InstanceFilterDefinition;

  /**
   * A limit to how many instances at most should be loaded for a hierarchy level. If the limit is exceeded,
   * the request fails with [[PresentationError]] having [[PresentationStatus.ResultSetTooLarge]] error number.
   *
   * Specifying the limit is useful when creating unlimited size result sets is not meaningful - this allows the library
   * to return early as soon as the limit is reached, instead of creating a very large result that's possibly too large to
   * be useful to be displayed to end users.
   *
   * @see [Hierarchies' filtering and limiting]($docs/presentation/hierarchies/FilteringLimiting.md)
   */
  sizeLimit?: number;
}

/**
 * Params for hierarchy level descriptor requests.
 * @public
 */
export interface HierarchyLevelDescriptorRequestOptions<TIModel, TNodeKey, TRulesetVariable = RulesetVariable>
  extends RequestOptionsWithRuleset<TIModel, TRulesetVariable> {
  /** Key of the parent node to get hierarchy level descriptor for. */
  parentKey?: TNodeKey;
}

/**
 * Request type of filtering hierarchies by given ECInstance paths.
 * @public
 */
export interface FilterByInstancePathsHierarchyRequestOptions<TIModel, TRulesetVariable = RulesetVariable>
  extends RequestOptionsWithRuleset<TIModel, TRulesetVariable> {
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
 * @public
 */
export interface ContentSourcesRequestOptions<TIModel> extends RequestOptions<TIModel> {
  /** Full names of classes to get content sources for. Format for a full class name: `SchemaName:ClassName`. */
  classes: string[];
}

/**
 * Request type for content descriptor requests.
 * @public
 */
export interface ContentDescriptorRequestOptions<TIModel, TKeySet, TRulesetVariable = RulesetVariable>
  extends RequestOptionsWithRuleset<TIModel, TRulesetVariable> {
  /**
   * Content display type.
   * @see [[DefaultContentDisplayTypes]]
   */
  displayType: string;
  /**
   * Content flags used for content customization.
   * @see [[ContentFlags]]
   */
  contentFlags?: number;
  /** Input keys for getting the content */
  keys: TKeySet;
  /** Information about the selection event that was the cause of this content request */
  selection?: SelectionInfo;
}

/**
 * Request type for content requests.
 * @public
 */
export interface ContentRequestOptions<TIModel, TDescriptor, TKeySet, TRulesetVariable = RulesetVariable>
  extends RequestOptionsWithRuleset<TIModel, TRulesetVariable> {
  /** Content descriptor for customizing the returned content */
  descriptor: TDescriptor;
  /** Input keys for getting the content */
  keys: TKeySet;
  /**
   * Flag that specifies whether value formatting should be omitted or not.
   * Content is returned without `displayValues` when this is set to `true`.
   */
  omitFormattedValues?: boolean;
}

/**
 * Request type for distinct values' requests.
 * @public
 */
export interface DistinctValuesRequestOptions<TIModel, TDescriptor, TKeySet, TRulesetVariable = RulesetVariable>
  extends Paged<RequestOptionsWithRuleset<TIModel, TRulesetVariable>> {
  /** Content descriptor for customizing the returned content */
  descriptor: TDescriptor;
  /** Input keys for getting the content */
  keys: TKeySet;
  /** Descriptor for a field distinct values are requested for */
  fieldDescriptor: FieldDescriptor;
}

/**
 * Request type for element properties requests
 * @public
 * @deprecated in 4.x. Use [[SingleElementPropertiesRequestOptions]] or [[MultiElementPropertiesRequestOptions]] directly.
 */
export type ElementPropertiesRequestOptions<TIModel, TParsedContent = ElementProperties> =
  | SingleElementPropertiesRequestOptions<TIModel>
  | MultiElementPropertiesRequestOptions<TIModel, TParsedContent>;

/**
 * Request type for single element properties requests.
 * @public
 */
export interface SingleElementPropertiesRequestOptions<TIModel, TParsedContent = ElementProperties> extends RequestOptions<TIModel> {
  /** ID of the element to get properties for. */
  elementId: Id64String;

  /**
   * Content parser that creates a result item based on given content descriptor and content item. Defaults
   * to a parser that creates [[ElementProperties]] objects.
   */
  contentParser?: (descriptor: Descriptor, item: Item) => TParsedContent;
}

/**
 * Request type for multiple elements properties requests.
 * @public
 */
export interface MultiElementPropertiesRequestOptions<TIModel, TParsedContent = ElementProperties> extends RequestOptions<TIModel> {
  /**
   * Classes of the elements to get properties for. If [[elementClasses]] is `undefined`, all classes
   * are used. Classes should be specified in one of these formats: "<schema name or alias>.<class_name>" or
   * "<schema name or alias>:<class_name>".
   */
  elementClasses?: string[];

  /**
   * Content parser that creates a result item based on given content descriptor and content item. Defaults
   * to a parser that creates [[ElementProperties]] objects.
   */
  contentParser?: (descriptor: Descriptor, item: Item) => TParsedContent;

  /**
   * The properties of multiple elements are going to be retrieved and returned in batches. Depending on the batch
   * size load on CPU vs MEMORY load may vary, so changing this attribute allows to fine tune the performance.
   * Defaults to `1000`.
   */
  batchSize?: number;
}

/**
 * Request type for content instance keys' requests.
 * @public
 */
export interface ContentInstanceKeysRequestOptions<TIModel, TKeySet, TRulesetVariable = RulesetVariable>
  extends Paged<RequestOptionsWithRuleset<TIModel, TRulesetVariable>> {
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
export interface SelectionScopeRequestOptions<TIModel> extends RequestOptions<TIModel> {} // eslint-disable-line @typescript-eslint/no-empty-object-type

/**
 * Request options used for calculating selection based on given instance keys and selection scope.
 * @public
 */
export interface ComputeSelectionRequestOptions<TIModel> extends RequestOptions<TIModel> {
  elementIds: Id64String[];
  scope: SelectionScopeProps;
}
/** @internal */
export function isComputeSelectionRequestOptions<TIModel>(
  options: ComputeSelectionRequestOptions<TIModel> | SelectionScopeRequestOptions<TIModel>,
): options is ComputeSelectionRequestOptions<TIModel> {
  return !!(options as ComputeSelectionRequestOptions<TIModel>).elementIds;
}

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
export type Paged<TOptions extends object> = TOptions & {
  /** Optional paging parameters */
  paging?: PageOptions;
};

/**
 * A wrapper type that injects priority into supplied type.
 * @public
 */
export type Prioritized<TOptions extends object> = TOptions & {
  /** Optional priority */
  priority?: number;
};

/**
 * Checks if supplied request options are for single or multiple element properties.
 * @internal
 */
export function isSingleElementPropertiesRequestOptions<TIModel, TParsedContent = any>(
  options: SingleElementPropertiesRequestOptions<TIModel> | MultiElementPropertiesRequestOptions<TIModel, TParsedContent>,
): options is SingleElementPropertiesRequestOptions<TIModel> {
  return (options as SingleElementPropertiesRequestOptions<TIModel>).elementId !== undefined;
}

/**
 * A wrapper type that injects cancelEvent into supplied type.
 * @public
 */
export type WithCancelEvent<TOptions extends object> = TOptions & {
  /** Event which is triggered when the request is canceled */
  cancelEvent?: BeEvent<() => void>;
};
