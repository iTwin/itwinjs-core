/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Quantity
 */

import { Phenomena, type PhenomenonName, type UnitName } from "./generated/Units.generated";
import { defaultPersistenceUnits } from "./internal/DefaultPersistenceUnits.generated";

/** Returns the recommended built-in default persistence unit for a bundled built-in phenomenon.
 *
 * This helper is intentionally limited to the built-in canonical unit set shipped with `@itwin/core-quantity`.
 * `Phenomena.LENGTH_RATIO` is intentionally excluded until the built-in default length-ratio unit is settled.
 * For schema-defined, custom, or iModel-specific persistence units, use a `UnitsProvider`-based workflow instead.
 *
 * @beta
 */
export function getDefaultPersistenceUnit(
  phenomenon: Exclude<PhenomenonName, typeof Phenomena.LENGTH_RATIO>,
): UnitName {
  return defaultPersistenceUnits[phenomenon];
}
