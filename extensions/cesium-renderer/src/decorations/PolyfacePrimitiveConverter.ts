/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { Polyface, Point3d } from "@itwin/core-geometry";
import { 
  BoundingSphere, 
  Cartesian3, 
  Color, 
  ColorGeometryInstanceAttribute, 
  ComponentDatatype, 
  Geometry, 
  GeometryAttribute,
  GeometryAttributes,
  GeometryInstance, 
  PerInstanceColorAppearance, 
  Primitive,
  PrimitiveType, 
} from "cesium";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverter, RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";
import { DecorationPrimitiveEntry } from "./DecorationTypes.js";

export class PolyfacePrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = 'polyface' as const;

  protected override getCollection(scene: CesiumScene): import('cesium').PrimitiveCollection {
    return scene.primitivesCollection;
  }

  protected override extractPrimitiveData(coordinateData: DecorationPrimitiveEntry[] | undefined, primitiveType: string): DecorationPrimitiveEntry[] | undefined {
    if (!coordinateData || !Array.isArray(coordinateData))
      return undefined;
    return coordinateData.filter((entry: DecorationPrimitiveEntry) => entry.type === primitiveType);
  }

  protected override createPrimitiveFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    primitiveId: string,
    _index: number,
    _collection: import('cesium').PrimitiveCollection,
    iModel?: IModelConnection,
    originalData?: unknown,
    _type?: string
  ): Primitive | null {
    const data = Array.isArray(originalData) ? (originalData as DecorationPrimitiveEntry[]) : undefined;
    const isPolyfaceEntry = (e: DecorationPrimitiveEntry): e is import('./DecorationTypes.js').PolyfaceEntry => e.type === 'polyface';
    const polyfaceEntry = Array.isArray(data) ? data.find((e): e is import('./DecorationTypes.js').PolyfaceEntry => isPolyfaceEntry(e)) : undefined;
    const polyface = polyfaceEntry?.polyface as Polyface | undefined;
    const filled = polyfaceEntry?.filled ?? true;
    
    if (!polyface)
      return null;

    // Convert IndexedPolyface to Cesium geometry
    const geometry = this.convertPolyfaceToGeometry(polyface, iModel);
    if (!geometry)
      return null;

    const colors = this.extractColorsFromGraphic(graphic);
    if (!colors)
      return null;

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

    return primitive;
  }

  public override clearDecorations(scene: CesiumScene): void {
    if (scene?.cesiumScene?.primitives) {
      const polyfacePrimitives = [];
      for (let i = scene.cesiumScene.primitives.length - 1; i >= 0; i--) {
        const primitive = scene.cesiumScene.primitives.get(i);
        if (primitive && primitive.id && typeof primitive.id === 'string' && primitive.id.includes('polyface')) {
          polyfacePrimitives.push(primitive);
        }
      }
      polyfacePrimitives.forEach(primitive => scene.cesiumScene.primitives.remove(primitive));
    }
  }

  private convertPolyfaceToGeometry(polyface: Polyface, iModel?: IModelConnection): Geometry | null {
    if (!polyface.data.point || !polyface.data.pointIndex)
      return null;

    // Extract vertices from polyface
    const points = polyface.data.point.getArray();
    if (!points || points.length === 0)
      return null;

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
      return null;

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

  private extractColorsFromGraphic(graphic: RenderGraphicWithCoordinates): { fillColor: Color; lineColor: Color; outlineWanted: boolean } | undefined {
    // Prefer symbology captured in coordinateData (from CoordinateBuilder)
    const coordData = graphic?._coordinateData as DecorationPrimitiveEntry[] | undefined;
    const isPolyface = (e: DecorationPrimitiveEntry): e is import('./DecorationTypes.js').PolyfaceEntry => e.type === 'polyface';
    const entry = coordData?.find((e) => isPolyface(e) && !!e.symbology?.lineColor);
    const toCesium = (cd?: ColorDef) => {
      if (!cd) return undefined;
      const c = cd.colors;
      const alpha = 255 - (c.t ?? 0);
      return Color.fromBytes(c.r, c.g, c.b, alpha);
    };
    
    if (entry) {
      const lineColor = toCesium(entry.symbology.lineColor as ColorDef | undefined);
      const fillColor = toCesium(entry.symbology.fillColor as ColorDef | undefined);
      if (lineColor && fillColor) {
        const outlineWanted = !Color.equals(lineColor, fillColor);
        return { fillColor, lineColor, outlineWanted };
      }
    }

    // Otherwise, use graphic.symbology as provided
    const symbology = (graphic as unknown as { symbology?: { color?: ColorDef; fillColor?: ColorDef } })?.symbology;
    const lineDef = symbology?.color as ColorDef | undefined;
    const fillDef = (symbology?.fillColor ?? symbology?.color) as ColorDef | undefined;
    const lineColor2 = toCesium(lineDef);
    const fillColor2 = toCesium(fillDef);
    if (!lineColor2 || !fillColor2)
      return undefined;
    const outlineWanted2 = !Color.equals(lineColor2, fillColor2);
    return { fillColor: fillColor2, lineColor: lineColor2, outlineWanted: outlineWanted2 };
  }
}
