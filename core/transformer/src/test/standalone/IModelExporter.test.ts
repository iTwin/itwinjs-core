/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as path from "path";
import { Element, GeometryPart, IModelJsFs, SnapshotDb } from "@itwin/core-backend";
import { createBRepDataProps } from "@itwin/core-backend/lib/cjs/test/GeometryTestUtil";
import { Id64 } from "@itwin/core-bentley";
import { Code, GeometryStreamBuilder, IModel } from "@itwin/core-common";
import { Point3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { IModelExporter } from "../../core-transformer";
import { IModelExportHandler } from "../../IModelExporter";
import { IModelTransformerTestUtils } from "../IModelTransformerUtils";
import { KnownTestLocations } from "../KnownTestLocations";

import "./TransformerTestStartup"; // calls startup/shutdown IModelHost before/after all tests

describe("IModelExporter", () => {
  const outputDir = path.join(KnownTestLocations.outputDir, "IModelExporter");

  before(async () => {
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir)) {
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    }
    if (!IModelJsFs.existsSync(outputDir)) {
      IModelJsFs.mkdirSync(outputDir);
    }
  });

  it("export element with brep geometry", async () => {
    const sourceDbPath = IModelTransformerTestUtils.prepareOutputFile("IModelExporter", "RoundtripBrep.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbPath, { rootSubject: { name: "brep-roundtrip" } });

    const builder = new GeometryStreamBuilder();
    builder.appendBRepData(createBRepDataProps(Point3d.create(5, 10, 0), YawPitchRollAngles.createDegrees(45, 0, 0)));

    const geomPart = new GeometryPart({
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
    }, sourceDb);

    assert(geomPart.geom?.[0]?.brep?.data !== undefined);

    const geomPartId = geomPart.insert();
    assert(Id64.isValidId64(geomPartId));

    const geomPartInSource = sourceDb.elements.getElement<GeometryPart>({ id: geomPartId, wantGeometry: true, wantBRepData: true }, GeometryPart);
    assert(geomPartInSource.geom?.[1]?.brep?.data !== undefined);

    sourceDb.saveChanges();

    const flatTargetDbPath = IModelTransformerTestUtils.prepareOutputFile("IModelExporter", "RoundtripBrepTarget.bim");
    const flatTargetDb = SnapshotDb.createEmpty(flatTargetDbPath, { rootSubject: sourceDb.rootSubject });

    class TestFlatImportHandler extends IModelExportHandler {
      public override onExportElement(elem: Element): void {
        if (elem instanceof GeometryPart)
          flatTargetDb.elements.insertElement(elem.toJSON());
      }
    }

    const exporter = new IModelExporter(sourceDb);
    exporter.registerHandler(new TestFlatImportHandler());
    exporter.wantGeometry = true;
    await expect(exporter.exportAll()).to.eventually.be.fulfilled;

    const geomPartInTarget = flatTargetDb.elements.getElement<GeometryPart>({ id: geomPartId, wantGeometry: true, wantBRepData: true }, GeometryPart);
    assert(geomPartInTarget.geom?.[1]?.brep?.data !== undefined);

    sourceDb.close();
  });
});
