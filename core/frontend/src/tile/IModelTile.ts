/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import {
  assert,
} from "@bentley/bentleyjs-core";
import {
  Range3d,
} from "@bentley/geometry-core";
import {
  BatchType,
  TileProps,
  ViewFlag,
} from "@bentley/imodeljs-common";
import {
  Tile,
  TileLoader,
} from "./TileTree";
import {
  TileRequest,
} from "./TileRequest";
import {
  IModelApp,
} from "../IModelApp";
import {
  IModelConnection,
} from "../IModelConnection";
import {
  IModelTileIO,
} from "./IModelTileIO";

function bisectRange3d(range: Range3d, takeUpper: boolean): void {
  const diag = range.diagonal();
  const pt = takeUpper ? range.high : range.low;
  if (diag.x > diag.y && diag.x > diag.z)
    pt.x = (range.low.x + range.high.x) / 2.0;
  else if (diag.y > diag.z)
    pt.y = (range.low.y + range.high.y) / 2.0;
  else
    pt.z = (range.low.z + range.high.z) / 2.0;
}

function bisectRange2d(range: Range3d, takeUpper: boolean): void {
  const diag = range.diagonal();
  const pt = takeUpper ? range.high : range.low;
  if (diag.x > diag.y)
    pt.x = (range.low.x + range.high.x) / 2.0;
  else
    pt.y = (range.low.y + range.high.y) / 2.0;
}

/** @hidden */
export namespace IModelTile {
  /** Flags controlling how tile content is produced. The flags are part of the ContentId.
   * @hidden
   */
  const enum ContentFlags {
    None = 0,
    AllowInstancing = 1 << 0,
    All = AllowInstancing,
  }

  interface ContentIdSpec {
    depth: number;
    i: number;
    j: number;
    k: number;
    multiplier: number;
  }

  abstract class ContentIdProvider {
    public get rootContentId(): string {
      return this.computeId(0, 0, 0, 0, 1);
    }

    public idFromParentAndMultiplier(parentId: string, multiplier: number): string {
      const lastSepPos = parentId.lastIndexOf(this._separator);
      assert(-1 !== lastSepPos);
      return parentId.substring(0, lastSepPos + 1) + multiplier.toString(16);
    }

    public specFromId(id: string): ContentIdSpec {
      const parts = id.split(this._separator);
      const len = parts.length;
      assert(len >= 5);
      return {
        depth: parseInt(parts[len - 5], 16),
        i: parseInt(parts[len - 4], 16),
        j: parseInt(parts[len - 3], 16),
        k: parseInt(parts[len - 2], 16),
        multiplier: parseInt(parts[len - 1], 16),
      };
    }

    public idFromSpec(spec: ContentIdSpec): string {
      return this.computeId(spec.depth, spec.i, spec.j, spec.k, spec.multiplier);
    }

    protected join(depth: number, i: number, j: number, k: number, mult: number): string {
      const sep = this._separator;
      return depth.toString(16) + sep + i.toString(16) + sep + j.toString(16) + sep + k.toString(16) + sep + mult.toString(16);
    }

    protected abstract get _separator(): string;
    protected abstract computeId(depth: number, i: number, j: number, k: number, mult: number): string;

    /** formatVersion is the maximum major version supported by the back-end supplying the tile tree.
     * Must ensure front-end does not request tiles of a format the back-end cannot supply, and back-end does
     * not supply tiles of a format the front-end doesn't recognize.
     */
    public static create(formatVersion?: number): ContentIdProvider {
      if (undefined !== formatVersion) {
        const majorVersion = Math.min((formatVersion >>> 0x10), IModelTileIO.CurrentVersion.Major);
        assert(majorVersion > 0);
        if (majorVersion > 1)
          return new ContentIdV2Provider(majorVersion);
      }

      return new ContentIdV1Provider();
    }
  }

  class ContentIdV1Provider extends ContentIdProvider {
    protected get _separator() { return "/"; }
    protected computeId(depth: number, i: number, j: number, k: number, mult: number): string {
      return this.join(depth, i, j, k, mult);
    }
  }

  class ContentIdV2Provider extends ContentIdProvider {
    private readonly _prefix: string;

    public constructor(majorVersion: number) {
      super();
      const flags = IModelApp.tileAdmin.enableInstancing ? ContentFlags.AllowInstancing : ContentFlags.None;
      this._prefix = this._separator + majorVersion.toString(16) + this._separator + flags.toString(16) + this._separator;
    }

    protected get _separator() { return "_"; }
    protected computeId(depth: number, i: number, j: number, k: number, mult: number): string {
      return this._prefix + this.join(depth, i, j, k, mult);
    }
  }

