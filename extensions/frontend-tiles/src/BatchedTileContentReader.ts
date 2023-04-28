/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, Id64, Id64String } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import { Feature, FeatureTable, TileReadStatus } from "@itwin/core-common";
import {
  GltfDataType,
  GltfMeshPrimitive,
  GltfReader,
  GltfReaderArgs,
  GltfReaderResult,
} from "@itwin/core-frontend";

interface BatchedTileReaderArgs extends GltfReaderArgs {
  modelId: Id64String;
  isLeaf: boolean;
  range: Range3d;
}

/** Read batched tiles in 3d Tiles 1.1 format. Currently, we prefer to produce tiles in iMdl format, so this goes unused for now.
 * @internal
 */
export class BatchedTileContentReader extends GltfReader {
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
    const featureTable = this.readFeatureTable();
    await this.resolveResources();
    if (this._isCanceled)
      return { readStatus: TileReadStatus.Canceled, isLeaf: this._isLeaf };

    return this.readGltfAndCreateGraphics(
      this._isLeaf,
      featureTable,
      this._range
    );
  }

  private readFeatureTable(): FeatureTable | undefined {
    // ###TODO we're just assuming there's one property table with one u64 property containing element Ids.
    const tables =
      this._glTF.extensions?.EXT_structural_metadata?.propertyTables;
    const table = tables ? tables[0] : undefined;
    const elementIdProperty = table?.properties
      ? table.properties.ElementId
      : undefined;
    if (!elementIdProperty) return undefined;

    const bufferView = this._bufferViews[elementIdProperty.values];
    if (!bufferView || undefined === bufferView.buffer) return undefined;

    const bufferData = this._buffers[bufferView.buffer]?.resolvedBuffer;
    if (!bufferData) return undefined;

    assert(undefined !== bufferView.byteLength); // required by spec; TypeScript interface is wrong.
    const byteOffset = bufferView.byteOffset ?? 0;
    const bytes = bufferData.subarray(
      byteOffset,
      byteOffset + bufferView.byteLength
    );

    // 2 u32s per element Id.
    const elementIds = new Uint32Array(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength / 4
    );
    const numFeatures = elementIds.length / 2;
    const featureTable = new FeatureTable(numFeatures, this._modelId);
    for (let i = 0; i < numFeatures; i++) {
      const elementId = Id64.fromUint32Pair(
        elementIds[i * 2],
        elementIds[i * 2 + 1]
      );
      featureTable.insertWithIndex(new Feature(elementId), i);
    }

    return featureTable;
  }

  protected override readPrimitiveFeatures(
    primitive: GltfMeshPrimitive
  ): Feature | number[] | undefined {
    const ext = primitive.extensions?.EXT_mesh_features;
    if (ext) {
      // ###TODO making assumptions here.
      const view = this.getBufferView(
        primitive.attributes,
        `_FEATURE_ID_${ext.featureIds[0].attribute}`
      );
      // NB: 32-bit integers are not supported, but 8- and 16-bit integers will be converted to them.
      // With more than 64k features in the tile we represent the Ids as floats instead.
      const featureIds =
        view?.toBufferData(GltfDataType.Float) ??
        view?.toBufferData(GltfDataType.UInt32);
      if (view && featureIds) {
        const indices = [];
        for (let i = 0; i < featureIds.count; i++) {
          const featureId = featureIds.buffer[i * view.stride];
          indices.push(featureId);
        }

        return indices;
      }
    }

    return new Feature(this._modelId);
  }
}
