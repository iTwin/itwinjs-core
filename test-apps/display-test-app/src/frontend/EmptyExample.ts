/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@itwin/core-bentley";
import { ColorDef, DisplayStyle3dSettingsProps, RenderMode } from "@itwin/core-common";
import { DecorateContext, Decorator, GraphicType, IModelApp, IModelConnection, StandardViewId } from "@itwin/core-frontend";
import { Viewer } from "./Viewer";
import { AngleSweep, Arc3d, Box, Cone, IndexedPolyface, LineString3d, Loop, Matrix3d, Path, Point2d, Point3d, PolyfaceBuilder, Range3d, Sphere } from "@itwin/core-geometry";

export async function openEmptyExample(viewer: Viewer) {
  assert(viewer.viewport.view.is3d());
  viewer.viewport.setStandardRotation(StandardViewId.Iso);
  viewer.viewport.turnCameraOn();

  // Expand extents to show decorations
  const extents = viewer.viewport.iModel.projectExtents.clone();
  extents.expandInPlace(120000);
  viewer.viewport.zoomToVolume(extents);

  viewer.viewport.viewFlags = viewer.viewport.viewFlags.copy({
    renderMode: RenderMode.SmoothShade,
    lighting: true,
    visibleEdges: false,
    whiteOnWhiteReversal: false,
    backgroundMap: true,
  });

  const style: DisplayStyle3dSettingsProps = {
    backgroundColor: ColorDef.computeTbgrFromString("#0000ff"),
    environment: {
      sky: {
        display: false,
      },
    },
  };

  viewer.viewport.overrideDisplayStyle(style);
  // Start test decorations for Cesium prototype
  if (viewer.viewport.iModel) {
    const decorator = CesiumDecorator.start(viewer.viewport.iModel);

    // Clean up decorator when iModel closes
    viewer.viewport.iModel.onClose.addOnce(() => {
      decorator.stop();
    });
  }
}

export class CesiumDecorator implements Decorator {
  private _iModel?: IModelConnection;
  private _xOffset = -220000; // Shift test paths left to avoid overlap

  constructor(iModel: IModelConnection) {
    this._iModel = iModel;
  }

  public decorate(context: DecorateContext): void {
    if (!this._iModel || !context.viewport.view.isSpatialView()) {
      return;
    }

    this.createPointDecorations(context);
    this.createLineStringDecorations(context);
    this.createShapeDecorations(context);
    this.createArcDecorations(context);
    this.createPathDecorations(context);
    this.createLoopDecorations(context);
    this.createPolyfaceDecorations(context);
    this.createSolidPrimitiveDecorations(context);
  }

  private createPointDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const center = this._iModel.projectExtents.center;

    const points = [
      new Point3d(center.x - 50000, center.y, center.z + 10000),
      new Point3d(center.x, center.y + 50000, center.z + 20000),
      new Point3d(center.x + 50000, center.y - 50000, center.z + 30000),
    ];

    points.forEach((point) => {
      const builder = context.createGraphic({ type: GraphicType.WorldDecoration });
      builder.setSymbology(ColorDef.blue, ColorDef.blue, 1);
      builder.addPointString([point]);
      context.addDecorationFromBuilder(builder);
    });