  /** @hidden */
  export class Loader extends TileLoader {
    private _iModel: IModelConnection;
    private _type: BatchType;
    private _edgesRequired: boolean;
    private readonly _contentIdProvider: ContentIdProvider;
    protected get _batchType() { return this._type; }
    protected get _loadEdges(): boolean { return this._edgesRequired; }

    public constructor(iModel: IModelConnection, formatVersion: number | undefined, batchType: BatchType, edgesRequired: boolean = true) {
      super();
      this._iModel = iModel;
      this._type = batchType;
      this._edgesRequired = edgesRequired;
      this._contentIdProvider = ContentIdProvider.create(formatVersion);
    }

    public get maxDepth(): number { return 32; }  // Can be removed when element tile selector is working.
    public get priority(): Tile.LoadPriority { return (BatchType.VolumeClassifier === this._batchType || BatchType.PlanarClassifier === this._batchType) ? Tile.LoadPriority.Classifier : Tile.LoadPriority.Primary; }
    public tileRequiresLoading(params: Tile.Params): boolean { return 0 !== params.maximumSize; }
    public get rootContentId(): string { return this._contentIdProvider.rootContentId; }

    protected static _viewFlagOverrides = new ViewFlag.Overrides();
    public get viewFlagOverrides() { return Loader._viewFlagOverrides; }

    public async getChildrenProps(parent: Tile): Promise<TileProps[]> {
      const kids: TileProps[] = [];

      // Leaf nodes have no children.
      if (parent.isLeaf)
        return kids;

      // One child, same range as parent, higher-resolution.
      if (parent.hasSizeMultiplier) {
        const sizeMultiplier = parent.sizeMultiplier * 2;
        const contentId = this._contentIdProvider.idFromParentAndMultiplier(parent.contentId, sizeMultiplier);
        kids.push({
          contentId,
          range: parent.range,
          contentRange: parent.contentRange,
          sizeMultiplier,
          isLeaf: false,
          maximumSize: 512,
        });

        return kids;
      }

      // Sub-divide parent's range into 4 (for 2d trees) or 8 (for 3d trees) child tiles.
      const parentSpec = this._contentIdProvider.specFromId(parent.contentId);
      assert(parent.depth === parentSpec.depth);

      const childSpec: ContentIdSpec = { ...parentSpec };
      childSpec.depth = parent.depth + 1;

      // This mask is a bitfield in which an 'on' bit indicates sub-volume containing no geometry.
      // Don't bother creating children or requesting content for such empty volumes.
      const emptyMask = IModelApp.tileAdmin.elideEmptyChildContentRequests ? parent.emptySubRangeMask : 0;

      const is2d = parent.root.is2d;
      const bisectRange = is2d ? bisectRange2d : bisectRange3d;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          for (let k = 0; k < (is2d ? 1 : 2); k++) {
            const emptyBit = 1 << (i + j * 2 + k * 4);
            if (0 !== (emptyMask & emptyBit))
              continue; // volume is known to contain no geometry.

            const range = parent.range.clone();
            bisectRange(range, 0 === i);
            bisectRange(range, 0 === j);
            if (!is2d)
              bisectRange(range, 0 === k);

            childSpec.i = parentSpec.i * 2 + i;
            childSpec.j = parentSpec.j * 2 + j;
            childSpec.k = parentSpec.k * 2 + k;

            const childId = this._contentIdProvider.idFromSpec(childSpec);
            kids.push({ contentId: childId, range, maximumSize: 512 });
          }
        }
      }

      return kids;
    }

    public async requestTileContent(tile: Tile): Promise<TileRequest.Response> {
      return this._iModel.tiles.getTileContent(tile.root.id, tile.contentId);
    }

    public adjustContentIdSizeMultiplier(contentId: string, sizeMultiplier: number): string {
      return this._contentIdProvider.idFromParentAndMultiplier(contentId, sizeMultiplier);
    }
  }
}

/**
 * Given a Tile, compute the ranges which would result from sub-dividing its range a la IModelTile.getChildrenProps().
 * This function exists strictly for debugging purposes.
 * @hidden
 */
export function computeChildRanges(tile: Tile): Array<{ range: Range3d, isEmpty: boolean }> {
  const emptyMask = tile.emptySubRangeMask;
  const is2d = tile.root.is2d;
  const bisectRange = is2d ? bisectRange2d : bisectRange3d;

  const ranges: Array<{ range: Range3d, isEmpty: boolean }> = [];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < (is2d ? 1 : 2); k++) {
        const emptyBit = 1 << (i + j * 2 + k * 4);
        const isEmpty = 0 !== (emptyMask & emptyBit);

        const range = tile.range.clone();
        bisectRange(range, 0 === i);
        bisectRange(range, 0 === j);
        if (!is2d)
          bisectRange(range, 0 === k);

        ranges.push({ range, isEmpty });
      }
    }
  }

  return ranges;
}
