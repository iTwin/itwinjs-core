/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import { createDecoderModule } from "draco3d";
import { Point2d, Point3d, Range3d } from "@itwin/core-geometry";
import { OctEncodedNormal, QParams3d, QPoint3d, QPoint3dList } from "@itwin/core-common";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { Triangle } from "../render/primitives/Primitives";
import { assert } from "@itwin/core-bentley";

export interface DecodedPointCloud {
  qParams: QParams3d;
  qPoints: Uint16Array;
  colors?: Uint8Array;
}

/** @internal */
export class DracoDecoder {
  private static _dracoDecoderModule: any;

  public static readDracoPointCloud(bufferData: Uint8Array, attributeId: number, colorAttributeId?: number): undefined | DecodedPointCloud {
    if (!DracoDecoder._dracoDecoderModule)
      DracoDecoder._dracoDecoderModule = createDecoderModule(undefined);

    const dracoModule = DracoDecoder._dracoDecoderModule;
    const dracoDecoder = new dracoModule.Decoder();

    const buffer = new dracoModule.DecoderBuffer();
    buffer.Init(bufferData, bufferData.length);

    const geometryType = dracoDecoder.GetEncodedGeometryType(buffer);
    if (geometryType !== dracoModule.POINT_CLOUD)
      return undefined;

    const dracoPointCloud = new dracoModule.PointCloud();
    const decodingStatus = dracoDecoder.DecodeBufferToPointCloud(buffer, dracoPointCloud);
    dracoModule.destroy(buffer);
    if (!decodingStatus.ok() || dracoPointCloud.ptr === 0)
      return undefined;

    const quantizedPoints = DracoDecoder.decodeAndQuantize(dracoPointCloud, dracoDecoder, attributeId);
    let decodedPointCloud: DecodedPointCloud | undefined;
    if (quantizedPoints) {
      decodedPointCloud = quantizedPoints;
      if (undefined !== colorAttributeId) {
        const colorDracoAttribute = dracoDecoder.GetAttributeByUniqueId(dracoPointCloud, colorAttributeId);
        if (colorDracoAttribute) {
          const dracoColors = new DracoDecoder._dracoDecoderModule.DracoUInt8Array();
          dracoDecoder.GetAttributeUInt8ForAllPoints(dracoPointCloud, colorDracoAttribute, dracoColors);
          const length = 3 * dracoPointCloud.num_points();
          const attrLength = dracoColors.size();
          assert(length === attrLength);
          decodedPointCloud.colors = new Uint8Array(length);
          for (let i = 0; i < length; i++)
            decodedPointCloud.colors[i] = dracoColors.GetValue(i);
        }
      }
    }
    dracoModule.destroy(dracoPointCloud);
    dracoModule.destroy(dracoDecoder);
    return decodedPointCloud;
  }

  public static readDracoMesh(mesh: Mesh, _primitive: any, bufferData: Uint8Array, attributes: any): Mesh | undefined {
    if (!DracoDecoder._dracoDecoderModule)
      DracoDecoder._dracoDecoderModule = createDecoderModule(undefined);

    const dracoModule = DracoDecoder._dracoDecoderModule;
    const dracoDecoder = new dracoModule.Decoder();

    const buffer = new dracoModule.DecoderBuffer();
    buffer.Init(bufferData, bufferData.length);

    const geometryType = dracoDecoder.GetEncodedGeometryType(buffer);
    if (geometryType !== dracoModule.TRIANGULAR_MESH)
      return undefined;

    const dracoGeometry = new dracoModule.Mesh();
    const decodingStatus = dracoDecoder.DecodeBufferToMesh(buffer, dracoGeometry);
    dracoModule.destroy(buffer);
    if (!decodingStatus.ok() || dracoGeometry.ptr === 0)
      return undefined;

    if (!DracoDecoder.decodeTriangles(mesh, dracoGeometry, dracoDecoder) ||
      !DracoDecoder.decodeVertices(mesh.points, dracoGeometry, dracoDecoder, attributes.POSITION))
      return undefined;
    DracoDecoder.decodeUVParams(mesh.uvParams, dracoGeometry, dracoDecoder, attributes.TEXCOORD_0);
    DracoDecoder.decodeNormals(mesh.normals, dracoGeometry, dracoDecoder, attributes.NORMAL);
    if (attributes._BATCHID !== undefined && mesh.features !== undefined)
      DracoDecoder.decodeBatchIds(mesh.features, dracoGeometry, dracoDecoder, attributes._BATCHID);
    dracoModule.destroy(dracoGeometry);
    dracoModule.destroy(dracoDecoder);

    return mesh;
  }
  private static decodeVertices(qPoints: QPoint3dList, dracoGeometry: any, dracoDecoder: any, attributeId: number): boolean {
    const dracoAttribute = dracoDecoder.GetAttributeByUniqueId(dracoGeometry, attributeId);
    if (undefined === dracoAttribute) return false;

    const quantized = DracoDecoder.decodeAndQuantize(dracoGeometry, dracoDecoder, attributeId);
    qPoints.fromTypedArray(quantized.range, quantized.qPoints);
    return true;
  }
  private static decodeBatchIds(features: Mesh.Features, dracoGeometry: any, dracoDecoder: any, attributeId: number): boolean {
    const dracoAttribute = dracoDecoder.GetAttributeByUniqueId(dracoGeometry, attributeId);
    if (undefined === dracoAttribute) return false;

    const unquantizedValues = new DracoDecoder._dracoDecoderModule.DracoFloat32Array();
    const numPoints = dracoGeometry.num_points();
    dracoDecoder.GetAttributeFloatForAllPoints(dracoGeometry, dracoAttribute, unquantizedValues);
    const featureIndices = [];
    featureIndices.length = numPoints;
    for (let i = 0; i < numPoints; i++)
      featureIndices[i] = unquantizedValues.GetValue(i);

    features.setIndices(featureIndices);
    return true;
  }
  private static decodeUVParams(points: Point2d[], dracoGeometry: any, dracoDecoder: any, attributeId: number): boolean {
    const dracoAttribute = dracoDecoder.GetAttributeByUniqueId(dracoGeometry, attributeId);
    if (undefined === dracoAttribute) return false;

    const numPoints = dracoGeometry.num_points();
    const unquantizedValues = new DracoDecoder._dracoDecoderModule.DracoFloat32Array();
    dracoDecoder.GetAttributeFloatForAllPoints(dracoGeometry, dracoAttribute, unquantizedValues);
    for (let i = 0, j = 0; i < numPoints; i++)
      points.push(new Point2d(unquantizedValues.GetValue(j++), unquantizedValues.GetValue(j++)));
    DracoDecoder._dracoDecoderModule.destroy(unquantizedValues);
    return true;
  }

