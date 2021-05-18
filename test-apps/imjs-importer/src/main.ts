/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHost } from "@bentley/imodeljs-backend";
import { ImportIMJS } from "./ImportIMJS";

/* eslint-disable no-console */

IModelHost.startup().then(async () => {
  console.log("start ..");
  for (const directoryTail of [
    "TaggedGeometryData",
    /*
    "AlternatingConvexClipTree",
    "Angle",
    "Arc3d",
    "ArnoldasEarthWorks",
    "Bezier",
    "BezierCurve3d",
    "BSpline",
    "BSplineCurve",
    "BSplineSurface",
    "ClipNode",
    "ClipPlane",
    "CoincidentGeometryQuery",
    "ConsolidateAdjacentPrimitives",
    "CurveCurveIntersection",
    "CurveCurveXY",
    "CurveFactory",
    "CurveOffset",
    "CurvePrimitive",
    "Ellipsoid",
    "EllipsoidPatch",
    "FrameBuilder",
    "Geometry3d",
    "Geometry4d",
    "Graph",
    "GreedyTriangulationBetweenLineStrings",
    "GriddedRaggedRange2dSet",
    "GridSampling",
    "iModelJsonSamples",
    "InsertAndRetriangulateContext",
    "LinearSearchRange2dArray",
    "Linestring3d",
    "MarkVisibility",
    "Moments",
    "Point3dArray",
    "PolarData",
    "Polyface",
    "PolyfaceClip",
    "PolyfaceQuery",
    "PolygonAreas",
    "PolygonOffset",
    "PolygonOps",
    "PolylineCompression",
    "RegionBoolean",
    "RegionOps",
    "ReorientFacets",
    "Solids",
    "SortablePolygon",
    "SphereImplicit",
    "TransformedSolids",
    "Triangulation",
    "ViewWidget",
    "XYPointBuckets",
    */
  ]) {
    console.log(`input from${directoryTail}`);
    const importer = ImportIMJS.create(`d:\\bfiles\\importIMJS\\${directoryTail}.bim`,
      "testSubject");

    if (!importer) {
      console.log("Failed to create bim file");
    } else {
      const modelGroups = importer.importFilesFromDirectory(
        `..\\..\\core\\geometry\\src\\test\\output\\${directoryTail}\\`);
      let numModel = 0;
      for (const group of modelGroups) {
        numModel += group.modelNames.length;
      }
      console.log({ directoryName: directoryTail, models: numModel });
      for (const group of modelGroups) {
        if (group.modelNames.length > 0) {
          console.log({
            groupName: group.groupName, numModel: group.modelNames.length,
            range: Math.floor(0.999999 + group.range.maxAbs()),
          });
        }
      }
    }
  }
  await IModelHost.shutdown();
  console.log("goodbye");
}).catch(() => { });
