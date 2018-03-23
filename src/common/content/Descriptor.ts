/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as ec from "../EC";
import { Field, resetParentship as resetFieldParentship, rebuildParentship as rebuildFieldParentship } from "./Fields";

/** Data structure that describes an ECClass in ContentDescriptor. In addition to the class
 * itself the structure holds its relationship path to the primary ECClass and paths
 * to related property classes.
 */
export interface SelectClassInfo {
  selectClassInfo: Readonly<ec.ClassInfo>;
  isSelectPolymorphic: boolean;
  pathToPrimaryClass: Readonly<ec.RelationshipPathInfo>;
  relatedPropertyPaths: Array<Readonly<ec.RelationshipPathInfo>>;
}

/** Flags that control content format. */
export enum ContentFlags {
  /** Each content record has only ec.InstanceKey and no data */
  KeysOnly = 1 << 0,

  /** Each content record additionally has an image id */
  ShowImages = 1 << 1,

  /** Each content record additionally has a label */
  ShowLabels = 1 << 2,

  /** All content records are merged into a single record */
  MergeResults = 1 << 3,

  /** Content has only distinct values */
  DistinctValues = 1 << 4,

  /** Doesn't create property or calculated fields. Can be used in conjunction with @e ShowLabels. */
  NoFields = 1 << 5,
}

export enum SortDirection {
  Ascending,
  Descending,
}

export interface SelectionInfo {
  providerName: string;
  level?: number;
}

/** Describes the content: fields, sorting, filtering, format. Users may change
 * @ref Descriptor to control what content they get and how they get it.
 */
export default interface Descriptor {
  displayType: string;
  selectClasses: Array<Readonly<SelectClassInfo>>;
  fields: Array<Readonly<Field>>;
  sortingField?: Readonly<Field>;
  sortDirection: SortDirection;
  contentFlags: number;
  filterExpression?: string;
}

/** @hidden */
export interface DescriptorOverrides {
  displayType: string;
  hiddenFieldNames: string[];
  sortingFieldName?: string;
  sortDirection: SortDirection;
  contentFlags: number;
  filterExpression?: string;
}

/** @hidden */
export const createDescriptorOverrides = (descriptor: Descriptor): DescriptorOverrides => {
  return {
    displayType: descriptor.displayType,
    hiddenFieldNames: [],
    sortingFieldName: descriptor.sortingField ? descriptor.sortingField.name : undefined,
    sortDirection: descriptor.sortDirection,
    contentFlags: descriptor.contentFlags,
    filterExpression: descriptor.filterExpression,
  };
};

/** @hidden */
export const resetParentship = (descriptor: Descriptor): void => {
  for (const field of descriptor.fields)
    resetFieldParentship(field);
};

/** @hidden */
export const rebuildParentship = (descriptor: Descriptor): void => {
  for (const field of descriptor.fields)
    rebuildFieldParentship(field);
};
