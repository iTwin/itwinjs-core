/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";
import * as path from "path";
import { assert } from "chai";
import { Id64, OpenMode } from "@bentley/bentleyjs-core";
import { Arc3d, Point3d, AngleSweep, Angle, LineString3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { ElementProps, GeometricElement3dProps, GeometryStreamBuilder, IModel, ModelProps, Placement3dProps, Code } from "@bentley/imodeljs-common";
import { IModelDb } from "@bentley/imodeljs-backend";
import { IModelTestUtils } from "./IModelTestUtils";

/**
 * Example code organized as tests to make sure that it builds and runs successfully.
 * > Note: these snippets get included by `docs/learning/WireFormat.md`
 */
describe("Wire Format Snippets", () => {
  let iModel: IModelDb;

  before(() => {
    iModel = IModelTestUtils.openIModel("test.bim", { copyFilename: "wire-format.bim", openMode: OpenMode.ReadWrite });
  });

  after(() => {
    iModel.closeStandalone();
  });

  const getJsonOutputFileName = (baseName: string): string => {
    return path.join(__dirname, "../../../../generated-docs/extract/", `${baseName}.json`);
  };

  it("Root Subject", () => {
    const jsonOutputFileName: string = getJsonOutputFileName("WireFormat_RootSubject");
    // __PUBLISH_EXTRACT_START__ WireFormat_RootSubject.code
    const elementProps = iModel.elements.getElementProps(IModel.rootSubjectId) as ElementProps;
    const json = JSON.stringify(elementProps, undefined, 2);
    // __PUBLISH_EXTRACT_END__
    assert.isDefined(elementProps);
    fs.writeFileSync(jsonOutputFileName, json);
    assert.isTrue(fs.existsSync(jsonOutputFileName));
  });

  it("RepositoryModel", () => {
    const jsonOutputFileName: string = getJsonOutputFileName("WireFormat_RepositoryModel");
    // __PUBLISH_EXTRACT_START__ WireFormat_RepositoryModel.code
    const modelProps = iModel.models.getModel(IModel.repositoryModelId) as ModelProps;
    const json = JSON.stringify(modelProps, undefined, 2);
    // __PUBLISH_EXTRACT_END__
    assert.isDefined(modelProps);
    fs.writeFileSync(jsonOutputFileName, json);
    assert.isTrue(fs.existsSync(jsonOutputFileName));
  });

  it("GeometricElement3d", () => {
    const modelId = Id64.invalid;
    const categoryId = Id64.invalid;
    // __PUBLISH_EXTRACT_START__ WireFormat_GeometricElement3d.code
    // Construct an Arc3d (local coordinates)
    const center = new Point3d(0, 0, 0);
    const radius = 1;
    const sweep: AngleSweep = AngleSweep.createStartEnd(Angle.createDegrees(90), Angle.createDegrees(180));
    const arc: Arc3d = Arc3d.createXY(center, radius, sweep);
    const arcJson: string = JSON.stringify(arc, undefined, 2);

    // Construct a LineString3d (local coordinates)
    const points: Point3d[] = [
      new Point3d(0, 0, 0),
      new Point3d(1, 2, 0),
      new Point3d(1, 2, 4),
    ];
    const lineString: LineString3d = LineString3d.createPoints(points);
    const lineStringJson: string = JSON.stringify(lineString, undefined, 2);

    // Construct a GeometryStream containing the Arc3d and LineString3d created above (local coordinates)
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(arc);
    builder.appendGeometry(lineString);
    const geometryStreamJson: string = JSON.stringify(builder.geometryStream, undefined, 2);

    // Construct a Placement (world coordinates)
    const origin = new Point3d(100, 100, 0);
    const angles = YawPitchRollAngles.createDegrees(0, 90, 0);
    const placement: Placement3dProps = { origin, angles };
    const placementJson: string = JSON.stringify(placement, undefined, 2);

    // Construct a GeometricElement3d using the GeometryStream and Placement created above
    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      model: modelId,
      code: Code.createEmpty(),
      category: categoryId,
      placement,
      geom: builder.geometryStream,
    };
    const elementPropsJson: string = JSON.stringify(elementProps, undefined, 2);

    // __PUBLISH_EXTRACT_END__
    fs.writeFileSync(getJsonOutputFileName("WireFormat_GeometricElement3d_Arc"), arcJson);
    fs.writeFileSync(getJsonOutputFileName("WireFormat_GeometricElement3d_LineString"), lineStringJson);
    fs.writeFileSync(getJsonOutputFileName("WireFormat_GeometricElement3d_GeometryStream"), geometryStreamJson);
    fs.writeFileSync(getJsonOutputFileName("WireFormat_GeometricElement3d_Placement"), placementJson);
    fs.writeFileSync(getJsonOutputFileName("WireFormat_GeometricElement3d_Element"), elementPropsJson);
  });

});
