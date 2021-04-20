/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { PropertyRecord, PropertyValueFormat } from "@bentley/ui-abstract";
import { countMatchesInString } from "../../../common/countMatchesInString";
import { FilteredType, PropertyDataFilterResult, PropertyRecordDataFiltererBase } from "./PropertyDataFiltererBase";

/**
 * Property data filterer which matches on Primitive Property Record display value text.
 * @beta
 */
export class DisplayValuePropertyDataFilterer extends PropertyRecordDataFiltererBase {
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

  public async recordMatchesFilter(node: PropertyRecord): Promise<PropertyDataFilterResult> {
    if (!this.isActive)
      return { matchesFilter: true };

    if (node.value.valueFormat !== PropertyValueFormat.Primitive)
      return { matchesFilter: false };

    const displayValue = node.value.displayValue?.toLowerCase() ?? "";
    const matchesCount = countMatchesInString(displayValue, this.filterText);

    if (matchesCount === 0)
      return { matchesFilter: false };

    return {
      matchesFilter: true,
      shouldExpandNodeParents: true,
      matchesCount,
      filteredTypes: [FilteredType.Value],
    };
  }
}
