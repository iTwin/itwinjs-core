/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import {
  Point3d, YawPitchRollAngles, Arc3d,
} from "@bentley/geometry-core";
import { Id64, Guid } from "@bentley/bentleyjs-core";
import {
  Code, GeometricElement3dProps, GeometryStreamProps, GeometryPartProps, IModel, GeometryStreamBuilder, GeomCoordSystem,
} from "@bentley/imodeljs-common";
import { IModelTestUtils } from "./IModelTestUtils";
import { IModelJson as GeomJson } from "@bentley/geometry-core/lib/serialization/IModelJsonSchema";
import { DictionaryModel, IModelDb, GeometricElement3d } from "../backend";
import { TextString, TextStringProps } from "@bentley/imodeljs-common/lib/geometry/TextString";

describe("GeometryStream", () => {
  let imodel: IModelDb;
  let imodelWithFonts: IModelDb;

  before(() => {
    imodel = IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
    imodelWithFonts = IModelTestUtils.openIModel("test.bim"); // NOTE: Has font map...but no embedded fonts, end up with last resort font...
  });

  after(() => {
    IModelTestUtils.closeIModel(imodel);
    IModelTestUtils.closeIModel(imodelWithFonts);
  });

  it.skip("json encoding and decoding roundtrip of TextString in world coords", async () => {
    // tslint:disable-next-line:no-debugger
    // debugger;

    // Set up element to be placed in iModel
    const seedElement = imodelWithFonts.elements.getElement(new Id64("0x38"));
    assert.isTrue(seedElement instanceof GeometricElement3d);
    const fonts = imodelWithFonts.getFontMap();
    assert.isTrue(fonts.fonts.size > 0);

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(45, 0, 0);
    const builder = GeometryStreamBuilder.from3d(testOrigin, testAngles);

    const textProps: TextStringProps = {
      text: "ABC",
      font: 1,
      height: 2,
      bold: true,
      origin: testOrigin,
      rotation: testAngles,
    };

    const textString = new TextString(textProps);
    const status = builder.appendTextString(textString, GeomCoordSystem.World);
    assert.isTrue(status);

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodelWithFonts,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      federationGuid: new Guid(true),
      userLabel: "UserLabel-" + 1,
      geom: builder.geometryStream,
      placement: { origin: testOrigin, angles: testAngles },
    };

    const testElem = imodelWithFonts.elements.createElement(elementProps);
    const newId = imodelWithFonts.elements.insertElement(testElem);
    imodelWithFonts.saveChanges();

    // Extract and test value returned, text transform should now be identity as it's accounted for by element's placement...
    const value = imodelWithFonts.elements.getElement({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    for (const entry of value.geom) {
      assert.isDefined(entry.textString);
      const origin = new Point3d(entry.textString.origin);
      const rotation = new YawPitchRollAngles(entry.textString.rotation);
      assert.isTrue(origin.isAlmostZero());
      assert.isTrue(rotation.isIdentity());
    }
  });

  it.skip("json encoding and decoding roundtrip of GeometryPart", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];

    const geometryStream: GeometryStreamProps = [];

    for (const geom of geomArray) {
      const arcData = GeomJson.Writer.toIModelJson(geom);
      geometryStream.push(arcData);
    }

    const dictionary: DictionaryModel = imodel.models.getModel(IModel.getDictionaryId()) as DictionaryModel;
    const partProps: GeometryPartProps = {
      classFullName: "BisCore:GeometryPart",
      iModel: imodel,
      model: dictionary,
      code: Code.createEmpty(),
      geom: geometryStream,
    };

    const testPart = imodel.elements.createElement(partProps);
    const partId = imodel.elements.insertElement(testPart);
    imodel.saveChanges();

    // Extract and test value returned
    const value = imodel.elements.getElement({ id: partId, wantGeometry: true });
    assert.isDefined(value.geom);
  });

  it.skip("json encoding and decoding roundtrip of arcs", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];

    const geometryStream: GeometryStreamProps = [];

    for (const geom of geomArray) {
      const arcData = GeomJson.Writer.toIModelJson(geom);
      geometryStream.push(arcData);
    }

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      federationGuid: new Guid(true),
      userLabel: "UserLabel-" + 1,
      geom: geometryStream,
    };

    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    // Extract and test value returned
    const value = imodel.elements.getElement({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    const geomArrayOut: Arc3d[] = [];
    for (const entry of value.geom) {
      assert.isDefined(entry.arc);
      const geometryQuery = GeomJson.Reader.parse(entry);
      assert.isTrue(geometryQuery instanceof Arc3d, "GeometricPrimitive correctly returned Arc3d data");
      if (geometryQuery !== undefined)
        geomArrayOut.push(geometryQuery);
    }

    assert.equal(geomArrayOut.length, geomArray.length, "All elements extracted from buffer");
    for (let i = 0; i < geomArrayOut.length; i++) {
      assert.isTrue(geomArrayOut[i].isAlmostEqual(geomArray[i]));
    }
  });
});
