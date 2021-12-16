/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Transform } from "@itwin/core-geometry";
import {
  DecorateContext, GraphicBranch, GraphicType, IModelApp, readGltfGraphics, RenderGraphic, Tool,
} from "@itwin/core-frontend";

class GltfDecoration {
  private readonly _graphic: RenderGraphic;
  private readonly _pickableId?: string;

  public constructor(graphic: RenderGraphic, pickableId?: string) {
    this._graphic = graphic;
    this._pickableId = pickableId;
  }

  public readonly useCachedDecorations = true;

  public decorate(context: DecorateContext): void {
    const branch = new GraphicBranch();
    branch.add(this._graphic);
    const transform = Transform.createTranslation(context.viewport.iModel.projectExtents.center);
    const graphic = context.createGraphicBranch(branch, transform);
    context.addDecoration(GraphicType.Scene, graphic);
  }

  public testDecorationHit(id: string): boolean {
    return undefined !== this._pickableId && id === this._pickableId;
  }
}

export class GltfDecorationTool extends Tool {
  public static override toolId = "AddGltfDecoration";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }

  public override async run() {
    const iModel = IModelApp.viewManager.selectedView?.iModel;
    if (!iModel)
      return false;

    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: "glTF",
            accept: { "model/*": [".gltf", ".glb"] },
          },
        ],
      });
      const file = await handle.getFile();
      const buffer = await file.arrayBuffer() as ArrayBuffer;
      let graphic = await readGltfGraphics({
        glb: new Uint8Array(buffer),
        iModel,
      });

      if (!graphic)
        return false;

      graphic = IModelApp.renderSystem.createGraphicOwner(graphic);
      IModelApp.viewManager.addDecorator(new GltfDecoration(graphic));
      return true;
    } catch (_) {
      return false;
    }
  }
}
