/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { createDecoderModule } from "draco3d";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { QPoint3dList/*, QParams3d, QParams2d, QPoint2dList */ } from "@bentley/imodeljs-common";
import { Point2d, Point3d } from "@bentley/geometry-core";
import { Triangle } from "../render/primitives/Primitives";

export class DracoDecoder {
  private static _dracoDecoderModule: any; /** @hidden */

  public static readDracoMesh(mesh: Mesh, _primitive: any, bufferData: Uint8Array): Mesh | undefined {
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
      !DracoDecoder.decodeVertices(mesh.points, dracoGeometry, dracoDecoder))
      return undefined;
    DracoDecoder.decodeUVParams(mesh.uvParams, dracoGeometry, dracoDecoder);
    dracoModule.destroy(dracoGeometry);
    dracoModule.destroy(dracoDecoder);

    return mesh;
  }
  private static decodeVertices(qPoints: QPoint3dList, dracoGeometry: any, dracoDecoder: any): boolean {
    const dracoAttribute = dracoDecoder.GetAttributeByUniqueId(dracoGeometry, dracoDecoder.GetAttributeId(dracoGeometry, DracoDecoder._dracoDecoderModule.POSITION));
    if (undefined === dracoAttribute) return false;

    const numPoints = dracoGeometry.num_points();

    /* Quantization WIP...
    const transform = new DracoDecoder._dracoDecoderModule.AttributeQuantizationTransform();
    const vertexArrayLength = 3 * numPoints;

    const isQuantized = transform.InitFromAttribute(dracoAttribute);
    if (isQuantized && 4 === dracoAttribute.data_type()) {   // If the data is already unsigned 16 bit (what our shaders support) then use it directly -- else get floats and we'll have to requantize.
      dracoDecoder.SkipAttributeTransform(DracoDecoder._dracoDecoderModule.POSITION);
      const quantizedValues = new DracoDecoder._dracoDecoderModule.DracoUInt16Array();
      dracoDecoder.GetAttributeUInt16ForAllPoints(dracoGeometry, dracoAttribute, quantizedValues);
      const typedArray = new Uint16Array(vertexArrayLength);
      const transformRange = transform.range();
      const transformMin = new Point3d(transform.min_value(0), transform.min_value(1), transform.min_value(2));
      for (let i = 0; i < vertexArrayLength; i++)
        typedArray[i] = quantizedValues.GetValue(i);

      const range = new Range3d(transformMin.x, transformMin.y, transformMin.z, transformMin.x + transformRange, transformMin.y + transformRange, transformMin.z + transformRange);
      QPoint3dList.fromTypedArray(typedArray, range, qPoints);
    } else  { */
    const unquantizedValues = new DracoDecoder._dracoDecoderModule.DracoFloat32Array();
    dracoDecoder.GetAttributeFloatForAllPoints(dracoGeometry, dracoAttribute, unquantizedValues);
    const points = [];
    for (let i = 0, j = 0; i < numPoints; i++)
      points.push(new Point3d(unquantizedValues.GetValue(j++), unquantizedValues.GetValue(j++), unquantizedValues.GetValue(j++)));

    QPoint3dList.fromPoints(points, qPoints);
    // }
    return true;
  }
  private static decodeUVParams(points: Point2d[], dracoGeometry: any, dracoDecoder: any): boolean {
    const dracoAttribute = dracoDecoder.GetAttributeByUniqueId(dracoGeometry, dracoDecoder.GetAttributeId(dracoGeometry, DracoDecoder._dracoDecoderModule.TEX_COORD));
    if (undefined === dracoAttribute) return false;

    const numPoints = dracoGeometry.num_points();

    /* Quantization WIP.
    const vertexArrayLength = 2 * numPoints;
    const transform = new DracoDecoder._dracoDecoderModule.AttributeQuantizationTransform();
    const isQuantized = transform.InitFromAttribute(dracoAttribute);
    if (isQuantized && 4 === dracoAttribute.data_type()) {   // If the data is already unsigned 16 bit (what our shaders support) then use it directly -- else get floats and we'll have to requantize.
      dracoDecoder.SkipAttributeTransform(DracoDecoder._dracoDecoderModule.TEX_COORD);
      const quantizedValues = new DracoDecoder._dracoDecoderModule.DracoUInt16Array();
      dracoDecoder.GetAttributeUInt16ForAllPoints(dracoGeometry, dracoAttribute, quantizedValues);
      const typedArray = new Uint16Array(vertexArrayLength);
      const transformRange = transform.range();
      const transformMin = new Point2d(transform.min_value(0), transform.min_value(1));
      for (let i = 0; i < vertexArrayLength; i++)
        typedArray[i] = quantizedValues.GetValue(i);

      const range = new Range2d(transformMin.x, transformMin.y, transformMin.x + transformRange, transformMin.y + transformRange);
      return QPoint2dList.fromTypedArray(typedArray, range);
    } else { */
    const unquantizedValues = new DracoDecoder._dracoDecoderModule.DracoFloat32Array();
    dracoDecoder.GetAttributeFloatForAllPoints(dracoGeometry, dracoAttribute, unquantizedValues);
    for (let i = 0, j = 0; i < numPoints; i++)
      points.push(new Point2d(unquantizedValues.GetValue(j++), unquantizedValues.GetValue(j++)));
    // }
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
}
