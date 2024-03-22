/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@itwin/core-bentley";
import { Box, Cone, Point3d, Range3d, Sphere, Transform } from "@itwin/core-geometry";
import { ColorDef, Feature, GeometryClass, GraphicParams, RenderMode, RenderTexture, SkyBox, TextureMapping, TextureTransparency } from "@itwin/core-common";
import { CreateRenderMaterialArgs, DecorateContext, GraphicBranch, GraphicBuilder, GraphicType, HitDetail, imageElementFromUrl, IModelApp, IModelConnection, MaterialTextureMappingProps, StandardViewId, Viewport } from "@itwin/core-frontend";
import { Viewer } from "./Viewer";

class GeometryDecorator {
  public readonly useCachedDecorations = true;
  private readonly _iModel: IModelConnection;
  private readonly _decorators = new Map<string, (builder: GraphicBuilder) => void>();
  private readonly _viewIndependentOrigin?: Point3d;
  private _texture?: RenderTexture;
  private _normalMap?: RenderTexture;
  private _dispose?: VoidFunction;

  public constructor(viewport: Viewport, texture: RenderTexture | undefined, normalMap: RenderTexture | undefined, viewIndependentOrigin?: Point3d) {
    this._iModel = viewport.iModel;
    this._viewIndependentOrigin = viewIndependentOrigin;

    this.addSphere(0, 6);
    this.addBox(3, 6);
    this.addCone(6, 6);
    this.addShape(9, 6);

    this.addSphere(0, 3);
    this.addBox(3, 3);
    this.addCone(6, 3);
    this.addShape(9, 3);

    this.addSphere(0, 0);
    this.addBox(3, 0);
    this.addCone(6, 0);
    this.addShape(9, 0);

    this.addSphere(0, -3);
    this.addBox(3, -3);
    this.addCone(6, -3);
    this.addShape(9, -3);

    this.addMultiFeatureDecoration();

    this._texture = texture;
    this._normalMap = normalMap;

    this._dispose = viewport.iModel.onClose.addListener(() => this.dispose());
  }

  public dispose(): void {
    if (this._dispose) {
      this._dispose();
      this._dispose = undefined;
    }

    IModelApp.viewManager.dropDecorator(this);
    this._texture?.dispose();
    this._texture = undefined;
    this._normalMap?.dispose();
    this._normalMap = undefined;
  }

  public setTextures(texture: RenderTexture | undefined, normalMap: RenderTexture | undefined) {
    this._texture = texture;
    this._normalMap = normalMap;
  }

  public decorate(context: DecorateContext): void {
    if (context.viewport.iModel !== this._iModel)
      return;

    let textureIndex = 0;
    const textures = [undefined, undefined, this._texture, this._texture];
    const nMaps = [undefined, this._normalMap, undefined, this._normalMap];
    const transform = new TextureMapping.Trans2x3(2, 0, 0, 0, 2, 0);
    const mode = TextureMapping.Mode.Planar;
    const worldMapping = true;

    const colors = [ColorDef.blue, ColorDef.red, ColorDef.green, ColorDef.fromString("yellow")];
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

      const ndx = Math.floor(textureIndex++ / 4);
      const tx = textures[ndx];
      const nm = nMaps[ndx];
      let textureMapping: MaterialTextureMappingProps | undefined;
      if (undefined === nm) {
        if (undefined !== tx)
          textureMapping = { texture: tx, transform, mode, worldMapping };
      } else {
        if (undefined !== tx)
          textureMapping = { texture: tx, transform, mode, worldMapping, normalMapParams: { normalMap: nm } };
        else
          textureMapping = { texture: nm, transform, mode, worldMapping, normalMapParams: {} };
      }

      const gp = GraphicParams.fromSymbology(color, color, 1);
      if (undefined !== nm || undefined !== tx) {
        const args: CreateRenderMaterialArgs = {
          diffuse: {
            color,
          },
          specular: {
            color: ColorDef.white,
          },
          textureMapping,
        };
        gp.material = IModelApp.renderSystem.createRenderMaterial(args);
      }
      builder.activateGraphicParams(gp);

      value(builder);
      branch.add(builder.finish());
    }

