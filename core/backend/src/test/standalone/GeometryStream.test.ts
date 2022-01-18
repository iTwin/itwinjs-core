/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { BentleyStatus, DbResult, Id64, Id64String } from "@itwin/core-bentley";
import {
  Angle, AngleSweep, Arc3d, Box, ClipMaskXYZRangePlanes, ClipPlane, ClipPlaneContainment, ClipPrimitive, ClipShape, ClipVector, ConvexClipPlaneSet,
  CurveCollection, CurvePrimitive, Geometry, GeometryQueryCategory, IndexedPolyface, LineSegment3d, LineString3d, Loop, Matrix3d,
  Plane3dByOriginAndUnitNormal, Point2d, Point3d, Point3dArray, PointString3d, PolyfaceBuilder, Range3d, SolidPrimitive, Sphere,
  StrokeOptions, Transform, Vector3d, YawPitchRollAngles,
} from "@itwin/core-geometry";
import {
  AreaPattern, BackgroundFill, BRepEntity, BRepGeometryCreate, BRepGeometryFunction, BRepGeometryInfo, BRepGeometryOperation, Code, ColorByName,
  ColorDef, ElementGeometry, ElementGeometryDataEntry, ElementGeometryFunction, ElementGeometryInfo, ElementGeometryOpcode, ElementGeometryRequest,
  ElementGeometryUpdate, FillDisplay, FontProps, FontType, GeometricElement3dProps, GeometricElementProps, GeometryClass,
  GeometryContainmentRequestProps, GeometryParams, GeometryPartProps, GeometryStreamBuilder, GeometryStreamFlags, GeometryStreamIterator,
  GeometryStreamProps, Gradient, ImageGraphicCorners, ImageGraphicProps, IModel, LinePixels, LineStyle, MassPropertiesOperation,
  MassPropertiesRequestProps, PhysicalElementProps, Placement3d, Placement3dProps, TextString, TextStringProps, ThematicGradientMode,
  ThematicGradientSettings, ViewFlags,
} from "@itwin/core-common";
import { GeometricElement, GeometryPart, LineStyleDefinition, PhysicalObject, Platform, SnapshotDb } from "../../core-backend";
import { IModelTestUtils, Timer } from "../";

function assertTrue(expr: boolean): asserts expr {
  assert.isTrue(expr);
}

function createGeometryPartProps(geom: GeometryStreamProps): GeometryPartProps {
  const partProps: GeometryPartProps = {
    classFullName: GeometryPart.classFullName,
    model: IModel.dictionaryId,
    code: Code.createEmpty(),
    geom,
  };
  return partProps;
}

function createPhysicalElementProps(seedElement: GeometricElement, placement?: Placement3dProps, geom?: GeometryStreamProps): PhysicalElementProps {
  const elementProps: PhysicalElementProps = {
    classFullName: PhysicalObject.classFullName,
    model: seedElement.model,
    category: seedElement.category,
    code: Code.createEmpty(),
    geom,
    placement,
  };
  return elementProps;
}

function createGeometryPart(geom: GeometryStreamProps, imodel: SnapshotDb): Id64String {
  const partProps = createGeometryPartProps(geom);
  return imodel.elements.insertElement(partProps);
}

function createGeometricElem(geom: GeometryStreamProps, placement: Placement3dProps, imodel: SnapshotDb, seedElement: GeometricElement): Id64String {
  const elementProps = createPhysicalElementProps(seedElement, placement, geom);
  const el = imodel.elements.createElement<GeometricElement>(elementProps);
  return imodel.elements.insertElement(el);
}

function createPartElem(partId: Id64String, origin: Point3d, angles: YawPitchRollAngles, imodel: SnapshotDb, seedElement: GeometricElement, isRelative = false): Id64String {
  const builder = new GeometryStreamBuilder();
  builder.appendGeometryPart3d(partId, isRelative ? origin : undefined, isRelative ? angles : undefined);
  return createGeometricElem(builder.geometryStream, isRelative ? { origin: Point3d.createZero(), angles: YawPitchRollAngles.createDegrees(0, 0, 0) } : { origin, angles }, imodel, seedElement);
}

function createPointPart(imodel: SnapshotDb): Id64String {
  const builder = new GeometryStreamBuilder();
  builder.appendGeometry(PointString3d.create(Point3d.createZero())); // NOTE: CoordinateXYZ isn't supported...
  return createGeometryPart(builder.geometryStream, imodel);
}

function createCirclePart(radius: number, imodel: SnapshotDb): Id64String {
  const builder = new GeometryStreamBuilder();
  builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), radius));
  return createGeometryPart(builder.geometryStream, imodel);
}

function createCircleElem(radius: number, origin: Point3d, angles: YawPitchRollAngles, imodel: SnapshotDb, seedElement: GeometricElement): Id64String {
  const builder = new GeometryStreamBuilder();
  builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), radius));
  return createGeometricElem(builder.geometryStream, { origin, angles }, imodel, seedElement);
}

function createSphereElem(radius: number, origin: Point3d, angles: YawPitchRollAngles, imodel: SnapshotDb, seedElement: GeometricElement): Id64String {
  const builder = new GeometryStreamBuilder();
  builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), radius));
  return createGeometricElem(builder.geometryStream, { origin, angles }, imodel, seedElement);
}

function createDisjointCirclesElem(radius: number, origin: Point3d, angles: YawPitchRollAngles, imodel: SnapshotDb, seedElement: GeometricElement): Id64String {
  const builder = new GeometryStreamBuilder();
  const xOffset = radius * 1.5;
  builder.appendGeometry(Arc3d.createXY(Point3d.create(-xOffset), radius));
  const geomParams = new GeometryParams(seedElement.category);
  geomParams.geometryClass = GeometryClass.Construction;
  builder.appendGeometryParamsChange(geomParams);
  builder.appendGeometry(Arc3d.createXY(Point3d.create(xOffset), radius));
  return createGeometricElem(builder.geometryStream, { origin, angles }, imodel, seedElement);
}

function createIndexedPolyface(radius: number, origin?: Point3d, angleTol?: Angle): IndexedPolyface {
  const options = StrokeOptions.createForFacets();

  options.needParams = true;
  options.needNormals = true;

  if (angleTol)
    options.angleTol = angleTol;

  // Create indexed polyface for testing by facetting a sphere...
  const sphere = Sphere.createCenterRadius(undefined !== origin ? origin : Point3d.createZero(), radius);
  const polyBuilder = PolyfaceBuilder.create(options);
  polyBuilder.handleSphere(sphere);

  return polyBuilder.claimPolyface();
}

function createBRepDataProps(origin?: Point3d, angles?: YawPitchRollAngles): BRepEntity.DataProps {
  // This brep has a face symbology attribute attached to one face, make it green.
  const faceSymb: BRepEntity.FaceSymbologyProps[] = [
    { color: ColorDef.blue.toJSON() }, // base symbology should match appearance...
    { color: ColorDef.green.toJSON(), transparency: 0.5 },
  ];

  const brepProps: BRepEntity.DataProps = {
    data: "encoding=base64;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",
    faceSymbology: faceSymb,
    transform: Transform.createOriginAndMatrix(origin, angles ? angles.toMatrix3d() : undefined).toJSON(),
  };

  return brepProps;
}

interface ExpectedElementGeometryEntry {
  opcode: ElementGeometryOpcode;
  geometryCategory?: GeometryQueryCategory;
  geometrySubCategory?: string;
  originalEntry?: ElementGeometryDataEntry;
  geomParams?: GeometryParams;
}

function validateElementInfo(info: ElementGeometryInfo, expected: ExpectedElementGeometryEntry[], isWorld: boolean): void {
  assert.isTrue(undefined !== info.entryArray && expected.length === info.entryArray.length);
  const geomParams = (undefined !== info.categoryId ? new GeometryParams(info.categoryId) : undefined);

  info.entryArray.forEach((entry, i) => {
    assert.isTrue(expected[i].opcode === entry.opcode);

    if (ElementGeometry.isGeometryQueryEntry(entry)) {
      const geom = ElementGeometry.toGeometryQuery(entry);
      assert.exists(geom);

      if (undefined !== expected[i].geometryCategory) {
        assert.isTrue(expected[i].geometryCategory === geom?.geometryCategory);
      }

      if (undefined !== expected[i].geometrySubCategory) {
        switch (expected[i].geometryCategory) {
          case "curvePrimitive": {
            assert.isTrue(geom instanceof CurvePrimitive);
            assert.isTrue(expected[i].geometrySubCategory === (geom as CurvePrimitive).curvePrimitiveType);
            break;
          }
          case "curveCollection": {
            assert.isTrue(geom instanceof CurveCollection);
            assert.isTrue(expected[i].geometrySubCategory === (geom as CurveCollection).curveCollectionType);
            break;
          }
          case "solid": {
            assert.isTrue(geom instanceof SolidPrimitive);
            assert.isTrue(expected[i].geometrySubCategory === (geom as SolidPrimitive).solidPrimitiveType);
            break;
          }
        }
      }
    } else if (ElementGeometry.isGeometricEntry(entry)) {
      switch (entry.opcode) {
        case ElementGeometryOpcode.BRep:
          const brep = ElementGeometry.toBRep(entry);
          assert.exists(brep);
          if (!isWorld && undefined !== expected[i].originalEntry) {
            const other = ElementGeometry.toBRep(expected[i].originalEntry!);
            assert.exists(other);
            // NOTE: Don't compare brep type; set from entity data by backend, ignored if supplied to update...
            const transform = Transform.fromJSON(brep?.transform);
            const otherTrans = Transform.fromJSON(other?.transform);
            assert.isTrue(transform.isAlmostEqual(otherTrans));
            const faceSymbLen = (undefined !== brep?.faceSymbology ? brep?.faceSymbology.length : 0);
            const otherSymbLen = (undefined !== other?.faceSymbology ? other?.faceSymbology.length : 0);
            assert.isTrue(faceSymbLen === otherSymbLen);
          }
          break;
        case ElementGeometryOpcode.TextString:
          const text = ElementGeometry.toTextString(entry);
          assert.exists(text);
          if (!isWorld && undefined !== expected[i].originalEntry) {
            const other = ElementGeometry.toTextString(expected[i].originalEntry!);
            assert.exists(other);
            assert.isTrue(text?.font === other?.font);
            assert.isTrue(text?.text === other?.text);
            assert.isTrue(text?.bold === other?.bold);
            assert.isTrue(text?.italic === other?.italic);
            assert.isTrue(text?.underline === other?.underline);
            assert.isTrue(text?.height === other?.height);
            assert.isTrue(text?.widthFactor === other?.widthFactor);
            const origin = Point3d.fromJSON(text?.origin);
            const otherOrigin = Point3d.fromJSON(other?.origin);
            assert.isTrue(origin.isAlmostEqual(otherOrigin));
            const angles = YawPitchRollAngles.fromJSON(text?.rotation);
            const otherAngles = YawPitchRollAngles.fromJSON(other?.rotation);
            assert.isTrue(angles.isAlmostEqual(otherAngles));
          }
          break;
        case ElementGeometryOpcode.Image:
          const image = ElementGeometry.toImageGraphic(entry);
          assert.exists(image);
          if (!isWorld && undefined !== expected[i].originalEntry) {
            const other = ElementGeometry.toImageGraphic(expected[i].originalEntry!);
            assert.exists(other);
            assert.isTrue(image?.textureId === other?.textureId);
            assert.isTrue(image?.hasBorder === other?.hasBorder);
            const corners = ImageGraphicCorners.fromJSON(image!.corners);
            const otherCorners = ImageGraphicCorners.fromJSON(other!.corners);
            assert.isTrue(corners[0].isAlmostEqual(otherCorners[0]));
            assert.isTrue(corners[1].isAlmostEqual(otherCorners[1]));
            assert.isTrue(corners[2].isAlmostEqual(otherCorners[2]));
            assert.isTrue(corners[3].isAlmostEqual(otherCorners[3]));
          }
          break;
        default:
          assert.isTrue(false);
          break;
      }
    } else if (ElementGeometryOpcode.SubGraphicRange === entry.opcode) {
      const subRange = ElementGeometry.toSubGraphicRange(entry);
      assert.exists(subRange);
      assert.isFalse(subRange?.isNull);
    } else if (ElementGeometryOpcode.PartReference === entry.opcode) {
      const partToElement = Transform.createIdentity();
      const part = ElementGeometry.toGeometryPart(entry, partToElement);
      assert.exists(part);
      if (!isWorld && undefined !== expected[i].originalEntry) {
        const otherToElement = Transform.createIdentity();
        const other = ElementGeometry.toGeometryPart(expected[i].originalEntry!, otherToElement);
        assert.exists(other);
        assert.isTrue(partToElement.isAlmostEqual(otherToElement));
      }
    } else if (ElementGeometry.isAppearanceEntry(entry)) {
      if (undefined !== geomParams) {
        const updated = ElementGeometry.updateGeometryParams(entry, geomParams);
        assert.isTrue(updated);
        if (!isWorld && undefined !== expected[i].geomParams)
          assert.isTrue(geomParams.isEquivalent(expected[i].geomParams!));
      }
    }
  });
}

