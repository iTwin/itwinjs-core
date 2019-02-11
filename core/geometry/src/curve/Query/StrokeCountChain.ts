/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { StrokeCountMap } from "./StrokeCountMap";
import { CurveCollection, CurveChain } from "../CurveCollection";
import { ParityRegion } from "../ParityRegion";
import { StrokeOptions } from "../StrokeOptions";
import { LineString3d } from "../LineString3d";
import { AnyCurve } from "../CurveChain";
import { Geometry } from "../../Geometry";
import { Loop } from "../Loop";
import { Range1d } from "../../geometry3d/Range";
import { Point3d } from "../../geometry3d/Point3dVector3d";
/**
 * class `StrokeCountChain` contains:
 * * `maps` = an array of `StrokeCountMap`
 * * `parent` = parent CurveCollection.
 *
 * An instance is normally created with either a `Path` or `Loop` as the parent.
 */
export class StrokeCountChain {
  public maps: StrokeCountMap[];
  public parent?: CurveCollection;
  /**
   * options are used (with different purposes) at two times:
   * * When the StrokeCountChain is created, the options affect the stroke counts.  This is just creating markup, not actual strokes.
   * * When actual stroking happens, the options control creation of parameters and tangents.
   */
  public options?: StrokeOptions;

  private constructor(parent?: CurveCollection, options?: StrokeOptions) {
    this.parent = parent;
    this.maps = [];
    this.options = options;
  }
  public static createForCurveChain(chain: CurveChain, options?: StrokeOptions): StrokeCountChain {
    const result = new StrokeCountChain(chain, options);
    result.parent = chain;
    // A chain can only contain primitives !!!!
    for (const p of chain.children) {
      p.computeAndAttachRecursiveStrokeCounts(options);
      if (p.strokeData)
        result.maps.push(p.strokeData);
    }
    return result;
  }
  public getStrokes(): LineString3d {
    const ls = LineString3d.create();
    if (this.options) {
      if (this.options.needNormals || this.options.needParams) {
        ls.initializeFractionArray();
        ls.initializeDerivativeArray();
      }
    }
    for (const m of this.maps) {
      if (m.primitive)
        m.primitive.addMappedStrokesToLineString3D(m, ls);
    }
    return ls;

  }
}

/**
 * class `StrokeCountSection`\
 * * contains an array of `StrokeCountChain`.
 * * Hence it is the internal node level of a (1-level-deep) tree of `StrokeCountChain`
 */
export class StrokeCountSection {
  public chains: StrokeCountChain[];
  public parent?: CurveCollection;
  private constructor(parent?: CurveCollection) { this.parent = parent; this.chains = []; }
  /**
   * construct array of arrays of `StrokeCountMap`s
   * @param parent
   */
  public static createForParityRegionOrChain(parent: CurveCollection, options?: StrokeOptions): StrokeCountSection {
    const result = new StrokeCountSection(parent);
    if (parent instanceof ParityRegion) {
      for (const child of parent.children) {
        const p = StrokeCountChain.createForCurveChain(child, options);
        result.chains.push(p);
      }
    } else if (parent instanceof CurveChain) {
      result.chains.push(StrokeCountChain.createForCurveChain(parent, options));
    }
    return result;
  }
  /** test if all sections have the same structure. */
  public static areSectionsCompatible(sections: StrokeCountSection[], enforceCounts: boolean): boolean {
    if (sections.length < 2)
      return true;  // hm.. don't know if that is useful, but nothing to check here.
    const numChains = sections[0].chains.length;
    for (let i = 1; i < sections.length; i++) {
      // first level: must match number of paths or loops
      if (sections[i].chains.length !== numChains)
        return false;
      // second level: must have same number of primitives in each path or loop
      for (let j = 0; j < sections[0].chains.length; j++) {
        const numPrimitive = sections[0].chains[j].maps.length;
        if (sections[i].chains[j].maps.length !== numPrimitive)
          return false;
        for (let k = 0; k < numPrimitive; k++) {
          if (!sections[0].chains[j].maps[k].isCompatibleComponentStructure(sections[i].chains[j].maps[k], enforceCounts))
            return false;
        }
      }

    }
    return true;
  }
  // walk up the array of sections, enforcing compatibility at corresponding maps within a specific chainIndex.
  // all indices assumed valid by prior tests.
  private static enforceCountCompatibityAtChainIndex(sections: StrokeCountSection[], chainIndex: number, workMaps: StrokeCountMap[]) {
    // pull corresponding maps out of all sections
    const numMapPerSection = sections[0].chains[chainIndex].maps.length;
    let maxNumStroke;
    let totalStroke;
    let numComponent;
    for (let k = 0; k < numMapPerSection; k++) {
      workMaps.length = 0;
      for (const s of sections) {
        workMaps.push(s.chains[chainIndex].maps[k]);
      }
      if (workMaps[0].componentData) {
        // enforce component-by-component compatibility, sum to get final number
        numComponent = workMaps[0].componentData.length;
        totalStroke = 0;
        for (let c = 0; c < numComponent; c++) {
          // No components.  just work with primary counts.
          maxNumStroke = 0;
          for (const map of workMaps) maxNumStroke = Geometry.maxXY(maxNumStroke, map.componentData![c].numStroke);
          totalStroke += maxNumStroke;
          for (const map of workMaps) map.componentData![c].numStroke = maxNumStroke;
          for (const map of workMaps) map.numStroke = totalStroke;
        }

      } else {
        // No components.  just work with primary counts.
        maxNumStroke = 0;
        for (const map of workMaps) maxNumStroke = Geometry.maxXY(maxNumStroke, map.numStroke);
        for (const map of workMaps) map.numStroke = maxNumStroke;

      }
    }
  }

