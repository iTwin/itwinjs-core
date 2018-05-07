/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Point3d, YawPitchRollAngles, Arc3d, IModelJson as GeomJson, LineSegment3d, LineString3d, Loop, Transform, Angle, Point2d } from "@bentley/geometry-core";
import { Id64 } from "@bentley/bentleyjs-core";
import {
  Code, GeometricElement3dProps, GeometryPartProps, IModel, GeometryStreamBuilder, TextString, TextStringProps, LinePixels, FontProps, FontType, FillDisplay, GeometryParams, LineStyle, ColorDef, BackgroundFill, Gradient, AreaPattern, ColorByName, GeometryStreamParser,
} from "@bentley/imodeljs-common";
import { IModelTestUtils } from "../IModelTestUtils";
import { GeometryPart, IModelDb, LineStyleDefinition, Platform } from "../../backend";

describe("GeometryStream", () => {
  let imodel: IModelDb;

  before(() => {
    imodel = IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
  });

  after(() => {
    IModelTestUtils.closeIModel(imodel);
  });

  it("create GeometricElement3d using line codes 1-7", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    // init line code to line pixels array
    const lsCodes: LinePixels[] = [LinePixels.Solid, LinePixels.Code1, LinePixels.Code2, LinePixels.Code3, LinePixels.Code4, LinePixels.Code5, LinePixels.Code6, LinePixels.Code7];

    // create new line style definitions for line codes 1-7
    const lsStyles: Id64[] = [];
    lsCodes.forEach((linePixels) => {
      lsStyles.push(LinePixels.Solid === linePixels ? new Id64() : LineStyleDefinition.Utils.getOrCreateLinePixelsStyle(imodel, IModel.dictionaryId, linePixels));
    });

    // get existing line style definitions for line codes 1-7
    const lsStylesExist: Id64[] = [];
    lsCodes.forEach((linePixels) => {
      lsStylesExist.push(LinePixels.Solid === linePixels ? new Id64() : LineStyleDefinition.Utils.getOrCreateLinePixelsStyle(imodel, IModel.dictionaryId, linePixels));
    });

    // make sure we found existing styles and didn't create a second set
    assert.isTrue(8 === lsStyles.length && lsStyles.length === lsStylesExist.length);
    for (let iStyle = 0; iStyle < lsStyles.length; ++iStyle) {
      assert.isTrue(0 === iStyle || lsStyles[iStyle].isValid());
      assert.isTrue(lsStylesExist[iStyle].equals(lsStyles[iStyle]));
    }

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    const pointS = Point3d.createZero();
    const pointE = Point3d.create(5, 0, 0);

    lsStyles.forEach((styleId) => {
      params.styleInfo = styleId.isValid() ? new LineStyle.Info(styleId) : undefined;
      builder.appendGeometryParamsChange(params);
      builder.appendGeometryQuery(LineSegment3d.create(pointS, pointE));
      pointS.y += 0.5; pointE.y += 0.5;
    });

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      userLabel: "UserLabel-" + 1,
      geom: builder.geometryStream,
    };

    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(newId.isValid());
    imodel.saveChanges();

    // Extract and test value returned...
    const value = imodel.elements.getElementProps({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    const itNextCheck = new GeometryStreamParser.Iterator(value.geom, value.category);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isFalse(itNextCheck.next().done);
    assert.isTrue(itNextCheck.next().done);

    const lsStylesUsed: Id64[] = [];
    const it = new GeometryStreamParser.Iterator(value.geom, value.category);
    for (const entry of it) {
      assert.isDefined(entry.geometryQuery);
      lsStylesUsed.push(entry.geomParams.styleInfo ? entry.geomParams.styleInfo.styleId : new Id64());
    }

    // Make sure we extracted same style information after round trip...
    assert.isTrue(lsStyles.length === lsStylesUsed.length);
    for (let iStyle = 0; iStyle < lsStyles.length; ++iStyle) {
      assert.isTrue(lsStylesUsed[iStyle].equals(lsStyles[iStyle]));
    }
  });

  it("create GeometricElement3d using continuous style", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    // create special "internal default" continuous style for drawing curves using width overrides
    const styleId = LineStyleDefinition.Utils.getOrCreateContinuousStyle(imodel, IModel.dictionaryId);
    assert.isTrue(styleId.isValid());

    // make sure we found existing style and didn't create a new one
    const styleIdExists = LineStyleDefinition.Utils.getOrCreateContinuousStyle(imodel, IModel.dictionaryId);
    assert.isTrue(styleIdExists.isValid() && styleIdExists.equals(styleId));

    // create continuous style with pre-defined constant width
    const styleIdWidth = LineStyleDefinition.Utils.getOrCreateContinuousStyle(imodel, IModel.dictionaryId, 0.05);
    assert.isTrue(styleIdWidth.isValid());

    // make sure we found existing style and didn't create a new one
    const styleIdWidthExists = LineStyleDefinition.Utils.getOrCreateContinuousStyle(imodel, IModel.dictionaryId, 0.05);
    assert.isTrue(styleIdWidthExists.isValid() && styleIdWidthExists.equals(styleIdWidth));

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    const styles: Id64[] = [styleId, styleId, styleIdWidth, styleIdWidth];
    const widths: number[] = [0.0, 0.025, 0.0, 0.075];

    // add line using 0 width continuous style
    params.styleInfo = new LineStyle.Info(styles[0]);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometryQuery(LineSegment3d.create(Point3d.create(0, 0, 0), Point3d.create(0, 5, 0)));

    // add line with width override, undefined endWidth = startWidth, needed soley for taper
    params.styleInfo.styleMod = new LineStyle.Modifier({ startWidth: widths[1], physicalWidth: true });
    builder.appendGeometryParamsChange(params);
    builder.appendGeometryQuery(LineSegment3d.create(Point3d.create(0.5, 0, 0), Point3d.create(0.5, 5, 0)));

    // add line using pre-defined width continuous style
    params.styleInfo = new LineStyle.Info(styles[2]);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometryQuery(LineSegment3d.create(Point3d.create(1.0, 0, 0), Point3d.create(1.0, 5, 0)));

    // add line with width override, undefined endWidth = startWidth, needed soley for taper
    params.styleInfo.styleMod = new LineStyle.Modifier({ startWidth: widths[3], physicalWidth: true });
    builder.appendGeometryParamsChange(params);
    builder.appendGeometryQuery(LineSegment3d.create(Point3d.create(1.5, 0, 0), Point3d.create(1.5, 5, 0)));

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      userLabel: "UserLabel-" + 1,
      geom: builder.geometryStream,
    };

    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(newId.isValid());
    imodel.saveChanges();

    // Extract and test value returned...
    const value = imodel.elements.getElementProps({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    const stylesUsed: Id64[] = [];
    const widthsUsed: number[] = [];
    const it = new GeometryStreamParser.Iterator(value.geom, value.category);
    for (const entry of it) {
      assert.isDefined(entry.geometryQuery);
      assert.isDefined(entry.geomParams.styleInfo);
      stylesUsed.push(entry.geomParams.styleInfo!.styleId);
      widthsUsed.push(entry.geomParams.styleInfo!.styleMod !== undefined ? entry.geomParams.styleInfo!.styleMod!.startWidth! : 0.0);
    }

    // Make sure we extracted same style information after round trip...
    assert.isTrue(styles.length === stylesUsed.length);
    for (let iStyle = 0; iStyle < styles.length; ++iStyle) {
      assert.isTrue(stylesUsed[iStyle].equals(styles[iStyle]));
      //      assert.isTrue(Geometry.isSameCoordinate(widthsUsed[iStyle], widths[iStyle])); <- styleMod missing when running full set of tests???
    }
  });

  it("create GeometricElement3d using arrow head style w/o using stroke pattern", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const partBuilder = new GeometryStreamBuilder();
    const partParams = new GeometryParams(new Id64()); // category won't be used

    partParams.fillDisplay = FillDisplay.Always;
    partBuilder.appendGeometryParamsChange(partParams);
    partBuilder.appendGeometryQuery(Loop.create(LineString3d.create(Point3d.create(0.1, 0, 0), Point3d.create(0, -0.05, 0), Point3d.create(0, 0.05, 0), Point3d.create(0.1, 0, 0))));

    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      iModel: imodel,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };

    const partId = imodel.elements.insertElement(partProps);
    assert.isTrue(partId.isValid());

    const pointSymbolData = LineStyleDefinition.Utils.createPointSymbolComponent(imodel, { geomPartId: partId }); // base and size will be set automatically...
    assert.isTrue(undefined !== pointSymbolData);

    // Use internal default instead of creating a stroke component for a solid line
    const strokePointData = LineStyleDefinition.Utils.createStrokePointComponent(imodel, { descr: "TestArrowHead", lcId: 0, lcType: LineStyleDefinition.ComponentType.Internal, symbols: [{ symId: pointSymbolData!.compId, strokeNum: -1, mod1: LineStyleDefinition.SymbolOptions.CurveEnd }] });
    assert.isTrue(undefined !== strokePointData);

    const compoundData = LineStyleDefinition.Utils.createCompoundComponent(imodel, { comps: [{ id: strokePointData!.compId, type: strokePointData!.compType }, { id: 0, type: LineStyleDefinition.ComponentType.Internal }] });
    assert.isTrue(undefined !== compoundData);

    const styleId = LineStyleDefinition.Utils.createStyle(imodel, IModel.dictionaryId, "TestArrowStyle", compoundData!);
    assert.isTrue(styleId.isValid());

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    params.styleInfo = new LineStyle.Info(styleId);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometryQuery(LineSegment3d.create(Point3d.createZero(), Point3d.create(-1, -1, 0)));

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      userLabel: "UserLabel-" + 1,
      geom: builder.geometryStream,
    };

    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(newId.isValid());
    imodel.saveChanges();
  });

  it("create GeometricElement3d using compound style with dash widths and symbol", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

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
    partBuilder.appendGeometryQuery(Arc3d.createXY(Point3d.createZero(), 0.05));

    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      iModel: imodel,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };

    const partId = imodel.elements.insertElement(partProps);
    assert.isTrue(partId.isValid());

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
    assert.isTrue(styleId.isValid());

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    params.styleInfo = new LineStyle.Info(styleId);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometryQuery(LineSegment3d.create(Point3d.createZero(), Point3d.create(5, 5, 0)));

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      userLabel: "UserLabel-" + 1,
      geom: builder.geometryStream,
    };

    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(newId.isValid());
    imodel.saveChanges();
  });

  it("create GeometricElement3d using shapes with fill/gradient", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    builder.appendGeometryRanges(); // Test inclusion of local ranges...

    const xOffset = Transform.createTranslation(Point3d.create(1.5));
    const shape = Loop.create(LineString3d.create(Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 1, 0), Point3d.create(0, 0, 0)));

    // No fill...
    params.lineColor = ColorDef.green;
    params.weight = 5;
    builder.appendGeometryParamsChange(params);
    builder.appendGeometryQuery(shape);

    // Opaque fill by view...
    params.fillDisplay = FillDisplay.ByView;
    params.fillColor = params.lineColor;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometryQuery(shape);

    // Outline fill by view...
    params.fillColor = ColorDef.red;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometryQuery(shape);

    // Outline transparency fill always...
    params.fillDisplay = FillDisplay.Always;
    params.fillTransparency = 0.75;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometryQuery(shape);

    // Opaque background fill always...
    params.backgroundFill = BackgroundFill.Solid;
    params.fillTransparency = 0.0;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometryQuery(shape);

    // Outline background fill always...
    params.backgroundFill = BackgroundFill.Outline;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometryQuery(shape);

    // Opaque gradient by view...
    params.fillDisplay = FillDisplay.ByView;
    params.gradient = new Gradient.Symb();
    params.gradient.mode = Gradient.Mode.Linear;
    params.gradient.flags = Gradient.Flags.Invert;
    params.gradient.keys.push(new Gradient.KeyColor({ value: 0.0, color: ColorDef.blue }));
    params.gradient.keys.push(new Gradient.KeyColor({ value: 0.5, color: ColorDef.red }));
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometryQuery(shape);

    // Outline gradient by view...Display issue, changes to gradient being ignored???
    params.gradient.flags = Gradient.Flags.Outline;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometryQuery(shape);

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      userLabel: "UserLabel-" + 1,
      geom: builder.geometryStream,
    };

    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(newId.isValid());
    imodel.saveChanges();
  });

  it("create GeometricElement3d using shapes with patterns", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const builder = new GeometryStreamBuilder();
    const params = new GeometryParams(seedElement.category);

    builder.appendGeometryRanges(); // Test inclusion of local ranges...

    const xOffset = Transform.createTranslation(Point3d.create(1.5));
    const shape = Loop.create(LineString3d.create(Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 1, 0), Point3d.create(0, 0, 0)));

    // Hatch w/o overrides
    params.lineColor = new ColorDef(ColorByName.yellow);
    params.weight = 5;
    params.pattern = new AreaPattern.Params();
    params.pattern.space1 = 0.05;
    params.pattern.angle1 = Angle.createDegrees(45.0);
    builder.appendGeometryParamsChange(params);
    builder.appendGeometryQuery(shape);

    // Cross hatch with color/weight override
    params.pattern.space2 = 0.1;
    params.pattern.angle2 = Angle.createDegrees(-30.0);
    params.pattern.color = ColorDef.red;
    params.pattern.weight = 0;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometryQuery(shape);

    const partBuilder = new GeometryStreamBuilder();
    partBuilder.appendGeometryQuery(Arc3d.createXY(Point3d.createZero(), 0.05));

    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      iModel: imodel,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };

    const partId = imodel.elements.insertElement(partProps);
    assert.isTrue(partId.isValid());

    // Area pattern w/o overrides
    params.pattern = new AreaPattern.Params();
    params.pattern.symbolId = partId;
    params.pattern.space1 = params.pattern.space2 = 0.05;
    params.pattern.angle1 = Angle.createDegrees(45.0);
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometryQuery(shape);

    // Area pattern with color/weight overrides, snappable geometry, and invisible boundary
    params.pattern.origin = Point3d.create(0.05, 0.05, 0.0);
    params.pattern.space1 = params.pattern.space2 = params.pattern.angle1 = undefined;
    params.pattern.color = ColorDef.red;
    params.pattern.weight = 1;
    params.pattern.snappable = params.pattern.invisibleBoundary = true;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometryQuery(shape);

    // Hatch definition w/o overrides (zig-zag)
    const defLines: AreaPattern.HatchDefLine[] = [
      { offset: Point2d.create(0.1, 0.1), dashes: [0.1, -0.1] },
      { angle: Angle.createDegrees(90.0), through: Point2d.create(0.1, 0.0), offset: Point2d.create(0.1, 0.1), dashes: [0.1, -0.1] },
    ];

    params.pattern = new AreaPattern.Params();
    params.pattern.defLines = defLines;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometryQuery(shape);

    // Hatch definition with color/weight overrides
    params.pattern.color = ColorDef.red;
    params.pattern.weight = 1;
    builder.appendGeometryParamsChange(params);
    shape.tryTransformInPlace(xOffset);
    builder.appendGeometryQuery(shape);

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      userLabel: "UserLabel-" + 1,
      geom: builder.geometryStream,
    };

    const newId = imodel.elements.insertElement(elementProps);
    assert.isTrue(newId.isValid());
    imodel.saveChanges();
  });

  it("create GeometricElement3d from world coordinate text using a newly embedded font", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    assert.isTrue(0 === imodel.getFontMap().fonts.size); // file currently contains no fonts...

    let fontProps: FontProps = { id: 0, type: FontType.TrueType, name: "Arial" };
    try {
      fontProps = imodel.embedFont(fontProps); // throws Error
      assert.isTrue(fontProps.id !== 0);
    } catch (error) {
      if ("win32" === Platform.platformName)
        assert.fail("Font embed failed");
      return; // failure expected if not windows, skip remainder of test...
    }

    assert.isTrue(0 !== imodel.getFontMap().fonts.size);
    const foundFont = imodel.getFontMap().getFont("Arial");
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

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      userLabel: "UserLabel-" + 1,
      geom: builder.geometryStream,
      placement: { origin: testOrigin, angles: testAngles },
    };

    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    // Extract and test value returned, text transform should now be identity as it's accounted for by element's placement...
    const value = imodel.elements.getElementProps({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    for (const entry of value.geom) {
      assert.isDefined(entry.textString);
      const origin = new Point3d(entry.textString.origin);
      const rotation = new YawPitchRollAngles(entry.textString.rotation);
      assert.isTrue(origin.isAlmostZero());
      assert.isTrue(rotation.isIdentity());
    }

    const itLocal = new GeometryStreamParser.Iterator(value.geom, value.category);
    for (const entry of itLocal) {
      assert.isDefined(entry.textString);
      assert.isTrue(entry.textString!.origin.isAlmostZero());
      assert.isTrue(entry.textString!.rotation.isIdentity());
    }

    const itWorld = GeometryStreamParser.Iterator.fromGeometricElement3d(value as GeometricElement3dProps);
    for (const entry of itWorld) {
      assert.isDefined(entry.textString);
      assert.isTrue(entry.textString!.origin.isAlmostEqual(testOrigin));
      assert.isTrue(entry.textString!.rotation.isAlmostEqual(testAngles));
    }
  });

  it("create GeometryPart from arcs", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];

    const partBuilder = new GeometryStreamBuilder();

    for (const geom of geomArray) {
      partBuilder.appendGeometryQuery(geom);
    }

    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      iModel: imodel,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };

    const testPart = imodel.elements.createElement(partProps);
    const partId = imodel.elements.insertElement(testPart);
    imodel.saveChanges();

    // Extract and test value returned
    const value = imodel.elements.getElementProps({ id: partId, wantGeometry: true });
    assert.isDefined(value.geom);
  });

  it("create GeometricElement3d from arcs", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];

    const builder = new GeometryStreamBuilder();

    for (const geom of geomArray) {
      builder.appendGeometryQuery(geom);
    }

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      userLabel: "UserLabel-" + 1,
      geom: builder.geometryStream,
    };

    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    // Extract and test value returned
    const value = imodel.elements.getElementProps({ id: newId, wantGeometry: true });
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