function validateGeometricElementProps(info: ElementGeometryInfo, expected: GeometricElement3dProps): void {
  assert.isFalse(undefined === info.categoryId || undefined === info.sourceToWorld || undefined === info.bbox);
  assert.isTrue(expected.category === info.categoryId);
  const placement = Placement3d.fromJSON(expected.placement);
  const sourceToWorld = ElementGeometry.toTransform(info.sourceToWorld!);
  assert.exists(sourceToWorld);
  assert.isTrue(sourceToWorld?.isAlmostEqual(placement.transform));
  const bbox = ElementGeometry.toElementAlignedBox3d(info.bbox!);
  assert.isFalse(bbox?.isNull);
}

function doElementGeometryValidate(imodel: SnapshotDb, elementId: Id64String, expected: ExpectedElementGeometryEntry[], isWorld: boolean, elementProps?: GeometricElement3dProps, brepOpt?: number): DbResult {
  const onGeometry: ElementGeometryFunction = (info: ElementGeometryInfo): void => {
    if (undefined !== elementProps)
      validateGeometricElementProps(info, elementProps);

    if (1 === brepOpt || 2 === brepOpt)
      assert.isTrue(info.brepsPresent);

    validateElementInfo(info, expected, isWorld);
  };

  const requestProps: ElementGeometryRequest = {
    onGeometry,
    elementId,
  };

  if (1 === brepOpt)
    requestProps.replaceBReps = true;
  else if (2 === brepOpt)
    requestProps.skipBReps = true;

  return imodel.elementGeometryRequest(requestProps);
}

function doElementGeometryUpdate(imodel: SnapshotDb, elementId: Id64String, entryArray: ElementGeometryDataEntry[], isWorld: boolean): DbResult {
  const updateProps: ElementGeometryUpdate = {
    elementId,
    entryArray,
    isWorld,
  };
  const status = imodel.elementGeometryUpdate(updateProps);
  if (DbResult.BE_SQLITE_OK === status)
    imodel.saveChanges();
  return status;
}

function createGeometricElemFromSeed(imodel: SnapshotDb, seedId: Id64String, entryArray: ElementGeometryDataEntry[], placement?: Placement3dProps, isWorld: boolean = false): { status: DbResult, newId: Id64String } {
  const seedElement = imodel.elements.getElement<GeometricElement>(seedId);
  assert.exists(seedElement);

  const elementProps = createPhysicalElementProps(seedElement, placement);
  const testElem = imodel.elements.createElement(elementProps);
  const newId = imodel.elements.insertElement(testElem);

  const status = imodel.elementGeometryUpdate({ elementId: newId, entryArray, isWorld });
  if (DbResult.BE_SQLITE_OK === status)
    imodel.saveChanges();
  return { status, newId };
}