    const overlayPoints = [
      Point2d.create(center.x - 90000, center.y + 90000),
    ];
    const point2dBuilder = context.createGraphic({ type: GraphicType.WorldOverlay });
    const overlayColor = ColorDef.from(255, 215, 0); // gold to contrast with 3d points
    point2dBuilder.setSymbology(overlayColor, overlayColor, 2);
    point2dBuilder.addPointString2d(overlayPoints, center.z + 6000);
    context.addDecorationFromBuilder(point2dBuilder);
  }

  private createLineStringDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const center = this._iModel.projectExtents.center;

    const lines = [
      {
        points: [
          new Point3d(center.x - 120000, center.y - 120000, center.z + 5000),
          new Point3d(center.x + 120000, center.y - 120000, center.z + 5000),
          new Point3d(center.x + 120000, center.y + 120000, center.z + 5000),
          new Point3d(center.x - 120000, center.y + 120000, center.z + 5000),
          new Point3d(center.x - 120000, center.y - 120000, center.z + 5000),
        ],
        type: GraphicType.WorldDecoration,
        color: ColorDef.from(255, 0, 0),
      },
      {
        points: [
          new Point3d(center.x - 150000, center.y, center.z + 19000),
          new Point3d(center.x, center.y + 150000, center.z + 19000),
          new Point3d(center.x + 150000, center.y, center.z + 19000),
          new Point3d(center.x, center.y - 150000, center.z + 19000),
          new Point3d(center.x - 150000, center.y, center.z + 19000),
        ],
        type: GraphicType.WorldOverlay,
        color: ColorDef.from(255, 165, 0),
      }
    ];

    lines.forEach((line) => {
      const builder = context.createGraphic({ type: line.type });
      builder.setSymbology(line.color, line.color, 2);
      builder.addLineString(line.points);
      context.addDecorationFromBuilder(builder);
    });

    const overlayLinePoints = [
      Point2d.create(center.x + 90000, center.y - 90000),
      Point2d.create(center.x + 150000, center.y - 90000),
      Point2d.create(center.x + 150000, center.y - 30000),
      Point2d.create(center.x + 90000, center.y - 30000),
      Point2d.create(center.x + 90000, center.y - 90000),
    ];
    const line2dBuilder = context.createGraphic({ type: GraphicType.WorldOverlay });
    const line2dColor = ColorDef.from(0, 200, 255);
    line2dBuilder.setSymbology(line2dColor, line2dColor, 3);
    line2dBuilder.addLineString2d(overlayLinePoints, center.z + 8000);
    context.addDecorationFromBuilder(line2dBuilder);
  }

  private createShapeDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const center = this._iModel.projectExtents.center;

    const shapes = [
      {
        points: [
          new Point3d(center.x - 80000, center.y - 80000, center.z + 15000),
          new Point3d(center.x + 80000, center.y - 80000, center.z + 15000),
          new Point3d(center.x, center.y + 80000, center.z + 15000),
          new Point3d(center.x - 80000, center.y - 80000, center.z + 15000),
        ],
        type: GraphicType.WorldDecoration,
        color: ColorDef.from(0, 255, 0),
      },
      {
        points: [
          new Point3d(center.x - 60000, center.y + 40000, center.z + 25000),
          new Point3d(center.x - 20000, center.y + 40000, center.z + 25000),
          new Point3d(center.x - 20000, center.y + 80000, center.z + 25000),
          new Point3d(center.x - 60000, center.y + 80000, center.z + 25000),
          new Point3d(center.x - 60000, center.y + 40000, center.z + 25000),
        ],
        type: GraphicType.WorldDecoration,
        color: ColorDef.from(255, 0, 255),
      }
    ];

    shapes.forEach((shape) => {
      const builder = context.createGraphic({ type: shape.type });
      builder.setSymbology(shape.color, shape.color, 3);
      builder.addShape(shape.points);
      context.addDecorationFromBuilder(builder);
    });

    const overlayShapePoints = [
      Point2d.create(center.x + 50000, center.y + 90000),
      Point2d.create(center.x + 120000, center.y + 90000),
      Point2d.create(center.x + 120000, center.y + 140000),
      Point2d.create(center.x + 50000, center.y + 140000),
      Point2d.create(center.x + 50000, center.y + 90000),
    ];
    const shape2dBuilder = context.createGraphic({ type: GraphicType.WorldDecoration });
    const shape2dColor = ColorDef.from(186, 85, 211);
    shape2dBuilder.setSymbology(shape2dColor, shape2dColor, 3);
    shape2dBuilder.addShape2d(overlayShapePoints, center.z + 9000);
    context.addDecorationFromBuilder(shape2dBuilder);
  }

  private createArcDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const center = this._iModel.projectExtents.center;

    const arcs = [
      {
        arc: Arc3d.createScaledXYColumns(
          new Point3d(center.x - 100000, center.y - 100000, center.z + 35000),
          Matrix3d.createIdentity(),
          40000,
          40000,
          AngleSweep.createStartSweepRadians(0, Math.PI)
        ),
        isEllipse: false,
        filled: false,
        type: GraphicType.WorldDecoration,
        color: ColorDef.from(255, 255, 0),
      },
      {
        arc: Arc3d.createScaledXYColumns(
          new Point3d(center.x + 100000, center.y + 100000, center.z + 40000),
          Matrix3d.createIdentity(),
          30000,
          50000,
          AngleSweep.createStartSweepRadians(0, Math.PI * 2)
        ),
        isEllipse: true,
        filled: true,
        type: GraphicType.WorldOverlay,
        color: ColorDef.from(0, 255, 255),
      },
      {
        arc: Arc3d.createScaledXYColumns(
          new Point3d(center.x, center.y - 200000, center.z + 45000),
          Matrix3d.createIdentity(),
          60000,
          30000,
          AngleSweep.createStartSweepRadians(Math.PI / 4, Math.PI * 1.5)
        ),
        isEllipse: false,
        filled: false,
        type: GraphicType.WorldDecoration,
        color: ColorDef.from(255, 100, 100),
      }
    ];

    arcs.forEach((arcDef) => {
      const builder = context.createGraphic({ type: arcDef.type });
      builder.setSymbology(arcDef.color, arcDef.color, 2);
      builder.addArc(arcDef.arc, arcDef.isEllipse, arcDef.filled);
      context.addDecorationFromBuilder(builder);
    });

    const overlayFullEllipse = Arc3d.createScaledXYColumns(
      new Point3d(center.x + 160000, center.y + 40000, center.z),
      Matrix3d.createIdentity(),
      25000,
      40000,
      AngleSweep.createStartSweepRadians(0, Math.PI * 2)
    );
    const arc2dBuilder = context.createGraphic({ type: GraphicType.WorldOverlay });
    const arc2dColor = ColorDef.from(64, 224, 208);
    arc2dBuilder.setSymbology(arc2dColor, arc2dColor, 2);
    arc2dBuilder.addArc2d(overlayFullEllipse, true, true, center.z + 12000);
    context.addDecorationFromBuilder(arc2dBuilder);
  }

  public static start(iModel: IModelConnection): CesiumDecorator {
    const decorator = new CesiumDecorator(iModel);
    IModelApp.viewManager.addDecorator(decorator);
    return decorator;
  }

  private createPathDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const c = this._iModel.projectExtents.center;

    const z = c.z + 50000;
    const R = 20000;


    // First segment: horizontal line from left to right
    const P0 = new Point3d(c.x - 80000 + this._xOffset, c.y - 80000, z);
    const P1 = new Point3d(c.x - 20000 + this._xOffset, c.y - 80000, z);

    // Second segment: vertical line upward to corner point
    const P2 = new Point3d(c.x - 20000 + this._xOffset, c.y - 20000, z);

    // Arc transition: 90-degree arc with radius 20000
    // Using start-middle-end definition to ensure P2 is the arc start point
    // Arc transitions from upward direction to rightward direction
    const arcMid = new Point3d(P2.x + R / Math.SQRT2, P2.y + R / Math.SQRT2, z);
    const arcEnd = new Point3d(P2.x + R, P2.y, z);

    const arc = Arc3d.createCircularStartMiddleEnd(P2, arcMid, arcEnd);
    if (!arc) return;

    // Third segment: continue upward from arc end point
    const P3 = new Point3d(arcEnd.x, arcEnd.y + 40000, z);

    const path1 = Path.create(
      LineString3d.create([P0, P1]),
      LineString3d.create([P1, P2]),
      arc,
      LineString3d.create([arcEnd, P3])
    );

    const builder1 = context.createGraphic({ type: GraphicType.WorldDecoration });
    builder1.setSymbology(ColorDef.from(255, 100, 200), ColorDef.from(255, 100, 200), 3);
    builder1.addPath(path1);
    context.addDecorationFromBuilder(builder1);

    // Second path: zigzag wave pattern
    const zigZag = Path.create(
      LineString3d.create([
        new Point3d(c.x + 50000 + this._xOffset, c.y - 100000, z + 10000),
        new Point3d(c.x + 70000 + this._xOffset, c.y - 80000, z + 10000),
        new Point3d(c.x + 50000 + this._xOffset, c.y - 60000, z + 10000),
        new Point3d(c.x + 70000 + this._xOffset, c.y - 40000, z + 10000),
        new Point3d(c.x + 50000 + this._xOffset, c.y - 20000, z + 10000),
        new Point3d(c.x + 70000 + this._xOffset, c.y, z + 10000)
      ])
    );

    const builder2 = context.createGraphic({ type: GraphicType.WorldOverlay });
    builder2.setSymbology(ColorDef.from(100, 255, 100), ColorDef.from(100, 255, 100), 3);
    builder2.addPath(zigZag);
    context.addDecorationFromBuilder(builder2);
  }

  private createLoopDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const c = this._iModel.projectExtents.center;

    const z = c.z + 70000;

    // Simple test: Just one triangle
    const trianglePoints = [
      new Point3d(c.x - 60000 + this._xOffset, c.y - 60000, z),
      new Point3d(c.x + 60000 + this._xOffset, c.y - 60000, z),
      new Point3d(c.x + this._xOffset, c.y + 60000, z),
      new Point3d(c.x - 60000 + this._xOffset, c.y - 60000, z)
    ];

    const triangleLoop = Loop.create(LineString3d.create(trianglePoints));

    const builder1 = context.createGraphic({ type: GraphicType.WorldDecoration });
    builder1.setSymbology(ColorDef.from(255, 0, 255), ColorDef.from(255, 0, 255), 2);
    builder1.addLoop(triangleLoop);
    context.addDecorationFromBuilder(builder1);
  }

  private createPolyfaceDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const c = this._iModel.projectExtents.center;

    const z = c.z + 80000;
    const yOffset = -80000; // Position below other decorations

    // Create a simple pyramid polyface
    const pyramidPolyface = this.createPyramidPolyface(
      new Point3d(c.x + this._xOffset, c.y + yOffset, z),
      40000 // Base size
    );

    if (pyramidPolyface) {
      const builder1 = context.createGraphic({ type: GraphicType.WorldDecoration });
      builder1.setSymbology(ColorDef.from(255, 165, 0), ColorDef.from(255, 165, 0, 128), 2); // Orange with transparent fill
      builder1.addPolyface(pyramidPolyface, true);
      context.addDecorationFromBuilder(builder1);
    }

    // Create a simple box polyface
    const boxPolyface = this.createBoxPolyface(
      new Point3d(c.x + 100000 + this._xOffset, c.y + yOffset, z),
      30000, // Width
      30000, // Depth
      40000  // Height
    );

    if (boxPolyface) {
      const builder2 = context.createGraphic({ type: GraphicType.WorldOverlay });
      builder2.setSymbology(ColorDef.from(100, 255, 255), ColorDef.from(100, 255, 255, 100), 2); // Cyan with transparent fill
      builder2.addPolyface(boxPolyface, true);
      context.addDecorationFromBuilder(builder2);
    }
  }

  private createPyramidPolyface(center: Point3d, baseSize: number): IndexedPolyface | undefined {
    const builder = PolyfaceBuilder.create();
    const halfSize = baseSize / 2;
    const height = baseSize * 0.8; // Pyramid height

    // Rotated pyramid - lying on its side for better view
    // Base vertices (square base) - rotated 90 degrees around Y axis
    const base1 = new Point3d(center.x, center.y - halfSize, center.z - halfSize);
    const base2 = new Point3d(center.x, center.y + halfSize, center.z - halfSize);
    const base3 = new Point3d(center.x, center.y + halfSize, center.z + halfSize);
    const base4 = new Point3d(center.x, center.y - halfSize, center.z + halfSize);

    // Apex vertex - pointing in X direction
    const apex = new Point3d(center.x + height, center.y, center.z);

    // Add base (square) - counter-clockwise for outward normal
    builder.addQuadFacet([base1, base2, base3, base4]);

    // Add triangular faces - each face should have outward normal
    builder.addTriangleFacet([base1, apex, base2]); // Front face
    builder.addTriangleFacet([base2, apex, base3]); // Right face
    builder.addTriangleFacet([base3, apex, base4]); // Back face
    builder.addTriangleFacet([base4, apex, base1]); // Left face

    return builder.claimPolyface();
  }

  private createBoxPolyface(center: Point3d, width: number, depth: number, height: number): IndexedPolyface | undefined {
    const builder = PolyfaceBuilder.create();
    const halfW = width / 2;
    const halfD = depth / 2;
    const halfH = height / 2;

    // Bottom vertices
    const b1 = new Point3d(center.x - halfW, center.y - halfD, center.z - halfH);
    const b2 = new Point3d(center.x + halfW, center.y - halfD, center.z - halfH);
    const b3 = new Point3d(center.x + halfW, center.y + halfD, center.z - halfH);
    const b4 = new Point3d(center.x - halfW, center.y + halfD, center.z - halfH);

    // Top vertices
    const t1 = new Point3d(center.x - halfW, center.y - halfD, center.z + halfH);
    const t2 = new Point3d(center.x + halfW, center.y - halfD, center.z + halfH);
    const t3 = new Point3d(center.x + halfW, center.y + halfD, center.z + halfH);
    const t4 = new Point3d(center.x - halfW, center.y + halfD, center.z + halfH);

    // Add faces with outward normals
    builder.addQuadFacet([b4, b3, b2, b1]); // Bottom (looking up)
    builder.addQuadFacet([t1, t2, t3, t4]); // Top (looking down)
    builder.addQuadFacet([b1, b2, t2, t1]); // Front
    builder.addQuadFacet([b2, b3, t3, t2]); // Right
    builder.addQuadFacet([b3, b4, t4, t3]); // Back
    builder.addQuadFacet([b4, b1, t1, t4]); // Left

    return builder.claimPolyface();
  }

  private createSolidPrimitiveDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const c = this._iModel.projectExtents.center;

    const z = c.z + 80000; // Same height as other decorations
    const yOffset = -80000; // Position below other decorations

    // Create a Box solid primitive
    const boxSize = 20000; // Smaller for better visibility
    const boxCenter = new Point3d(c.x + 200000, c.y + yOffset, z); // Far right to avoid overlap
    const boxRange = Range3d.create(
      new Point3d(boxCenter.x - boxSize/2, boxCenter.y - boxSize/2, boxCenter.z - boxSize/2),
      new Point3d(boxCenter.x + boxSize/2, boxCenter.y + boxSize/2, boxCenter.z + boxSize/2)
    );
    const boxSolid = Box.createRange(boxRange, true);

    if (boxSolid) {
      const builder1 = context.createGraphic({ type: GraphicType.WorldDecoration });
      builder1.setSymbology(ColorDef.from(255, 100, 100), ColorDef.from(255, 100, 100, 150), 2); // Red with transparent fill
      builder1.addSolidPrimitive(boxSolid);
      context.addDecorationFromBuilder(builder1);
    }

    // Create a Sphere solid primitive
    const sphereRadius = 15000; // Reasonable size
    const sphereCenter = new Point3d(c.x + 240000, c.y + yOffset, z); // Next to box
    const sphereSolid = Sphere.createCenterRadius(sphereCenter, sphereRadius);

    if (sphereSolid) {
      const builder2 = context.createGraphic({ type: GraphicType.WorldOverlay });
      builder2.setSymbology(ColorDef.from(100, 100, 255), ColorDef.from(100, 100, 255, 120), 2); // Blue with transparent fill
      builder2.addSolidPrimitive(sphereSolid);
      context.addDecorationFromBuilder(builder2);
    }

    // Create a Cone solid primitive
    const coneHeight = 25000;
    const coneRadius = 10000;
    const coneStart = new Point3d(c.x + 280000, c.y + yOffset, z); // Next to sphere
    const coneEnd = new Point3d(c.x + 280000, c.y + yOffset, z + coneHeight);
    const coneSolid = Cone.createAxisPoints(coneStart, coneEnd, coneRadius, 0, true); // Radius at start, 0 at end = cone

    if (coneSolid) {
      const builder3 = context.createGraphic({ type: GraphicType.WorldDecoration });
      builder3.setSymbology(ColorDef.from(100, 255, 100), ColorDef.from(100, 255, 100, 100), 2); // Green with transparent fill
      builder3.addSolidPrimitive(coneSolid);
      context.addDecorationFromBuilder(builder3);
    }
  }

  public stop(): void {
    IModelApp.viewManager.dropDecorator(this);
  }
}
