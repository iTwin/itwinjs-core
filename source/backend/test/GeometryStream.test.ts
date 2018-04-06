/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Point3d, YawPitchRollAngles, Arc3d, IModelJson as GeomJson, LineSegment3d } from "@bentley/geometry-core";
import { Id64 } from "@bentley/bentleyjs-core";
import {
  Code, GeometricElement3dProps, GeometryStreamProps, GeometryPartProps, IModel, GeometryStreamBuilder, TextString, TextStringProps,
} from "@bentley/imodeljs-common";
import { IModelTestUtils } from "./IModelTestUtils";
import { IModelDb, GeometricElement3d, LineStyleDefinition } from "../backend";

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

  it("json encoding and decoding of linestyle", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    // tslint:disable-next-line:no-debugger
    // debugger;

    const lsStrokes: LineStyleDefinition.Strokes = [];
    lsStrokes.push({ length: 0.25, orgWidth: 0.0, endWidth: 0.025, strokeMode: 1, widthMode: 3 });
    lsStrokes.push({ length: 0.1 });
    lsStrokes.push({ length: 0.1, orgWidth: 0.025, endWidth: 0.025, strokeMode: 1, widthMode: 3 });
    lsStrokes.push({ length: 0.1 });
    lsStrokes.push({ length: 0.25, orgWidth: 0.025, endWidth: 0.0, strokeMode: 1, widthMode: 3 });
    lsStrokes.push({ length: 0.1 });

    const lineCodeData = LineStyleDefinition.Utils.createLineCode(imodel, { descr: "TestDashDotDashLineCode", strokes: lsStrokes } );
    assert.isTrue(undefined !== lineCodeData);

    const partStream: GeometryStreamProps = [];
    partStream.push(GeomJson.Writer.toIModelJson(Arc3d.createXY(Point3d.createZero(), 0.05)));

    const partProps: GeometryPartProps = {
      classFullName: "BisCore:GeometryPart",
      iModel: imodel,
      model: IModel.getDictionaryId(),
      code: Code.createEmpty(),
      geom: partStream,
    };

    const partId = imodel.elements.insertElement(partProps);
    assert.isTrue(partId.isValid());

    const pointSymbolData = LineStyleDefinition.Utils.createPointSymbol(imodel, { geomPartId: partId } ); // base and size will be set automatically...
    assert.isTrue(undefined !== pointSymbolData);

    const lsSymbols: LineStyleDefinition.Symbols = [];
    lsSymbols.push({ symId: pointSymbolData!.compId, strokeNum: 1, mod1: 3 }); // NEEDSWORK: Add enums for stuff like mod1...
    lsSymbols.push({ symId: pointSymbolData!.compId, strokeNum: 3, mod1: 3 });

    const linePointData = LineStyleDefinition.Utils.createLinePoint(imodel, { descr: "TestGapSymbolsLinePoint", lcId: lineCodeData!.compId, symbols: lsSymbols } );
    assert.isTrue(undefined !== linePointData);

    const lsComponents: LineStyleDefinition.Components = [];
    lsComponents.push({ id: linePointData!.compId, type: linePointData!.compType });
    lsComponents.push({ id: lineCodeData!.compId, type: lineCodeData!.compType });

    const compoundData = LineStyleDefinition.Utils.createCompound(imodel, { comps: lsComponents } );
    assert.isTrue(undefined !== compoundData);

    const styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.getDictionaryId(), "TestDashCircleDotCircleDashStyle", compoundData!);
    assert.isTrue(styleId.isValid());

    // const styleId2a = LineStyleDefinition.Utils.getOrCreateLinePixelsStyle(imodel, IModel.getDictionaryId(), LineStyleDefinition.LinePixels.Code4);
    // assert.isTrue(styleId2a.isValid());
    // const styleId2b = LineStyleDefinition.Utils.getOrCreateLinePixelsStyle(imodel, IModel.getDictionaryId(), LineStyleDefinition.LinePixels.Code4);
    // assert.isTrue(styleId2a.equals(styleId2b));

    const geometryStream: GeometryStreamProps = [];
    geometryStream.push({ appearance: { style: styleId } });
    geometryStream.push(GeomJson.Writer.toIModelJson(LineSegment3d.create(Point3d.createZero(), Point3d.create(10, 0, 0))));

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      userLabel: "UserLabel-" + 1,
      geom: geometryStream,
    };

    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(newId.isValid());
    imodel.saveChanges();
  });

  it("json encoding and decoding roundtrip of TextString in world coords", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodelWithFonts.elements.getElement(new Id64("0x38"));
    assert.isTrue(seedElement instanceof GeometricElement3d);
    const fonts = imodelWithFonts.getFontMap();
    assert.isTrue(fonts.fonts.size > 0);

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(45, 0, 0);
    const builder = new GeometryStreamBuilder();

    builder.setLocalToWorld3d(testOrigin, testAngles); // Establish world to local transform...

    const textProps: TextStringProps = {
      text: "ABC",
      font: 1,
      height: 2,
      bold: true,
      origin: testOrigin,
      rotation: testAngles,
    };

    const textString = new TextString(textProps);
    const status = builder.appendTextString(textString);
    assert.isTrue(status);

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodelWithFonts,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
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

  it("json encoding and decoding roundtrip of GeometryPart", async () => {
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

    const partProps: GeometryPartProps = {
      classFullName: "BisCore:GeometryPart",
      iModel: imodel,
      model: IModel.getDictionaryId(),
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

  it("json encoding and decoding roundtrip of arcs", async () => {
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
