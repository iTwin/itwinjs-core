/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

/** Map from bare phenomenon name to its canonical SI persistence unit.
 * @internal
 */
const phenomenonToPersistenceUnit: ReadonlyMap<string, string> = new Map([
  ["LENGTH", "Units.M"],
  ["AREA", "Units.SQ_M"],
  ["VOLUME", "Units.CUB_M"],
  ["PLANE_ANGLE", "Units.RAD"],
  ["ANGLE", "Units.RAD"],
  ["TIME", "Units.S"],
  ["TEMPERATURE", "Units.K"],
  ["MASS", "Units.KG"],
]);

/** Strips the "Units." prefix from a schema-qualified phenomenon name.
 * Accepts both "LENGTH" and "Units.LENGTH" — returns "LENGTH" in both cases.
 * @internal
 */
function normalizePhenomenonName(phenomenon: string): string {
  const prefix = "Units.";
  if (phenomenon.startsWith(prefix))
    return phenomenon.slice(prefix.length);
  return phenomenon;
}

/** Returns the canonical SI persistence unit name for a given phenomenon.
 * Accepts both bare names (e.g., "LENGTH") and schema-qualified names (e.g., "Units.LENGTH").
 * Returns `undefined` if the phenomenon is not recognized.
 *
 * @param phenomenon - The phenomenon name, e.g. "LENGTH", "Units.LENGTH", "AREA", "Units.AREA"
 * @returns The SI persistence unit name (e.g., "Units.M"), or `undefined` if unknown.
 * @beta
 */
export function findPersistenceUnitForPhenomenon(phenomenon: string): string | undefined {
  const bare = normalizePhenomenonName(phenomenon);
  return phenomenonToPersistenceUnit.get(bare);
}