  /**
   * * Confirm that all sections in the array have the same structure.
   * * Within each corresponding set of entries, apply the max count to all.
   * @param sections array of per-section stroke count entries
   */
  public static enforceCompatibility(sections: StrokeCountSection[]): boolean {

    if (sections.length < 2)
      return true;
    if (!StrokeCountSection.areSectionsCompatible(sections, false))
      return false;
    // Sections are compatible ...
    // among corresponding maps, enforce maximum count ..
    const mapList: StrokeCountMap[] = [];
    const numChains = sections[0].chains.length;
    for (let chainIndex = 0; chainIndex < numChains; chainIndex++)
      StrokeCountSection.enforceCountCompatibityAtChainIndex(sections, chainIndex, mapList);
    return true;

  }
  /**
   * Return stroked form of the section.
   */
  public getStrokes(): AnyCurve {
    if (this.chains.length === 1) {
      return this.chains[0].getStrokes();
    } else {
      const region = ParityRegion.create();
      for (const c of this.chains) {
        const strokes = c.getStrokes();
        if (strokes instanceof LineString3d)
          region.tryAddChild(Loop.create(strokes));
      }
      return region;
    }
  }
  /**
   * Given two compatibile stroke sets (as returned by getStrokes) extend a range
   * with the distances between corresponding points.
   * * Each set of strokes may be:
   *   * linestring
   *   * ParityRegion
   *   * CurveChain (Loop or Path)
   * @param strokeA first set of strokes
   * @param strokeB second set of strokes
   * @param rangeToExtend caller-allocated range to be extended.
   * @returns true if structures are compatible.
   */
  public static extendDistanceRangeBetweenStrokes(strokeA: AnyCurve, strokeB: AnyCurve, rangeToExtend: Range1d): boolean {
    if (!strokeA.isSameGeometryClass(strokeB))
      return false;
    if (strokeA instanceof LineString3d) {
      if (!(strokeB instanceof LineString3d))
        return false;
      if (strokeA.numPoints() === strokeB.numPoints()) {
        const n = strokeA.numPoints();
        const pointA = Point3d.create();
        const pointB = Point3d.create();
        const allPointA = strokeA.packedPoints;
        const allPointB = strokeB.packedPoints;

        for (let i = 0; i < n; i++) {
          allPointA.atPoint3dIndex(i, pointA);
          allPointB.atPoint3dIndex(i, pointB);
          rangeToExtend.extendX(pointA.distance(pointB));
        }
        return true;
      }
    } else if (strokeA instanceof ParityRegion) {
      if (!(strokeB instanceof ParityRegion))
        return false;
      const childrenA = strokeA.children;
      const childrenB = strokeB.children;
      const n = childrenA.length;
      if (n === childrenB.length) {
        for (let i = 0; i < n; i++) {
          if (!this.extendDistanceRangeBetweenStrokes(childrenA[i], childrenB[i], rangeToExtend))
            return false;
        }
        return true;
      }
    } else if (strokeA instanceof CurveChain) {
      if (!(strokeB instanceof CurveChain))
        return false;
      const childrenA = strokeA.children;
      const childrenB = strokeB.children;
      const n = childrenA.length;
      if (n === childrenB.length) {
        for (let i = 0; i < n; i++) {
          if (!this.extendDistanceRangeBetweenStrokes(childrenA[i], childrenB[i], rangeToExtend))
            return false;
        }
        return true;
      }
    }
    return false;
  }
}
