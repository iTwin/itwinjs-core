/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormatting
 */

import { UnitNameKey } from "./QuantityFormatter";
import { UNIT_EXTRA_DATA } from "./UnitsData";

/** Function to generate default set of alternate unit labels
 *  @internal
 */
export function getDefaultAlternateUnitLabels() {
  const altDisplayLabelsMap = new Map<UnitNameKey, Set<string>>();
  for (const entry of UNIT_EXTRA_DATA) {
    if (entry.altDisplayLabels && entry.altDisplayLabels.length > 0) {
      altDisplayLabelsMap.set(entry.name, new Set<string>(entry.altDisplayLabels));
    }
  }
  if (altDisplayLabelsMap.size)
    return altDisplayLabelsMap;
  return undefined;
}
