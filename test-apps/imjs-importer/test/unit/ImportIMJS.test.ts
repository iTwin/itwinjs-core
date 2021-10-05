/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "mocha";
import { expect } from "chai";
import { IModelHost } from "@itwin/core-backend";
import { ImportIMJS } from "../../src/ImportIMJS";

describe("ImportIMJS", () => {
    beforeEach(() => {
        IModelHost.startup();
    });

    afterEach(() => {
        IModelHost.shutdown();
    });

    it("imjsFromNative", async () => {
        const importer = ImportIMJS.create("d:\\bfiles\\importIMJS\\imjsFromNative.bim", "testSubject");
        let ok = true;

        if (importer) {
            const modelGroups = importer.importFilesFromDirectory("d:/git20B/imodeljs/core/geometry/src/test/iModelJsonSamples/fromNative/");
            console.log("Imported model groups", modelGroups.length);
            let totalModels = 0;
            for (const group of modelGroups) {
                totalModels += group.modelNames.length;
                console.log({
                    groupName: group.groupName, numModel: group.modelNames.length,
                    range: Math.floor(0.999999 + group.range.maxAbs()),
                });
            }
            ok = totalModels > 0;

        }

        expect(ok)
    });
    it.only("imodeljsUnitTest", async () => {
        for (const directoryTail of [
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
        ]) {
            const importer = ImportIMJS.create("d:\\bfiles\\importIMJS\\" + directoryTail + ".bim",
                "testSubject");
            let ok = true;

            if (importer) {
                const modelGroups = importer.importFilesFromDirectory(
                    "d:\\git20B\\imodeljs\\core\\geometry\\src\\test\\output\\" + directoryTail + "\\");
                let numModel = 0;
                for (const group of modelGroups) {
                    numModel += group.modelNames.length;
                }
                console.log({ directoryName: directoryTail, models: numModel });
                let totalModels = 0;
                for (const group of modelGroups) {
                    if (group.modelNames.length > 0) {
                        totalModels += group.modelNames.length;
                        console.log({
                            groupName: group.groupName, numModel: group.modelNames.length,
                            range: Math.floor(0.999999 + group.range.maxAbs()),
                        });
                    }
                }
                ok = totalModels > 0;
            }
            expect(ok)
        }
    });

});
