/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@itwin/core-bentley";
import { Box, Cone, IndexedPolyface, Point3d, PolyfaceBuilder, Range3d, Sphere, StrokeOptions, Transform } from "@itwin/core-geometry";
import { ColorDef, Feature, GeometryClass, RenderMode, SkyBox } from "@itwin/core-common";
import { DecorateContext, GraphicBranch, GraphicBuilder, GraphicType, IModelApp, IModelConnection, StandardViewId, Viewport } from "@itwin/core-frontend";
import { Viewer } from "./Viewer";
import { ConvexMeshDecomposition } from "vhacd-js";

class GeometryDecorator {
  public readonly useCachedDecorations = true;
  private readonly _iModel: IModelConnection;
  private readonly _decorators = new Map<string, (builder: GraphicBuilder) => void>();
  private readonly _viewIndependentOrigin?: Point3d;
  private readonly _decomposer: ConvexMeshDecomposition;

  public constructor(viewport: Viewport, viewIndependentOrigin: Point3d | undefined, decomposer: ConvexMeshDecomposition) {
    this._iModel = viewport.iModel;
    this._viewIndependentOrigin = viewIndependentOrigin;
    this._decomposer = decomposer;

    this.addSphere(0);
    this.addBox(2);
    this.addCone(4);
    this.addShape(6);
    this.addPolyface(8);

    this.addMultiFeatureDecoration();
  }

  public decorate(context: DecorateContext): void {
    if (context.viewport.iModel !== this._iModel)
      return;

    const colors = [ColorDef.blue, ColorDef.red, ColorDef.green];
    let colorIndex = 0;
    const branch = new GraphicBranch();
    for (const [key, value] of this._decorators) {
      const builder = context.createGraphic({
        type: GraphicType.Scene,
        pickable: { id: key },
        viewIndependentOrigin: this._viewIndependentOrigin,
      });

      const color = colors[colorIndex++];
      if (colorIndex >= colors.length)
        colorIndex = 0;

      builder.setSymbology(color, color, 1);
      value(builder);
      branch.add(builder.finish());
    }

    const graphic = context.createGraphicBranch(branch, Transform.createIdentity());
    context.addDecoration(GraphicType.Scene, graphic);
  }

  private addShape(ox: number): void {
    const points = [
      new Point3d(ox, 0, 0), new Point3d(ox + 1, 0, 0), new Point3d(ox + 1, 1, 1), new Point3d(ox, 1, 1), new Point3d(ox, 0, 0),
    ];
    this._decorators.set(this._iModel.transientIds.next, (builder) => builder.addShape(points));
  }

  private addDecorator(decorate: (builder: GraphicBuilder) => void): void {
    this._decorators.set(this._iModel.transientIds.next, decorate);
  }

  private addBox(cx: number): void {
    const box = Box.createRange(new Range3d(cx, 0, 0, cx + 1, 1, 1), true);
    if (box)
      this.addDecorator((builder) => builder.addSolidPrimitive(box));
  }

  private addSphere(cx: number): void {
    const sphere = Sphere.createCenterRadius(new Point3d(cx + 0.5, 0.5, 0.5), 0.5);
    this.addDecorator((builder) => builder.addSolidPrimitive(sphere));
  }

  private addCone(cx: number): void {
    const cone = Cone.createAxisPoints(new Point3d(cx, 0, 0), new Point3d(cx, 0, 1), 0.5, 0.25, true);
    if (cone)
      this.addDecorator((builder) => builder.addSolidPrimitive(cone));
  }

