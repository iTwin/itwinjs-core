/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { PropertyRecord } from "@bentley/ui-abstract";
import { countMatchesInString } from "../../../common/countMatchesInString";
import { PropertyDataFiltererBase, PropertyDataFilterResult } from "./PropertyDataFiltererBase";

/**
 * PropertyData filter which matches on any record type label and includes descendant nodes on match
 * @alpha
 */
export class LabelPropertyDataFilterer extends PropertyDataFiltererBase {
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

  public async matchesFilter(node: PropertyRecord): Promise<PropertyDataFilterResult> {
    if (!this.isActive)
      return { matchesFilter: true };

    const displayLabel = node.property.displayLabel.toLowerCase();
    const matchesCount = countMatchesInString(displayLabel, this.filterText);
    if (matchesCount === 0)
      return { matchesFilter: false };

    return {
      matchesFilter: true,
      shouldExpandNodeParents: true,
      shouldForceIncludeDescendants: true,
      matchesCount: { label: matchesCount },
    };
  }
}
