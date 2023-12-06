/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import {
  Matrix3d, Point3d, Range3d, Transform, Vector3d,
} from "@itwin/core-geometry";
import { Tileset3dSchema as schema } from "@itwin/core-common";
import { IModelConnection, RealityModelTileUtils, TileLoadPriority } from "@itwin/core-frontend";
import { BatchedTileTreeParams } from "./BatchedTileTree";
import { BatchedTile, BatchedTileParams } from "./BatchedTile";

/** @internal */
export interface BatchedTilesetProps extends schema.Tileset {
  extensions?: {
    BENTLEY_BatchedTileSet?: { // eslint-disable-line @typescript-eslint/naming-convention
      includedModels: Id64String[];
    };
  };
}

function isBatchedTileset(json: unknown): json is BatchedTilesetProps {
  if (typeof json !== "object")
    return false;

  const props = json as schema.Tileset;

  if (!props.root || !props.asset)
    return false;

  // ###TODO spec requires geometricError to be present on tileset and all tiles; exporter is omitting from tileset.
  if (undefined === props.geometricError)
    props.geometricError = props.root.geometricError;

  return true;
}

/** @internal */
export interface BatchedTilesetSpec {
  baseUrl: URL;
  props: BatchedTilesetProps;
}

/** @internal */
export namespace BatchedTilesetSpec {
  export function create(baseUrl: URL, json: unknown) {
    if (!isBatchedTileset(json))
      throw new Error("Invalid tileset JSON");

    return { baseUrl, props: json };
  }
}

function rangeFromBoundingVolume(vol: schema.BoundingVolume): Range3d {
  if (vol.box) {
    const center = new Point3d(vol.box[0], vol.box[1], vol.box[2]);
    const ux = new Vector3d(vol.box[3], vol.box[4], vol.box[5]);
    const uy = new Vector3d(vol.box[6], vol.box[7], vol.box[8]);
    const uz = new Vector3d(vol.box[9], vol.box[10], vol.box[11]);

    const range = Range3d.createNull();
    for (let i = -1; i <= 1; i += 2)
      for (let j = -1; j <= 1; j += 2)
        for (let k = -1; k <= 1; k += 2)
          range.extendPoint(center.plus3Scaled(ux, i, uy, j, uz, k));

    return range;
  } else if (vol.sphere) {
    const center = new Point3d(vol.sphere[0], vol.sphere[1], vol.sphere[2]);
    const radius = vol.sphere[3];
    return Range3d.createXYZXYZ(center.x - radius, center.y - radius, center.z - radius, center.x + radius, center.y + radius, center.z + radius);
  }

  // We won't get region bounding volumes in our tiles.
  throw new Error("region bounding volume unimplemented");
}

function transformFromJSON(json: schema.Transform): Transform {
  const translation = new Point3d(json[12], json[13], json[14]);
  const matrix = Matrix3d.createRowValues(
    json[0], json[4], json[8],
    json[1], json[5], json[9],
    json[2], json[6], json[10],
  );

  return Transform.createOriginAndMatrix(translation, matrix);
}

/** @internal */
export class BatchedTilesetReader {
  private readonly _iModel: IModelConnection;
  private readonly _tileset: schema.Tileset;
  public readonly baseUrl: URL;

  public constructor(spec: BatchedTilesetSpec, iModel: IModelConnection) {
    this._iModel = iModel;
    this._tileset = spec.props;
    this.baseUrl = spec.baseUrl;
  }

  public readTileParams(json: schema.Tile, parent?: BatchedTile): BatchedTileParams {
    const content = json.content;
    const geometricError = json.geometricError;
    const range = rangeFromBoundingVolume(json.boundingVolume);
    const isLeaf = undefined === json.children || json.children.length === 0;

    let transformToRoot;
    if (undefined !== parent) {
      const localToParent = json.transform ? transformFromJSON(json.transform) : undefined;
      const parentToRoot = parent.transformToRoot;
      if (localToParent) {
        if (parentToRoot)
          localToParent.multiplyTransformTransform(parentToRoot, localToParent);

        transformToRoot = localToParent;
      } else {
        transformToRoot = parentToRoot;
      }
    }

    // ###TODO evaluate this. The geometric errors in the tiles seem far too small.
    const maximumSizeScale = 8;
    return {
      parent,
      contentId: content?.uri ?? "",
      range,
      contentRange: content?.boundingVolume ? rangeFromBoundingVolume(content.boundingVolume) : undefined,
      isLeaf,
      maximumSize: maximumSizeScale * RealityModelTileUtils.maximumSizeFromGeometricTolerance(range, geometricError),
      childrenProps: isLeaf ? undefined : json.children,
      transformToRoot,
    };
  }

  public async readTileTreeParams(): Promise<BatchedTileTreeParams> {
    const root = this._tileset.root;
    const location = root.transform ? transformFromJSON(root.transform) : Transform.createIdentity();
    const extension = this._tileset.extensions?.BENTLEY_BatchedTileSet;
    const includedModels = extension ? new Set<Id64String>(extension.includedModels) : undefined;

    return {
      id: "spatial-models",
      modelId: this._iModel.transientIds.getNext(),
      iModel: this._iModel,
      location,
      priority: TileLoadPriority.Primary,
      rootTile: this.readTileParams(root),
      reader: this,
      includedModels,
    };
  }
}
