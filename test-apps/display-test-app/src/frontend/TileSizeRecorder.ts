/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, Id64String } from "@itwin/core-bentley";
import { iModelTileTreeIdToString } from "@itwin/core-common";
import { IModelApp, IModelTileTree, TileAdmin, Tool } from "@itwin/core-frontend";
import { copyStringToClipboard, parseToggle } from "@itwin/frontend-devtools";

interface ContentId {
  modelId: Id64String;
  contentId: string;
}

class TileSizeRecorder {
  // Outer dictionary maps unique stringified ContentIds to tile trees for which that tile's content has been loaded since recording began.
  // Inner dictionary maps stringified unique tile tree Ids to the tile's content size (prior to decoding) loaded by that tree.
  private readonly _records = new Map<string, Map<string, number>>();

  public record(contentId: ContentId, tree: IModelTileTree, size: number): void {
    const id = `${tree.iModel.key}:${contentId.modelId}:${contentId.contentId}`;
    let record = this._records.get(id);
    if (!record)
      this._records.set(id, record = new Map<string, number>());

    // Note: use the same (fake) model Id for every tree Id for grouping - the actual model Ids are in the row labels.
    const treeId = iModelTileTreeIdToString("1", tree.iModelTileTreeId, IModelApp.tileAdmin);
    record.set(treeId, size);
  }

  // Produce CSV of the format:
  //  <empty>,  TreeId1,TreeId2,..., TreeIdN
  //  contentId1,size1, size2, ,..., sizeN
  //  contentId2, ...
  //  ...
  //  contentIdN, ...
  // If a given content Id has no size recorded for a given tree Id, the value in that row and column is output as zero.
  public toCSV(): string {
    const headerRow = ["Content Id"];
    const treeIdToColumnIndex = new Map<string, number>();
    for (const map of this._records.values()) {
      for (const treeId of map.keys()) {
        if (!treeIdToColumnIndex.has(treeId)) {
          treeIdToColumnIndex.set(treeId, treeIdToColumnIndex.size + 1); // first column is for row labels
          headerRow.push(treeId);
        }
      }
    }

    const rows: Array<string[]> = [headerRow];
    for (const [contentId, sizes] of this._records) {
      const row = [contentId];
      for (const [treeId, size] of sizes)
        row[treeIdToColumnIndex.get(treeId)!] = size.toString(10);

      rows.push(row);
    }

    // ###TODO aggregate values (min,max,sum,mean; absolute delta, % delta)
    return rows.map((row) => row.join(",")).join("\n");
  }
}

let recorder: TileSizeRecorder | undefined;
// eslint-disable-next-line @typescript-eslint/unbound-method
const generateTileContent = TileAdmin.prototype.generateTileContent;

/** A quick and dirty tool to record the sizes of tiles loaded during a recording session.
 * The size recorded is that of the encoded data - not of the decoded graphics.
 * Key-in `dta record tilesize` once to begin a recording sessions.
 * Key it in again to stop the session and copy the results to the clipboard in CSV format (see comments on TileSizeRecorder.toCSV for details).
 * This is mainly useful when you're loading the same tile content from different versions of tile tree (e.g., one with edges enabled, one without) and want to compare
 * how the sizes differ between them.
 */
export class RecordTileSizesTool extends Tool {
  public static override toolId = "RecordTileSizes";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      return this.run(enable);

    return false;
  }

  public override async run(enable?: boolean): Promise<boolean> {
    const currentlyEnabled = undefined !== recorder;
    enable = enable ?? !currentlyEnabled;
    if (enable === currentlyEnabled)
      return false;

    if (enable) {
      recorder = new TileSizeRecorder();
      IModelApp.tileAdmin.generateTileContent = async (tile: { iModelTree: IModelTileTree, contentId: string, request?: { isCanceled: boolean } }): Promise<Uint8Array> => {
        const content = await generateTileContent.bind(IModelApp.tileAdmin, tile)();
        recorder?.record({ contentId: tile.contentId, modelId: tile.iModelTree.modelId }, tile.iModelTree, content.byteLength);
        return content;
      };

      return true;
    }

    IModelApp.tileAdmin.generateTileContent = generateTileContent.bind(IModelApp.tileAdmin);
    assert(undefined !== recorder);
    copyStringToClipboard(recorder.toCSV());
    recorder = undefined;
    return true;
  }
}
