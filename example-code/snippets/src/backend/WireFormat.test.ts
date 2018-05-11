/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";
import * as path from "path";
import { assert } from "chai";
import { OpenMode } from "@bentley/bentleyjs-core";
import { Arc3d, Point3d, AngleSweep, Angle, LineString3d } from "@bentley/geometry-core";
import { ElementProps, IModel, ModelProps } from "@bentley/imodeljs-common";
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
    const elementProps: ElementProps = iModel.elements.getElementProps(IModel.rootSubjectId);
    const json: string = JSON.stringify(elementProps, undefined, 2);
    // __PUBLISH_EXTRACT_END__
    assert.isDefined(elementProps);
    fs.writeFileSync(jsonOutputFileName, json);
    assert.isTrue(fs.existsSync(jsonOutputFileName));
  });

  it("RepositoryModel", () => {
    const jsonOutputFileName: string = getJsonOutputFileName("WireFormat_RepositoryModel");
    // __PUBLISH_EXTRACT_START__ WireFormat_RepositoryModel.code
    const modelProps: ModelProps = iModel.models.getModel(IModel.repositoryModelId);
    const json: string = JSON.stringify(modelProps, undefined, 2);
    // __PUBLISH_EXTRACT_END__
    assert.isDefined(modelProps);
    fs.writeFileSync(jsonOutputFileName, json);
    assert.isTrue(fs.existsSync(jsonOutputFileName));
  });

  it("Arc3d", () => {
    const jsonOutputFileName: string = getJsonOutputFileName("WireFormat_Arc3d");
    // __PUBLISH_EXTRACT_START__ WireFormat_Arc3d.code
    const center = new Point3d(0, 0, 0);
    const radius = 1;
    const sweep: AngleSweep = AngleSweep.createStartEnd(Angle.createDegrees(90), Angle.createDegrees(180));
    const arc: Arc3d = Arc3d.createXY(center, radius, sweep);
    const json: string = JSON.stringify(arc, undefined, 2);
    // __PUBLISH_EXTRACT_END__
    assert.isDefined(arc);
    fs.writeFileSync(jsonOutputFileName, json);
    assert.isTrue(fs.existsSync(jsonOutputFileName));
  });

  it("LineString3d", () => {
    const jsonOutputFileName: string = getJsonOutputFileName("WireFormat_LineString3d");
    // __PUBLISH_EXTRACT_START__ WireFormat_LineString3d.code
    const points: Point3d[] = [
      new Point3d(0, 0, 0),
      new Point3d(1, 2, 0),
      new Point3d(1, 2, 4),
    ];
    const lineString: LineString3d = LineString3d.createPoints(points);
    const json: string = JSON.stringify(lineString, undefined, 2);
    // __PUBLISH_EXTRACT_END__
    assert.isDefined(lineString);
    fs.writeFileSync(jsonOutputFileName, json);
    assert.isTrue(fs.existsSync(jsonOutputFileName));
  });

});
