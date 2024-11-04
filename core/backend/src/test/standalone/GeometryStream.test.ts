/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { BentleyStatus, Id64, Id64String, IModelStatus } from "@itwin/core-bentley";
import {
  Angle, AngleSweep, Arc3d, Box, ClipMaskXYZRangePlanes, ClipPlane, ClipPlaneContainment, ClipPrimitive, ClipShape, ClipVector, ConvexClipPlaneSet,
  CurveCollection, CurvePrimitive, Geometry, GeometryQueryCategory, IndexedPolyface, InterpolationCurve3d, InterpolationCurve3dOptions, InterpolationCurve3dProps,
  LineSegment3d, LineString3d, Loop, Matrix3d, Plane3dByOriginAndUnitNormal, Point2d, Point3d, Point3dArray, PointString3d, PolyfaceBuilder, Range2d, Range3d,
  SolidPrimitive, Sphere, StrokeOptions, Transform, Vector3d, YawPitchRollAngles,
} from "@itwin/core-geometry";
import {
  AreaPattern, BackgroundFill, BRepGeometryCreate, BRepGeometryFunction, BRepGeometryInfo, BRepGeometryOperation, Code, ColorByName,
  ColorDef, ElementGeometry, ElementGeometryDataEntry, ElementGeometryFunction, ElementGeometryInfo, ElementGeometryOpcode, ElementGeometryRequest,
  FillDisplay, GeometricElement3dProps, GeometricElementProps, GeometryClass,
  GeometryContainmentRequestProps, GeometryParams, GeometryPartProps, GeometryPrimitive, GeometryStreamBuilder, GeometryStreamFlags, GeometryStreamIterator,
  GeometryStreamProps, Gradient, ImageGraphicCorners, ImageGraphicProps, IModel, LinePixels, LineStyle, MassPropertiesOperation,
  MassPropertiesRequestProps, PhysicalElementProps, Placement3d, Placement3dProps, TextString, TextStringGlyphData, TextStringProps, ThematicGradientMode,
  ThematicGradientSettings, ViewFlags,
} from "@itwin/core-common";
import { _nativeDb, DefinitionModel, deleteElementTree, GeometricElement, GeometryPart, LineStyleDefinition, PhysicalObject, SnapshotDb, Subject } from "../../core-backend";
import { createBRepDataProps } from "../GeometryTestUtil";
import { IModelTestUtils } from "../IModelTestUtils";
import { Timer } from "../TestUtils";

function assertTrue(expr: boolean): asserts expr {
  assert.isTrue(expr);
}

function createGeometryPartProps(geom?: GeometryStreamProps, modelId?: Id64String): GeometryPartProps {
  const partProps: GeometryPartProps = {
    classFullName: GeometryPart.classFullName,
    model: modelId ?? IModel.dictionaryId,
    code: Code.createEmpty(),
    geom,
  };
  return partProps;
}

