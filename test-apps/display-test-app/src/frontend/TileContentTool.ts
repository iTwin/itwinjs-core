/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, ByteStream } from "@itwin/core-bentley";
import {
  ImdlReader, IModelApp, IModelTileTree, Tool,
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
      const stream = new ByteStream(bytes.buffer);
      const reader = ImdlReader.create(stream, tree.iModel, tree.modelId, tree.is3d, IModelApp.renderSystem, tree.batchType, tree.hasEdges, undefined, undefined, { tileId: contentId });
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