describe("GeometryStream", () => {
  let imodel: SnapshotDb;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("GeometryStream", "GeometryStreamTest.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => {
    imodel.close();
  });

  it("create GeometricElement3d using line codes 1-7", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    // init line code to line pixels array
    const lsCodes: LinePixels[] = [LinePixels.Solid, LinePixels.Code1, LinePixels.Code2, LinePixels.Code3, LinePixels.Code4, LinePixels.Code5, LinePixels.Code6, LinePixels.Code7];

    // create new line style definitions for line codes 1-7
    const lsStyles: Id64String[] = [];
    lsCodes.forEach((linePixels) => {
      lsStyles.push(LinePixels.Solid === linePixels ? Id64.invalid : LineStyleDefinition.Utils.getOrCreateLinePixelsStyle(imodel, IModel.dictionaryId, linePixels));
    });

    // get existing line style definitions for line codes 1-7
    const lsStylesExist: Id64String[] = [];
    lsCodes.forEach((linePixels) => {
      lsStylesExist.push(LinePixels.Solid === linePixels ? Id64.invalid : LineStyleDefinition.Utils.getOrCreateLinePixelsStyle(imodel, IModel.dictionaryId, linePixels));
    });

    // make sure we found existing styles and didn't create a second set
    assert.isTrue(8 === lsStyles.length && lsStyles.length === lsStylesExist.length);
    for (let iStyle = 0; iStyle < lsStyles.length; ++iStyle) {
      assert.isTrue(0 === iStyle || Id64.isValidId64(lsStyles[iStyle]));
      assert.isTrue(lsStylesExist[iStyle] === (lsStyles[iStyle]));
    }

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    const pointS = Point3d.createZero();
    const pointE = Point3d.create(5, 0, 0);

    lsStyles.forEach((styleId) => {
      params.styleInfo = Id64.isValidId64(styleId) ? new LineStyle.Info(styleId) : undefined;
      builder.appendGeometryParamsChange(params);
      builder.appendGeometry(LineSegment3d.create(pointS, pointE));
      pointS.y += 0.5; pointE.y += 0.5;
    });

    const elementProps = createPhysicalElementProps(seedElement, undefined, builder.geometryStream);
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    // Extract and test value returned...
    const value = imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    const itNextCheck = new GeometryStreamIterator(value.geom!, value.category);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isTrue(itNextCheck.next().done);

    const lsStylesUsed: Id64String[] = [];
    const it = new GeometryStreamIterator(value.geom!, value.category);
    for (const entry of it) {
      assert.equal(entry.primitive.type, "geometryQuery");
      lsStylesUsed.push(entry.geomParams.styleInfo ? entry.geomParams.styleInfo.styleId : Id64.invalid);
    }

    // Make sure we extracted same style information after round trip...
    assert.isTrue(lsStyles.length === lsStylesUsed.length);
    for (let iStyle = 0; iStyle < lsStyles.length; ++iStyle) {
      assert.isTrue(lsStylesUsed[iStyle] === (lsStyles[iStyle]));
    }
  });

  it("create GeometricElement3d using continuous style", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    // create special "internal default" continuous style for drawing curves using width overrides
    const styleId = LineStyleDefinition.Utils.getOrCreateContinuousStyle(imodel, IModel.dictionaryId);
    assert.isTrue(Id64.isValidId64(styleId));

    // make sure we found existing style and didn't create a new one
    const styleIdExists = LineStyleDefinition.Utils.getOrCreateContinuousStyle(imodel, IModel.dictionaryId);
    assert.isTrue(Id64.isValidId64(styleIdExists) && styleIdExists === (styleId));

    // create continuous style with pre-defined constant width
    const styleIdWidth = LineStyleDefinition.Utils.getOrCreateContinuousStyle(imodel, IModel.dictionaryId, 0.05);
    assert.isTrue(Id64.isValidId64(styleIdWidth));

    // make sure we found existing style and didn't create a new one
    const styleIdWidthExists = LineStyleDefinition.Utils.getOrCreateContinuousStyle(imodel, IModel.dictionaryId, 0.05);
    assert.isTrue(Id64.isValidId64(styleIdWidthExists) && styleIdWidthExists === (styleIdWidth));

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    const styles: Id64String[] = [styleId, styleId, styleIdWidth, styleIdWidth];
    const widths: number[] = [0.0, 0.025, 0.0, 0.075];

    // add line using 0 width continuous style
    params.styleInfo = new LineStyle.Info(styles[0]);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometry(LineSegment3d.create(Point3d.create(0, 0, 0), Point3d.create(0, 5, 0)));

    // add line with width override, undefined endWidth = startWidth, needed solely for taper
    params.styleInfo.styleMod = new LineStyle.Modifier({ startWidth: widths[1], physicalWidth: true });
    builder.appendGeometryParamsChange(params);
    builder.appendGeometry(LineSegment3d.create(Point3d.create(0.5, 0, 0), Point3d.create(0.5, 5, 0)));

    // add line using pre-defined width continuous style
    params.styleInfo = new LineStyle.Info(styles[2]);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometry(LineSegment3d.create(Point3d.create(1.0, 0, 0), Point3d.create(1.0, 5, 0)));

    // add line with width override, undefined endWidth = startWidth, needed solely for taper
    params.styleInfo.styleMod = new LineStyle.Modifier({ startWidth: widths[3], physicalWidth: true });
    builder.appendGeometryParamsChange(params);
    builder.appendGeometry(LineSegment3d.create(Point3d.create(1.5, 0, 0), Point3d.create(1.5, 5, 0)));

    const elementProps = createPhysicalElementProps(seedElement, undefined, builder.geometryStream);
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    // Extract and test value returned...
    const value = imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    const stylesUsed: Id64String[] = [];
    const widthsUsed: number[] = [];
    const it = new GeometryStreamIterator(value.geom!, value.category);
    for (const entry of it) {
      assert.equal(entry.primitive.type, "geometryQuery");
      assert.isDefined(entry.geomParams.styleInfo);
      stylesUsed.push(entry.geomParams.styleInfo!.styleId);
      widthsUsed.push(entry.geomParams.styleInfo!.styleMod !== undefined ? entry.geomParams.styleInfo!.styleMod.startWidth! : 0.0);
    }

    // Make sure we extracted same style information after round trip...
    assert.isTrue(styles.length === stylesUsed.length);
    for (let iStyle = 0; iStyle < styles.length; ++iStyle) {
      assert.isTrue(stylesUsed[iStyle] === (styles[iStyle]));
      assert.isTrue(Geometry.isSameCoordinate(widthsUsed[iStyle], widths[iStyle]));
    }
  });

  it("create GeometricElement3d using arrow head style w/o using stroke pattern", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const partBuilder = new GeometryStreamBuilder();
    const partParams = new GeometryParams(Id64.invalid); // category won't be used

    partParams.fillDisplay = FillDisplay.Always;
    partBuilder.appendGeometryParamsChange(partParams);
    partBuilder.appendGeometry(Loop.create(LineString3d.create(Point3d.create(0.1, 0, 0), Point3d.create(0, -0.05, 0), Point3d.create(0, 0.05, 0), Point3d.create(0.1, 0, 0))));

    const partProps = createGeometryPartProps(partBuilder.geometryStream);
    const partId = imodel.elements.insertElement(partProps);
    assert.isTrue(Id64.isValidId64(partId));

    const pointSymbolData = LineStyleDefinition.Utils.createPointSymbolComponent(imodel, { geomPartId: partId }); // base and size will be set automatically...
    assert.isTrue(undefined !== pointSymbolData);

    // Use internal default instead of creating a stroke component for a solid line
    const strokePointData = LineStyleDefinition.Utils.createStrokePointComponent(imodel, { descr: "TestArrowHead", lcId: 0, lcType: LineStyleDefinition.ComponentType.Internal, symbols: [{ symId: pointSymbolData!.compId, strokeNum: -1, mod1: LineStyleDefinition.SymbolOptions.CurveEnd }] });
    assert.isTrue(undefined !== strokePointData);

    const compoundData = LineStyleDefinition.Utils.createCompoundComponent(imodel, { comps: [{ id: strokePointData.compId, type: strokePointData.compType }, { id: 0, type: LineStyleDefinition.ComponentType.Internal }] });
    assert.isTrue(undefined !== compoundData);

    const styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.dictionaryId, "TestArrowStyle", compoundData);
    assert.isTrue(Id64.isValidId64(styleId));

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    params.styleInfo = new LineStyle.Info(styleId);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometry(LineSegment3d.create(Point3d.createZero(), Point3d.create(-1, -1, 0)));

    const elementProps = createPhysicalElementProps(seedElement, undefined, builder.geometryStream);
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    const usageInfo = imodel.nativeDb.queryDefinitionElementUsage([partId, styleId])!;
    assert.isTrue(usageInfo.geometryPartIds!.includes(partId));
    assert.isTrue(usageInfo.lineStyleIds!.includes(styleId));
    assert.isTrue(usageInfo.usedIds!.includes(partId));
    assert.isTrue(usageInfo.usedIds!.includes(styleId));
  });

  it("create GeometricElement3d using compound style with dash widths and symbol", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const lsStrokes: LineStyleDefinition.Strokes = [];
    lsStrokes.push({ length: 0.25, orgWidth: 0.0, endWidth: 0.025, strokeMode: LineStyleDefinition.StrokeMode.Dash, widthMode: LineStyleDefinition.StrokeWidth.Left });
    lsStrokes.push({ length: 0.1 });
    lsStrokes.push({ length: 0.1, orgWidth: 0.025, endWidth: 0.025, strokeMode: LineStyleDefinition.StrokeMode.Dash, widthMode: LineStyleDefinition.StrokeWidth.Full });
    lsStrokes.push({ length: 0.1 });
    lsStrokes.push({ length: 0.25, orgWidth: 0.025, endWidth: 0.0, strokeMode: LineStyleDefinition.StrokeMode.Dash, widthMode: LineStyleDefinition.StrokeWidth.Right });
    lsStrokes.push({ length: 0.1 });

    const strokePatternData = LineStyleDefinition.Utils.createStrokePatternComponent(imodel, { descr: "TestDashDotDashLineCode", strokes: lsStrokes });
    assert.isTrue(undefined !== strokePatternData);

    const partBuilder = new GeometryStreamBuilder();
    partBuilder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 0.05));

    const partProps = createGeometryPartProps(partBuilder.geometryStream);
    const partId = imodel.elements.insertElement(partProps);
    assert.isTrue(Id64.isValidId64(partId));

    const pointSymbolData = LineStyleDefinition.Utils.createPointSymbolComponent(imodel, { geomPartId: partId }); // base and size will be set automatically...
    assert.isTrue(undefined !== pointSymbolData);

    const lsSymbols: LineStyleDefinition.Symbols = [];
    lsSymbols.push({ symId: pointSymbolData!.compId, strokeNum: 1, mod1: LineStyleDefinition.SymbolOptions.Center });
    lsSymbols.push({ symId: pointSymbolData!.compId, strokeNum: 3, mod1: LineStyleDefinition.SymbolOptions.Center });

    const strokePointData = LineStyleDefinition.Utils.createStrokePointComponent(imodel, { descr: "TestGapSymbolsLinePoint", lcId: strokePatternData.compId, symbols: lsSymbols });
    assert.isTrue(undefined !== strokePointData);

    const lsComponents: LineStyleDefinition.Components = [];
    lsComponents.push({ id: strokePointData.compId, type: strokePointData.compType });
    lsComponents.push({ id: strokePatternData.compId, type: strokePatternData.compType });

    const compoundData = LineStyleDefinition.Utils.createCompoundComponent(imodel, { comps: lsComponents });
    assert.isTrue(undefined !== compoundData);

    const styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.dictionaryId, "TestDashCircleDotCircleDashStyle", compoundData);
    assert.isTrue(Id64.isValidId64(styleId));

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    params.styleInfo = new LineStyle.Info(styleId);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometry(LineSegment3d.create(Point3d.createZero(), Point3d.create(5, 5, 0)));

    const elementProps = createPhysicalElementProps(seedElement, undefined, builder.geometryStream);
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    const usageInfo = imodel.nativeDb.queryDefinitionElementUsage([partId, styleId, seedElement.category])!;
    assert.isTrue(usageInfo.geometryPartIds!.includes(partId));
    assert.isTrue(usageInfo.lineStyleIds!.includes(styleId));
    assert.isTrue(usageInfo.spatialCategoryIds!.includes(seedElement.category));
    assert.isTrue(usageInfo.usedIds!.includes(partId));
    assert.isTrue(usageInfo.usedIds!.includes(styleId));
    assert.isTrue(usageInfo.usedIds!.includes(seedElement.category));
  });

  it("create GeometricElement3d using shapes with fill/gradient", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    builder.appendGeometryRanges(); // Test inclusion of local ranges...

    const xOffset = Transform.createTranslation(Point3d.create(1.5));
    const shape = Loop.create(LineString3d.create(Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 1, 0), Point3d.create(0, 0, 0)));

    // No fill...
    params.lineColor = ColorDef.green;
    params.weight = 5;
    builder.appendGeometryParamsChange(params);
    builder.appendGeometry(shape);

    // Opaque fill by view...
    params.fillDisplay = FillDisplay.ByView;
    params.fillColor = params.lineColor;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometry(shape);

    // Outline fill by view...
    params.fillColor = ColorDef.red;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometry(shape);

    // Outline transparency fill always...
    params.fillDisplay = FillDisplay.Always;
    params.fillTransparency = 0.75;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometry(shape);

    // Opaque background fill always...
    params.backgroundFill = BackgroundFill.Solid;
    params.fillTransparency = 0.0;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometry(shape);

    // Outline background fill always...
    params.backgroundFill = BackgroundFill.Outline;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometry(shape);

    // Opaque gradient by view...
    params.fillDisplay = FillDisplay.ByView;
    params.gradient = new Gradient.Symb();
    params.gradient.mode = Gradient.Mode.Linear;
    params.gradient.flags = Gradient.Flags.Invert;
    params.gradient.keys.push(new Gradient.KeyColor({ value: 0.0, color: ColorDef.blue.toJSON() }));
    params.gradient.keys.push(new Gradient.KeyColor({ value: 0.5, color: ColorDef.red.toJSON() }));
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometry(shape);

    // Outline gradient by view...Display issue, changes to gradient being ignored???
    params.gradient.flags = Gradient.Flags.Outline;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometry(shape);

    const elementProps = createPhysicalElementProps(seedElement, undefined, builder.geometryStream);
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    // Extract and test value returned...
    const value = imodel.elements.getElementProps<GeometricElementProps>({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    let iShape = 0;
    const itLocal = new GeometryStreamIterator(value.geom!, value.category);
    for (const entry of itLocal) {
      assert.equal(entry.primitive.type, "geometryQuery");
      switch (iShape++) {
        case 0:
          assert.isTrue(undefined === entry.geomParams.fillDisplay || FillDisplay.Never === entry.geomParams.fillDisplay);
          break;
        case 1:
          assert.isTrue(FillDisplay.ByView === entry.geomParams.fillDisplay);
          assert.isTrue(entry.geomParams.lineColor!.equals(entry.geomParams.fillColor!));
          break;
        case 2:
          assert.isTrue(FillDisplay.ByView === entry.geomParams.fillDisplay);
          assert.isFalse(entry.geomParams.lineColor!.equals(entry.geomParams.fillColor!));
          break;
        case 3:
          assert.isTrue(FillDisplay.Always === entry.geomParams.fillDisplay);
          assert.isFalse(0.0 === entry.geomParams.fillTransparency);
          break;
        case 4:
          assert.isTrue(FillDisplay.Always === entry.geomParams.fillDisplay);
          assert.isTrue(BackgroundFill.Solid === entry.geomParams.backgroundFill);
          break;
        case 5:
          assert.isTrue(FillDisplay.Always === entry.geomParams.fillDisplay);
          assert.isTrue(BackgroundFill.Outline === entry.geomParams.backgroundFill);
          break;
        case 6:
          assert.isTrue(FillDisplay.ByView === entry.geomParams.fillDisplay);
          assert.isDefined(entry.geomParams.gradient);
          assert.isTrue(0 === (Gradient.Flags.Outline & entry.geomParams.gradient!.flags));
          break;
        case 7:
          assert.isTrue(FillDisplay.ByView === entry.geomParams.fillDisplay);
          assert.isDefined(entry.geomParams.gradient);
          assert.isFalse(0 === (Gradient.Flags.Outline & entry.geomParams.gradient!.flags));
          break;
      }
    }
    assert.isTrue(8 === iShape);
  });

  it("create GeometricElement3d using shapes with patterns", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    builder.appendGeometryRanges(); // Test inclusion of local ranges...

    const xOffset = Transform.createTranslation(Point3d.create(1.5));
    const shape = Loop.create(LineString3d.create(Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 1, 0), Point3d.create(0, 0, 0)));

    // Hatch w/o overrides
    params.lineColor = ColorDef.create(ColorByName.yellow);
    params.weight = 5;
    params.pattern = new AreaPattern.Params();
    params.pattern.space1 = 0.05;
    params.pattern.angle1 = Angle.createDegrees(45.0);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometry(shape);

    // Cross hatch with color/weight override
    params.pattern.space2 = 0.1;
    params.pattern.angle2 = Angle.createDegrees(-30.0);
    params.pattern.color = ColorDef.red;
    params.pattern.weight = 0;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometry(shape);

    const partBuilder = new GeometryStreamBuilder();
    partBuilder.appendGeometry(Arc3d.createXY(Point3d.createZero(), 0.05));

    const partProps = createGeometryPartProps(partBuilder.geometryStream);
    const partId = imodel.elements.insertElement(partProps);
    assert.isTrue(Id64.isValidId64(partId));

    // Area pattern w/o overrides
    params.pattern = new AreaPattern.Params();
    params.pattern.symbolId = partId;
    params.pattern.space1 = params.pattern.space2 = 0.05;
    params.pattern.angle1 = Angle.createDegrees(45.0);
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometry(shape);

    // Area pattern with color/weight overrides, snappable geometry, and invisible boundary
    params.pattern.origin = Point3d.create(0.05, 0.05, 0.0);
    params.pattern.space1 = params.pattern.space2 = params.pattern.angle1 = undefined;
    params.pattern.color = ColorDef.red;
    params.pattern.weight = 1;
    params.pattern.snappable = params.pattern.invisibleBoundary = true;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometry(shape);

    // Hatch definition w/o overrides (zig-zag)
    const defLines: AreaPattern.HatchDefLine[] = [
      { offset: Point2d.create(0.1, 0.1), dashes: [0.1, -0.1] },
      { angle: Angle.createDegrees(90.0), through: Point2d.create(0.1, 0.0), offset: Point2d.create(0.1, 0.1), dashes: [0.1, -0.1] },
    ];

    params.pattern = new AreaPattern.Params();
    params.pattern.defLines = defLines;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometry(shape);

    // Hatch definition with color/weight overrides
    params.pattern.color = ColorDef.red;
    params.pattern.weight = 1;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometry(shape);

    const elementProps = createPhysicalElementProps(seedElement, undefined, builder.geometryStream);
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    // Extract and test value returned...
    const value = imodel.elements.getElementProps<GeometricElementProps>({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    let iShape = 0;
    const itLocal = new GeometryStreamIterator(value.geom!, value.category);
    for (const entry of itLocal) {
      assert.equal(entry.primitive.type, "geometryQuery");
      assert.isDefined(entry.geomParams.pattern);
      switch (iShape++) {
        case 0:
          assert.isTrue(undefined !== entry.geomParams.pattern!.space1 && undefined !== entry.geomParams.pattern!.angle1 && undefined === entry.geomParams.pattern!.space2 && undefined === entry.geomParams.pattern!.angle2);
          break;
        case 1:
          assert.isTrue(undefined !== entry.geomParams.pattern!.space1 && undefined !== entry.geomParams.pattern!.angle1 && undefined !== entry.geomParams.pattern!.space2 && undefined !== entry.geomParams.pattern!.angle2);
          break;
        case 2:
          assert.isTrue(undefined !== entry.geomParams.pattern!.symbolId && undefined === entry.geomParams.pattern!.color);
          break;
        case 3:
          assert.isTrue(undefined !== entry.geomParams.pattern!.symbolId && undefined !== entry.geomParams.pattern!.color);
          break;
        case 4:
          assert.isTrue(undefined !== entry.geomParams.pattern!.defLines && undefined === entry.geomParams.pattern!.color);
          break;
        case 5:
          assert.isTrue(undefined !== entry.geomParams.pattern!.defLines && undefined !== entry.geomParams.pattern!.color);
          break;
      }
    }
    assert.isTrue(6 === iShape);

    const usageInfo = imodel.nativeDb.queryDefinitionElementUsage([partId])!;
    assert.isTrue(usageInfo.geometryPartIds!.includes(partId));
    assert.isTrue(usageInfo.usedIds!.includes(partId));
  });

  it("create GeometricElement3d from world coordinate text using a newly embedded font", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    assert.isTrue(0 === imodel.fontMap.fonts.size); // file currently contains no fonts...

    let fontProps: FontProps = { id: 0, type: FontType.TrueType, name: "Arial" };
    try {
      fontProps = imodel.embedFont(fontProps); // throws Error
      assert.isTrue(fontProps.id !== 0);
    } catch (error: any) {
      if ("win32" === Platform.platformName)
        assert.fail("Font embed failed");
      return; // failure expected if not windows, skip remainder of test...
    }

    assert.isTrue(0 !== imodel.fontMap.fonts.size);
    const foundFont = imodel.fontMap.getFont("Arial");
    assert.isTrue(foundFont && foundFont.id === fontProps.id);

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(45, 0, 0);
    const builder = new GeometryStreamBuilder();

    builder.setLocalToWorld3d(testOrigin, testAngles); // Establish world to local transform...

    const textProps: TextStringProps = {
      text: "ABC",
      font: fontProps.id,
      height: 2,
      bold: true,
      origin: testOrigin,
      rotation: testAngles,
    };

    const textString = new TextString(textProps);
    const status = builder.appendTextString(textString);
    assert.isTrue(status);

    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles }, builder.geometryStream);
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    // Extract and test value returned, text transform should now be identity as it is accounted for by element's placement...
    const value = imodel.elements.getElementProps<GeometricElementProps>({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    let gotHeader = false;
    for (const entry of value.geom!) {
      expect(undefined === entry.header).to.equal(gotHeader);
      if (undefined !== entry.header) {
        gotHeader = true;
      } else {
        assert.isDefined(entry.textString);
        const origin = Point3d.fromJSON(entry.textString!.origin);
        const rotation = YawPitchRollAngles.fromJSON(entry.textString!.rotation);
        assert.isTrue(origin.isAlmostZero);
        assert.isTrue(rotation.isIdentity());
      }
    }

    expect(gotHeader).to.be.true;

    const itLocal = new GeometryStreamIterator(value.geom!, value.category);
    for (const entry of itLocal) {
      assertTrue(entry.primitive.type === "textString");
      assert.isTrue(entry.primitive.textString.origin.isAlmostZero);
      assert.isTrue(entry.primitive.textString.rotation.isIdentity());
    }

    const itWorld = GeometryStreamIterator.fromGeometricElement3d(value as GeometricElement3dProps);
    for (const entry of itWorld) {
      assertTrue(entry.primitive.type === "textString");
      assert.isTrue(entry.primitive.textString.origin.isAlmostEqual(testOrigin));
      assert.isTrue(entry.primitive.textString.rotation.isAlmostEqual(testAngles));
    }
  });

  it("create GeometryPart from arcs", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];

    const partBuilder = new GeometryStreamBuilder();

    for (const geom of geomArray) {
      partBuilder.appendGeometry(geom);
    }

    const partProps = createGeometryPartProps(partBuilder.geometryStream);
    const testPart = imodel.elements.createElement(partProps);
    const partId = imodel.elements.insertElement(testPart);
    imodel.saveChanges();

    // Extract and test value returned
    const value = imodel.elements.getElementProps<GeometricElementProps>({ id: partId, wantGeometry: true });
    assert.isDefined(value.geom);

    const geomArrayOut: Arc3d[] = [];
    const itLocal = GeometryStreamIterator.fromGeometryPart(value as GeometryPartProps);
    for (const entry of itLocal) {
      assertTrue(entry.primitive.type === "geometryQuery");
      assertTrue(entry.primitive.geometry instanceof Arc3d);
      geomArrayOut.push(entry.primitive.geometry);
    }

    assert.isTrue(geomArrayOut.length === geomArray.length);
    for (let i = 0; i < geomArrayOut.length; i++) {
      assert.isTrue(geomArrayOut[i].isAlmostEqual(geomArray[i]));
    }

    const usageInfo = imodel.nativeDb.queryDefinitionElementUsage([partId])!;
    assert.isTrue(usageInfo.geometryPartIds!.includes(partId));
    assert.isUndefined(usageInfo.usedIds, "GeometryPart should not to be used by any GeometricElement");
  });

  it("create GeometricElement3d from arcs", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];

    const builder = new GeometryStreamBuilder();

    for (const geom of geomArray) {
      builder.appendGeometry(geom);
    }

    const elementProps = createPhysicalElementProps(seedElement, undefined, builder.geometryStream);
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    // Extract and test value returned
    const value = imodel.elements.getElementProps<GeometricElementProps>({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    const geomArrayOut: Arc3d[] = [];
    const itLocal = new GeometryStreamIterator(value.geom!, value.category);
    for (const entry of itLocal) {
      assertTrue(entry.primitive.type === "geometryQuery");
      assertTrue(entry.primitive.geometry instanceof Arc3d);
      geomArrayOut.push(entry.primitive.geometry);
    }

    assert.isTrue(geomArrayOut.length === geomArray.length);
    for (let i = 0; i < geomArrayOut.length; i++) {
      assert.isTrue(geomArrayOut[i].isAlmostEqual(geomArray[i]));
    }
  });

  it("create GeometricElement3d partToWorld test", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const arc = Arc3d.createXY(Point3d.create(0, 0), 1);
    const partBuilder = new GeometryStreamBuilder();

    partBuilder.appendGeometry(arc);

    const partProps = createGeometryPartProps(partBuilder.geometryStream);
    const testPart = imodel.elements.createElement(partProps);
    const partId = imodel.elements.insertElement(testPart);
    imodel.saveChanges();

    const builder = new GeometryStreamBuilder();
    const shapePts: Point3d[] = [Point3d.create(1, 1, 0), Point3d.create(2, 1, 0), Point3d.create(2, 2, 0), Point3d.create(1, 2, 0)];
    const testOrigin = Point3d.create(0.5, 0.5, 0);
    const testAngles = YawPitchRollAngles.createDegrees(45, 0, 0);

    builder.setLocalToWorld3d(testOrigin, testAngles);
    builder.appendGeometry(Loop.create(LineString3d.create(shapePts)));
    shapePts.forEach((pt) => { builder.appendGeometryPart3d(partId, pt, undefined, 0.25); }); // Position part (arc center) at each vertex...

    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles }, builder.geometryStream);
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    // Extract and test value returned
    const valueElem = imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true });
    assert.isDefined(valueElem.geom);

    const outPts: Point3d[] = [];
    const itWorld = GeometryStreamIterator.fromGeometricElement3d(valueElem);
    for (const entry of itWorld) {
      if ("partReference" !== entry.primitive.type)
        continue;
      assertTrue(partId === entry.primitive.part.id);
      const valuePart = imodel.elements.getElementProps<GeometryPartProps>({ id: entry.primitive.part.id, wantGeometry: true });
      assert.isDefined(valuePart.geom);

      const itWorldPart = GeometryStreamIterator.fromGeometryPart(valuePart, undefined, itWorld.partToWorld());
      for (const partEntry of itWorldPart) {
        assertTrue(partEntry.primitive.type === "geometryQuery");
        assertTrue(partEntry.primitive.geometry instanceof Arc3d);
        outPts.push(partEntry.primitive.geometry.center);
      }
    }

    assert.isTrue(outPts.length === shapePts.length);
    for (let i = 0; i < outPts.length; i++) {
      assert.isTrue(outPts[i].isAlmostEqual(shapePts[i]));
    }
  });

  it("create GeometricElement3d wire format appearance check", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);
    const shape = Loop.create(LineString3d.create(Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 1, 0), Point3d.create(0, 0, 0)));

    params.fillDisplay = FillDisplay.ByView;
    builder.appendGeometryParamsChange(params);
    builder.appendGeometry(shape);

    const elementProps = createPhysicalElementProps(seedElement, undefined, builder.geometryStream);
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    // Extract and test value returned...
    const value = imodel.elements.getElementProps<GeometricElementProps>({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    const itLocal = new GeometryStreamIterator(value.geom!, value.category);
    for (const entry of itLocal) {
      assert.equal(entry.primitive.type, "geometryQuery");
      assert.isTrue(FillDisplay.ByView === entry.geomParams.fillDisplay);
    }

    const geometryStream: GeometryStreamProps = [];

    geometryStream.push({ header: { flags: 0 } });
    geometryStream.push({ appearance: {} }); // Native ToJson should add appearance entry with no defined values for this case...
    geometryStream.push({ fill: { display: FillDisplay.ByView } });
    geometryStream.push({ loop: [{ lineString: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 0]] }] });

    const fromBuilder = JSON.stringify(builder.geometryStream);
    const fromElProps = JSON.stringify(value.geom);
    const fromScratch = JSON.stringify(geometryStream);

    assert.isTrue(undefined !== builder.geometryStream[0].appearance && builder.geometryStream[0].appearance.subCategory === IModel.getDefaultSubCategoryId(value.category)); // Ensure default sub-category is specified...
    assert.isTrue(fromElProps !== fromBuilder); // Should not match, default sub-category should not be persisted...
    assert.isTrue(fromElProps === fromScratch);
  });

  it("create GeometricElement3d from world coordinate brep data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(45, 0, 0);
    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    builder.setLocalToWorld3d(testOrigin, testAngles); // Establish world to local transform...

    params.lineColor = ColorDef.red;
    params.weight = 2;
    builder.appendGeometryParamsChange(params);

    const brepProps = createBRepDataProps(testOrigin, testAngles);
    builder.appendBRepData(brepProps);

    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles }, builder.geometryStream);
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    // Extract and test value returned
    const value = imodel.elements.getElementProps<GeometricElementProps>({ id: newId, wantGeometry: true, wantBRepData: true });
    assert.isDefined(value.geom);

    const itLocal = new GeometryStreamIterator(value.geom!, value.category);
    for (const entry of itLocal) {
      assert.equal(entry.primitive.type, "brep");
    }

    const itWorld = GeometryStreamIterator.fromGeometricElement3d(value as GeometricElement3dProps);
    for (const entry of itWorld) {
      assert.equal(entry.primitive.type, "brep");
    }
  });

  it("create GeometricElement3d with local coordinate indexed polyface json data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const xOffset = Transform.createTranslation(Point3d.create(2.5));
    const builder = new GeometryStreamBuilder();

    // NOTE: It's a good idea to request sub-graphic ranges when adding multiple "large" polyfaces to a geometry stream...
    builder.appendGeometryRanges();

    const polyface = createIndexedPolyface(5.0);
    builder.appendGeometry(polyface);

    polyface.tryTransformInPlace(xOffset); // translate in x...
    builder.appendGeometry(polyface);

    polyface.tryTransformInPlace(xOffset); // translate in x again...
    builder.appendGeometry(polyface);

    // NOTE: For time comparison with ElementGeometry: create GeometricElement3d with local coordinate indexed polyface flatbuffer data
    let timer = new Timer("createGeometricElem");
    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const newId = createGeometricElem(builder.geometryStream, { origin: testOrigin, angles: testAngles }, imodel, seedElement);
    timer.end();
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    timer = new Timer("queryGeometricElem");
    const value = imodel.elements.getElementProps<GeometricElementProps>({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    const itLocal = new GeometryStreamIterator(value.geom!, value.category);
    for (const entry of itLocal) {
      assert.isTrue(entry.geomParams.categoryId === seedElement.category); // Current appearance information (default sub-category appearance in this case)...
      assert.isTrue(undefined !== entry.localRange && !entry.localRange.isNull); // Make sure sub-graphic ranges were added...

      assertTrue(entry.primitive.type === "geometryQuery");
      assertTrue(entry.primitive.geometry instanceof IndexedPolyface);

      const polyOut = entry.primitive.geometry;
      assert.isTrue(polyOut.pointCount === polyface.pointCount);
      assert.isTrue(polyOut.paramCount === polyface.paramCount);
      assert.isTrue(polyOut.normalCount === polyface.normalCount);
    }
    timer.end();
  });

  it("should preserve header with flags", () => {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Arc3d.createXY(Point3d.create(0, 0), 5));

    const roundTrip = () => {
      const iter = new GeometryStreamIterator(builder.geometryStream);
      expect((iter.flags === GeometryStreamFlags.ViewIndependent)).to.equal(builder.isViewIndependent);

      const partProps = createGeometryPartProps(builder.geometryStream);
      const part = imodel.elements.createElement(partProps);
      const partId = imodel.elements.insertElement(part);
      imodel.saveChanges();

      const json = imodel.elements.getElementProps<GeometryPartProps>({ id: partId, wantGeometry: true });
      expect(json.geom).not.to.be.undefined;
      expect(json.geom!.length).to.equal(2);
      expect(json.geom![0].header).not.to.be.undefined;
      const flags = json.geom![0].header!.flags;
      expect(flags).to.equal(builder.isViewIndependent ? GeometryStreamFlags.ViewIndependent : GeometryStreamFlags.None);

      if (undefined !== builder.getHeader())
        expect(JSON.stringify(builder.geometryStream[0])).to.equal(JSON.stringify(json.geom![0]));
    };

    expect(builder.getHeader()).to.be.undefined;
    expect(builder.isViewIndependent).to.be.false;
    roundTrip();

    builder.isViewIndependent = false;
    expect(builder.getHeader()).to.be.undefined;
    expect(builder.isViewIndependent).to.be.false;
    roundTrip();

    builder.isViewIndependent = true;
    expect(builder.getHeader()).not.to.be.undefined;
    expect(builder.isViewIndependent).to.be.true;
    roundTrip();

    builder.isViewIndependent = false;
    expect(builder.getHeader()).not.to.be.undefined;
    expect(builder.isViewIndependent).to.be.false;
  });
});

