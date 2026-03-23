/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@itwin/core-frontend";
import { Point3d, Polyface } from "@itwin/core-geometry";
import {
  BoundingSphere,
  Cartesian3,
  ColorGeometryInstanceAttribute,
  ComponentDatatype,
  Geometry,
  GeometryAttribute,
  GeometryAttributes,
  GeometryInstance,
  PerInstanceColorAppearance,
  Primitive,
  PrimitiveCollection,
  PrimitiveType,
} from "@cesium/engine";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverter, RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";
import type { DecorationPrimitiveEntry, PolyfaceEntry } from "./DecorationTypes.js";

export class PolyfacePrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = 'polyface' as const;

  protected override getCollection(scene: CesiumScene): PrimitiveCollection {
    return scene.primitivesCollection;
  }

  protected override createPrimitiveFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    primitiveId: string,
    _index: number,
    _collection: PrimitiveCollection,
    iModel?: IModelConnection,
    originalData?: DecorationPrimitiveEntry[],
    _type?: string
  ): Primitive | undefined {
    const polyfaceEntry = originalData?.find((e): e is PolyfaceEntry => e.type === 'polyface');
    const polyface = polyfaceEntry?.polyface;
    const filled = polyfaceEntry?.filled ?? true;

    if (!polyface)
      return undefined;

    // Convert IndexedPolyface to Cesium geometry
    const geometry = this.convertPolyfaceToGeometry(polyface, iModel);
    if (!geometry)
      return undefined;

    const colors = this.extractFillAndLineColorsFromGraphic(graphic, 'polyface');
    if (!colors)
      return undefined;

    const { fillColor, lineColor } = colors;
    const color = filled ? fillColor : lineColor;
    const translucent = color.alpha < 1.0;

    const geometryInstance = new GeometryInstance({
      geometry,
      id: primitiveId,
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(color),
      },
    });

    const appearance = new PerInstanceColorAppearance({
      flat: true,
      translucent,
    });

    const primitive = new Primitive({
      geometryInstances: geometryInstance,
      appearance,
      asynchronous: false,
    });

    (primitive as any).id = primitiveId;
    return primitive;
  }

  private convertPolyfaceToGeometry(polyface: Polyface, iModel?: IModelConnection): Geometry | undefined {
    if (!polyface.data.point || !polyface.data.pointIndex)
      return undefined;

    // Extract vertices from polyface
    const points = polyface.data.point.getArray();
    if (!points || points.length === 0)
      return undefined;

    // Convert to Cartesian3 positions
    const positions = new Float64Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      const cartesian = this.convertPointToCartesian3(points[i], iModel);
      positions[i * 3] = cartesian.x;
      positions[i * 3 + 1] = cartesian.y;
      positions[i * 3 + 2] = cartesian.z;
    }

    // Use iTwin.js visitor to properly extract triangulated indices
    const visitor = polyface.createVisitor(0);
    const triangleIndices: number[] = [];

    while (visitor.moveToNextFacet()) {
      const numVertices = visitor.pointCount;

      if (numVertices === 3) {
        // Triangle - add directly
        triangleIndices.push(visitor.clientPointIndex(0));
        triangleIndices.push(visitor.clientPointIndex(1));
        triangleIndices.push(visitor.clientPointIndex(2));
      } else if (numVertices === 4) {
        // Quad - triangulate as two triangles
        const i0 = visitor.clientPointIndex(0);
        const i1 = visitor.clientPointIndex(1);
        const i2 = visitor.clientPointIndex(2);
        const i3 = visitor.clientPointIndex(3);

        // First triangle: 0,1,2
        triangleIndices.push(i0, i1, i2);
        // Second triangle: 0,2,3
        triangleIndices.push(i0, i2, i3);
      }
    }

    if (triangleIndices.length === 0)
      return undefined;

    // Create geometry attributes using triangulated indices
    const indices = triangleIndices;

    // Create geometry attributes
    const attributes = new GeometryAttributes();
    attributes.position = new GeometryAttribute({
      componentDatatype: ComponentDatatype.DOUBLE,
      componentsPerAttribute: 3,
      values: positions,
    });

    // Calculate normals if available
    if (polyface.data.normal && polyface.data.normalIndex) {
      const normals = polyface.data.normal.getArray();
      const normalData = new Float32Array(points.length * 3);

      // Map normals using normal indices
      const normalIndices = polyface.data.normalIndex;
      let vertexIndex = 0;
      for (const normalIndex of normalIndices) {
        if (normalIndex > 0 && vertexIndex < points.length) {
          const normal = normals[normalIndex - 1];
          normalData[vertexIndex * 3] = normal.x;
          normalData[vertexIndex * 3 + 1] = normal.y;
          normalData[vertexIndex * 3 + 2] = normal.z;
          vertexIndex++;
        }
      }

      attributes.normal = new GeometryAttribute({
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 3,
        values: normalData,
      });
    }

    const geometry = new Geometry({
      attributes,
      indices: new Uint32Array(indices),
      primitiveType: PrimitiveType.TRIANGLES,
      boundingSphere: BoundingSphere.fromVertices(Array.from(positions)),
    });

    return geometry;
  }

  private convertPointToCartesian3(point: Point3d, iModel?: IModelConnection): Cartesian3 {
    if (iModel) {
      // Use coordinate conversion if available
      return this.convertPointsToCartesian3([point], iModel)[0];
    } else {
      // Fallback: direct conversion
      return new Cartesian3(point.x, point.y, point.z);
    }
  }
}
