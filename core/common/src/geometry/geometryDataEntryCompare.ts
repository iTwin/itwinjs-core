/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CurveCollection, GeometryQuery, LineSegment3d, LineString3d, Path } from "@itwin/core-geometry";
import { ElementGeometry } from "./ElementGeometry";
import { TextStringProps } from "./TextString";

/** Options for deep comparison */
export interface DeepEqualOptions {
  /** Keys to ignore on the top-level objects. */
  topLevelKeysToIgnore: Set<string>;
  /** Ignore object properties with names that are symbols? */
  ignoreSymbols: boolean;
  /** Should a missing property *not* be considered equivalent to a property with an undefined value?
   * The default is the treat missing properties as equivalent to undefined.
   */
  missingNotEquivalentToUndefined?: boolean;
}

const emptySet = new Set<string>();

function filteredKeys(obj: object, opts: DeepEqualOptions): string[] {
  return Object.keys(obj).filter((k) => {
    return !opts.topLevelKeysToIgnore.has(k)
      // optionally ignore props identified by symbols
      && (!opts.ignoreSymbols || (typeof ((obj as any)[k]) !== "symbol"))
      // ignore props with undefined values ... unless we need to distinguish between missing props and undefined props
      && (opts.missingNotEquivalentToUndefined || (obj as any)[k] !== undefined);
  });
}

/**
 * Compare two objects for equality with optional filters applied.
 * @param obj1 First object
 * @param obj2 Second object
 * @param opts The keys to exclude from the comparison, etc.
 * @returns true if the objects are equal, ignoring the excluded keys and symbols
 * @alpha
 */
export function areObjectsDeepEqual(obj1: unknown, obj2: unknown, opts: DeepEqualOptions): boolean {
  if (obj1 === undefined && obj2 === undefined)
    return true;

  if (Array.isArray(obj1)) {
    if (!Array.isArray(obj2))
      return false;
    if (obj1.length !== obj2.length)
      return false;
    for (let i = 0; i < obj1.length; ++i) {
      if (!areObjectsDeepEqual(obj1[i], obj2[i], opts))
        return false;
    }
    return true;
  }

  if (typeof (obj1) === "object") {
    if (typeof (obj2) !== "object")
      return false;
    if (obj1 === null && obj2 === null)
      return true;
    if (obj1 === null || obj2 === null)
      return false;
    const keys1 = filteredKeys(obj1, opts);
    const keys2 = filteredKeys(obj2, opts);
    if (keys1.length !== keys2.length)
      return false;
    if (!keys2.every((k2) => keys1.includes(k2)))
      return false;
    for (const key of keys1) {
      const p1 = (obj1 as any)[key];
      const p2 = (obj2 as any)[key];

      if (!areObjectsDeepEqual(p1, p2, { ...opts, topLevelKeysToIgnore: emptySet }))
        return false;
    }
    return true;
  }

  if (typeof (obj1) !== typeof (obj2))
    return false;

  // TODO: This function is not prepared to compare coordinates, distances, or angles.
  // TODO: Can't just assume that every number is a distance
  // if (typeof (obj1) === "number")
  //     return Geometry.isSameCoordinate(obj1, obj2 as number);

  return obj1 === obj2;
}

function simplifyGeometryQuery(g: GeometryQuery): GeometryQuery {
  if (g instanceof LineSegment3d)
    return LineString3d.create([g.point0Ref, g.point1Ref]);

  if ((g instanceof Path) && (g.children.length === 1)) {
    return g.children[0];
  }
  // TODO: Duplicate other transformations that native code geometry builder applies to in-coming elementGeometryBuilderParams
  return g;
}

function isTextStringProps(obj: unknown): obj is TextStringProps {
  return (typeof (obj) === "object") && (obj !== null) && ("text" in obj);
}

function fixGeometryParams(u: ElementGeometry.AnyGeometricEntityPropsWithParams | undefined): void {
  if ((u === undefined) || (typeof (u.entity) !== "object") || (u.entity === null))
    return;

  if (((u.entity instanceof CurveCollection) && !u.entity.isAnyRegionType) || isTextStringProps(u.entity)) {
    // Fill only applies to planar regions. Ignore it in any params for anything else.
    u.geomParams = u.geomParams.clone(); // don't modify the original geomParams, since it is probably shared by many entries
    u.geomParams.fillDisplay = undefined;
    u.geomParams.fillColor = undefined;
    u.geomParams.fillTransparency = undefined;
  }
}

function equalGeometryQueries(g1: GeometryQuery, g2: GeometryQuery): boolean {
  const s1 = simplifyGeometryQuery(g1);
  const s2 = simplifyGeometryQuery(g2);
  return s1.isAlmostEqual(s2);
}

function equalEntries(u1: ElementGeometry.AnyGeometricEntityPropsWithParams | undefined, u2: ElementGeometry.AnyGeometricEntityPropsWithParams | undefined): boolean {
  if (u1 === undefined || u2 === undefined)
    return false; // undefined means that it's a geometry entry that we cannot handle
  if (u1.entity === undefined || u2.entity === undefined)
    return false; // undefined means that the geometry entry was corrupt
  // Ignore localRange. That is calculated by the native C++ builder.
  fixGeometryParams(u1);
  fixGeometryParams(u2);
  if (!u1.geomParams.isEquivalent(u2.geomParams))
    return false;
  if (u1.entity instanceof GeometryQuery)
    return (u2.entity instanceof GeometryQuery) && equalGeometryQueries(u1.entity, u2.entity);
  // TODO BRep
  return areObjectsDeepEqual(u1.entity, u2.entity, { topLevelKeysToIgnore: new Set<string>(), ignoreSymbols: true });
}

/**
 * Test if two ElementGeometryDataEntry arrays are equivalent.
 * The test is for equivalence, not strict equality. That means:
 * - For params, GeometryParams.isEquivalent is used.
 * - For GeometryQueries, GeometryQueries.isAlmostEqual
 * Beyond that, as it compare the entries, this function applies the same simplications and filters (temporarily)
 * to geometries and params that the C++ addon builder would apply when incorporating them into a geometry stream.
 * Therefore, this function can be used to compare the entryArray an ElementGeometryBuilderParams prior to insert
 * with that of an ElementGeometryInfo returned by IModelDb.elementGeometryRequest for a persistent geometric element.
 * @param a1 the first stream of geometric entities
 * @param a2 the second stream of geometric entities
 * @returns true if the two streams are equivalent
 * @alpha
 */
export function areEqualElementGeometryEntities(a1: ElementGeometry.EntityPropsIterator, a2: ElementGeometry.EntityPropsIterator): boolean {
  for (const e1 of a1) {
    const e2 = a2.next();
    if (e2.done)
      return false;
    if (!equalEntries(e1, e2.value))
      return false;
  }
  if (!a2.next().done)
    return false;
  return true;
}
