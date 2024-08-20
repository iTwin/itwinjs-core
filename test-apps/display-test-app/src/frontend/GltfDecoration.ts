/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import {
  DecorateContext, GraphicBranch, GraphicType, IModelApp, IModelConnection, readGltfGraphics, readGltfTemplate, RenderGraphic, RenderInstances, RenderInstancesParamsBuilder, Tool,
} from "@itwin/core-frontend";
import { parseArgs } from "@itwin/frontend-devtools";
import { Id64String } from "@itwin/core-bentley";

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

function createInstances(numInstances: number, templateRange: Range3d, iModel: IModelConnection, modelId: Id64String): RenderInstances | undefined {
  if (numInstances <= 1) {
    return undefined;
  }

  const maxExtents = iModel.projectExtents.clone();
  const projectCenter = iModel.projectExtents.center;
  maxExtents.low.subtractInPlace(projectCenter);
  maxExtents.high.subtractInPlace(projectCenter);

  function applyRandomOffset(pos: Point3d, coord: "x" | "y" | "z"): void {
    const r = Math.random() * 2 *maxExtents.high[coord] - projectCenter[coord];
    pos[coord] += r;
  }

  function computeRandomPosition(): Point3d {
    const pos = templateRange.center;
    applyRandomOffset(pos, "x");
    applyRandomOffset(pos, "y");
    applyRandomOffset(pos, "z");
    return pos;
  }

  const builder = RenderInstancesParamsBuilder.create({ modelId });
  for (let i = 0; i < numInstances; i++) {
    const origin = computeRandomPosition();
    builder.add({
      transform: Transform.createTranslation(origin),
      feature: iModel.transientIds.getNext(),
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
  public static override get maxArgs() { return 1; }

  private _url?: string;
  private _numInstances = 1;

  public override async parseAndRun(...inArgs: string[]) {
    const args = parseArgs(inArgs);
    this._url = args.get("u");
    this._numInstances = args.getInteger("i") ?? 1;
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

      const instances = createInstances(this._numInstances, gltfTemplate.boundingBox, vp.iModel, modelId);
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