  private addPolyface(cx: number): void {
    const opts = StrokeOptions.createForFacets()
    opts.shouldTriangulate = true;
    const pfb = PolyfaceBuilder.create(opts);

    const doBox = false;
    if (doBox) {
      pfb.addBox(Box.createRange(new Range3d(cx, 0, 0, cx + 1, 1, 1), true)!);
    } else {
      const cone = Cone.createAxisPoints(new Point3d(cx, 0, 0), new Point3d(cx, 0, 1), 1, 1, false)!;
      assert(undefined !== cone);
      pfb.addCone(cone);
    }

    const polyface = pfb.claimPolyface();

    const hulls = this._decomposer.computeConvexHulls({
      indices: new Uint32Array(polyface.data.pointIndex),
      positions: polyface.data.point.float64Data().subarray(0, polyface.data.point.float64Length),
    }, {
      // maxHulls: 8,
      fillMode: "surface",
    });

    assert(hulls.length > 0);

    opts.needNormals = true;
    const polyfaces: IndexedPolyface[] = [];
    for (const hull of hulls) {
      const hullBuilder = PolyfaceBuilder.create(opts);
      for (let i = 0; i < hull.indices.length; i += 3) {
        const i0 = hull.indices[i + 0] * 3;
        const i1 = hull.indices[i + 1] * 3;
        const i2 = hull.indices[i + 2] * 3;
        hullBuilder.addTriangleFacet([
          new Point3d(hull.positions[i0], hull.positions[i0 + 1], hull.positions[i0 + 2]),
          new Point3d(hull.positions[i1], hull.positions[i1 + 1], hull.positions[i1 + 2]),
          new Point3d(hull.positions[i2], hull.positions[i2 + 1], hull.positions[i2 + 2]),
        ]);
      }

      polyfaces.push(hullBuilder.claimPolyface());
    }

    this.addDecorator((builder) => {
      for (const polyface of polyfaces)
        builder.addPolyface(polyface, false);
    });
  }

  private addMultiFeatureDecoration(): void {
    const y = 4;
    const boxId = this._iModel.transientIds.next,
      sphereId = this._iModel.transientIds.next,
      coneId = this._iModel.transientIds.next;

    this._decorators.set(this._iModel.transientIds.next, (builder) => {
      builder.addShape([ new Point3d(0, y, 0), new Point3d(1, y, 0), new Point3d(1, y + 1, 1), new Point3d(0, y + 1, 1), new Point3d(0, y, 0) ]);

      builder.activatePickableId(boxId);
      const box = Box.createRange(new Range3d(2, y, 0, 3, y + 1, 1), true);
      assert(undefined !== box);
      builder.addSolidPrimitive(box);

      builder.activateFeature(new Feature(sphereId, undefined, GeometryClass.Construction));
      const sphere = Sphere.createCenterRadius(new Point3d(4.5, y + 0.5, 0.5), 0.5);
      builder.addSolidPrimitive(sphere);

      builder.activatePickableId(coneId);
      const cone = Cone.createAxisPoints(new Point3d(6, y, 0), new Point3d(6, y, 1), 0.5, 0.25, true);
      assert(undefined !== cone);
      builder.addSolidPrimitive(cone);
    });
  }
}

export async function openDecorationGeometryExample(viewer: Viewer): Promise<void> {
  const decomposer = await ConvexMeshDecomposition.create();
  const viewIndependentOrigin = undefined; // new Point3d(4, 0, 0) -- uncomment for testing.
  IModelApp.viewManager.addDecorator(new GeometryDecorator(viewer.viewport, viewIndependentOrigin, decomposer));

  assert(viewer.viewport.view.is3d());
  viewer.viewport.setStandardRotation(StandardViewId.Iso);
  viewer.viewport.turnCameraOn();
  viewer.viewport.zoomToVolume(viewer.viewport.iModel.projectExtents);

  viewer.viewport.viewFlags = viewer.viewport.viewFlags.copy({
    renderMode: RenderMode.SmoothShade,
    lighting: true,
    visibleEdges: true,
    whiteOnWhiteReversal: false,
    backgroundMap: true,
  });

  const settings = viewer.viewport.view.getDisplayStyle3d().settings;
  settings.environment = settings.environment.clone({
    displaySky: true,
    sky: SkyBox.fromJSON({ twoColor: true, nadirColor: 0xdfefff, zenithColor: 0xffefdf }),
  });
}
