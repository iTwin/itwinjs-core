/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BentleyStatus, DbResult, Id64, Id64String } from "@bentley/bentleyjs-core";
import { Angle, Arc3d, Box, ClipMaskXYZRangePlanes, ClipPlane, ClipPlaneContainment, ClipPrimitive, ClipShape, ClipVector, ConvexClipPlaneSet, Geometry, LineSegment3d, LineString3d, Loop, Plane3dByOriginAndUnitNormal, Point2d, Point3d, Range3d, Sphere, Transform, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { AreaPattern, BackgroundFill, BRepEntity, Code, ColorByName, ColorDef, FillDisplay, FontProps, FontType, GeometricElement3dProps, GeometricElementProps, GeometryClass, GeometryContainmentRequestProps, GeometryParams, GeometryPartProps, GeometryStreamBuilder, GeometryStreamFlags, GeometryStreamIterator, GeometryStreamProps, Gradient, IModel, LinePixels, LineStyle, MassPropertiesOperation, MassPropertiesRequestProps, PhysicalElementProps, Placement3dProps, TextString, TextStringProps, ViewFlags } from "@bentley/imodeljs-common";
import { assert, expect } from "chai";
import { BackendRequestContext, ExportGraphics, ExportGraphicsInfo, ExportGraphicsMeshVisitor, ExportGraphicsOptions, GeometricElement, GeometryPart, LineStyleDefinition, PhysicalObject, Platform, SnapshotDb } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";

function assertTrue(expr: boolean): asserts expr {
  assert.isTrue(expr);
}

function createGeometryPart(geom: GeometryStreamProps, imodel: SnapshotDb): Id64String {
  const partProps: GeometryPartProps = {
    classFullName: GeometryPart.classFullName,
    model: IModel.dictionaryId,
    code: Code.createEmpty(),
    geom,
  };
  return imodel.elements.insertElement(partProps);
}

function createGeometricElem(geom: GeometryStreamProps, placement: Placement3dProps, imodel: SnapshotDb, seedElement: GeometricElement): Id64String {
  const elementProps: PhysicalElementProps = {
    classFullName: PhysicalObject.classFullName,
    model: seedElement.model,
    category: seedElement.category,
    code: Code.createEmpty(),
    geom,
    placement,
  };
  const el = imodel.elements.createElement<GeometricElement>(elementProps);
  return imodel.elements.insertElement(el);
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

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
    };

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

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
    };

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

    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };

    const partId = imodel.elements.insertElement(partProps);
    assert.isTrue(Id64.isValidId64(partId));

    const pointSymbolData = LineStyleDefinition.Utils.createPointSymbolComponent(imodel, { geomPartId: partId }); // base and size will be set automatically...
    assert.isTrue(undefined !== pointSymbolData);

    // Use internal default instead of creating a stroke component for a solid line
    const strokePointData = LineStyleDefinition.Utils.createStrokePointComponent(imodel, { descr: "TestArrowHead", lcId: 0, lcType: LineStyleDefinition.ComponentType.Internal, symbols: [{ symId: pointSymbolData!.compId, strokeNum: -1, mod1: LineStyleDefinition.SymbolOptions.CurveEnd }] });
    assert.isTrue(undefined !== strokePointData);

    const compoundData = LineStyleDefinition.Utils.createCompoundComponent(imodel, { comps: [{ id: strokePointData!.compId, type: strokePointData!.compType }, { id: 0, type: LineStyleDefinition.ComponentType.Internal }] });
    assert.isTrue(undefined !== compoundData);

    const styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.dictionaryId, "TestArrowStyle", compoundData!);
    assert.isTrue(Id64.isValidId64(styleId));

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    params.styleInfo = new LineStyle.Info(styleId);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometry(LineSegment3d.create(Point3d.createZero(), Point3d.create(-1, -1, 0)));

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
    };

    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
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

    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };

    const partId = imodel.elements.insertElement(partProps);
    assert.isTrue(Id64.isValidId64(partId));

    const pointSymbolData = LineStyleDefinition.Utils.createPointSymbolComponent(imodel, { geomPartId: partId }); // base and size will be set automatically...
    assert.isTrue(undefined !== pointSymbolData);

    const lsSymbols: LineStyleDefinition.Symbols = [];
    lsSymbols.push({ symId: pointSymbolData!.compId, strokeNum: 1, mod1: LineStyleDefinition.SymbolOptions.Center });
    lsSymbols.push({ symId: pointSymbolData!.compId, strokeNum: 3, mod1: LineStyleDefinition.SymbolOptions.Center });

    const strokePointData = LineStyleDefinition.Utils.createStrokePointComponent(imodel, { descr: "TestGapSymbolsLinePoint", lcId: strokePatternData!.compId, symbols: lsSymbols });
    assert.isTrue(undefined !== strokePointData);

    const lsComponents: LineStyleDefinition.Components = [];
    lsComponents.push({ id: strokePointData!.compId, type: strokePointData!.compType });
    lsComponents.push({ id: strokePatternData!.compId, type: strokePatternData!.compType });

    const compoundData = LineStyleDefinition.Utils.createCompoundComponent(imodel, { comps: lsComponents });
    assert.isTrue(undefined !== compoundData);

    const styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.dictionaryId, "TestDashCircleDotCircleDashStyle", compoundData!);
    assert.isTrue(Id64.isValidId64(styleId));

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    params.styleInfo = new LineStyle.Info(styleId);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometry(LineSegment3d.create(Point3d.createZero(), Point3d.create(5, 5, 0)));

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
    };

    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(Id64.isValidId64(newId));
    imodel.saveChanges();
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

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
    };

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

    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };

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

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
    };

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
    } catch (error) {
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

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
      placement: { origin: testOrigin, angles: testAngles },
    };

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

    const itWorld = GeometryStreamIterator.fromGeometricElement3d(value);
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

    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };

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

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
    };

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

    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };

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

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
      placement: { origin: testOrigin, angles: testAngles },
    };

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

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
    };

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
    // Currently parasolid limited to windows...
    if ("win32" !== Platform.platformName)
      return;

    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(45, 0, 0);
    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    //    builder.setLocalToWorld3d(testOrigin, testAngles); // Establish world to local transform...

    params.lineColor = ColorDef.red;
    params.weight = 2;
    builder.appendGeometryParamsChange(params);

    // This brep has a face symbology attribute attached to one face, make it green.
    const faceSymb: BRepEntity.FaceSymbologyProps[] = [
      { color: params.lineColor.toJSON() }, // base symbology should match appearance...
      { color: ColorDef.green.toJSON(), transparency: 0.5 },
    ];

    const brepProps: BRepEntity.DataProps = {
      data: "encoding=base64;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",
      faceSymbology: faceSymb,
      transform: Transform.createOriginAndMatrix(testOrigin, testAngles.toMatrix3d()).toJSON(),
    };

    builder.appendBRepData(brepProps);

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
      //      placement: { origin: testOrigin, angles: testAngles },
    };

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

  it("should preserve header with flags", () => {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Arc3d.createXY(Point3d.create(0, 0), 5));

    const roundTrip = () => {
      const iter = new GeometryStreamIterator(builder.geometryStream);
      expect((iter.flags === GeometryStreamFlags.ViewIndependent)).to.equal(builder.isViewIndependent);

      const partProps: GeometryPartProps = {
        classFullName: GeometryPart.classFullName,
        model: IModel.dictionaryId,
        code: Code.createEmpty(),
        geom: builder.geometryStream,
      };

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

describe("exportGraphics", () => {
  let imodel: SnapshotDb;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("GeometryStream", "GeometryStreamTest.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => {
    imodel.close();
  });

  it("converts to IndexedPolyface", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const box = Box.createRange(Range3d.create(Point3d.createZero(), Point3d.create(1.0, 1.0, 1.0)), true);
    assert.isFalse(undefined === box);

    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(box!);

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
    };

    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const infos: ExportGraphicsInfo[] = [];
    const onGraphics = (info: ExportGraphicsInfo) => {
      infos.push(info);
    };
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [newId],
      onGraphics,
    };

    const exportStatus = imodel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 1);
    assert.strictEqual(infos[0].color, ColorDef.white.tbgr);
    assert.strictEqual(infos[0].mesh.indices.length, 36);
    assert.strictEqual(infos[0].elementId, newId);
    const polyface = ExportGraphics.convertToIndexedPolyface(infos[0].mesh);
    assert.strictEqual(polyface.facetCount, 12);
    assert.strictEqual(polyface.data.pointCount, 24);
    assert.strictEqual(polyface.data.normalCount, 24);
    assert.strictEqual(polyface.data.paramCount, 24);
  });

  //
  //
  //    2---3      6
  //    | \ |     | \
  //    0---1    4---5
  //
  it("ExportMeshGraphicsVisitor", async () => {
    const numPoints = 7;
    const numFacets = 3;
    const pointData = [0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 2, 0, 2, 0, 0, 4, 0, 0, 3, 2, 0];
    const paramData = [0, 0, 1, 0, 0, 2, 1, 2, 2, 0, 4, 0, 3, 2];
    const normalData = new Float32Array(pointData.length);
    const a0 = 2.0;
    const a1 = 3.0;
    const b0 = -2.0;
    const b1 = 5.0;
    // make normals functionally related to point coordinates . . . not good normals, but good for tests
    let paramCursor = 0;
    for (let i = 0; i < pointData.length; i++) {
      normalData[i] = a1 * pointData[i] + a0;
      if ((i + 1) % 3 !== 0)
        paramData[paramCursor++] = b0 + b1 * pointData[i];
    }
    const smallMesh = {
      points: new Float64Array(pointData),
      params: new Float32Array(paramData),
      // normals have one-based index as z ..
      normals: new Float32Array(normalData),
      indices: new Int32Array([0, 1, 2, 2, 1, 3, 4, 5, 6]),
      isTwoSided: true,
    };
    const knownArea = 4.0;
    assert.isTrue(smallMesh.points.length === 3 * numPoints);
    assert.isTrue(smallMesh.normals.length === 3 * numPoints);
    assert.isTrue(smallMesh.params.length === 2 * numPoints);
    assert.isTrue(smallMesh.indices.length === 3 * numFacets);
    const visitor = ExportGraphicsMeshVisitor.create(smallMesh, 0);
    assert.isDefined(visitor.paramIndex, "paramIndex defined");
    assert.isDefined(visitor.paramIndex, "paramIndex defined");
    let numFacetsA = 0;
    let indexCursor = 0;
    let areaSum = 0.0;
    while (visitor.moveToNextFacet()) {
      numFacetsA++;
      assert.isTrue(visitor.point.length === 3);
      assert.isTrue(smallMesh.indices[indexCursor] === visitor.pointIndex[0]);
      assert.isTrue(smallMesh.indices[indexCursor + 1] === visitor.pointIndex[1]);
      assert.isTrue(smallMesh.indices[indexCursor + 2] === visitor.pointIndex[2]);
      const areaVector = visitor.point.crossProductIndexIndexIndex(0, 1, 2)!;
      areaSum += areaVector.magnitude() * 0.5;
      assert.isTrue(smallMesh.indices[indexCursor] === visitor.paramIndex![0]);
      assert.isTrue(smallMesh.indices[indexCursor + 1] === visitor.paramIndex![1]);
      assert.isTrue(smallMesh.indices[indexCursor + 2] === visitor.paramIndex![2]);
      assert.isTrue(smallMesh.indices[indexCursor] === visitor.normalIndex![0]);
      assert.isTrue(smallMesh.indices[indexCursor + 1] === visitor.normalIndex![1]);
      assert.isTrue(smallMesh.indices[indexCursor + 2] === visitor.normalIndex![2]);
      for (let k = 0; k < 3; k++) {
        const point = visitor.point.getPoint3dAtUncheckedPointIndex(k);
        const normal = visitor.normal!.getPoint3dAtUncheckedPointIndex(k);
        const param = visitor.param!.getPoint2dAtUncheckedPointIndex(k);
        for (let j = 0; j < 3; j++) {
          assert.isTrue(a0 + a1 * point.at(j) === normal.at(j));
        }
        for (let j = 0; j < 2; j++) {
          assert.isTrue(b0 + b1 * point.at(j) === (j === 0 ? param.x : param.y));
        }
      }
      indexCursor += 3;
    }
    assert.isTrue(Math.abs(knownArea - areaSum) < 1.0e-13);
    assert.isTrue(numFacetsA === numFacets, "facet count");
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

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
    };

    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const requestProps: MassPropertiesRequestProps = {
      operation: MassPropertiesOperation.AccumulateVolumes,
      candidates: [newId],
    };

    const requestContext = new BackendRequestContext();
    const result = await imodel.getMassProperties(requestContext, requestProps);
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

    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      geom: builder.geometryStream,
    };

    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    const requestProps: MassPropertiesRequestProps = {
      operation: MassPropertiesOperation.AccumulateAreas,
      candidates: [newId],
    };

    const requestContext = new BackendRequestContext();
    const result = await imodel.getMassProperties(requestContext, requestProps);
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

    const requestContext = new BackendRequestContext();
    let result = await imodel.getGeometryContainment(requestContext, requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(2 === result.numInside);
    assert.isTrue(2 === result.numOutside);
    assert.isTrue(2 === result.numOverlap);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainment[index]); });

    requestProps.allowOverlaps = false; // test inside mode...
    result = await imodel.getGeometryContainment(requestContext, requestProps);

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

    const requestContext = new BackendRequestContext();
    let result = await imodel.getGeometryContainment(requestContext, requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(2 === result.numInside);
    assert.isTrue(2 === result.numOutside);
    assert.isTrue(2 === result.numOverlap);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainment[index]); });

    requestProps.allowOverlaps = false; // test inside mode...
    result = await imodel.getGeometryContainment(requestContext, requestProps);

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

    const requestContext = new BackendRequestContext();
    let result = await imodel.getGeometryContainment(requestContext, requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(4 === result.numInside);
    assert.isTrue(4 === result.numOutside);
    assert.isTrue(4 === result.numOverlap);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainment[index]); });

    requestProps.allowOverlaps = false; // test inside mode...
    result = await imodel.getGeometryContainment(requestContext, requestProps);

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

    const requestContext = new BackendRequestContext();
    let result = await imodel.getGeometryContainment(requestContext, requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainmentDef.length);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainmentDef[index]); });
    assert.isTrue(1 === result.numInside);
    assert.isTrue(0 === result.numOutside);
    assert.isTrue(3 === result.numOverlap);

    const expectedContainmentSubCat: ClipPlaneContainment[] = [ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyOutside];

    requestProps.offSubCategories = [IModel.getDefaultSubCategoryId(seedElement.category)];
    result = await imodel.getGeometryContainment(requestContext, requestProps);

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
    result = await imodel.getGeometryContainment(requestContext, requestProps);

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

    const requestContext = new BackendRequestContext();
    const result = await imodel.getGeometryContainment(requestContext, requestProps);

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

    const requestContext = new BackendRequestContext();
    const result = await imodel.getGeometryContainment(requestContext, requestProps);

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

    const requestContext = new BackendRequestContext();
    const result = await imodel.getGeometryContainment(requestContext, requestProps);

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

    const requestContext = new BackendRequestContext();
    const result = await imodel.getGeometryContainment(requestContext, requestProps);

    assert.isTrue(BentleyStatus.SUCCESS === result.status && undefined !== result.candidatesContainment);
    assert.isTrue(result.candidatesContainment?.length === expectedContainment.length);
    assert.isTrue(1 === result.numInside);
    assert.isTrue(1 === result.numOutside);
    assert.isTrue(1 === result.numOverlap);
    result.candidatesContainment!.forEach((val, index) => { assert.isTrue(val === expectedContainment[index]); });
  });
});