  private static decodeNormals(normals: OctEncodedNormal[], dracoGeometry: any, dracoDecoder: any, attributeId: number): boolean {
    const dracoAttribute = dracoDecoder.GetAttributeByUniqueId(dracoGeometry, attributeId);
    if (undefined === dracoAttribute) return false;

    const numPoints = dracoGeometry.num_points();
    const unquantizedValues = new DracoDecoder._dracoDecoderModule.DracoFloat32Array();
    dracoDecoder.GetAttributeFloatForAllPoints(dracoGeometry, dracoAttribute, unquantizedValues);
    for (let i = 0, j = 0; i < numPoints; i++)
      normals.push(OctEncodedNormal.fromVector({ x: unquantizedValues.GetValue(j++), y: unquantizedValues.GetValue(j++), z: unquantizedValues.GetValue(j++) }));
    DracoDecoder._dracoDecoderModule.destroy(unquantizedValues);
    return true;
  }
  private static decodeTriangles(mesh: Mesh, dracoGeometry: any, dracoDecoder: any) {
    const numFaces = dracoGeometry.num_faces();
    const faceIndices = new DracoDecoder._dracoDecoderModule.DracoInt32Array();
    const numIndices = numFaces * 3;
    const indexArray = new Uint32Array();
    const triangle = new Triangle();

    for (let i = 0; i < numFaces; ++i) {
      dracoDecoder.GetFaceFromMesh(dracoGeometry, i, faceIndices);
      triangle.setIndices(faceIndices.GetValue(0), faceIndices.GetValue(1), faceIndices.GetValue(2));
      mesh.addTriangle(triangle);
    }

    DracoDecoder._dracoDecoderModule.destroy(faceIndices);

    return {
      typedArray: indexArray,
      numberOfIndices: numIndices,
    };
  }

  private static decodeAndQuantize(dracoGeometry: any, dracoDecoder: any, attributeId: number): { qParams: QParams3d, range: Range3d, qPoints: Uint16Array } {
    const dracoModule = DracoDecoder._dracoDecoderModule;
    const dracoAttribute = dracoDecoder.GetAttributeByUniqueId(dracoGeometry, attributeId);
    const numPoints = dracoGeometry.num_points();

    const unquantizedValues = new DracoDecoder._dracoDecoderModule.DracoFloat32Array();
    const range = Range3d.createNull();
    dracoDecoder.GetAttributeFloatForAllPoints(dracoGeometry, dracoAttribute, unquantizedValues);
    for (let i = 0, j = 0; i < numPoints; i++)
      range.extendXYZ(unquantizedValues.GetValue(j++), unquantizedValues.GetValue(j++), unquantizedValues.GetValue(j++));

    const qParams = QParams3d.fromRange(range);
    const qPoints = new Uint16Array(3 * numPoints);
    const point = Point3d.createZero();
    const qPoint = QPoint3d.create(point, qParams);
    for (let i = 0, j = 0; i < numPoints; i++) {
      point.set(unquantizedValues.GetValue(j), unquantizedValues.GetValue(j + 1), unquantizedValues.GetValue(j + 2));
      qPoint.init(point, qParams);
      qPoints[j++] = qPoint.x;
      qPoints[j++] = qPoint.y;
      qPoints[j++] = qPoint.z;
    }

    dracoModule.destroy(unquantizedValues);
    return { qParams, range, qPoints };
  }
}
