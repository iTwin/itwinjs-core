/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Point3d, YawPitchRollAngles, Arc3d, IModelJson as GeomJson, LineSegment3d } from "@bentley/geometry-core";
import { Id64, Id64Props } from "@bentley/bentleyjs-core";
import {
  Code, GeometricElement3dProps, GeometryStreamProps, GeometryPartProps, IModel, GeometryStreamBuilder, TextString, TextStringProps, LineStyleProps, FilePropertyProps,
} from "@bentley/imodeljs-common";
import { IModelTestUtils } from "./IModelTestUtils";
import { IModelDb, GeometricElement3d } from "../backend";
import { LineStyle } from "../Element";

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

  it.skip("json encoding and decoding of linestyle", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    enum LineStyleComponentType {
      Unknown = 0,
      PointSymbol = 1,
      Compound = 2,
      LineCode = 3,
      LinePoint = 4,
      Internal = 6,
      RasterImage = 7,
    }

    /** Create line code component */
    type LineStyleStrokeProps =
      { length: number } |
      { orgWidth?: number } |
      { endWidth?: number } |
      { strokeMode?: number } | /** 0 for gap, 1 for dash */
      { widthMode?: number } |
      { capMode?: number };

    type LineStyleStrokes = LineStyleStrokeProps[];

    interface LineStyleLineCodeProps {
      descr: string;
      phase?: number;
      options?: number;
      maxIter?: number;
      strokes: LineStyleStrokes;
    }

    const lsStrokes: LineStyleStrokes = [];
    lsStrokes.push({ length: 0.25, strokeMode: 1 });
    lsStrokes.push({ length: 0.1 });
    lsStrokes.push({ length: 0.1, strokeMode: 1 });
    lsStrokes.push({ length: 0.1 });
    lsStrokes.push({ length: 0.1, strokeMode: 1 });
    lsStrokes.push({ length: 0.1 });
    lsStrokes.push({ length: 0.25, strokeMode: 1 });
    lsStrokes.push({ length: 0.1 });

    const lsCmpnDef1: LineStyleLineCodeProps = { descr: "TestLineCode", strokes: lsStrokes };
    const lsStrVal1 = JSON.stringify(lsCmpnDef1);

    const lineCodeId = 1; // NEEDSWORK: Use get next avail when node addon updated...
    const lsPropsStr1: FilePropertyProps = { name: "LineCodeV1", namespace: "dgn_LStyle", id: lineCodeId };

    const stat1 = imodel.saveFileProperty(lsPropsStr1, lsStrVal1);
    assert.equal(stat1, 0, "saveFileProperty as string");
    const readFromDb1 = imodel.queryFilePropertyString(lsPropsStr1);
    assert.equal(readFromDb1, lsStrVal1, "query string after save");

    /** Create point symbol component */
    type LineStylePointSymbolProps =
      { geomPartId: Id64Props } |
      { baseX?: number } |
      { baseY?: number } |
      { baseZ?: number } |
      { sizeX?: number } |
      { sizeY?: number } |
      { sizeZ?: number } |
      { symFlags?: number } |
      { scale?: number };

    const lsCmpnDef2: LineStylePointSymbolProps = { geomPartId: new Id64() }; // NEEDSWORK: Create geometry part...
    const lsStrVal2 = JSON.stringify(lsCmpnDef2);

    const lineSymbId = 1; // NEEDSWORK: Use get next avail when node addon updated...
    const lsPropsStr2: FilePropertyProps = { name: "PointSymV1", namespace: "dgn_LStyle", id: lineSymbId };

    const stat2 = imodel.saveFileProperty(lsPropsStr2, lsStrVal2);
    assert.equal(stat2, 0, "saveFileProperty as string");
    const readFromDb2 = imodel.queryFilePropertyString(lsPropsStr2);
    assert.equal(readFromDb2, lsStrVal2, "query string after save");

    /** Create line point component */
    type LineStyleSymbolProps =
      { symId: number } | /** id of LineStyleComponentType.PointSymbol component */
      { strokeNum?: number } |
      { xOffset?: number } |
      { yOffset?: number } |
      { angle?: number } |
      { mod1?: number };

    type LineStyleSymbols = LineStyleSymbolProps[];

    interface LineStyleLinePointProps {
      descr: string;
      lcId: number; /** id of LineStyleComponentType.LineCode component */
      symbols: LineStyleSymbols;
    }

    const lsSymbols: LineStyleSymbols = [];
    lsSymbols.push({ symId: lineSymbId, strokeNum: 2 });
    lsSymbols.push({ symId: lineSymbId, strokeNum: 4 });

    const lsCmpnDef3: LineStyleLinePointProps = { descr: "TestLinePoint", lcId: lineCodeId, symbols: lsSymbols };
    const lsStrVal3 = JSON.stringify(lsCmpnDef3);

    const linePointId = 1; // NEEDSWORK: Use get next avail when node addon updated...
    const lsPropsStr3: FilePropertyProps = { name: "LinePointV1", namespace: "dgn_LStyle", id: linePointId };

    const stat3 = imodel.saveFileProperty(lsPropsStr3, lsStrVal3);
    assert.equal(stat3, 0, "saveFileProperty as string");
    const readFromDb3 = imodel.queryFilePropertyString(lsPropsStr3);
    assert.equal(readFromDb3, lsStrVal3, "query string after save");

    /** Create compound component */
    type LineStyleComponentProps =
      { id: number } | /** id of LineCodeV1 or PointSymV1 component */
      { type: LineStyleComponentType } | /** type of component for specified id */
      { offset?: number };

    type LineStyleComponents = LineStyleComponentProps[];

    interface LineStyleCompoundProps {
      comps: LineStyleComponents;
    }

    const lsCmpns: LineStyleComponents = [];
    lsCmpns.push({ id: linePointId, type: LineStyleComponentType.LinePoint });
    lsCmpns.push({ id: lineCodeId, type: LineStyleComponentType.LineCode });

    const lsCmpnDef4: LineStyleCompoundProps = { comps: lsCmpns };
    const lsStrVal4 = JSON.stringify(lsCmpnDef4);

    const compoundId = 1; // NEEDSWORK: Use get next avail when node addon updated...
    const lsPropsStr4: FilePropertyProps = { name: "CompoundV1", namespace: "dgn_LStyle", id: compoundId };

    const stat4 = imodel.saveFileProperty(lsPropsStr4, lsStrVal4);
    assert.equal(stat4, 0, "saveFileProperty as string");
    const readFromDb4 = imodel.queryFilePropertyString(lsPropsStr4);
    assert.equal(readFromDb4, lsStrVal4, "query string after save");

    /* Crete line style definition element */
    interface LineStyleDataProps {
      compId: number;
      compType: LineStyleComponentType;
      flags?: number;
      unitDef?: number;
      }

    const lsDataProps: LineStyleDataProps = {
      compId: 1,
      compType: LineStyleComponentType.Compound,
    };

    // tslint:disable-next-line:no-debugger
    // debugger;

    const lsProps: LineStyleProps = {
      classFullName: "BisCore:LineStyle",
      iModel: imodel,
      model: IModel.getDictionaryId(),
      code: LineStyle.createCode(imodel, IModel.getDictionaryId(), "TestDashDotDotDash"),
      data: JSON.stringify(lsDataProps),
    };

    const lsId = imodel.elements.insertElement(lsProps);
    assert.isTrue(lsId.isValid());

/** */
    const geometryStream: GeometryStreamProps = [];

    geometryStream.push({ appearance: { style: lsId } });
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

    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    assert.isTrue(newId.isValid());
    imodel.saveChanges();
/** */

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
