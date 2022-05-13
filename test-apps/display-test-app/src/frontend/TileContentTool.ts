/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, ByteStream, Guid } from "@itwin/core-bentley";
import { PersistentGraphicsRequestProps } from "@itwin/core-common";
import {
  ImdlReader, IModelApp, IModelConnection, IModelTileTree, Tool,
} from "@itwin/core-frontend";
import { parseArgs } from "@itwin/frontend-devtools";

export class GenerateTileContentTool extends Tool {
  public static override toolId = "GenerateTileContent";
  public static override get minArgs() { return 2; }
  public static override get maxArgs() { return 2; }

  public override async run(args?: { tree: IModelTileTree, contentId: string }) {
    if (!args)
      return false;

    try {
      const { tree, contentId } = args;
      const bytes = await IModelApp.tileAdmin.generateTileContent({ contentId, iModelTree: tree });
      const stream = ByteStream.fromUint8Array(bytes);
      const { iModel, modelId, is3d, containsTransformNodes } = tree;
      const reader = ImdlReader.create({
        stream, iModel, modelId, is3d, containsTransformNodes,
        system: IModelApp.renderSystem,
        type: tree.batchType,
        loadEdges: false !== tree.edgeOptions,
        options: { tileId: contentId },
      });

      assert(undefined !== reader);
      await reader.read();
      return true;
    } catch (err) {
      if (err instanceof Error)
        alert(err.toString());

      return false;
    }
  }

  public override async parseAndRun(...input: string[]) {
    const iModel = IModelApp.viewManager.selectedView?.iModel;
    if (!iModel)
      return false;

    const args = parseArgs(input);
    const contentId = args.get("c");
    const modelId = args.get("m");
    if (!contentId || !modelId)
      return false;

    for (const owner of iModel.tiles) {
      const tree = owner.owner.tileTree;
      if (tree instanceof IModelTileTree && tree.modelId === modelId)
        return this.run({ tree, contentId });
    }

    return false;
  }
}

export class GenerateElementGraphicsTool extends Tool {
  public static override toolId = "GenerateElementGraphics";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 2; }

  public override async run(props?: PersistentGraphicsRequestProps, iModel?: IModelConnection): Promise<boolean> {
    if (!props || !iModel)
      return false;

    await IModelApp.tileAdmin.requestElementGraphics(iModel, props);
    return true;
  }

  public override async parseAndRun(...input: string[]) {
    const args = parseArgs(input);
    const elementId = args.get("e");
    if (!elementId)
      return false;

    return this.run({
      id: Guid.createValue(),
      elementId,
      toleranceLog10: args.getInteger("t") ?? -2,
    }, IModelApp.viewManager.selectedView?.iModel);
  }
}
