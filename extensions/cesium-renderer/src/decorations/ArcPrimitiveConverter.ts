/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BoundingSphere, ColorGeometryInstanceAttribute, ComponentDatatype, Geometry, GeometryAttribute, GeometryInstance, Material, PerInstanceColorAppearance, Polyline, Primitive, PrimitiveCollection, PrimitiveType } from "cesium";
import { Loop, Path, Polyface, PolyfaceBuilder, StrokeOptions, SweepContour } from "@itwin/core-geometry";
import { IModelConnection } from "@itwin/core-frontend";
import { CesiumScene } from "../CesiumScene.js";
import { type DepthOptions, PrimitiveConverter, type RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";
import { DecorationPrimitiveEntry } from "./DecorationTypes.js";
import { CesiumCoordinateConverter } from "./CesiumCoordinateConverter.js";

export class ArcPrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType: 'arc' | 'arc2d';
  private _currentScene?: CesiumScene;

  public constructor(primitiveType: 'arc' | 'arc2d' = 'arc') {
    super();
    this.primitiveType = primitiveType;
  }

  protected override getCollection(scene: CesiumScene): PrimitiveCollection {
    this._currentScene = scene; // Store scene reference for later use
    return scene.primitivesCollection;
  }

  protected override extractPrimitiveData(coordinateData: DecorationPrimitiveEntry[], primitiveType: string): DecorationPrimitiveEntry[] | undefined {
    if (!Array.isArray(coordinateData)) {
      return undefined;
    }

    const entries = coordinateData.filter((entry: DecorationPrimitiveEntry) => entry.type === primitiveType);

    // For arcs, return the whole entry object, not just points
    return entries;
  }

  protected override createPrimitiveFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    primitiveId: string,
    _index: number,
    _collection: PrimitiveCollection,
    iModel?: IModelConnection,
    originalData?: DecorationPrimitiveEntry[],
    _type?: string
  ): Primitive | Polyline | undefined {
    const data = originalData;

    const getEntry = () => {
      const entry = this.findEntryByType(graphic, this.primitiveType);
      if (entry)
        return entry;

      if (!data)
        return undefined;

      return data.find((d) => d.type === this.primitiveType);
    };

    const arcData = getEntry();
    if (!arcData || (arcData.type !== 'arc' && arcData.type !== 'arc2d'))
      return undefined;

    const isArc2d = arcData.type === 'arc2d';
    const arc = arcData.arc.clone();
    const isEllipse = arcData.isEllipse === true;
    const filled = arcData.filled === true;
    const depth = isArc2d ? arcData.zDepth : undefined;
    if (typeof depth === 'number' && arc.center.z !== depth)
      arc.center.z = depth;

    const converterIModel = iModel;
    if (!converterIModel) {
      return undefined;
    }

    const converter = new CesiumCoordinateConverter(converterIModel);

    // Determine color from graphic symbology when available; fallback by type
    const color = this.extractLineColorFromGraphic(graphic, this.primitiveType);
    if (!color)
      return undefined;

    if (filled || isEllipse) {
      // Use iTwin.js Loop.create(arc) + SweepContour + PolyfaceBuilder for accurate filled ellipse
      const loop = Loop.create(arc);
      const contour = SweepContour.createForLinearSweep(loop);

      // Create polyface from iTwin.js contour
      const facetOptions = StrokeOptions.createForFacets();
      facetOptions.chordTol = 0.01;

      const pfBuilder = PolyfaceBuilder.create(facetOptions);
      contour?.emitFacets(pfBuilder, false);
      const polyface = pfBuilder.claimPolyface();

      if (!polyface || polyface.pointCount === 0) {
        return undefined;
      }

      // Convert polyface to Cesium geometry
      const cesiumGeometry = this.createGeometryFromPolyface(polyface, converter);
      if (!cesiumGeometry) {
        return undefined;
      }

      const geometryInstance = new GeometryInstance({
        geometry: cesiumGeometry,
        id: primitiveId,
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(color)
        }
      });

      const primitive = new Primitive({
        geometryInstances: geometryInstance,
        appearance: new PerInstanceColorAppearance({
          flat: true,
          translucent: false
        }),
        asynchronous: false
      });

      return primitive;
    } else {
      const path = Path.create(arc);
      const strokeOptions = StrokeOptions.createForCurves();
      strokeOptions.chordTol = 0.01;

      const strokes = path.getPackedStrokes(strokeOptions);
      if (!strokes) {
        return undefined;
      }

      const arcPoints = strokes.getPoint3dArray();

      // Convert iTwin.js points to Cesium coordinates
      const positions = this.convertPointsToCartesian3(arcPoints, converterIModel);

      // For non-filled arcs, use the stored scene reference to access polyline collection
      if (this._currentScene && this._currentScene.polylineCollection) {
        const polyline = this._currentScene.polylineCollection.add({
          positions,
          width: 2,
          material: Material.fromType(Material.ColorType, { color }),
          ...this.getDepthOptions(_type ?? "world"),
        });

        return polyline;
      } else {
        return undefined;
      }
    }
  }

  protected override getPrimitiveTypeName(): string {
    return this.primitiveType;
  }

  protected override shouldSkipEmptyGraphics(): boolean {
    return true;
  }

  protected override getDepthOptions(decorationType: string): DepthOptions {
    const baseOptions = super.getDepthOptions(decorationType);

    const isOverlay = decorationType === 'worldOverlay' || decorationType === 'viewOverlay';
    if (isOverlay) {
      return {
        ...baseOptions,
        heightReference: 0,
        extrudedHeightReference: 0
      };
    }

    return baseOptions;
  }

  private createGeometryFromPolyface(polyface: Polyface, converter: CesiumCoordinateConverter): Geometry | undefined {
    if (!polyface || !polyface.data || !polyface.data.point || polyface.data.point.length === 0) {
      return undefined;
    }

    // Extract points from polyface.data.point
    const positions: number[] = [];
    const pointCount = polyface.data.point.length;
    for (let i = 0; i < pointCount; i++) {
      const point = polyface.data.point.getPoint3dAtUncheckedPointIndex(i);
      if (point) {
        const cesiumPoint = converter.spatialToCesiumCartesian3(point);
        positions.push(cesiumPoint.x, cesiumPoint.y, cesiumPoint.z);
      }
    }

    if (positions.length === 0) {
      return undefined;
    }

    // Extract indices from polyface.data.pointIndex
    const indices: number[] = [];
    if (polyface.data.pointIndex && polyface.data.pointIndex.length > 0) {
      // Process face indices - iTwin.js uses 1-based indexing with 0 as separator
      let faceStart = 0;
      for (let i = 0; i < polyface.data.pointIndex.length; i++) {
        const index = polyface.data.pointIndex[i];
        if (index === 0) {
          // End of face - triangulate the face
          const faceLength = i - faceStart;
          if (faceLength >= 3) {
            // Convert to 0-based indexing and triangulate
            const faceIndices = [];
            for (let j = faceStart; j < i; j++) {
              faceIndices.push(polyface.data.pointIndex[j] - 1); // Convert to 0-based
            }

            // Simple fan triangulation
            for (let k = 1; k < faceIndices.length - 1; k++) {
              indices.push(faceIndices[0], faceIndices[k], faceIndices[k + 1]);
            }
          }
          faceStart = i + 1;
        }
      }
    }

    if (indices.length === 0) {
      return undefined;
    }

    // Compute bounding sphere from positions
    const positionsArray = new Float64Array(positions);
    const boundingSphere = BoundingSphere.fromVertices(positions);

    const geometry = new Geometry({
      attributes: {
        position: new GeometryAttribute({
          componentDatatype: ComponentDatatype.DOUBLE,
          componentsPerAttribute: 3,
          values: positionsArray
        }),
        normal: undefined,
        st: undefined,
        bitangent: undefined,
        tangent: undefined,
        color: undefined
      },
      indices: new Uint16Array(indices),
      primitiveType: PrimitiveType.TRIANGLES,
      boundingSphere
    });

    return geometry;
  }
}
