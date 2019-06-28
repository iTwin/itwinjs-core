/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */
import {
  assert,
} from "@bentley/bentleyjs-core";
import {
  Point3d,
  Range3d,
  XYZProps,
} from "@bentley/geometry-core";
import {
  AxisAlignedBox3d,
  TileProps,
} from "@bentley/imodeljs-common";
import {
  TileLoader,
 } from "./TileTree";
import {
  Tile,
} from "./Tile";
import {
  TileRequest,
} from "./TileRequest";

/** @internal */
export namespace A3xTile {
  export interface BoundsProps {
    center: XYZProps;
    halfLengths: XYZProps;
  }

  export function aabbFromBounds(props?: BoundsProps, result?: AxisAlignedBox3d): AxisAlignedBox3d {
    if (undefined === result)
      result = new Range3d();

    if (undefined === props)
      return result;

    const center = Point3d.fromJSON(props.center);
    const delta = Point3d.fromJSON(props.halfLengths);
    center.minus(delta, result.low);
    center.plus(delta, result.high);

    return result;
  }

  export type TextureType = "dxt1"; // ###TODO...

  export interface LayerSettingsProps {
    maxLevel: number;
    version: number;
    innerBounds: BoundsProps;
    outerBounds: BoundsProps;
    textureType: TextureType;
    type: string;
    lodWindowSize: {
      x: number;
      y: number;
    };
  }

  export class LayerSettings {
    public readonly maxLevel: number;
    public readonly innerBounds: AxisAlignedBox3d;
    public readonly outerBounds: AxisAlignedBox3d;
    public readonly maximumSize: number;

    public constructor(maxLevel: number, outerBounds: AxisAlignedBox3d, maximumSize: number, innerBounds?: AxisAlignedBox3d) {
      this.maxLevel = maxLevel;
      this.outerBounds = outerBounds;
      this.innerBounds = undefined !== innerBounds ? innerBounds : outerBounds;
      this.maximumSize = maximumSize;
    }

    public static fromJSON(props: LayerSettingsProps): LayerSettings | undefined {
      if ("terrain" !== props.type)
        return undefined;

      const outer = aabbFromBounds(props.outerBounds);
      const inner = aabbFromBounds(props.innerBounds);

      // Expect x == y but unsure if always true
      const maxSize = (props.lodWindowSize.x + props.lodWindowSize.y) / 2;

      return new LayerSettings(props.maxLevel, outer, maxSize, inner);
    }
  }

  export class Loader extends TileLoader {
    public readonly url: string; // ends with a '/'
    private readonly _maxDepth: number;
    private readonly _regex: RegExp;
    private readonly _maxSize: number;

    public constructor(url: string, maxDepth: number, maxSize: number) {
      super();
      this.url = url;
      this._maxDepth = maxDepth;
      this._maxSize = maxSize;
      this._regex = /\/(\d+)_(\d+)_(\d+)\.a3x/;
    }

    public get maxDepth() { return this._maxDepth; }
    public get priority() { return Tile.LoadPriority.Context; }
    protected get _loadEdges() { return false; } // ###TODO why is this in base class??

    public tileRequiresLoading(_params: Tile.Params): boolean {
      return true; // ###TODO?
    }

    public async getChildrenProps(parent: Tile): Promise<TileProps[]> {
      return this.createChildrenProps(parent.range, parent.contentId, parent.hasContentRange ? parent.contentRange : undefined);
    }

    public createChildrenProps(parentRange: Range3d, parentContentId: string, contentRange?: Range3d): TileProps[] {
      const children: TileProps[] = [ ];
      const p = parentRange;
      const c = p.center;
      const loZ = p.low.z;
      const hiZ = p.high.z;

      const ranges = [
        [
          new Range3d(p.low.x, p.low.y, loZ, c.x, c.y, hiZ),
          new Range3d(p.low.x, c.y, loZ, c.x, p.high.y, hiZ),
        ],
        [
          new Range3d(c.x, p.low.y, loZ, p.high.x, c.y, hiZ),
          new Range3d(c.x, c.y, loZ, p.high.x, p.high.y, hiZ),
        ],
      ];

      const parts = this.parseContentId(parentContentId);
      if (undefined === parts)
        return children;

      const llx = 2 * parts.x;
      const lly = 2 * parts.y;
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          const range = ranges[x][y];
          if (undefined !== contentRange && !contentRange.intersectsRange(range))
            continue;

          const contentId = this.formatContentId(parts.d + 1, llx + x, lly + y);
          children.push({
            contentId,
            range,
            maximumSize: this._maxSize,
          });
        }
      }

      return children;
    }

    public async requestTileContent(_tile: Tile): Promise<TileRequest.Response> {
      return undefined;
    }

    public async loadTileContent(_tile: Tile, _data: TileRequest.ResponseData, _isCanceled?: () => boolean): Promise<Tile.Content> {
      return { };
    }

    // /level/x/level_x_y.a3x
    public formatContentId(d: number, x: number, y: number): string {
      return "" + d + "/" + x + "/" + d + "_" + x + "_" + y + ".a3x";
    }

    public parseContentId(id: string): { x: number, y: number, d: number } | undefined {
      const match = id.match(this._regex);
      assert(null !== match);
      if (null === match)
        return undefined;

      return {
        d: parseInt(match[1], 10),
        x: parseInt(match[2], 10),
        y: parseInt(match[3], 10),
      };
    }
  }
}