describe("ElementGeometry", () => {
  let imodel: SnapshotDb;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("GeometryStream", "GeometryStreamTest.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => {
    imodel.close();
  });

  it("Exercise using builder/iterator in world coordinates with flatbuffer data", async () => {
    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);

    const pts: Point3d[] = [];
    pts.push(Point3d.create(5, 10, 0));
    pts.push(Point3d.create(10, 10, 0));
    pts.push(Point3d.create(10, 15, 0));
    pts.push(Point3d.create(5, 15, 0));
    pts.push(pts[0].clone());

    const builder = new ElementGeometry.Builder();
    const primitive = LineString3d.create(pts);

    builder.setLocalToWorld3d(testOrigin, testAngles); // Establish world to local transform for append...
    const status = builder.appendGeometryQuery(primitive);
    assert.isTrue(status);

    const it = new ElementGeometry.Iterator({ entryArray: builder.entries }, undefined, builder.localToWorld);
    it.requestWorldCoordinates(); // Apply local to world to entries...

    for (const entry of it) {
      const geom = entry.toGeometryQuery();
      assert.exists(geom);
      assertTrue(geom instanceof LineString3d);
      assert.isTrue(Point3dArray.isAlmostEqual(pts, geom.points));
    }
  });

  it("request geometry stream flatbuffer data from existing element", async () => {
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const expected: ExpectedElementGeometryEntry[] = [{ opcode: ElementGeometryOpcode.SolidPrimitive, geometryCategory: "solid", geometrySubCategory: "sphere" }];
    assert(DbResult.BE_SQLITE_OK === doElementGeometryValidate(imodel, "0x1d", expected, false));
  });

  it("create GeometricElement3d from world coordinate point and arc primitive flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const pts: Point3d[] = [];
    pts.push(Point3d.create(5, 10, 0));
    pts.push(Point3d.create(10, 10, 0));
    pts.push(Point3d.create(10, 15, 0));
    pts.push(Point3d.create(5, 15, 0));
    pts.push(pts[0].clone());

    const expected: ExpectedElementGeometryEntry[] = [];
    const newEntries: ElementGeometryDataEntry[] = [];

    const entryLN = ElementGeometry.fromGeometryQuery(LineSegment3d.create(pts[0], pts[1]));
    assert.exists(entryLN);
    newEntries.push(entryLN!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curvePrimitive", geometrySubCategory: "lineString" });

    const entryLS = ElementGeometry.fromGeometryQuery(LineString3d.create(pts));
    assert.exists(entryLS);
    newEntries.push(entryLS!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curvePrimitive", geometrySubCategory: "lineString" });

    const entrySH = ElementGeometry.fromGeometryQuery(Loop.createPolygon(pts));
    assert.exists(entrySH);
    newEntries.push(entrySH!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    const entryPS = ElementGeometry.fromGeometryQuery(PointString3d.create(pts));
    assert.exists(entryPS);
    newEntries.push(entryPS!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "pointCollection" });

    const entryAR = ElementGeometry.fromGeometryQuery(Arc3d.createXY(pts[0], pts[0].distance(pts[1])));
    assert.exists(entryAR);
    newEntries.push(entryAR!);
    expected.push({ opcode: ElementGeometryOpcode.ArcPrimitive, geometryCategory: "curvePrimitive", geometrySubCategory: "arc" });

    const entryEL = ElementGeometry.fromGeometryQuery(Loop.create(Arc3d.createXY(pts[0], pts[0].distance(pts[1]))));
    assert.exists(entryEL);
    newEntries.push(entryEL!);
    expected.push({ opcode: ElementGeometryOpcode.ArcPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    assert(DbResult.BE_SQLITE_OK === doElementGeometryUpdate(imodel, newId, newEntries, true));
    assert(DbResult.BE_SQLITE_OK === doElementGeometryValidate(imodel, newId, expected, true, elementProps));
  });

  it("create GeometricElement3d with local coordinate indexed polyface flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const xOffset = Transform.createTranslation(Point3d.create(2.5));
    const builder = new ElementGeometry.Builder();

    // NOTE: It's a good idea to request sub-graphic ranges when adding multiple "large" polyfaces to a geometry stream...
    builder.appendGeometryRanges();

    const polyface = createIndexedPolyface(5.0);
    builder.appendGeometryQuery(polyface);

    polyface.tryTransformInPlace(xOffset); // translate in x...
    builder.appendGeometryQuery(polyface);

    polyface.tryTransformInPlace(xOffset); // translate in x again...
    builder.appendGeometryQuery(polyface);

    // NOTE: For time comparison with GeometryStream: create GeometricElement3d with local coordinate indexed polyface json data
    let timer = new Timer("elementNoGeometryInsert");
    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    timer.end();

    timer = new Timer("elementGeometryUpdate");
    let status = imodel.elementGeometryUpdate({ elementId: newId, entryArray: builder.entries, isWorld: false });
    timer.end();
    assert.isTrue(DbResult.BE_SQLITE_OK === status);
    imodel.saveChanges();

    const onGeometry: ElementGeometryFunction = (info: ElementGeometryInfo): void => {
      assert.isTrue(6 === info.entryArray.length); // 3 pairs of sub-range + polyface...
      const it = new ElementGeometry.Iterator(info);
      for (const entry of it) {
        assert.isTrue(entry.geomParams.categoryId === info.categoryId); // Current appearance information (default sub-category appearance in this case)...
        assert.isTrue(undefined !== entry.localRange && !entry.localRange.isNull); // Make sure sub-graphic ranges were added...

        const geom = entry.toGeometryQuery();
        assert.exists(geom);
        assert.isTrue(geom instanceof IndexedPolyface);

        const polyOut = geom as IndexedPolyface;
        assert.isTrue(polyOut.pointCount === polyface.pointCount);
        assert.isTrue(polyOut.paramCount === polyface.paramCount);
        assert.isTrue(polyOut.normalCount === polyface.normalCount);
      }
    };

    timer = new Timer("elementGeometryRequest");
    status = imodel.elementGeometryRequest({ onGeometry, elementId: newId });
    timer.end();
    assert.isTrue(DbResult.BE_SQLITE_OK === status);
  });

  it("create GeometricElement3d from local coordinate brep flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const expected: ExpectedElementGeometryEntry[] = [];
    const expectedFacet: ExpectedElementGeometryEntry[] = [];
    const expectedSkip: ExpectedElementGeometryEntry[] = [];
    const newEntries: ElementGeometryDataEntry[] = [];

    const brepProps = createBRepDataProps(testOrigin, testAngles);
    const entry = ElementGeometry.fromBRep(brepProps);
    assert.exists(entry);
    newEntries.push(entry!);
    expected.push({ opcode: ElementGeometryOpcode.BRep, originalEntry: entry });

    // Why 6 and not 4?
    expectedFacet.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expectedFacet.push({ opcode: ElementGeometryOpcode.Polyface, geometryCategory: "polyface" });
    expectedFacet.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expectedFacet.push({ opcode: ElementGeometryOpcode.Polyface, geometryCategory: "polyface" });
    expectedFacet.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expectedFacet.push({ opcode: ElementGeometryOpcode.Polyface, geometryCategory: "polyface" });

    assert(DbResult.BE_SQLITE_OK === doElementGeometryUpdate(imodel, newId, newEntries, false));
    assert(DbResult.BE_SQLITE_OK === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
    assert(DbResult.BE_SQLITE_OK === doElementGeometryValidate(imodel, newId, expectedFacet, false, undefined, 1));
    assert(DbResult.BE_SQLITE_OK === doElementGeometryValidate(imodel, newId, expectedSkip, false, undefined, 2));
  });

  it("apply world coordinate transform directly to brep flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const brepProps = createBRepDataProps();
    const entry = ElementGeometry.fromBRep(brepProps);
    assert.exists(entry);

    const entityTransform = Transform.createOriginAndMatrix(testOrigin, testAngles.toMatrix3d());
    const status = ElementGeometry.transformBRep(entry!, entityTransform);
    assert.isTrue(status);

    const worldBRep = ElementGeometry.toBRep(entry!);
    assert.exists(worldBRep);
    const worldTransform = Transform.fromJSON(worldBRep?.transform);
    assert.isTrue(worldTransform.isAlmostEqual(entityTransform));

    const newEntries: ElementGeometryDataEntry[] = [];
    newEntries.push(entry!);

    // Facet to make sure brep and face attachments are intact after transformBRep...
    const expectedFacet: ExpectedElementGeometryEntry[] = [];
    expectedFacet.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expectedFacet.push({ opcode: ElementGeometryOpcode.Polyface, geometryCategory: "polyface" });
    expectedFacet.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expectedFacet.push({ opcode: ElementGeometryOpcode.Polyface, geometryCategory: "polyface" });
    expectedFacet.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expectedFacet.push({ opcode: ElementGeometryOpcode.Polyface, geometryCategory: "polyface" });

    assert(DbResult.BE_SQLITE_OK === doElementGeometryUpdate(imodel, newId, newEntries, true));
    assert(DbResult.BE_SQLITE_OK === doElementGeometryValidate(imodel, newId, expectedFacet, false, undefined, 1));
  });

  it("create GeometricElement3d from local coordinate text string flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    assert.isTrue(0 === imodel.fontMap.fonts.size); // file currently contains no fonts...

    let fontProps: FontProps = { id: 0, type: FontType.TrueType, name: "Arial" };
    try {
      fontProps = imodel.embedFont(fontProps); // throws Error
      assert.isTrue(fontProps.id !== 0);
    } catch (error: any) {
      if ("win32" === Platform.platformName)
        assert.fail("Font embed failed");
      return; // failure expected if not windows, skip remainder of test...
    }

    assert.isTrue(0 !== imodel.fontMap.fonts.size);
    const foundFont = imodel.fontMap.getFont("Arial");
    assert.isTrue(foundFont && foundFont.id === fontProps.id);

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const expected: ExpectedElementGeometryEntry[] = [];
    const newEntries: ElementGeometryDataEntry[] = [];

    const textProps: TextStringProps = {
      text: "ABC",
      font: fontProps.id,
      height: 2,
      bold: true,
      origin: testOrigin,
      rotation: testAngles,
    };

    const entry = ElementGeometry.fromTextString(textProps);
    assert.exists(entry);
    newEntries.push(entry!);
    expected.push({ opcode: ElementGeometryOpcode.TextString, originalEntry: entry });

    assert(DbResult.BE_SQLITE_OK === doElementGeometryUpdate(imodel, newId, newEntries, false));
    assert(DbResult.BE_SQLITE_OK === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
  });

  it("create GeometricElement3d from local coordinate image flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const expected: ExpectedElementGeometryEntry[] = [];
    const newEntries: ElementGeometryDataEntry[] = [];

    const imageProps: ImageGraphicProps = {
      corners: [Point3d.create(), Point3d.create(1, 0), Point3d.create(1, 1), Point3d.create(0, 1)],
      textureId: "0x1",
      hasBorder: true,
    };

    const entry = ElementGeometry.fromImageGraphic(imageProps);
    assert.exists(entry);
    newEntries.push(entry!);
    expected.push({ opcode: ElementGeometryOpcode.Image, originalEntry: entry });

    assert(DbResult.BE_SQLITE_OK === doElementGeometryUpdate(imodel, newId, newEntries, false));
    assert(DbResult.BE_SQLITE_OK === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
  });

  it("create GeometricElement3d with sub-graphic ranges flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const expected: ExpectedElementGeometryEntry[] = [];
    const newEntries: ElementGeometryDataEntry[] = [];

    const entrySG = ElementGeometry.fromSubGraphicRange(Range3d.create()); // Computed on backend, just need opcode...
    assert.exists(entrySG);
    newEntries.push(entrySG!);
    expected.push({ opcode: ElementGeometryOpcode.SubGraphicRange });

    const pts: Point3d[] = [];
    pts.push(Point3d.create(0, 0, 0));
    pts.push(Point3d.create(5, 5, 0));
    pts.push(Point3d.create(-5, -5, 0));

    const entryL1 = ElementGeometry.fromGeometryQuery(LineSegment3d.create(pts[0], pts[1]));
    assert.exists(entryL1);
    newEntries.push(entryL1!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curvePrimitive", geometrySubCategory: "lineString" });

    expected.push({ opcode: ElementGeometryOpcode.SubGraphicRange }); // Added on backend...

    const entryL2 = ElementGeometry.fromGeometryQuery(LineSegment3d.create(pts[0], pts[2]));
    assert.exists(entryL2);
    newEntries.push(entryL2!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curvePrimitive", geometrySubCategory: "lineString" });

    assert(DbResult.BE_SQLITE_OK === doElementGeometryUpdate(imodel, newId, newEntries, false));
    assert(DbResult.BE_SQLITE_OK === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
  });

  it("create GeometricElement3d with part reference flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const partId = createPointPart(imodel); // TODO: Invalid to create a part w/o geometry...
    const expectedPart: ExpectedElementGeometryEntry[] = [];
    const newPartEntries: ElementGeometryDataEntry[] = [];

    const entryAR = ElementGeometry.fromGeometryQuery(Arc3d.createXY(Point3d.createZero(), 2.5));
    assert.exists(entryAR);
    newPartEntries.push(entryAR!);
    expectedPart.push({ opcode: ElementGeometryOpcode.ArcPrimitive, geometryCategory: "curvePrimitive", geometrySubCategory: "arc" });

    assert(DbResult.BE_SQLITE_OK === doElementGeometryUpdate(imodel, partId, newPartEntries, false));
    assert(DbResult.BE_SQLITE_OK === doElementGeometryValidate(imodel, partId, expectedPart, false));

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const expected: ExpectedElementGeometryEntry[] = [];
    const newEntries: ElementGeometryDataEntry[] = [];

    const entryPI = ElementGeometry.fromGeometryPart(partId);
    assert.exists(entryPI);
    newEntries.push(entryPI!);
    expected.push({ opcode: ElementGeometryOpcode.PartReference, originalEntry: entryPI });

    const entryPT = ElementGeometry.fromGeometryPart(partId, Transform.createTranslation(Point3d.create(5, 5, 0)));
    assert.exists(entryPT);
    newEntries.push(entryPT!);
    expected.push({ opcode: ElementGeometryOpcode.PartReference, originalEntry: entryPT });

    const entryPR = ElementGeometry.fromGeometryPart(partId, Transform.createOriginAndMatrix(testOrigin, testAngles.toMatrix3d()));
    assert.exists(entryPR);
    newEntries.push(entryPR!);
    expected.push({ opcode: ElementGeometryOpcode.PartReference, originalEntry: entryPR });

    const entryPS = ElementGeometry.fromGeometryPart(partId, Transform.createScaleAboutPoint(testOrigin, 2));
    assert.exists(entryPS);
    newEntries.push(entryPS!);
    expected.push({ opcode: ElementGeometryOpcode.PartReference, originalEntry: entryPS });

    assert(DbResult.BE_SQLITE_OK === doElementGeometryUpdate(imodel, newId, newEntries, false));
    assert(DbResult.BE_SQLITE_OK === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
  });

  it("create GeometricElement3d with appearance flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const pts: Point3d[] = [];
    pts.push(Point3d.create(5, 10, 0));
    pts.push(Point3d.create(10, 10, 0));
    pts.push(Point3d.create(10, 15, 0));
    pts.push(Point3d.create(5, 15, 0));
    pts.push(pts[0].clone());

    const entrySH = ElementGeometry.fromGeometryQuery(Loop.createPolygon(pts));
    assert.exists(entrySH);

    const expected: ExpectedElementGeometryEntry[] = [];
    const newEntries: ElementGeometryDataEntry[] = [];
    const geomParams = new GeometryParams(seedElement.category);

    // Shape with red outline...
    geomParams.lineColor = ColorDef.red;
    let added = ElementGeometry.appendGeometryParams(geomParams, newEntries);
    assert.isTrue(added);
    expected.push({ opcode: ElementGeometryOpcode.BasicSymbology, geomParams: geomParams.clone() });

    newEntries.push(entrySH!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    // Shape with gradient fill...
    geomParams.fillDisplay = FillDisplay.ByView;
    geomParams.gradient = new Gradient.Symb();
    geomParams.gradient.mode = Gradient.Mode.Linear;
    geomParams.gradient.flags = Gradient.Flags.Outline;
    geomParams.gradient.keys.push(new Gradient.KeyColor({ value: 0.0, color: ColorDef.blue.toJSON() }));
    geomParams.gradient.keys.push(new Gradient.KeyColor({ value: 0.5, color: ColorDef.red.toJSON() }));
    geomParams.gradient.angle = Angle.createDegrees(45);
    added = ElementGeometry.appendGeometryParams(geomParams, newEntries);
    assert.isTrue(added);
    expected.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expected.push({ opcode: ElementGeometryOpcode.Fill, geomParams: geomParams.clone() });

    newEntries.push(entrySH!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    // Shape with thematic gradient fill...
    geomParams.gradient.mode = Gradient.Mode.Thematic;
    geomParams.gradient.thematicSettings = ThematicGradientSettings.fromJSON({ mode: ThematicGradientMode.Stepped, stepCount: 5 });
    added = ElementGeometry.appendGeometryParams(geomParams, newEntries);
    assert.isTrue(added);
    expected.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expected.push({ opcode: ElementGeometryOpcode.Fill, geomParams: geomParams.clone() });

    newEntries.push(entrySH!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    // Shape with bg fill...
    geomParams.gradient = undefined;
    geomParams.backgroundFill = BackgroundFill.Outline;
    added = ElementGeometry.appendGeometryParams(geomParams, newEntries);
    assert.isTrue(added);
    expected.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expected.push({ opcode: ElementGeometryOpcode.Fill, geomParams: geomParams.clone() });

    newEntries.push(entrySH!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    // Shape with solid fill...
    geomParams.backgroundFill = undefined;
    geomParams.fillColor = ColorDef.blue;
    geomParams.fillTransparency = 0.75;
    added = ElementGeometry.appendGeometryParams(geomParams, newEntries);
    assert.isTrue(added);
    expected.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expected.push({ opcode: ElementGeometryOpcode.Fill, geomParams: geomParams.clone() });

    newEntries.push(entrySH!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    // Shape with solid fill and render material
    geomParams.materialId = "0x5";
    added = ElementGeometry.appendGeometryParams(geomParams, newEntries);
    assert.isTrue(added);
    expected.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expected.push({ opcode: ElementGeometryOpcode.Fill });
    expected.push({ opcode: ElementGeometryOpcode.Material, geomParams: geomParams.clone() });

    newEntries.push(entrySH!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    // Green construction line to test ignoring region specific appearance like fill...
    geomParams.materialId = undefined;
    geomParams.lineColor = ColorDef.green;
    geomParams.weight = 2;
    const modifiers = new LineStyle.Modifier({
      scale: 2, dashScale: 0.5, gapScale: 0.2,
      startWidth: 0.1, endWidth: 0.3,
      distPhase: 0.25, fractPhase: 0.1, centerPhase: true,
      segmentMode: false, physicalWidth: true,
      normal: Vector3d.unitZ().toJSON(),
      rotation: YawPitchRollAngles.createDegrees(45, 0, 0).toJSON(),
    });
    geomParams.styleInfo = new LineStyle.Info(Id64.invalid, modifiers);
    geomParams.elmTransparency = 0.5;
    geomParams.geometryClass = GeometryClass.Construction;
    added = ElementGeometry.appendGeometryParams(geomParams, newEntries);
    assert.isTrue(added);
    geomParams.fillDisplay = geomParams.fillColor = geomParams.fillTransparency = undefined; // Region specific appearance ignored for open elements...
    expected.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expected.push({ opcode: ElementGeometryOpcode.LineStyleModifiers, geomParams: geomParams.clone() });

    const entryLN = ElementGeometry.fromGeometryQuery(LineSegment3d.create(pts[0], pts[2]));
    assert.exists(entryLN);
    newEntries.push(entryLN!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curvePrimitive", geometrySubCategory: "lineString" });

    assert(DbResult.BE_SQLITE_OK === doElementGeometryUpdate(imodel, newId, newEntries, false));
    assert(DbResult.BE_SQLITE_OK === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
  });

  it("create GeometricElement3d with pattern flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const pts: Point3d[] = [];
    pts.push(Point3d.create(5, 10, 0));
    pts.push(Point3d.create(10, 10, 0));
    pts.push(Point3d.create(10, 15, 0));
    pts.push(Point3d.create(5, 15, 0));
    pts.push(pts[0].clone());

    const entrySH = ElementGeometry.fromGeometryQuery(Loop.createPolygon(pts));
    assert.exists(entrySH);

    const expected: ExpectedElementGeometryEntry[] = [];
    const newEntries: ElementGeometryDataEntry[] = [];
    const geomParams = new GeometryParams(seedElement.category);

    // Shape with hatch w/o overrides...
    geomParams.pattern = new AreaPattern.Params();
    geomParams.pattern.space1 = 0.05;
    geomParams.pattern.angle1 = Angle.createDegrees(45.0);
    let added = ElementGeometry.appendGeometryParams(geomParams, newEntries);
    assert.isTrue(added);
    expected.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expected.push({ opcode: ElementGeometryOpcode.Pattern, geomParams: geomParams.clone() });

    newEntries.push(entrySH!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    // Shape with cross hatch with color/weight override...
    geomParams.pattern.space2 = 0.1;
    geomParams.pattern.angle2 = Angle.createDegrees(-30.0);
    geomParams.pattern.color = ColorDef.red;
    geomParams.pattern.weight = 0;
    added = ElementGeometry.appendGeometryParams(geomParams, newEntries);
    assert.isTrue(added);
    expected.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expected.push({ opcode: ElementGeometryOpcode.Pattern, geomParams: geomParams.clone() });

    newEntries.push(entrySH!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    // Shape with area pattern w/o overrides...
    const partId = createCirclePart(1.0, imodel);
    assert.isTrue(Id64.isValidId64(partId));
    geomParams.pattern = new AreaPattern.Params();
    geomParams.pattern.symbolId = partId;
    geomParams.pattern.space1 = geomParams.pattern.space2 = 0.05;
    geomParams.pattern.angle1 = Angle.createDegrees(45.0);
    added = ElementGeometry.appendGeometryParams(geomParams, newEntries);
    assert.isTrue(added);
    expected.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expected.push({ opcode: ElementGeometryOpcode.Pattern, geomParams: geomParams.clone() });

    newEntries.push(entrySH!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    // Shape with area pattern with color/weight and other overrides...
    geomParams.pattern.origin = Point3d.create(0.05, 0.05, 0.0);
    geomParams.pattern.rotation = YawPitchRollAngles.createDegrees(45, 0, 0);
    geomParams.pattern.space1 = geomParams.pattern.space2 = geomParams.pattern.angle1 = undefined;
    geomParams.pattern.color = ColorDef.red;
    geomParams.pattern.weight = 1;
    geomParams.pattern.snappable = geomParams.pattern.invisibleBoundary = true;
    added = ElementGeometry.appendGeometryParams(geomParams, newEntries);
    assert.isTrue(added);
    expected.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expected.push({ opcode: ElementGeometryOpcode.Pattern, geomParams: geomParams.clone() });

    newEntries.push(entrySH!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    // Shape with hatch definition w/o overrides (zig-zag)...
    const defLines: AreaPattern.HatchDefLine[] = [
      { offset: Point2d.create(0.1, 0.1), dashes: [0.1, -0.1] },
      { angle: Angle.createDegrees(90.0), through: Point2d.create(0.1, 0.0), offset: Point2d.create(0.1, 0.1), dashes: [0.1, -0.1] },
    ];

    geomParams.pattern = new AreaPattern.Params();
    geomParams.pattern.defLines = defLines;
    added = ElementGeometry.appendGeometryParams(geomParams, newEntries);
    assert.isTrue(added);
    expected.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expected.push({ opcode: ElementGeometryOpcode.Pattern, geomParams: geomParams.clone() });

    newEntries.push(entrySH!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    // Shape with hatch definition with color/weight overrides...
    geomParams.pattern.color = ColorDef.red;
    geomParams.pattern.weight = 1;
    added = ElementGeometry.appendGeometryParams(geomParams, newEntries);
    assert.isTrue(added);
    expected.push({ opcode: ElementGeometryOpcode.BasicSymbology });
    expected.push({ opcode: ElementGeometryOpcode.Pattern, geomParams: geomParams.clone() });

    newEntries.push(entrySH!);
    expected.push({ opcode: ElementGeometryOpcode.PointPrimitive, geometryCategory: "curveCollection", geometrySubCategory: "loop" });

    assert(DbResult.BE_SQLITE_OK === doElementGeometryUpdate(imodel, newId, newEntries, false));
    assert(DbResult.BE_SQLITE_OK === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
  });
});

describe("BRepGeometry", () => {
  let imodel: SnapshotDb;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("GeometryStream", "GeometryStreamTest.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => {
    imodel.close();
  });

  it("create GeometricElement3d from a sequence of BRep operations test", async () => {
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    const builder = new ElementGeometry.Builder();

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);
      builder.entries.length = 0; // Always replace builder.entries with result for subsequent operations/creating element
      builder.entries.push(info.entryArray[0]);
    };

    // Step 1: Create solid by subtracting the 2 small spheres from the large sphere
    builder.appendGeometryQuery(Sphere.createEllipsoid(Transform.createOriginAndMatrix(Point3d.create(0, 0, 0), Matrix3d.createUniformScale(5)), AngleSweep.createFullLatitude(), true)!);
    builder.appendGeometryQuery(Sphere.createEllipsoid(Transform.createOriginAndMatrix(Point3d.create(0, 0, 5), Matrix3d.createUniformScale(3)), AngleSweep.createFullLatitude(), true)!);
    builder.appendGeometryQuery(Sphere.createEllipsoid(Transform.createOriginAndMatrix(Point3d.create(0, 0, -5), Matrix3d.createUniformScale(3)), AngleSweep.createFullLatitude(), true)!);

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Subtract,
      entryArray: builder.entries,
      onResult,
    };

    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 2: Create flat spots on sides by intersecting with a cube (i.e. something more complex that a simple revolved solid)
    builder.appendGeometryQuery(Box.createRange(Range3d.create(Point3d.create(-4, -4, -5), Point3d.create(4, 4, 5)), true)!);

    createProps.operation = BRepGeometryOperation.Intersect;

    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 3: Create a hollow shell
    createProps.operation = BRepGeometryOperation.Hollow;
    createProps.parameters = { distance: -0.5 };

    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 4: Cut a small hole through the middle of the solid
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.createZero(), 1)));

    createProps.operation = BRepGeometryOperation.Cut;
    createProps.parameters = { bothDirections: true };

    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 5: Create a geometric element from the result solid
    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);

    assert.isTrue(DbResult.BE_SQLITE_OK === imodel.elementGeometryUpdate({ elementId: newId, entryArray: builder.entries, isWorld: false }));
    imodel.saveChanges();
  });

  it("create GeometricElement3d using half-space boolean test", async () => {
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    const builder = new ElementGeometry.Builder();

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);
      builder.entries.length = 0; // Always replace builder.entries with result for subsequent operations/creating element
      builder.entries.push(info.entryArray[0]);
    };

    // Step 1: Create solid cube with all edges rounded
    builder.appendGeometryQuery(Box.createRange(Range3d.create(Point3d.create(-5, -5, -5), Point3d.create(5, 5, 5)), true)!);

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Round,
      entryArray: builder.entries,
      onResult,
      parameters: { radius: 2.0 },
    };

    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 2: Create a hollow shell
    createProps.operation = BRepGeometryOperation.Hollow;
    createProps.parameters = { distance: -0.5 };

    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 3: Use solid/sheet subtract to remove bottom half of solid (keep material in direction of surface normal)
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.createZero(), 10)));

    createProps.operation = BRepGeometryOperation.Subtract;
    createProps.parameters = undefined;

    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 4: Create a geometric element from the result solid
    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);

    assert.isTrue(DbResult.BE_SQLITE_OK === imodel.elementGeometryUpdate({ elementId: newId, entryArray: builder.entries, isWorld: false }));
    imodel.saveChanges();
  });

  it("create multiple GeometricElement3d from world coordinate disjoint body result test", async () => {
    const builder = new ElementGeometry.Builder();
    let results: ElementGeometryDataEntry[];

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 2 === info.entryArray.length);
      results = info.entryArray;
    };

    // Step 1: Create two solids by intersecting the 2 small spheres with the large sphere
    builder.appendGeometryQuery(Sphere.createEllipsoid(Transform.createOriginAndMatrix(Point3d.create(2, 2, 0), Matrix3d.createUniformScale(5)), AngleSweep.createFullLatitude(), true)!);
    builder.appendGeometryQuery(Sphere.createEllipsoid(Transform.createOriginAndMatrix(Point3d.create(2, 2, 5), Matrix3d.createUniformScale(3)), AngleSweep.createFullLatitude(), true)!);
    builder.appendGeometryQuery(Sphere.createEllipsoid(Transform.createOriginAndMatrix(Point3d.create(2, 2, -5), Matrix3d.createUniformScale(3)), AngleSweep.createFullLatitude(), true)!);

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Intersect,
      entryArray: builder.entries,
      onResult,
      separateDisjoint: true, // Request result as 2 solids instead of a single solid with disjoint regions...
    };

    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 2: Create a geometric element from each result solid
    results!.forEach((entry) => {
      // NOTE: Since entity transform reflects local to world of target (the large sphere) it's a reasonable placement...
      const brepData = ElementGeometry.toBRep(entry);
      assert.isDefined(brepData);
      const placement = YawPitchRollAngles.tryFromTransform(Transform.fromJSON(brepData!.transform));
      assert.isDefined(placement.angles);
      const result = createGeometricElemFromSeed(imodel, "0x1d", [entry], { origin: placement.origin, angles: placement.angles! }, true);
      assert.isTrue(DbResult.BE_SQLITE_OK === result.status);
    });
  });

  it("unite/subtract/intersect solids test", async () => {
    const builder = new ElementGeometry.Builder();
    builder.appendGeometryQuery(Sphere.createEllipsoid(Transform.createOriginAndMatrix(Point3d.create(0, 0, 0), Matrix3d.createUniformScale(5)), AngleSweep.createFullLatitude(), true)!);
    builder.appendGeometryQuery(Sphere.createEllipsoid(Transform.createOriginAndMatrix(Point3d.create(5, 0, 0), Matrix3d.createUniformScale(3)), AngleSweep.createFullLatitude(), true)!);

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);
    };

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Unite,
      entryArray: builder.entries,
      onResult,
    };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    createProps.operation = BRepGeometryOperation.Subtract;
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    createProps.operation = BRepGeometryOperation.Intersect;
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }
  });

  it("subtract consumes target test", async () => {
    const builder = new ElementGeometry.Builder();
    builder.appendGeometryQuery(Box.createRange(Range3d.create(Point3d.create(1, 1, 1), Point3d.create(4, 4, 4)), true)!);
    builder.appendGeometryQuery(Box.createRange(Range3d.create(Point3d.create(0, 0, 0), Point3d.create(5, 5, 5)), true)!);

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      // Successful operation w/empty result...
      assert.isTrue(undefined !== info.entryArray && 0 === info.entryArray.length);
    };

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Subtract,
      entryArray: builder.entries,
      onResult,
    };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }
  });

  it("sew sheets test", async () => {
    const builder = new ElementGeometry.Builder();
    builder.appendGeometryQuery(Loop.createPolygon([Point3d.create(0, 0, 0), Point3d.create(0, 2, 0), Point3d.create(1, 2, 0), Point3d.create(1, 0, 0), Point3d.create(0, 0, 0)]));
    builder.appendGeometryQuery(Loop.createPolygon([Point3d.create(0, 0, 3), Point3d.create(1, 0, 3), Point3d.create(1, 2, 3), Point3d.create(0, 2, 3), Point3d.create(0, 0, 3)]));
    builder.appendGeometryQuery(Loop.createPolygon([Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 0, 3), Point3d.create(0, 0, 3), Point3d.create(0, 0, 0)]));
    builder.appendGeometryQuery(Loop.createPolygon([Point3d.create(1, 2, 0), Point3d.create(0, 2, 0), Point3d.create(0, 2, 3), Point3d.create(1, 2, 3), Point3d.create(1, 2, 0)]));
    builder.appendGeometryQuery(Loop.createPolygon([Point3d.create(0, 2, 0), Point3d.create(0, 0, 0), Point3d.create(0, 0, 3), Point3d.create(0, 2, 3), Point3d.create(0, 2, 0)]));
    builder.appendGeometryQuery(Loop.createPolygon([Point3d.create(1, 0, 0), Point3d.create(1, 2, 0), Point3d.create(1, 2, 3), Point3d.create(1, 0, 3), Point3d.create(1, 0, 0)]));

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);
    };

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Sew,
      entryArray: builder.entries,
      onResult,
    };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }
  });

  it("cut solids test", async () => {
    const builder = new ElementGeometry.Builder();

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);
    };

    // Test creating cut through solid in forward direction (default)
    builder.appendGeometryQuery(Box.createRange(Range3d.create(Point3d.create(0, 0, 0), Point3d.create(5, 5, 5)), true)!);
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.create(2.5, 2.5, 2.5), 2)));

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Cut,
      entryArray: builder.entries,
      onResult,
    };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Test creating cut through solid in both directions
    createProps.parameters = { bothDirections: true };

    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Test creating depth cut in solid in forward direction
    createProps.parameters = { distance: 1 };

    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Test creating depth cut in solid in both directions
    createProps.parameters = { distance: 1, bothDirections: true };

    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }
  });

  it("emboss profile test", async () => {
    const builder = new ElementGeometry.Builder();

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);
    };

    // Test creating a pocket in a solid
    builder.appendGeometryQuery(Box.createRange(Range3d.create(Point3d.create(0, 0, 1), Point3d.create(5, 5, 2)), true)!);
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.create(2.5, 2.5, 1.5), 2)));

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Emboss,
      entryArray: builder.entries,
      onResult,
    };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Test creating a pad on a solid
    builder.entries.length = 0;
    builder.appendGeometryQuery(Box.createRange(Range3d.create(Point3d.create(0, 0, -3), Point3d.create(5, 5, -2)), true)!);
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.create(2.5, 2.5, -1.5), 2)));

    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Test embossing a surface
    builder.entries.length = 0;
    builder.appendGeometryQuery(Loop.createPolygon([Point3d.create(0, 0, 0), Point3d.create(0, 5, 0), Point3d.create(5, 5, 0), Point3d.create(5, 0, 0), Point3d.create(0, 0, 0)]));
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.create(2.5, 2.5, -0.5), 2, AngleSweep.createStartSweepDegrees(0, -360))));

    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }
  });

  it("thicken surfaces test", async () => {
    const builder = new ElementGeometry.Builder();
    builder.appendGeometryQuery(Loop.createPolygon([Point3d.create(0, 0, 0), Point3d.create(0, 5, 0), Point3d.create(5, 5, 0), Point3d.create(5, 0, 0), Point3d.create(0, 0, 0)]));

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);
    };

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Thicken,
      entryArray: builder.entries,
      onResult,
      parameters: { frontDistance: 0.25 },
    };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    createProps.parameters = { backDistance: 0.25 };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    createProps.parameters = { frontDistance: 0.1, backDistance: 0.1 };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }
  });

  it("offset surfaces test", async () => {
    const builder = new ElementGeometry.Builder();
    builder.appendGeometryQuery(Loop.createPolygon([Point3d.create(0, 0, 0), Point3d.create(0, 5, 0), Point3d.create(5, 5, 0), Point3d.create(5, 0, 0), Point3d.create(0, 0, 0)]));

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);
    };

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Offset,
      entryArray: builder.entries,
      onResult,
      parameters: { distance: 0.25 },
    };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }
  });

  it("hollow solids test", async () => {
    const builder = new ElementGeometry.Builder();
    builder.appendGeometryQuery(Box.createRange(Range3d.create(Point3d.createZero(), Point3d.create(5, 5, 2)), true)!);

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);
    };

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Hollow,
      entryArray: builder.entries,
      onResult,
      parameters: { distance: 0.25 },
    };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }
  });

  it("offset solids test", async () => {
    const builder = new ElementGeometry.Builder();
    builder.appendGeometryQuery(Box.createRange(Range3d.create(Point3d.createZero(), Point3d.create(5, 5, 2)), true)!);

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);
    };

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Offset,
      entryArray: builder.entries,
      onResult,
      parameters: { distance: 0.25 },
    };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }
  });

  it("sweep profile along path test", async () => {
    const builder = new ElementGeometry.Builder();
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.create(0, 0, 0), 1)));
    builder.appendGeometryQuery(LineString3d.create(Point3d.create(0, 0, 0), Point3d.create(0, 0, 3), Point3d.create(5, 0, 3), Point3d.create(8, 10, 10)));

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);
    };

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Sweep,
      entryArray: builder.entries,
      onResult,
    };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }
  });

  it("loft profiles test", async () => {
    const builder = new ElementGeometry.Builder();
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.create(0.5, 0, 5), 1.25)));
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.create(0, 0, 3), 1)));
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.create(0, 0, 2), 2)));
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.create(0, 0, 0), 1.5)));
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.create(-0.5, 0, -2), 3)));

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);
    };

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Loft,
      entryArray: builder.entries,
      onResult,
    };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }
  });

  it("round edges test", async () => {
    const builder = new ElementGeometry.Builder();
    builder.appendGeometryQuery(Box.createRange(Range3d.create(Point3d.createZero(), Point3d.create(5, 5, 2)), true)!);

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);
    };

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Round,
      entryArray: builder.entries,
      onResult,
      parameters: { radius: 1 },
    };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }
  });

  it("create element using base 64 encoded brep from flatbuffer test", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const builder = new ElementGeometry.Builder();
    builder.appendGeometryQuery(Box.createRange(Range3d.create(Point3d.createZero(), Point3d.create(5, 5, 2)), true)!);

    const onResult: BRepGeometryFunction = (info: BRepGeometryInfo): void => {
      assert.isTrue(undefined !== info.entryArray && 1 === info.entryArray.length && ElementGeometryOpcode.BRep === info.entryArray[0].opcode);

      // Create new element to test flatbuffer conversion to brep wire format
      // NOTE: It is preferable to use IModelDb.elementGeometryUpdate over GeometryStreamBuilder this is just for testing,
      const gsBuilder = new GeometryStreamBuilder();
      const brep = ElementGeometry.toBRep(info.entryArray[0], true);
      assert.exists(brep);
      gsBuilder.appendBRepData(brep!);

      const elementProps = createPhysicalElementProps(seedElement, { origin: Point3d.create(5, 10, 0), angles: YawPitchRollAngles.createDegrees(45, 0, 0) }, gsBuilder.geometryStream);
      const testElem = imodel.elements.createElement(elementProps);
      const newId = imodel.elements.insertElement(testElem);
      imodel.saveChanges();

      // Extract and test value returned
      const value = imodel.elements.getElementProps<GeometricElementProps>({ id: newId, wantGeometry: true, wantBRepData: true });
      assert.isDefined(value.geom);

      const itLocal = new GeometryStreamIterator(value.geom!, value.category);
      for (const entry of itLocal) {
        assertTrue(entry.primitive.type === "brep");
        // TODO: Enable fromBRep check below when addon is updated...
        // const brepEntry = ElementGeometry.fromBRep(entry.primitive.brep);
        // assert.exists(brepEntry);
      }
    };

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Hollow,
      entryArray: builder.entries,
      onResult,
      parameters: { distance: 0.25 },
    };
    try {
      assert(DbResult.BE_SQLITE_OK === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }
  });
});

