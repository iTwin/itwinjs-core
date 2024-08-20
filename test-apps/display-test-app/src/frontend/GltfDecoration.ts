/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Angle, AxisIndex, Matrix3d, Point3d, Range3d, Transform } from "@itwin/core-geometry";
import {
  DecorateContext, GraphicBranch, GraphicType, IModelApp, IModelConnection, readGltfGraphics, readGltfTemplate, RenderGraphic, RenderInstances, RenderInstancesParamsBuilder, Tool,
} from "@itwin/core-frontend";
import { parseArgs } from "@itwin/frontend-devtools";
import { Id64String } from "@itwin/core-bentley";
import { ColorByName, ColorDef, RgbColor } from "@itwin/core-common";

class GltfDecoration {
  private readonly _graphic: RenderGraphic;
  private readonly _tooltip: string;
  private readonly _pickableId?: string;

  public constructor(graphic: RenderGraphic, tooltip: string | undefined, pickableId?: string) {
    this._graphic = graphic;
    this._tooltip = tooltip ?? "glTF model";
    this._pickableId = pickableId;
  }

  public readonly useCachedDecorations = true;

  public decorate(context: DecorateContext): void {
    if (context.viewport.view.isSpatialView())
      context.addDecoration(GraphicType.Scene, this._graphic);
  }

  public testDecorationHit(id: string): boolean {
    return undefined !== this._pickableId && id === this._pickableId;
  }

  public async getDecorationToolTip() {
    return this._tooltip;
  }
}

function createInstances(numInstances: number, iModel: IModelConnection, modelId: Id64String, wantScale: boolean, wantColor: boolean, wantRotate: boolean): RenderInstances | undefined {
  if (numInstances <= 1) {
    return undefined;
  }

  const diagonal = iModel.projectExtents.diagonal();
  const maxExtent = Math.min(diagonal.x, Math.min(diagonal.y, diagonal.z));

  function applyRandomOffset(pos: Point3d, coord: "x" | "y" | "z"): void {
    const r = Math.random() * 2 * maxExtent - maxExtent;
    pos[coord] += r;
  }

  function computeRandomPosition(): Point3d {
    const pos = new Point3d(); // templateRange.center;
    applyRandomOffset(pos, "x");
    applyRandomOffset(pos, "y");
    applyRandomOffset(pos, "z");
    return pos;
  }

  const colors = [
    ColorDef.green,
    ColorDef.blue,
    ColorDef.red,
    ColorDef.white,
    ColorDef.fromJSON(ColorByName.yellow),
    ColorDef.fromJSON(ColorByName.orange),
    ColorDef.fromJSON(ColorByName.black),
  ];
  
  const builder = RenderInstancesParamsBuilder.create({ modelId });
  for (let i = 0; i < numInstances; i++) {
    const origin = computeRandomPosition();
    const translation = Transform.createTranslation(origin);

    const maxScale = 2.5;
    const minScale = 0.25;
    const scaleFactor = wantScale ? Math.random() * (maxScale - minScale) + minScale : 1;
    const scale = Transform.createScaleAboutPoint(origin, scaleFactor);

    const zAngle = wantRotate ? Math.random() * 360 : 0;
    const rotation = Transform.createFixedPointAndMatrix(origin, Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, Angle.createDegrees(zAngle)));
    const symbology = wantColor ? { color: RgbColor.fromColorDef(colors[i % colors.length]) } : undefined;
    builder.add({
      transform: translation.multiplyTransformTransform(scale).multiplyTransformTransform(rotation),
      feature: iModel.transientIds.getNext(),
      symbology,
    });
  }

  const params = builder.finish();
  return IModelApp.renderSystem.createRenderInstances(params);
}

/** Opens a file picker from which the user can select a glTF or glb file. Creates a decoration graphic from the glTF and
 * installs a decorator to display it at the center of the active viewport's iModel's project extents.
 */
export class GltfDecorationTool extends Tool {
  public static override toolId = "AddGltfDecoration";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 5; }

  private _url?: string;
  private _numInstances = 1;
  private _wantScale = false;
  private _wantColor = false;
  private _wantRotate = false;

  public override async parseAndRun(...inArgs: string[]) {
    const args = parseArgs(inArgs);
    this._url = args.get("u");
    this._numInstances = args.getInteger("i") ?? 1;
    this._wantScale = !!args.getBoolean("s");
    this._wantColor = !!args.getBoolean("c");
    this._wantRotate = !!args.getBoolean("r");
    
    return this.run();
  }

  private async queryAsset(url?: string): Promise<ArrayBuffer | undefined> {
    if (url) {
      const response = await fetch(url);
      return response.arrayBuffer();
    }

    // No url specified - choose an asset from local file system.
    const [handle] = await (window as any).showOpenFilePicker({
      types: [
        {
          description: "glTF",
          accept: { "model/*": [".gltf", ".glb"] },
        },
      ],
    });

    const file = await handle.getFile();
    return file.arrayBuffer();
  }

  public override async run() {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return false;

    const url = this._url;
    const iModel = vp.iModel;
    try {
      const buffer = await this.queryAsset(url);
      if (!buffer)
        return false;

      // Convert the glTF into a RenderGraphic.
      const id = iModel.transientIds.getNext();
      // The modelId must be different from the pickable Id for the decoration to be selectable and hilite-able.
      const modelId = iModel.transientIds.getNext();
      let gltfTemplate = await readGltfTemplate({
        gltf: new Uint8Array(buffer),
        iModel,
        baseUrl: url ? new URL(url) : undefined,
        pickableOptions: {
          id,
          modelId,
        },
      });

      if (!gltfTemplate?.template)
        return false;

      const instances = createInstances(this._numInstances, vp.iModel, modelId, this._wantScale, this._wantColor, this._wantRotate);
      let graphic = IModelApp.renderSystem.createGraphicFromTemplate({ template: gltfTemplate.template, instances });
      
      // Transform the graphic to the center of the project extents.
      const branch = new GraphicBranch();
      branch.add(graphic);
      const transform = Transform.createTranslation(iModel.projectExtents.center);
      graphic = IModelApp.renderSystem.createGraphicBranch(branch, transform);

      // Take ownership of the graphic so it is not disposed of until we're finished with it.
      const graphicOwner = IModelApp.renderSystem.createGraphicOwner(graphic);

      // Install the decorator.
      const decorator = new GltfDecoration(graphicOwner, url, id);
      IModelApp.viewManager.addDecorator(decorator);

      // Fit the view to the decoration
      const range = new Range3d();
      graphic.unionRange(range);
      vp.view.lookAtVolume(range, vp.viewRect.aspect);
      vp.synchWithView({ animateFrustumChange: true });
      vp.viewCmdTargetCenter = undefined;

      // Once the iModel is closed, dispose of the graphic and uninstall the decorator.
      iModel.onClose.addOnce(() => {
        graphicOwner.disposeGraphic();
        IModelApp.viewManager.dropDecorator(decorator);
      });

      return true;
    } catch (_) {
      return false;
    }
  }
}
