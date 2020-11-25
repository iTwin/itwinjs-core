/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { PropertyRecord } from "@bentley/ui-abstract";
import { PropertyCategory } from "../../PropertyDataProvider";
import { IPropertyDataFilterer, PropertyDataFiltererBase, PropertyDataFilterResult } from "./PropertyDataFiltererBase";

/**
 * Logical operator for composite filterer.
 * @alpha
 */
export enum CompositeFilterType {
  And,
  Or,
}

/**
 * Composite PropertyData filter which can join two filters using logic operators
 * @alpha
 */
export class CompositePropertyDataFilterer extends PropertyDataFiltererBase {
  public constructor(private _leftFilterer: IPropertyDataFilterer, private _operator: CompositeFilterType, private _rightFilterer: IPropertyDataFilterer) {
    super();
    this._leftFilterer.onFilterChanged.addListener(() => this.onFilterChanged.raiseEvent());
    this._rightFilterer.onFilterChanged.addListener(() => this.onFilterChanged.raiseEvent());
  }

  public get isActive() { return this._leftFilterer.isActive || this._rightFilterer.isActive; }

  public async recordMatchesFilter(node: PropertyRecord, parents: PropertyRecord[]): Promise<PropertyDataFilterResult> {
    const [lhs, rhs] = await Promise.all([
      this._leftFilterer.recordMatchesFilter(node, parents),
      this._rightFilterer.recordMatchesFilter(node, parents),
    ]);

    const matchesFilter = (this._operator === CompositeFilterType.And) ? (lhs.matchesFilter && rhs.matchesFilter) : (lhs.matchesFilter || rhs.matchesFilter);
    if (!matchesFilter)
      return { matchesFilter: false };

    return {
      matchesFilter: true,
      shouldExpandNodeParents: lhs.shouldExpandNodeParents || rhs.shouldExpandNodeParents,
      shouldForceIncludeDescendants: lhs.shouldForceIncludeDescendants || rhs.shouldForceIncludeDescendants,
      matchesCount: { label: sumNullableNumbers(lhs.matchesCount?.label, rhs.matchesCount?.label), value: sumNullableNumbers(lhs.matchesCount?.value, rhs.matchesCount?.value) },
    };
  }

  public async categoryMatchesFilter(node: PropertyCategory, parents: PropertyCategory[]): Promise<PropertyDataFilterResult> {
    const [lhs, rhs] = await Promise.all([
      this._leftFilterer.categoryMatchesFilter(node, parents),
      this._rightFilterer.categoryMatchesFilter(node, parents),
    ]);

    const matchesFilter = (this._operator === CompositeFilterType.And) ? (lhs.matchesFilter && rhs.matchesFilter) : (lhs.matchesFilter || rhs.matchesFilter);
    if (!matchesFilter)
      return { matchesFilter: false };

    return {
      matchesFilter: true,
      shouldExpandNodeParents: lhs.shouldExpandNodeParents || rhs.shouldExpandNodeParents,
      shouldForceIncludeDescendants: lhs.shouldForceIncludeDescendants || rhs.shouldForceIncludeDescendants,
      matchesCount: { label: sumNullableNumbers(lhs.matchesCount?.label, rhs.matchesCount?.label), value: sumNullableNumbers(lhs.matchesCount?.value, rhs.matchesCount?.value) },
    };
  }
}

function sumNullableNumbers(lhs: number | undefined, rhs: number | undefined) {
  if (undefined === lhs && undefined === rhs)
    return undefined;
  return (lhs ?? 0) + (rhs ?? 0);
}