describe("Mass Properties", () => {
  let imodel: SnapshotDb;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("GeometryStream", "GeometryStreamTest.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => {
    imodel.close();
  });

  it("volume", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const box = Box.createRange(Range3d.create(Point3d.createZero(), Point3d.create(1.0, 1.0, 1.0)), true);
    assert.isFalse(undefined === box);

    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(box!);

    const elementProps = createPhysicalElementProps(seedElement, undefined, builder.geometryStream);
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const requestProps: MassPropertiesRequestProps = {
      operation: MassPropertiesOperation.AccumulateVolumes,
      candidates: [newId],
    };

    const result = await imodel.getMassProperties(requestProps);
    assert.isTrue(BentleyStatus.SUCCESS === result.status);
    assert.isTrue(1.0 === result.volume);
    assert.isTrue(6.0 === result.area);
    assert.isTrue(Point3d.fromJSON(result.centroid).isAlmostEqual(Point3d.create(0.5, 0.5, 0.5)));
  });

  it("area", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const shape = Loop.create(LineString3d.create(Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 1, 0), Point3d.create(0, 0, 0)));
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(shape);

    const elementProps = createPhysicalElementProps(seedElement, undefined, builder.geometryStream);
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const requestProps: MassPropertiesRequestProps = {
      operation: MassPropertiesOperation.AccumulateAreas,
      candidates: [newId],
    };

    const result = await imodel.getMassProperties(requestProps);
    assert.isTrue(BentleyStatus.SUCCESS === result.status);
    assert.isTrue(1.0 === result.area);
    assert.isTrue(4.0 === result.perimeter);
    assert.isTrue(Point3d.fromJSON(result.centroid).isAlmostEqual(Point3d.create(0.5, 0.5, 0.0)));
  });
});

