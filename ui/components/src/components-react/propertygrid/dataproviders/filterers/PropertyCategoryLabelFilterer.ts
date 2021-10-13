/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { countMatchesInString } from "../../../common/countMatchesInString";
import { PropertyCategory } from "../../PropertyDataProvider";
import { FilteredType, PropertyCategoryDataFiltererBase, PropertyDataFilterResult } from "./PropertyDataFiltererBase";

/**
 * PropertyData filterer which matches on PropertyCategory's label.
 * @public
 */
export class PropertyCategoryLabelFilterer extends PropertyCategoryDataFiltererBase {
  private _filterText: string = "";

  public constructor(filterText: string = "") {
    super();
    this._filterText = filterText;
  }

  public get filterText(): string { return this._filterText; }
  public set filterText(value: string) {
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue !== this.filterText) {
      this._filterText = lowerValue;
      this.onFilterChanged.raiseEvent();
    }
  }

  public get isActive() { return this.filterText !== ""; }

  public async categoryMatchesFilter(node: PropertyCategory): Promise<PropertyDataFilterResult> {
    if (!this.isActive)
      return { matchesFilter: true };

    const displayLabel = node.label.toLowerCase();
    const matchesCount = countMatchesInString(displayLabel, this.filterText);

    if (matchesCount === 0)
      return { matchesFilter: false };

    return {
      matchesFilter: true,
      shouldExpandNodeParents: true,
      shouldForceIncludeDescendants: true,
      matchesCount,
      filteredTypes: [FilteredType.Category],
    };
  }
}
