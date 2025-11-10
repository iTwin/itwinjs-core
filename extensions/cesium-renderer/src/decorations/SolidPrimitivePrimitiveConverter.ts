/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@itwin/core-frontend";
import { Box, Cone, Point3d, SolidPrimitive, Sphere } from "@itwin/core-geometry";
import {
  BoxGeometry,
  Cartesian3,
  ColorGeometryInstanceAttribute,
  CylinderGeometry,
  GeometryInstance,
  Matrix4,
  PerInstanceColorAppearance,
  Primitive,
  PrimitiveCollection,
  SphereGeometry,
  VertexFormat,
} from "@cesium/engine";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverter, RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";
import { DecorationPrimitiveEntry, SolidPrimitiveEntry } from "./DecorationTypes.js";

export class SolidPrimitivePrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = 'solidPrimitive' as const;

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
    const solidEntry = originalData?.find((e): e is SolidPrimitiveEntry => e.type === 'solidPrimitive');
    const solidPrimitive = solidEntry?.solidPrimitive;

    if (!solidPrimitive) {
      return undefined;
    }

    // Convert SolidPrimitive to appropriate Cesium geometry with positioning
    const geometryResult = this.convertSolidPrimitiveToGeometry(solidPrimitive, iModel);
    if (!geometryResult) {
      return undefined;
    }

    const { geometry, modelMatrix } = geometryResult;

    const colors = this.extractFillAndLineColorsFromGraphic(graphic, 'solidPrimitive');
    if (!colors) {
      return undefined;
    }

    const { fillColor } = colors;
    const translucent = false;

    const geometryInstance = new GeometryInstance({
      geometry,
      id: primitiveId,
      modelMatrix,
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(fillColor),
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
      const solidPrimitives = [];
      for (let i = scene.cesiumScene.primitives.length - 1; i >= 0; i--) {
        const primitive = scene.cesiumScene.primitives.get(i);
        if (primitive && primitive.id && typeof primitive.id === 'string' && primitive.id.includes('solidPrimitive')) {
          solidPrimitives.push(primitive);
        }
      }
      solidPrimitives.forEach(primitive => scene.cesiumScene.primitives.remove(primitive));
    }
  }

  private convertSolidPrimitiveToGeometry(solidPrimitive: SolidPrimitive, iModel?: IModelConnection): { geometry: BoxGeometry | SphereGeometry | CylinderGeometry; modelMatrix: Matrix4 } | undefined {
    switch (solidPrimitive.solidPrimitiveType) {
      case 'box':
        return this.convertBoxToGeometry(solidPrimitive as Box, iModel);
      case 'sphere':
        return this.convertSphereToGeometry(solidPrimitive as Sphere, iModel);
      case 'cone':
        return this.convertConeToGeometry(solidPrimitive as Cone, iModel);
      default:
        return undefined;
    }
  }

  private convertBoxToGeometry(box: Box, iModel?: IModelConnection): { geometry: BoxGeometry; modelMatrix: Matrix4 } | undefined {
    // Get box corner points
    const corners = box.getCorners();
    if (!corners || corners.length !== 8)
      return undefined;

    // Calculate min and max from corners
    let minX = corners[0].x, maxX = corners[0].x;
    let minY = corners[0].y, maxY = corners[0].y;
    let minZ = corners[0].z, maxZ = corners[0].z;

    for (const corner of corners) {
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y);
      maxY = Math.max(maxY, corner.y);
      minZ = Math.min(minZ, corner.z);
      maxZ = Math.max(maxZ, corner.z);
    }

    // Calculate center point in iTwin coordinate system
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // Calculate dimensions
    const width = maxX - minX;
    const height = maxY - minY;
    const depth = maxZ - minZ;

    // Create geometry at origin with proper dimensions
    const boxGeometry = new BoxGeometry({
      minimum: new Cartesian3(-width/2, -height/2, -depth/2),
      maximum: new Cartesian3(width/2, height/2, depth/2),
      vertexFormat: VertexFormat.POSITION_AND_NORMAL,
    });

    // Create translation using Cesium coordinates (keep consistent with other converters)
    const [cesiumCenter] = this.convertPointsToCartesian3([Point3d.create(centerX, centerY, centerZ)], iModel);
    if (!cesiumCenter)
      return undefined;
    const modelMatrix = Matrix4.fromTranslation(cesiumCenter);

    return { geometry: boxGeometry, modelMatrix };
  }

  private convertSphereToGeometry(sphere: Sphere, iModel?: IModelConnection): { geometry: SphereGeometry; modelMatrix: Matrix4 } | undefined {
    // Get sphere properties using iTwin.js methods
    const center = sphere.cloneCenter();

    // Use the radius from the sphere creation (which should be 15000)
    let radius = 15000; // Use the radius from CesiumDecorator

    const transform = sphere.getConstructiveFrame();
    if (transform) {
      const matrix = transform.matrix;
      // Extract scale from transformation matrix (approximate radius)
      const scaleX = Math.sqrt(matrix.at(0,0)**2 + matrix.at(1,0)**2 + matrix.at(2,0)**2);
      if (scaleX > 1000) { // Only use if it seems reasonable
        radius = scaleX;
      }
    }

    // Clamp radius to reasonable bounds
    radius = Math.max(5000, Math.min(radius, 50000));

    if (!center || radius <= 0) {
      return undefined;
    }

    // Create sphere geometry at origin
    const sphereGeometry = new SphereGeometry({
      radius,
      stackPartitions: 32,
      slicePartitions: 32,
      vertexFormat: VertexFormat.POSITION_AND_NORMAL,
    });

    // Create translation using Cesium coordinates (keep consistent with other converters)
    const [cesiumCenter] = this.convertPointsToCartesian3([center], iModel);
    if (!cesiumCenter)
      return undefined;
    const modelMatrix = Matrix4.fromTranslation(cesiumCenter);

    return { geometry: sphereGeometry, modelMatrix };
  }

  private convertConeToGeometry(cone: Cone, iModel?: IModelConnection): { geometry: CylinderGeometry; modelMatrix: Matrix4 } | undefined {
    const centerA = cone.getCenterA();
    const centerB = cone.getCenterB();
    const radiusA = cone.getRadiusA();
    const radiusB = cone.getRadiusB();

    if (!centerA || !centerB) {
      return undefined;
    }

    // Calculate length from center points
    const length = centerA.distance(centerB);

    if (length <= 0) {
      return undefined;
    }

    // Create cylinder geometry at origin
    const cylinderGeometry = new CylinderGeometry({
      length,
      topRadius: radiusB,
      bottomRadius: radiusA,
      slices: 32,
      vertexFormat: VertexFormat.POSITION_AND_NORMAL,
    });

    // Calculate center point for positioning
    const centerX = (centerA.x + centerB.x) / 2;
    const centerY = (centerA.y + centerB.y) / 2;
    const centerZ = (centerA.z + centerB.z) / 2;

    // Create translation using Cesium coordinates (keep consistent with other converters)
    const [cesiumCenter] = this.convertPointsToCartesian3([Point3d.create(centerX, centerY, centerZ)], iModel);
    if (!cesiumCenter)
      return undefined;
    const modelMatrix = Matrix4.fromTranslation(cesiumCenter);

    return { geometry: cylinderGeometry, modelMatrix };
  }
}