    const graphic = context.createGraphicBranch(branch, Transform.createIdentity());
    context.addDecoration(GraphicType.Scene, graphic);
  }

  private addShape(ox: number, oy: number = 0): void {
    const points = [
      new Point3d(ox, oy, 0), new Point3d(ox + 1, oy, 0), new Point3d(ox + 1, oy + 1, 1), new Point3d(ox, oy + 1, 1), new Point3d(ox, oy, 0),
    ];
    this._decorators.set(this._iModel.transientIds.getNext(), (builder) => builder.addShape(points));
  }

  private addDecorator(decorate: (builder: GraphicBuilder) => void): void {
    this._decorators.set(this._iModel.transientIds.getNext(), decorate);
  }

  private addBox(cx: number, cy: number = 0): void {
    const box = Box.createRange(new Range3d(cx, cy, 0, cx + 1, cy + 1, 1), true);
    if (box)
      this.addDecorator((builder) => builder.addSolidPrimitive(box));
  }

  private addSphere(cx: number, cy: number = 0): void {
    const sphere = Sphere.createCenterRadius(new Point3d(cx + 0.5, cy + 0.5, 0.5), 0.5);
    this.addDecorator((builder) => builder.addSolidPrimitive(sphere));
  }

  private addCone(cx: number, cy: number = 0): void {
    const cone = Cone.createAxisPoints(new Point3d(cx + 0.5, cy + 0.5, 0), new Point3d(cx + 0.5, cy + 0.5, 1), 0.5, 0.25, true);
    if (cone)
      this.addDecorator((builder) => builder.addSolidPrimitive(cone));
  }

  private addMultiFeatureDecoration(): void {
    const y = 9;
    const boxId = this._iModel.transientIds.getNext(),
      sphereId = this._iModel.transientIds.getNext(),
      coneId = this._iModel.transientIds.getNext();

    this._decorators.set(this._iModel.transientIds.getNext(), (builder) => {
      builder.addShape([new Point3d(0, y, 0), new Point3d(1, y, 0), new Point3d(1, y + 1, 1), new Point3d(0, y + 1, 1), new Point3d(0, y, 0)]);

      builder.activatePickableId(boxId);
      const box = Box.createRange(new Range3d(3, y, 0, 4, y + 1, 1), true);
      assert(undefined !== box);
      builder.addSolidPrimitive(box);

      builder.activateFeature(new Feature(sphereId, undefined, GeometryClass.Construction));
      const sphere = Sphere.createCenterRadius(new Point3d(6.5, y + 0.5, 0.5), 0.5);
      builder.addSolidPrimitive(sphere);

      builder.activatePickableId(coneId);
      const cone = Cone.createAxisPoints(new Point3d(9.5, y + 0.5, 0), new Point3d(9.5, y + 0.5, 1), 0.5, 0.25, true);
      assert(undefined !== cone);
      builder.addSolidPrimitive(cone);
    });
  }
}

export async function openDecorationGeometryExample(viewer: Viewer) {
  const viewIndependentOrigin = undefined; // new Point3d(4, 0, 0) -- uncomment for testing.
  const gd = new GeometryDecorator(viewer.viewport, undefined, undefined, viewIndependentOrigin);
  IModelApp.viewManager.addDecorator(gd);

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

  const txrEl = await imageElementFromUrl("brick05baseColor.jpg");
  const texture = IModelApp.renderSystem.createTexture({ image: { source: txrEl, transparency: TextureTransparency.Opaque }, ownership: "external" });

  const nMapEl = await imageElementFromUrl("brick05normal.jpg");
  const normalMap = IModelApp.renderSystem.createTexture({ image: { source: nMapEl, transparency: TextureTransparency.Opaque }, ownership: "external" });

  gd.setTextures(texture, normalMap);
}