function createPhysicalElementProps(seedElement: GeometricElement, placement?: Placement3dProps, geom?: GeometryStreamProps, modelId?: Id64String): PhysicalElementProps {
  const elementProps: PhysicalElementProps = {
    classFullName: PhysicalObject.classFullName,
    model: modelId ?? seedElement.model,
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
  return imodel.elements.insertElement(el.toJSON());
}

function createPartElem(partId: Id64String, origin: Point3d, angles: YawPitchRollAngles, imodel: SnapshotDb, seedElement: GeometricElement, isRelative = false): Id64String {
  const builder = new GeometryStreamBuilder();
  builder.appendGeometryPart3d(partId, isRelative ? origin : undefined, isRelative ? angles : undefined);
  return createGeometricElem(builder.geometryStream, isRelative ? { origin: Point3d.createZero(), angles: YawPitchRollAngles.createDegrees(0, 0, 0) } : { origin, angles }, imodel, seedElement);
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

function createStyledLineElem(imodel: SnapshotDb, seedElement: GeometricElement, x: number, y: number, length: number, styleInfo?: LineStyle.Info, color?: ColorDef): Id64String {
  const builder = new GeometryStreamBuilder();
  const params = new GeometryParams(seedElement.category);

  if (styleInfo)
    params.styleInfo = styleInfo;

  if (color)
    params.lineColor = color;

  builder.appendGeometryParamsChange(params);
  builder.appendGeometry(LineSegment3d.create(Point3d.create(x, y, 0), Point3d.create(x + length, y, 0)));

  const elementProps = createPhysicalElementProps(seedElement, undefined, builder.geometryStream);
  return imodel.elements.insertElement(elementProps);
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
            const other = ElementGeometry.toBRep(expected[i].originalEntry);
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
            const other = ElementGeometry.toTextString(expected[i].originalEntry);
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
            const other = ElementGeometry.toImageGraphic(expected[i].originalEntry);
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
        const other = ElementGeometry.toGeometryPart(expected[i].originalEntry, otherToElement);
        assert.exists(other);
        assert.isTrue(partToElement.isAlmostEqual(otherToElement));
      }
    } else if (ElementGeometry.isAppearanceEntry(entry)) {
      if (undefined !== geomParams) {
        const updated = ElementGeometry.updateGeometryParams(entry, geomParams);
        assert.isTrue(updated);
        if (!isWorld && undefined !== expected[i].geomParams)
          assert.isTrue(geomParams.isEquivalent(expected[i].geomParams));
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

function doElementGeometryValidate(imodel: SnapshotDb, elementId: Id64String, expected: ExpectedElementGeometryEntry[], isWorld: boolean, elementProps?: GeometricElement3dProps, brepOpt?: number): IModelStatus {
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

function createGeometricElemFromSeed(imodel: SnapshotDb, seedId: Id64String, entryArray: ElementGeometryDataEntry[], placement?: Placement3dProps): Id64String {
  const seedElement = imodel.elements.getElement<GeometricElement>(seedId);
  assert.exists(seedElement);

  const elementProps = createPhysicalElementProps(seedElement, placement);
  elementProps.elementGeometryBuilderParams = { entryArray };

  const newId = imodel.elements.insertElement(elementProps);
  assert.isTrue(Id64.isValidId64(newId));
  imodel.saveChanges();

  return newId;
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
      pointS.y += 0.5;
      pointE.y += 0.5;
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

  function createGeometricElem3dUsingArrowHeadNoStrokePattern(definitionModelId?: Id64String, physicalModelId?: Id64String) {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    if (definitionModelId === undefined)
      definitionModelId = IModel.dictionaryId;

    if (physicalModelId === undefined)
      physicalModelId = seedElement.model;

    const partBuilder = new GeometryStreamBuilder();
    const partParams = new GeometryParams(Id64.invalid); // category won't be used

    partParams.fillDisplay = FillDisplay.Always;
    partBuilder.appendGeometryParamsChange(partParams);
    partBuilder.appendGeometry(Loop.create(LineString3d.create(Point3d.create(0.1, 0, 0), Point3d.create(0, -0.05, 0), Point3d.create(0, 0.05, 0), Point3d.create(0.1, 0, 0))));

    const partProps = createGeometryPartProps(partBuilder.geometryStream, definitionModelId);
    const partId = imodel.elements.insertElement(partProps);
    assert.isTrue(Id64.isValidId64(partId));

    const pointSymbolData = LineStyleDefinition.Utils.createPointSymbolComponent(imodel, { geomPartId: partId }); // base and size will be set automatically...
    assert.isTrue(undefined !== pointSymbolData);

    // Use internal default instead of creating a stroke component for a solid line
    const strokePointData = LineStyleDefinition.Utils.createStrokePointComponent(imodel, { descr: "TestArrowHead", lcId: 0, lcType: LineStyleDefinition.ComponentType.Internal, symbols: [{ symId: pointSymbolData!.compId, strokeNum: -1, mod1: LineStyleDefinition.SymbolOptions.CurveEnd }] });
    assert.isTrue(undefined !== strokePointData);

    const compoundData = LineStyleDefinition.Utils.createCompoundComponent(imodel, { comps: [{ id: strokePointData.compId, type: strokePointData.compType }, { id: 0, type: LineStyleDefinition.ComponentType.Internal }] });
    assert.isTrue(undefined !== compoundData);

    const styleId = LineStyleDefinition.Utils.createStyle(imodel, definitionModelId, "TestArrowStyle", compoundData);
    assert.isTrue(Id64.isValidId64(styleId));

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    params.styleInfo = new LineStyle.Info(styleId);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometry(LineSegment3d.create(Point3d.createZero(), Point3d.create(-1, -1, 0)));

    const elementProps = createPhysicalElementProps(seedElement, undefined, builder.geometryStream, physicalModelId);
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    const usageInfo = imodel[_nativeDb].queryDefinitionElementUsage([partId, styleId])!;
    assert.isTrue(usageInfo.geometryPartIds!.includes(partId));
    assert.isTrue(usageInfo.lineStyleIds!.includes(styleId));
    assert.isTrue(usageInfo.usedIds!.includes(partId));
    assert.isTrue(usageInfo.usedIds!.includes(styleId));
  }

  it("create GeometricElement3d using arrow head style w/o using stroke pattern", async () => {
    createGeometricElem3dUsingArrowHeadNoStrokePattern();
  });

  it("create GeometricElement3d using arrow head style w/o using stroke pattern - deleteElementTree fails", async () => {
    const mySubject = Subject.insert(imodel, IModel.rootSubjectId, "My Subject - fails");
    const myDefModel = DefinitionModel.insert(imodel, mySubject, "My Definitions - fails");
    const myPhysicalModel = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), false, mySubject)[0];

    createGeometricElem3dUsingArrowHeadNoStrokePattern(myDefModel, myPhysicalModel);

    deleteElementTree({ iModel: imodel, topElement: mySubject, maxPasses: 1 });
    expect(imodel.elements.tryGetElement(mySubject)).not.undefined;
  });

  it("create GeometricElement3d using arrow head style w/o using stroke pattern - deleteElementTree succeeds with 2 passes", async () => {
    const mySubject = Subject.insert(imodel, IModel.rootSubjectId, "My Subject - success");
    const myDefModel = DefinitionModel.insert(imodel, mySubject, "My Definitions - success");
    const myPhysicalModel = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), false, mySubject)[0];

    createGeometricElem3dUsingArrowHeadNoStrokePattern(myDefModel, myPhysicalModel);

    deleteElementTree({ iModel: imodel, topElement: mySubject, maxPasses: 2 });
    expect(imodel.elements.tryGetElement(mySubject)).undefined;
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

    const usageInfo = imodel[_nativeDb].queryDefinitionElementUsage([partId, styleId, seedElement.category])!;
    assert.isTrue(usageInfo.geometryPartIds!.includes(partId));
    assert.isTrue(usageInfo.lineStyleIds!.includes(styleId));
    assert.isTrue(usageInfo.spatialCategoryIds!.includes(seedElement.category));
    assert.isTrue(usageInfo.usedIds!.includes(partId));
    assert.isTrue(usageInfo.usedIds!.includes(styleId));
    assert.isTrue(usageInfo.usedIds!.includes(seedElement.category));
  });

  it("create GeometricElement3d with line styles to check bounding box padding", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    // LineStyleDefinition: create special "internal default" continuous style for drawing curves using width overrides
    let x = 0.0;
    let y = 0.0;
    let unitDef = 1.0;
    let widthDef = 0.0;
    let name = `Continuous-${unitDef}-${widthDef}`;
    let styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.dictionaryId, name, { compId: 0, compType: LineStyleDefinition.ComponentType.Internal, flags: LineStyleDefinition.StyleFlags.Continuous | LineStyleDefinition.StyleFlags.NoSnap });
    assert.isTrue(Id64.isValidId64(styleId));

    // Expect no range padding...
    let newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId));
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.0));

    // Expect range padded by 0.25...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ startWidth: 0.25, physicalWidth: true })), ColorDef.red);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.25));

    // LineStyleDefinition: create continuous style with both width and unit scale specified in definition...
    x = 0.0;
    y++;
    unitDef = 2.0;
    widthDef = 0.5;
    name = `Continuous-${unitDef}-${widthDef}`;
    let strokePatternData = LineStyleDefinition.Utils.createStrokePatternComponent(imodel, { descr: name, strokes: [{ length: 1e37, orgWidth: widthDef, strokeMode: LineStyleDefinition.StrokeMode.Dash, widthMode: LineStyleDefinition.StrokeWidth.Full }] });
    styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.dictionaryId, name, { compId: strokePatternData.compId, compType: strokePatternData.compType, flags: LineStyleDefinition.StyleFlags.Continuous | LineStyleDefinition.StyleFlags.NoSnap, unitDef });
    assert.isTrue(Id64.isValidId64(styleId));

    // Expect no range padding...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ startWidth: 0.0, physicalWidth: true })));
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.0));

    // Expect range padded by 1.0...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId), ColorDef.red);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), widthDef * unitDef));

    // Expect range padded by 0.25...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ startWidth: 0.25, physicalWidth: true })), ColorDef.green);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.25));

    // LineStyleDefinition: create stroke pattern with dash widths in definition...
    x = 0.0;
    y++;
    unitDef = 1.0;
    widthDef = 0.025;
    name = `StrokePattern-${unitDef}-${widthDef}`;
    const lsStrokes: LineStyleDefinition.Strokes = [];
    lsStrokes.push({ length: 0.25, orgWidth: widthDef, endWidth: widthDef, strokeMode: LineStyleDefinition.StrokeMode.Dash, widthMode: LineStyleDefinition.StrokeWidth.Left });
    lsStrokes.push({ length: 0.1 });
    lsStrokes.push({ length: 0.2, orgWidth: widthDef, endWidth: widthDef, strokeMode: LineStyleDefinition.StrokeMode.Dash, widthMode: LineStyleDefinition.StrokeWidth.Full });
    lsStrokes.push({ length: 0.1 });
    lsStrokes.push({ length: 0.25, orgWidth: widthDef, endWidth: widthDef, strokeMode: LineStyleDefinition.StrokeMode.Dash, widthMode: LineStyleDefinition.StrokeWidth.Right });
    lsStrokes.push({ length: 0.1 });
    strokePatternData = LineStyleDefinition.Utils.createStrokePatternComponent(imodel, { descr: name, strokes: lsStrokes });
    styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.dictionaryId, name, { compId: strokePatternData.compId, compType: strokePatternData.compType, flags: LineStyleDefinition.StyleFlags.NoSnap });
    assert.isTrue(Id64.isValidId64(styleId));

    // Expect range padded by 0.025...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId));
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), widthDef * unitDef));

    // Expect range padded by 0.25...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ startWidth: 0.25, physicalWidth: true })), ColorDef.red);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.25));

    // LineStyleDefinition: create stroke pattern with dash widths and unit scale specified in definition...
    x = 0.0;
    y++;
    unitDef = 2.0;
    widthDef = 0.025;
    name = `StrokePattern-${unitDef}-${widthDef}`;
    styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.dictionaryId, name, { compId: strokePatternData.compId, compType: strokePatternData.compType, flags: LineStyleDefinition.StyleFlags.NoSnap, unitDef });
    assert.isTrue(Id64.isValidId64(styleId));

    // Expect range padded by 0.05...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId));
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), widthDef * unitDef));

    // Expect range padded by 0.25...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ startWidth: 0.25, physicalWidth: true })), ColorDef.red);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.25));

    // Expect range padded by 0.25...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ startWidth: 0.25, scale: 0.5, physicalWidth: true })), ColorDef.green);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.25));

    // Expect range padded by 0.025...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ scale: 0.5 })), ColorDef.blue);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), widthDef * unitDef * 0.5));

    // LineStyleDefinition: create point symbol with internal default instead of a stroke pattern...
    x = 0.0;
    y++;
    unitDef = 1.0;
    widthDef = 1.0;
    name = `PointSymbol-${unitDef}-${widthDef}`;
    const partId = createCirclePart(0.25, imodel);
    let pointSymbolData = LineStyleDefinition.Utils.createPointSymbolComponent(imodel, { geomPartId: partId });
    let strokePointData = LineStyleDefinition.Utils.createStrokePointComponent(imodel, { descr: name, lcId: 0, lcType: LineStyleDefinition.ComponentType.Internal, symbols: [{ symId: pointSymbolData!.compId, strokeNum: -1, mod1: LineStyleDefinition.SymbolOptions.CurveOrigin }] });
    let compoundData = LineStyleDefinition.Utils.createCompoundComponent(imodel, { comps: [{ id: strokePointData.compId, type: strokePointData.compType }, { id: 0, type: LineStyleDefinition.ComponentType.Internal }] });
    styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.dictionaryId, name, compoundData);
    assert.isTrue(Id64.isValidId64(styleId));

    // Expect range padded by 0.5 (circle radius)...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId));
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.5));

    // Expect range padded by 0.25 (scaled circle radius)...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ scale: 0.5 })), ColorDef.red);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.25));

    // Expect range padded by 1.0 (width override > symbol size)...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ startWidth: 1.0, scale: 0.5, physicalWidth: true })), ColorDef.green);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 1.0));

    // LineStyleDefinition: create scaling point symbol with stroke pattern with width and unit scale specified in definition...
    x = 0.0;
    y++;
    unitDef = 0.5;
    widthDef = 0.025; // value used for lsStrokes...
    name = `PointSymbol-${unitDef}-${widthDef}}`;
    strokePatternData = LineStyleDefinition.Utils.createStrokePatternComponent(imodel, { descr: name, strokes: lsStrokes });
    pointSymbolData = LineStyleDefinition.Utils.createPointSymbolComponent(imodel, { geomPartId: partId, scale: 2.0 });
    const lsSymbols: LineStyleDefinition.Symbols = [];
    lsSymbols.push({ symId: pointSymbolData!.compId, strokeNum: 1, mod1: LineStyleDefinition.SymbolOptions.Center });
    lsSymbols.push({ symId: pointSymbolData!.compId, strokeNum: 3, mod1: LineStyleDefinition.SymbolOptions.Center });
    strokePointData = LineStyleDefinition.Utils.createStrokePointComponent(imodel, { descr: name, lcId: strokePatternData.compId, symbols: lsSymbols });
    const lsComponents: LineStyleDefinition.Components = [];
    lsComponents.push({ id: strokePointData.compId, type: strokePointData.compType });
    lsComponents.push({ id: strokePatternData.compId, type: strokePatternData.compType });
    compoundData = LineStyleDefinition.Utils.createCompoundComponent(imodel, { comps: lsComponents });
    compoundData.unitDef = unitDef;
    styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.dictionaryId, name, compoundData);
    assert.isTrue(Id64.isValidId64(styleId));

    // Expect range padded by 0.125 (symbol and unit scaled circle radius)......
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId));
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.125));

    // Expect range padded by 0.0625 (symbol and modifier scaled circle radius)...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ scale: 0.5 })), ColorDef.red);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.0625));

    // Expect range padded by 0.75 (width override > symbol and modifier scaled symbol size)...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ startWidth: 0.75, scale: 0.5, physicalWidth: true })), ColorDef.green);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.75));

    // LineStyleDefinition: create non-scaling point symbol with stroke pattern with width and unit scale specified in definition...
    x = 0.0;
    y++;
    unitDef = 0.5;
    widthDef = 0.025; // value used for lsStrokes...
    name = `NonScalingPointSymbol-${unitDef}-${widthDef}}`;
    strokePatternData = LineStyleDefinition.Utils.createStrokePatternComponent(imodel, { descr: name, strokes: lsStrokes });
    pointSymbolData = LineStyleDefinition.Utils.createPointSymbolComponent(imodel, { geomPartId: partId, scale: 2.0, symFlags: LineStyleDefinition.PointSymbolFlags.NoScale });
    lsSymbols.length = 0;
    lsSymbols.push({ symId: pointSymbolData!.compId, strokeNum: 1, mod1: LineStyleDefinition.SymbolOptions.Center });
    lsSymbols.push({ symId: pointSymbolData!.compId, strokeNum: 3, mod1: LineStyleDefinition.SymbolOptions.Center });
    strokePointData = LineStyleDefinition.Utils.createStrokePointComponent(imodel, { descr: name, lcId: strokePatternData.compId, symbols: lsSymbols });
    lsComponents.length = 0;
    lsComponents.push({ id: strokePointData.compId, type: strokePointData.compType });
    lsComponents.push({ id: strokePatternData.compId, type: strokePatternData.compType });
    compoundData = LineStyleDefinition.Utils.createCompoundComponent(imodel, { comps: lsComponents });
    compoundData.unitDef = unitDef;
    styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.dictionaryId, name, compoundData);
    assert.isTrue(Id64.isValidId64(styleId));

    // Expect range padded by 0.5 (circle radius)......
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId));
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.5));

    // Expect range padded by 0.5 (unscaled circle radius)...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ scale: 0.5 })), ColorDef.red);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.5));

    // Expect range padded by 0.75 (width override > unscaled symbol size)...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ startWidth: 0.75, scale: 0.5, physicalWidth: true })), ColorDef.green);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.75));

    // LineStyleDefinition: create scaling point symbol with offsets with stroke pattern with width and unit scale specified in definition...
    x = 0.0;
    y++;
    unitDef = 0.5;
    widthDef = 0.025; // value used for lsStrokes...
    name = `OffsetPointSymbol-${unitDef}-${widthDef}}`;
    strokePatternData = LineStyleDefinition.Utils.createStrokePatternComponent(imodel, { descr: name, strokes: lsStrokes });
    pointSymbolData = LineStyleDefinition.Utils.createPointSymbolComponent(imodel, { geomPartId: partId, scale: 2.0 });
    lsSymbols.length = 0;
    lsSymbols.push({ symId: pointSymbolData!.compId, strokeNum: 1, mod1: LineStyleDefinition.SymbolOptions.Center, yOffset: -0.1 });
    lsSymbols.push({ symId: pointSymbolData!.compId, strokeNum: 3, mod1: LineStyleDefinition.SymbolOptions.Center, yOffset: 0.1 });
    strokePointData = LineStyleDefinition.Utils.createStrokePointComponent(imodel, { descr: name, lcId: strokePatternData.compId, symbols: lsSymbols });
    lsComponents.length = 0;
    lsComponents.push({ id: strokePointData.compId, type: strokePointData.compType });
    lsComponents.push({ id: strokePatternData.compId, type: strokePatternData.compType });
    compoundData = LineStyleDefinition.Utils.createCompoundComponent(imodel, { comps: lsComponents });
    compoundData.unitDef = unitDef;
    styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.dictionaryId, name, compoundData);
    assert.isTrue(Id64.isValidId64(styleId));

    // Expect range padded by 0.225 (offset symbol and unit scaled circle radius)......
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId));
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.225));

    // Expect range padded by 0.1125 (offset symbol and modifier scaled circle radius)...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ scale: 0.5 })), ColorDef.red);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.1125));

    // Expect range padded by 0.75 (width override > symbol and modifier scaled symbol size)...
    newId = createStyledLineElem(imodel, seedElement, x++, y, 1.0, new LineStyle.Info(styleId, new LineStyle.Modifier({ startWidth: 0.75, scale: 0.5, physicalWidth: true })), ColorDef.green);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    assert.isTrue(Geometry.isSameCoordinate(Placement3d.fromJSON(imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true }).placement).bbox.yLength(), 0.75));
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

    const usageInfo = imodel[_nativeDb].queryDefinitionElementUsage([partId])!;
    assert.isTrue(usageInfo.geometryPartIds!.includes(partId));
    assert.isTrue(usageInfo.usedIds!.includes(partId));
  });

  it("create GeometricElement3d from world coordinate text using a newly added font", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const foundFont = imodel.fontMap.getFont("Vera");
    assert.exists(foundFont);

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(45, 0, 0);
    const builder = new GeometryStreamBuilder();

    builder.setLocalToWorld3d(testOrigin, testAngles); // Establish world to local transform...

    const textProps: TextStringProps = {
      text: "ABC",
      font: foundFont!.id,
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
    const newId = imodel.elements.insertElement(testElem.toJSON());
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
    const partId = imodel.elements.insertElement(testPart.toJSON());
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

    const usageInfo = imodel[_nativeDb].queryDefinitionElementUsage([partId])!;
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
    const newId = imodel.elements.insertElement(testElem.toJSON());
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
    const partId = imodel.elements.insertElement(testPart.toJSON());
    imodel.saveChanges();

    const builder = new GeometryStreamBuilder();
    const shapePts: Point3d[] = [Point3d.create(1, 1, 0), Point3d.create(2, 1, 0), Point3d.create(2, 2, 0), Point3d.create(1, 2, 0)];
    const testOrigin = Point3d.create(0.5, 0.5, 0);
    const testAngles = YawPitchRollAngles.createDegrees(45, 0, 0);

    builder.setLocalToWorld3d(testOrigin, testAngles);
    builder.appendGeometry(Loop.create(LineString3d.create(shapePts)));
    shapePts.forEach((pt) => builder.appendGeometryPart3d(partId, pt, undefined, 0.25)); // Position part (arc center) at each vertex...

    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles }, builder.geometryStream);
    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem.toJSON());
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
    const newId = imodel.elements.insertElement(testElem.toJSON());
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
      const partId = imodel.elements.insertElement(part.toJSON());
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
    assert(IModelStatus.Success === doElementGeometryValidate(imodel, "0x1d", expected, false));
  });

  it("create GeometricElement3d from local coordinate point and arc primitive flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });

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

    elementProps.elementGeometryBuilderParams = { entryArray: newEntries };
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    assert(IModelStatus.Success === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
  });

  it("create GeometricElement3d from local coordinate interpolation curve flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });

    const pts: Point3d[] = [];
    pts.push(Point3d.create(5, 10, 0));
    pts.push(Point3d.create(10, 10, 0));
    pts.push(Point3d.create(10, 15, 0));
    pts.push(Point3d.create(5, 15, 0));

    const expected: ExpectedElementGeometryEntry[] = [];
    const newEntries: ElementGeometryDataEntry[] = [];

    const interpolationProps: InterpolationCurve3dProps = { fitPoints: pts, closed: false, isChordLenKnots: 1, isColinearTangents: 1 };
    const interpolationOpts = InterpolationCurve3dOptions.create(interpolationProps);
    const interpolationCurve = InterpolationCurve3d.createCapture(interpolationOpts);
    assert.isDefined(interpolationCurve);

    const entry1 = ElementGeometry.fromGeometryQuery(interpolationCurve!);
    assert.exists(entry1);
    newEntries.push(entry1!);
    expected.push({ opcode: ElementGeometryOpcode.CurvePrimitive, geometryCategory: "curvePrimitive" });

    elementProps.elementGeometryBuilderParams = { entryArray: newEntries };
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    assert(IModelStatus.Success === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
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
    let timer = new Timer("elementGeometryInsert");
    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    elementProps.elementGeometryBuilderParams = { entryArray: builder.entries };

    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
    timer.end();

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
    const status = imodel.elementGeometryRequest({ onGeometry, elementId: newId });
    timer.end();
    assert.isTrue(IModelStatus.Success === status);
  });

  it("create GeometricElement3d from local coordinate brep flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });

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

    elementProps.elementGeometryBuilderParams = { entryArray: newEntries };
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    assert(IModelStatus.Success === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
    assert(IModelStatus.Success === doElementGeometryValidate(imodel, newId, expectedFacet, false, undefined, 1));
    assert(IModelStatus.Success === doElementGeometryValidate(imodel, newId, expectedSkip, false, undefined, 2));
  });

  it("apply world coordinate transform directly to brep flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });

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

    elementProps.elementGeometryBuilderParams = { entryArray: newEntries };
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    assert(IModelStatus.Success === doElementGeometryValidate(imodel, newId, expectedFacet, false, undefined, 1));
  });

  it("test BRep entity transform", async () => {
    const localToWorld = Transform.createOriginAndMatrix(Point3d.create(5, 10, 0), YawPitchRollAngles.createDegrees(0, 0, 0).toMatrix3d());
    const worldToLocal = localToWorld.inverse()!;

    // Specify an entity transform that won't have translation/rotation fully cancelled out by placement...
    const brepProps = createBRepDataProps(Point3d.create(15, 25, 5), YawPitchRollAngles.createDegrees(90, 0, 0));
    const brepEntry = ElementGeometry.fromBRep(brepProps, worldToLocal);
    assert.exists(brepEntry);

    const brepToWorldExpected = Transform.fromJSON(brepProps.transform);
    const brepToLocalExpected = worldToLocal.multiplyTransformTransform(brepToWorldExpected);

    // Check for expected brep to local transform...
    const brepPropsLocal = ElementGeometry.toBRep(brepEntry!, false);
    assert.exists(brepPropsLocal);
    const brepToLocal = Transform.fromJSON(brepPropsLocal!.transform);
    assert.isTrue(brepToLocalExpected.isAlmostEqual(brepToLocal));

    // Check for expected brep to world transform...
    const brepPropsWorld = ElementGeometry.toBRep(brepEntry!, false, localToWorld);
    assert.exists(brepPropsWorld);
    const brepToWorld = Transform.fromJSON(brepPropsWorld!.transform);
    assert.isTrue(brepToWorldExpected.isAlmostEqual(brepToWorld));

    // Ensure that applying transform directly to flat buffer data produces same result...
    ElementGeometry.transformBRep(brepEntry!, localToWorld);

    const brepPropsWorld2 = ElementGeometry.toBRep(brepEntry!, false);
    assert.exists(brepPropsWorld2);
    const brepToWorld2 = Transform.fromJSON(brepPropsWorld2!.transform);
    assert.isTrue(brepToWorldExpected.isAlmostEqual(brepToWorld2));

    // Check json format geometry stream...
    const builder = new GeometryStreamBuilder();
    builder.setLocalToWorld(localToWorld);
    builder.appendBRepData(brepProps);

    const itLocal = new GeometryStreamIterator(builder.geometryStream);
    for (const entry of itLocal) {
      assertTrue(entry.primitive.type === "brep");
      const brepToLocalGSB = Transform.fromJSON(entry.primitive.brep.transform);
      assert.isTrue(brepToLocalExpected.isAlmostEqual(brepToLocalGSB));
    }

    const itWorld = new GeometryStreamIterator(builder.geometryStream, undefined, localToWorld);
    for (const entry of itWorld) {
      assertTrue(entry.primitive.type === "brep");
      const brepToWorldGSB = Transform.fromJSON(entry.primitive.brep.transform);
      assert.isTrue(brepToWorldExpected.isAlmostEqual(brepToWorldGSB));
    }
  });

  it("create GeometricElement3d from local coordinate text string flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const foundFont = imodel.fontMap.getFont("Vera");
    assert.exists(foundFont);

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });

    const expected: ExpectedElementGeometryEntry[] = [];
    const newEntries: ElementGeometryDataEntry[] = [];

    const textProps: TextStringProps = {
      text: "ABC",
      font: foundFont!.id,
      height: 2,
      bold: true,
      origin: testOrigin,
      rotation: testAngles,
    };

    const glyphData: TextStringGlyphData = {
      glyphIds: [1, 2, 3],
      glyphOrigins: [new Point2d(0.0, 0.0), new Point2d(1000.0, 0.0), new Point2d(2000.0, 0.0)],
      range: new Range2d(0, 0, 10, 30),
    };

    const entry = ElementGeometry.fromTextString(textProps, undefined, glyphData);
    assert.exists(entry);
    newEntries.push(entry!);
    // We can't validate glyph data later from the TextString in the DB because the native TextString will re-compute them if the font isn't embedded.
    // So, just verify that we are passing the correct flatbuffer here.
    assert.deepEqual(entry ? ElementGeometry.toTextStringGlyphData(entry) : undefined, glyphData);
    expected.push({ opcode: ElementGeometryOpcode.TextString, originalEntry: entry });

    elementProps.elementGeometryBuilderParams = { entryArray: newEntries };
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    assert(IModelStatus.Success === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
  });

  it("create GeometricElement3d from local coordinate image flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });

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

    elementProps.elementGeometryBuilderParams = { entryArray: newEntries };
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    assert(IModelStatus.Success === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
  });

  it("create GeometricElement3d with sub-graphic ranges flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });

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

    elementProps.elementGeometryBuilderParams = { entryArray: newEntries };
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    assert(IModelStatus.Success === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
  });

  it("create GeometricElement3d with part reference flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const partProps = createGeometryPartProps();
    const expectedPart: ExpectedElementGeometryEntry[] = [];
    const newPartEntries: ElementGeometryDataEntry[] = [];

    const entryAR = ElementGeometry.fromGeometryQuery(Arc3d.createXY(Point3d.createZero(), 2.5));
    assert.exists(entryAR);
    newPartEntries.push(entryAR!);
    expectedPart.push({ opcode: ElementGeometryOpcode.ArcPrimitive, geometryCategory: "curvePrimitive", geometrySubCategory: "arc" });

    partProps.elementGeometryBuilderParams = { entryArray: newPartEntries };
    const partId = imodel.elements.insertElement(partProps);
    assert.isTrue(Id64.isValidId64(partId));
    imodel.saveChanges();

    assert(IModelStatus.Success === doElementGeometryValidate(imodel, partId, expectedPart, false));

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });

    const expected: ExpectedElementGeometryEntry[] = [];
    const newEntries: ElementGeometryDataEntry[] = [];
    const partToElement = Transform.createIdentity();

    const entryPI = ElementGeometry.fromGeometryPart(partId);
    assert.exists(entryPI);
    ElementGeometry.toGeometryPart(entryPI!, partToElement);
    assert.isTrue(partToElement.isIdentity);
    newEntries.push(entryPI!);
    expected.push({ opcode: ElementGeometryOpcode.PartReference, originalEntry: entryPI });

    const transPT = Transform.createTranslation(Point3d.create(5, 5, 0));
    const entryPT = ElementGeometry.fromGeometryPart(partId, transPT);
    assert.exists(entryPT);
    ElementGeometry.toGeometryPart(entryPT!, partToElement);
    assert.isTrue(partToElement.isAlmostEqual(transPT));
    newEntries.push(entryPT!);
    expected.push({ opcode: ElementGeometryOpcode.PartReference, originalEntry: entryPT });

    const transPR = Transform.createOriginAndMatrix(testOrigin, testAngles.toMatrix3d());
    const entryPR = ElementGeometry.fromGeometryPart(partId, transPR);
    assert.exists(entryPR);
    ElementGeometry.toGeometryPart(entryPR!, partToElement);
    assert.isTrue(partToElement.isAlmostEqual(transPR));
    newEntries.push(entryPR!);
    expected.push({ opcode: ElementGeometryOpcode.PartReference, originalEntry: entryPR });

    const transPS = Transform.createScaleAboutPoint(testOrigin, 2);
    const entryPS = ElementGeometry.fromGeometryPart(partId, transPS);
    assert.exists(entryPS);
    ElementGeometry.toGeometryPart(entryPS!, partToElement);
    assert.isTrue(partToElement.isAlmostEqual(transPS));
    newEntries.push(entryPS!);
    expected.push({ opcode: ElementGeometryOpcode.PartReference, originalEntry: entryPS });

    const transPA = transPR.multiplyTransformTransform(transPS);
    const entryPA = ElementGeometry.fromGeometryPart(partId, transPA);
    assert.exists(entryPA);
    ElementGeometry.toGeometryPart(entryPA!, partToElement);
    assert.isTrue(partToElement.isAlmostEqual(transPA));
    newEntries.push(entryPA!);
    expected.push({ opcode: ElementGeometryOpcode.PartReference, originalEntry: entryPA });

    elementProps.elementGeometryBuilderParams = { entryArray: newEntries };
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    assert(IModelStatus.Success === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
  });

  it("create GeometricElement3d with appearance flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });

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

    elementProps.elementGeometryBuilderParams = { entryArray: newEntries };
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    assert(IModelStatus.Success === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
  });

  it("create GeometricElement3d with pattern flatbuffer data", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });

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

    elementProps.elementGeometryBuilderParams = { entryArray: newEntries };
    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();

    assert(IModelStatus.Success === doElementGeometryValidate(imodel, newId, expected, false, elementProps));
  });

  it("should transform PatternParams", () => {
    const offset = Point3d.create(1, 1, 1);
    const rotation = YawPitchRollAngles.createDegrees(45, 45, 45);
    const t = Transform.createOriginAndMatrix(offset, rotation.toMatrix3d());

    const pattern = new AreaPattern.Params();
    pattern.origin = Point3d.createZero();
    pattern.rotation = YawPitchRollAngles.createDegrees(0, 0, 0);
    pattern.applyTransform(t);
    expect(pattern.origin.isAlmostEqual(offset)).true;
    expect(pattern.rotation.isAlmostEqual(rotation)).true;
  });

  it("should insert elements and parts with binary geometry stream", () => {
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");

    const pts: Point3d[] = [];
    pts.push(Point3d.create(5, 10, 0));
    pts.push(Point3d.create(10, 10, 0));

    const entryLN = ElementGeometry.fromGeometryQuery(LineSegment3d.create(pts[0], pts[1]));
    assert.isTrue(entryLN !== undefined);

    const entryAR = ElementGeometry.fromGeometryQuery(Arc3d.createXY(pts[0], pts[0].distance(pts[1])));
    assert.exists(entryAR);

    // ------------------
    // GeometricElement3d
    // ------------------

    //    Insert

    const elemProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      // geom: geomBuilder.geometryStream,
      elementGeometryBuilderParams: { entryArray: [entryLN!], viewIndependent: false },
    };

    const spatialElementId = imodel.elements.insertElement(elemProps);

    let persistentProps = imodel.elements.getElementProps<GeometricElementProps>({ id: spatialElementId, wantGeometry: true });
    assert.isDefined(persistentProps.geom);
    assert.isTrue(persistentProps.placement !== undefined);
    assert.deepEqual(Point3d.fromJSON(persistentProps.placement!.origin), Point3d.create(0, 0, 0));
    assert.deepEqual(Point3d.fromJSON(persistentProps.placement!.bbox!.low), Point3d.create(5, 10, 0));
    assert.deepEqual(Point3d.fromJSON(persistentProps.placement!.bbox!.high), Point3d.create(10, 10, 0));

    for (const entry of new GeometryStreamIterator(persistentProps.geom!, persistentProps.category)) {
      assert.equal(entry.primitive.type, "geometryQuery");
      const geometry = (entry.primitive as GeometryPrimitive).geometry;
      assert.isTrue(geometry instanceof LineString3d);
      const ls: LineString3d = geometry as LineString3d;
      assert.deepEqual(ls.points, pts);
    }

    //    Insert - various failure cases
    elemProps.elementGeometryBuilderParams = { entryArray: [{ opcode: 9999 } as unknown as ElementGeometryDataEntry] };
    expect(() => imodel.elements.insertElement(elemProps)).to.throw(); // TODO: check error message

    elemProps.elementGeometryBuilderParams = { entryArray: [{ opcode: ElementGeometryOpcode.ArcPrimitive, data: undefined } as unknown as ElementGeometryDataEntry] };
    expect(() => imodel.elements.insertElement(elemProps)).to.throw(); // TODO: check error message

    //    Update
    persistentProps.elementGeometryBuilderParams = { entryArray: [entryAR!] };

    imodel.elements.updateElement(persistentProps);

    persistentProps = imodel.elements.getElementProps<GeometricElementProps>({ id: spatialElementId, wantGeometry: true });
    assert.isDefined(persistentProps.geom);
    assert.isTrue(persistentProps.placement !== undefined);
    assert.deepEqual(Point3d.fromJSON(persistentProps.placement!.origin), Point3d.create(0, 0, 0));
    assert.deepEqual(Point3d.fromJSON(persistentProps.placement!.bbox!.low), Point3d.create(0, 5, 0));
    assert.deepEqual(Point3d.fromJSON(persistentProps.placement!.bbox!.high), Point3d.create(10, 15, 0));

    for (const entry of new GeometryStreamIterator(persistentProps.geom!, persistentProps.category)) {
      assert.equal(entry.primitive.type, "geometryQuery");
      const geometry = (entry.primitive as GeometryPrimitive).geometry;
      assert.isTrue(geometry instanceof Arc3d);
      const ar: Arc3d = geometry as Arc3d;
      assert.deepEqual(ar.center, pts[0]);
    }

    // ---------------
    // Geometry part
    // ---------------

    //    Insert
    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      elementGeometryBuilderParams: { entryArray: [entryLN!], is2dPart: false },
    };

    const partId = imodel.elements.insertElement(partProps);

    let persistentPartProps = imodel.elements.getElementProps<GeometryPartProps>({ id: partId, wantGeometry: true });
    assert.isDefined(persistentPartProps.geom);

    for (const entry of new GeometryStreamIterator(persistentPartProps.geom!)) {
      assert.equal(entry.primitive.type, "geometryQuery");
      const geometry = (entry.primitive as GeometryPrimitive).geometry;
      assert.isTrue(geometry instanceof LineString3d);
      const ls: LineString3d = geometry as LineString3d;
      assert.deepEqual(ls.points, pts);
    }

    //    Update
    persistentPartProps.elementGeometryBuilderParams = { entryArray: [entryAR!] };

    imodel.elements.updateElement(persistentPartProps);

    persistentPartProps = imodel.elements.getElementProps<GeometryPartProps>({ id: partId, wantGeometry: true });
    assert.isDefined(persistentPartProps.geom);

    for (const entry of new GeometryStreamIterator(persistentPartProps.geom!)) {
      assert.equal(entry.primitive.type, "geometryQuery");
      const geometry = (entry.primitive as GeometryPrimitive).geometry;
      assert.isTrue(geometry instanceof Arc3d);
      const ar: Arc3d = geometry as Arc3d;
      assert.deepEqual(ar.center, pts[0]);
    }
  });

  it("create and update a GeometricElement3d to test clearing its geometry stream", async () => {
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const newId = createCircleElem(1.0, Point3d.create(5, 5, 0), YawPitchRollAngles.createDegrees(90, 0, 0), imodel, seedElement);
    imodel.saveChanges();

    const newElemProps = imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true });
    assert.isDefined(newElemProps.geom);
    assert.isTrue(newElemProps.placement !== undefined);

    newElemProps.elementGeometryBuilderParams = { entryArray: [] };
    imodel.elements.updateElement(newElemProps);
    imodel.saveChanges();

    const updateElemProps = imodel.elements.getElementProps<GeometricElement3dProps>({ id: newId, wantGeometry: true });
    assert.isUndefined(updateElemProps.geom);
    assert.isTrue(updateElemProps.placement !== undefined);
    const updatedPlacement = Placement3d.fromJSON(updateElemProps.placement);
    assert.isTrue(updatedPlacement.bbox.isNull);
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 2: Create flat spots on sides by intersecting with a cube (i.e. something more complex that a simple revolved solid)
    builder.appendGeometryQuery(Box.createRange(Range3d.create(Point3d.create(-4, -4, -5), Point3d.create(4, 4, 5)), true)!);

    createProps.operation = BRepGeometryOperation.Intersect;

    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 3: Create a hollow shell
    createProps.operation = BRepGeometryOperation.Hollow;
    createProps.parameters = { distance: -0.5 };

    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 4: Cut a small hole through the middle of the solid
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.createZero(), 1)));

    createProps.operation = BRepGeometryOperation.Cut;
    createProps.parameters = { bothDirections: true };

    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 5: Create a geometric element from the result solid
    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    elementProps.elementGeometryBuilderParams = { entryArray: builder.entries };

    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 2: Create a hollow shell
    createProps.operation = BRepGeometryOperation.Hollow;
    createProps.parameters = { distance: -0.5 };

    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 3: Use solid/sheet subtract to remove bottom half of solid (keep material in direction of surface normal)
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.createZero(), 10)));

    createProps.operation = BRepGeometryOperation.Subtract;
    createProps.parameters = undefined;

    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Step 4: Create a geometric element from the result solid
    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);
    const elementProps = createPhysicalElementProps(seedElement, { origin: testOrigin, angles: testAngles });
    elementProps.elementGeometryBuilderParams = { entryArray: builder.entries };

    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
  });

  it("create multiple GeometricElement3d from local coordinate disjoint body result test", async () => {
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
      const newId = createGeometricElemFromSeed(imodel, "0x1d", [entry], { origin: placement.origin, angles: placement.angles! });
      assert.isTrue(Id64.isValidId64(newId));
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    createProps.operation = BRepGeometryOperation.Subtract;
    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    createProps.operation = BRepGeometryOperation.Intersect;
    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Test creating cut through solid in both directions
    createProps.parameters = { bothDirections: true };

    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Test creating depth cut in solid in forward direction
    createProps.parameters = { distance: 1 };

    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Test creating depth cut in solid in both directions
    createProps.parameters = { distance: 1, bothDirections: true };

    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Test creating a pad on a solid
    builder.entries.length = 0;
    builder.appendGeometryQuery(Box.createRange(Range3d.create(Point3d.create(0, 0, -3), Point3d.create(5, 5, -2)), true)!);
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.create(2.5, 2.5, -1.5), 2)));

    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    // Test embossing a surface
    builder.entries.length = 0;
    builder.appendGeometryQuery(Loop.createPolygon([Point3d.create(0, 0, 0), Point3d.create(0, 5, 0), Point3d.create(5, 5, 0), Point3d.create(5, 0, 0), Point3d.create(0, 0, 0)]));
    builder.appendGeometryQuery(Loop.create(Arc3d.createXY(Point3d.create(2.5, 2.5, -0.5), 2, AngleSweep.createStartSweepDegrees(0, -360))));

    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    createProps.parameters = { backDistance: 0.25 };
    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
    } catch (error: any) {
      assert(false, error.message);
    }

    createProps.parameters = { frontDistance: 0.1, backDistance: 0.1 };
    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
      // NOTE: It is preferable to use ElementGeometry.Builder over GeometryStreamBuilder this is just for testing,
      const gsBuilder = new GeometryStreamBuilder();
      const brep = ElementGeometry.toBRep(info.entryArray[0], true);
      assert.exists(brep);
      gsBuilder.appendBRepData(brep!);

      const elementProps = createPhysicalElementProps(seedElement, { origin: Point3d.create(5, 10, 0), angles: YawPitchRollAngles.createDegrees(45, 0, 0) }, gsBuilder.geometryStream);
      const testElem = imodel.elements.createElement(elementProps);
      const newId = imodel.elements.insertElement(testElem.toJSON());
      imodel.saveChanges();

      // Extract and test value returned
      const value = imodel.elements.getElementProps<GeometricElementProps>({ id: newId, wantGeometry: true, wantBRepData: true });
      assert.isDefined(value.geom);

      const itLocal = new GeometryStreamIterator(value.geom!, value.category);
      for (const entry of itLocal) {
        assertTrue(entry.primitive.type === "brep");
      }
    };

    const createProps: BRepGeometryCreate = {
      operation: BRepGeometryOperation.Hollow,
      entryArray: builder.entries,
      onResult,
      parameters: { distance: 0.25 },
    };
    try {
      assert(IModelStatus.Success === imodel.createBRepGeometry(createProps));
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
    const newId = imodel.elements.insertElement(testElem.toJSON());
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
    const newId = imodel.elements.insertElement(testElem.toJSON());
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
    result.candidatesContainment!.forEach((val, index) => assert.isTrue(val === expectedContainment[index]));

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
    result.candidatesContainment!.forEach((val, index) => assert.isTrue(val === expectedContainment[index]));

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
    result.candidatesContainment!.forEach((val, index) => assert.isTrue(val === expectedContainment[index]));

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
    result.candidatesContainment!.forEach((val, index) => assert.isTrue(val === expectedContainmentDef[index]));
    assert.isTrue(1 === result.numInside);
    assert.isTrue(0 === result.numOutside);
    assert.isTrue(3 === result.numOverlap);

    const expectedContainmentSubCat: ClipPlaneContainment[] = [ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyOutside];

    requestProps.offSubCategories = [IModel.getDefaultSubCategoryId(seedElement.category)];
    result = await imodel.getGeometryContainment(requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainmentSubCat.length);
    result.candidatesContainment!.forEach((val, index) => assert.isTrue(val === expectedContainmentSubCat[index]));
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
    result.candidatesContainment!.forEach((val, index) => assert.isTrue(val === expectedContainmentViewFlags[index]));
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
    result.candidatesContainment!.forEach((val, index) => assert.isTrue(val === expectedContainment[index]));
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
    result.candidatesContainment!.forEach((val, index) => assert.isTrue(val === expectedContainment[index]));
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
    result.candidatesContainment!.forEach((val, index) => assert.isTrue(val === expectedContainment[index]));
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
    result.candidatesContainment!.forEach((val, index) => assert.isTrue(val === expectedContainment[index]));
  });

});
