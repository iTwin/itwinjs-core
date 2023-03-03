/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import { TileReadStatus } from "@itwin/core-common";
import {
  GltfReader, GltfReaderArgs, GltfReaderResult,
} from "@itwin/core-frontend";

interface BatchedTileReaderArgs extends GltfReaderArgs {
  modelId: Id64String;
  isLeaf: boolean;
  range: Range3d;
}

export class BatchedTileReader extends GltfReader {
  private readonly _modelId: Id64String;
  private readonly _isLeaf: boolean;
  private readonly _range: Range3d;

  public constructor(args: BatchedTileReaderArgs) {
    super(args);
    this._modelId = args.modelId;
    this._isLeaf = args.isLeaf;
    this._range = args.range;
  }

  public override async read(): Promise<GltfReaderResult> {
    const featureTable = undefined; // ###TODO
    const transformToRoot = undefined; // ###TODO?
    await this.resolveResources();
    if (this._isCanceled)
      return { readStatus: TileReadStatus.Canceled, isLeaf: this._isLeaf };

    return this.readGltfAndCreateGraphics(this._isLeaf, featureTable, this._range, transformToRoot);
  }
}