describe("Geometry Containment", () => {
  let imodel: SnapshotDb;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("GeometryStream", "GeometryStreamTest.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => {
    imodel.close();
  });

  it("clip volume curve containment", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const rangeInsideId = createCircleElem(1.0, Point3d.create(5, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOutsideId = createCircleElem(1.0, Point3d.create(12, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const edgeOverlapId = createCircleElem(1.0, Point3d.create(0, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const cornerOverlapId = createCircleElem(1.0, Point3d.create(10, 10, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOvrGeomOutId = createCircleElem(1.25, Point3d.create(11, -1, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOvrGeomInId = createCircleElem(0.85, Point3d.create(5, 9, 0), YawPitchRollAngles.createDegrees(45, 0, 0), imodel, seedElement);
    imodel.saveChanges();

    const range = Range3d.create(Point3d.create(0, 0, -5), Point3d.create(10, 10, 5));
    const clip = ClipVector.createEmpty();
    const block = ClipShape.createBlock(range, ClipMaskXYZRangePlanes.All, false, false);
    clip.appendReference(block);

    const expectedContainment: ClipPlaneContainment[] = [ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.Ambiguous, ClipPlaneContainment.Ambiguous, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyInside];

    const requestProps: GeometryContainmentRequestProps = {
      candidates: [rangeInsideId, rangeOutsideId, edgeOverlapId, cornerOverlapId, rangeOvrGeomOutId, rangeOvrGeomInId],
      clip: clip.toJSON(),
      allowOverlaps: true,
    };

    let result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(2 === result.numInside);
    assert.isTrue(2 === result.numOutside);
    assert.isTrue(2 === result.numOverlap);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainment[index]); });

    requestProps.allowOverlaps = false; // test inside mode...
    result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(2 === result.numInside);
    assert.isTrue(4 === result.numOutside);
    assert.isTrue(0 === result.numOverlap);
  });

  it("clip volume mesh containment", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const rangeInsideId = createSphereElem(1.0, Point3d.create(5, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOutsideId = createSphereElem(1.0, Point3d.create(12, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const edgeOverlapId = createSphereElem(1.0, Point3d.create(0, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const cornerOverlapId = createSphereElem(1.0, Point3d.create(10, 10, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOvrGeomOutId = createSphereElem(1.25, Point3d.create(11, -1, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOvrGeomInId = createSphereElem(0.85, Point3d.create(5, 9, 0), YawPitchRollAngles.createDegrees(45, 0, 0), imodel, seedElement);
    imodel.saveChanges();

    const range = Range3d.create(Point3d.create(0, 0, -5), Point3d.create(10, 10, 5));
    const clip = ClipVector.createEmpty();
    const block = ClipShape.createBlock(range, ClipMaskXYZRangePlanes.All, false, false);
    clip.appendReference(block);

    const expectedContainment: ClipPlaneContainment[] = [ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.Ambiguous, ClipPlaneContainment.Ambiguous, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyInside];

    const requestProps: GeometryContainmentRequestProps = {
      candidates: [rangeInsideId, rangeOutsideId, edgeOverlapId, cornerOverlapId, rangeOvrGeomOutId, rangeOvrGeomInId],
      clip: clip.toJSON(),
      allowOverlaps: true,
    };

    let result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(2 === result.numInside);
    assert.isTrue(2 === result.numOutside);
    assert.isTrue(2 === result.numOverlap);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainment[index]); });

    requestProps.allowOverlaps = false; // test inside mode...
    result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(2 === result.numInside);
    assert.isTrue(4 === result.numOutside);
    assert.isTrue(0 === result.numOverlap);
  });

  it("clip volume part containment", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const partAId = createCirclePart(1.0, imodel);
    const partBId = createCirclePart(1.25, imodel);
    const partCId = createCirclePart(0.85, imodel);

    // create part entries without instance transform...
    const rangeInsideId = createPartElem(partAId, Point3d.create(5, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOutsideId = createPartElem(partAId, Point3d.create(12, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const edgeOverlapId = createPartElem(partAId, Point3d.create(0, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const cornerOverlapId = createPartElem(partAId, Point3d.create(10, 10, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOvrGeomOutId = createPartElem(partBId, Point3d.create(11, -1, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOvrGeomInId = createPartElem(partCId, Point3d.create(5, 9, 0), YawPitchRollAngles.createDegrees(45, 0, 0), imodel, seedElement);

    // create part entries with instance transform...
    const rangeInsideRId = createPartElem(partAId, Point3d.create(5, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement, true);
    const rangeOutsideRId = createPartElem(partAId, Point3d.create(12, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement, true);
    const edgeOverlapRId = createPartElem(partAId, Point3d.create(0, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement, true);
    const cornerOverlapRId = createPartElem(partAId, Point3d.create(10, 10, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement, true);
    const rangeOvrGeomOutRId = createPartElem(partBId, Point3d.create(11, -1, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement, true);
    const rangeOvrGeomInRId = createPartElem(partCId, Point3d.create(5, 9, 0), YawPitchRollAngles.createDegrees(45, 0, 0), imodel, seedElement, true);

    imodel.saveChanges();

    const range = Range3d.create(Point3d.create(0, 0, -5), Point3d.create(10, 10, 5));
    const clip = ClipVector.createEmpty();
    const block = ClipShape.createBlock(range, ClipMaskXYZRangePlanes.All, false, false);
    clip.appendReference(block);

    const expectedContainment: ClipPlaneContainment[] = [ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.Ambiguous, ClipPlaneContainment.Ambiguous, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.Ambiguous, ClipPlaneContainment.Ambiguous, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyInside];

    const requestProps: GeometryContainmentRequestProps = {
      candidates: [rangeInsideId, rangeOutsideId, edgeOverlapId, cornerOverlapId, rangeOvrGeomOutId, rangeOvrGeomInId, rangeInsideRId, rangeOutsideRId, edgeOverlapRId, cornerOverlapRId, rangeOvrGeomOutRId, rangeOvrGeomInRId],
      clip: clip.toJSON(),
      allowOverlaps: true,
    };

    let result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(4 === result.numInside);
    assert.isTrue(4 === result.numOutside);
    assert.isTrue(4 === result.numOverlap);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainment[index]); });

    requestProps.allowOverlaps = false; // test inside mode...
    result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(4 === result.numInside);
    assert.isTrue(8 === result.numOutside);
    assert.isTrue(0 === result.numOverlap);
  });

  it("clip volume displayed containment", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const primInConsOutId = createDisjointCirclesElem(1.0, Point3d.create(10, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const primOutConsInId = createDisjointCirclesElem(1.0, Point3d.create(0, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const primInConsInId = createDisjointCirclesElem(1.0, Point3d.create(5, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const primOvrConsOvrId = createDisjointCirclesElem(1.0, Point3d.create(5, 10, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    imodel.saveChanges();

    const range = Range3d.create(Point3d.create(0, 0, -5), Point3d.create(10, 10, 5));
    const clip = ClipVector.createEmpty();
    const block = ClipShape.createBlock(range, ClipMaskXYZRangePlanes.All, false, false);
    clip.appendReference(block);

    const expectedContainmentDef: ClipPlaneContainment[] = [ClipPlaneContainment.Ambiguous, ClipPlaneContainment.Ambiguous, ClipPlaneContainment.StronglyInside, ClipPlaneContainment.Ambiguous];

    const requestProps: GeometryContainmentRequestProps = {
      candidates: [primInConsOutId, primOutConsInId, primInConsInId, primOvrConsOvrId],
      clip: clip.toJSON(),
      allowOverlaps: true,
    };

    let result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainmentDef.length);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainmentDef[index]); });
    assert.isTrue(1 === result.numInside);
    assert.isTrue(0 === result.numOutside);
    assert.isTrue(3 === result.numOverlap);

    const expectedContainmentSubCat: ClipPlaneContainment[] = [ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyOutside];

    requestProps.offSubCategories = [IModel.getDefaultSubCategoryId(seedElement.category)];
    result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainmentSubCat.length);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainmentSubCat[index]); });
    assert.isTrue(0 === result.numInside);
    assert.isTrue(4 === result.numOutside);
    assert.isTrue(0 === result.numOverlap);

    const expectedContainmentViewFlags: ClipPlaneContainment[] = [ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyInside, ClipPlaneContainment.Ambiguous];

    const flags = new ViewFlags(); // constructions are off by default...
    requestProps.viewFlags = flags;
    requestProps.offSubCategories = undefined;
    result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainmentViewFlags.length);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainmentViewFlags[index]); });
    assert.isTrue(2 === result.numInside);
    assert.isTrue(1 === result.numOutside);
    assert.isTrue(1 === result.numOverlap);
  });

  it("clip L shape volume curve containment", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const rangeInsideXYId = createCircleElem(1.0, Point3d.create(2.5, 2.5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeInsideYId = createCircleElem(1.0, Point3d.create(2.5, 7.5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeInsideXId = createCircleElem(1.0, Point3d.create(7.5, 2.5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOutsideId = createCircleElem(1.0, Point3d.create(7.5, 7.5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOvrGeomOvrId = createCircleElem(1.0, Point3d.create(5, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    imodel.saveChanges();

    const clipShapePts: Point3d[] = [];
    clipShapePts.push(Point3d.create(0, 0, 0));
    clipShapePts.push(Point3d.create(10, 0, 0));
    clipShapePts.push(Point3d.create(10, 5, 0));
    clipShapePts.push(Point3d.create(5, 5, 0));
    clipShapePts.push(Point3d.create(5, 10, 0));
    clipShapePts.push(Point3d.create(0, 10, 0));
    clipShapePts.push(Point3d.create(0, 0, 0));
    const clip = ClipVector.createEmpty();
    clip.appendShape(clipShapePts, -5, 5);

    const expectedContainment: ClipPlaneContainment[] = [ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.Ambiguous];

    const requestProps: GeometryContainmentRequestProps = {
      candidates: [rangeInsideXYId, rangeInsideXId, rangeInsideYId, rangeOutsideId, rangeOvrGeomOvrId],
      clip: clip.toJSON(),
      allowOverlaps: true,
    };

    const result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(3 === result.numInside);
    assert.isTrue(1 === result.numOutside);
    assert.isTrue(1 === result.numOverlap);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainment[index]); });
  });

  it("clip L shape volume mesh containment", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const rangeInsideXYId = createSphereElem(1.0, Point3d.create(2.5, 2.5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeInsideYId = createSphereElem(1.0, Point3d.create(2.5, 7.5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeInsideXId = createSphereElem(1.0, Point3d.create(7.5, 2.5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOutsideId = createSphereElem(1.0, Point3d.create(7.5, 7.5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOvrGeomOvrId = createSphereElem(1.0, Point3d.create(5, 5, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    imodel.saveChanges();

    const clipShapePts: Point3d[] = [];
    clipShapePts.push(Point3d.create(0, 0, 0));
    clipShapePts.push(Point3d.create(10, 0, 0));
    clipShapePts.push(Point3d.create(10, 5, 0));
    clipShapePts.push(Point3d.create(5, 5, 0));
    clipShapePts.push(Point3d.create(5, 10, 0));
    clipShapePts.push(Point3d.create(0, 10, 0));
    clipShapePts.push(Point3d.create(0, 0, 0));
    const clip = ClipVector.createEmpty();
    clip.appendShape(clipShapePts, -5, 5);

    const expectedContainment: ClipPlaneContainment[] = [ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.Ambiguous];

    const requestProps: GeometryContainmentRequestProps = {
      candidates: [rangeInsideXYId, rangeInsideXId, rangeInsideYId, rangeOutsideId, rangeOvrGeomOvrId],
      clip: clip.toJSON(),
      allowOverlaps: true,
    };

    const result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(3 === result.numInside);
    assert.isTrue(1 === result.numOutside);
    assert.isTrue(1 === result.numOverlap);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainment[index]); });
  });

  it("clip plane curve containment", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const rangeInsideId = createCircleElem(1.0, Point3d.create(0, 0, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOutsideId = createCircleElem(1.0, Point3d.create(10, 0, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOverlapId = createCircleElem(1.0, Point3d.create(5, 0, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    imodel.saveChanges();

    const plane = Plane3dByOriginAndUnitNormal.create(Point3d.create(5, 0, 0), Vector3d.create(-1, 0, 0)); // inward normal...
    const planeSet = ConvexClipPlaneSet.createEmpty();
    planeSet.addPlaneToConvexSet(ClipPlane.createPlane(plane!));
    const prim = ClipPrimitive.createCapture(planeSet);
    const clip = ClipVector.createEmpty();
    clip.appendReference(prim);

    const expectedContainment: ClipPlaneContainment[] = [ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.Ambiguous];

    const requestProps: GeometryContainmentRequestProps = {
      candidates: [rangeInsideId, rangeOutsideId, rangeOverlapId],
      clip: clip.toJSON(),
      allowOverlaps: true,
    };

    const result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(1 === result.numInside);
    assert.isTrue(1 === result.numOutside);
    assert.isTrue(1 === result.numOverlap);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainment[index]); });
  });

  it("clip plane mesh containment", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const rangeInsideId = createSphereElem(1.0, Point3d.create(0, 0, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOutsideId = createSphereElem(1.0, Point3d.create(10, 0, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    const rangeOverlapId = createSphereElem(1.0, Point3d.create(5, 0, 0), YawPitchRollAngles.createDegrees(0, 0, 0), imodel, seedElement);
    imodel.saveChanges();

    const plane = Plane3dByOriginAndUnitNormal.create(Point3d.create(5, 0, 0), Vector3d.create(-1, 0, 0)); // inward normal...
    const planeSet = ConvexClipPlaneSet.createEmpty();
    planeSet.addPlaneToConvexSet(ClipPlane.createPlane(plane!));
    const prim = ClipPrimitive.createCapture(planeSet);
    const clip = ClipVector.createEmpty();
    clip.appendReference(prim);

    const expectedContainment: ClipPlaneContainment[] = [ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.Ambiguous];

    const requestProps: GeometryContainmentRequestProps = {
      candidates: [rangeInsideId, rangeOutsideId, rangeOverlapId],
      clip: clip.toJSON(),
      allowOverlaps: true,
    };

    const result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(1 === result.numInside);
    assert.isTrue(1 === result.numOutside);
    assert.isTrue(1 === result.numOverlap);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainment[index]); });
  });
});
