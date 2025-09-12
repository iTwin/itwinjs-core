import { BoundingSphere, Cartesian3, Color, ColorGeometryInstanceAttribute, ComponentDatatype, Geometry, GeometryAttribute, GeometryInstance, Material, PerInstanceColorAppearance, Primitive, PrimitiveType } from "cesium";
import { ColorDef } from "@itwin/core-common";
import { Loop, Path, PolyfaceBuilder, StrokeOptions, SweepContour } from "@itwin/core-geometry";
import { IModelConnection } from "@itwin/core-frontend";
import { GraphicPrimitive } from "@itwin/core-frontend/lib/cjs/common/render/GraphicPrimitive";
import { CesiumScene } from "./Scene";
import { PrimitiveConverter } from "./PrimitiveConverter";
import { CesiumCoordinateConverter } from "./CesiumCoordinateConverter";

export class ArcPrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = 'arc';
  private _currentScene?: CesiumScene;

  protected override getCollection(scene: CesiumScene): any {
    this._currentScene = scene; // Store scene reference for later use
    return scene.primitivesCollection;
  }

  protected override extractPrimitiveData(coordinateData: GraphicPrimitive[] | undefined, primitiveType: string): any[] | undefined {
    if (!coordinateData || !Array.isArray(coordinateData)) {
      return undefined;
    }
    
    const entries = coordinateData.filter((entry: GraphicPrimitive) => entry.type === primitiveType);
    
    // For arcs, return the whole entry object, not just points
    return entries;
  }

  protected override createPrimitiveFromGraphic(
    _graphic: any, 
    primitiveId: string, 
    _index: number, 
    _collection: any, 
    iModel?: IModelConnection, 
    originalData?: any[], 
    _type?: string
  ): any {
    if (!originalData || originalData.length === 0) {
      return null;
    }

    // Find the arc data in the array
    let arcData = null;
    for (const data of originalData) {
      if (data && data.type === 'arc') {
        arcData = data;
        break;
      }
    }

    if (!arcData || arcData.type !== 'arc') {
      return null;
    }

    const { arc, isEllipse = false, filled = false } = arcData;

    const converterIModel = iModel || (this._currentScene as any)?._iModel;
    if (!converterIModel) {
      return null;
    }
    
    const converter = new CesiumCoordinateConverter(converterIModel);
    
    // Determine color from graphic symbology when available; fallback by type
    const color = this.extractColorFromGraphic(_graphic);
    if (!color)
      return null;

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
        return null;
      }

      // Convert polyface to Cesium geometry
      const cesiumGeometry = this.createGeometryFromPolyface(polyface, converter);
      if (!cesiumGeometry) {
        return null;
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
      // Use iTwin.js Path.create(arc).getPackedStrokes() for accurate arc points
      const path = Path.create(arc);
      const strokeOptions = StrokeOptions.createForCurves();
      strokeOptions.chordTol = 0.01;
      
      const strokes = path.getPackedStrokes(strokeOptions);
      if (!strokes) {
        return null;
      }
      
      const arcPoints = strokes.getPoint3dArray();
      
      // Convert iTwin.js points to Cesium coordinates
      const positions: Cartesian3[] = [];
      for (const point of arcPoints) {
        const cesiumPoint = converter.spatialToCesiumCartesian3(point);
        positions.push(cesiumPoint);
      }
      
      // For non-filled arcs, use the stored scene reference to access polyline collection
      if (this._currentScene && this._currentScene.polylineCollection) {
        const polyline = this._currentScene.polylineCollection.add({
          positions,
          width: 2,
          material: Material.fromType(Material.ColorType, { color })
        });
        
        return polyline;
      } else {
        return null;
      }
    }
  }

  protected override getPrimitiveTypeName(): string {
    return 'arc';
  }

  protected override shouldSkipEmptyGraphics(): boolean {
    return true;
  }

  protected override getDepthOptions(decorationType: string): any {
    const baseOptions = super.getDepthOptions(decorationType);
    
    const isOverlay = decorationType === 'worldOverlay' || decorationType === 'viewOverlay';
    if (isOverlay) {
      return {
        ...baseOptions,
        extrudedHeight: 0
      };
    }
    
    return baseOptions;
  }

  private createGeometryFromPolyface(polyface: any, converter: CesiumCoordinateConverter): Geometry | null {
    if (!polyface || !polyface.data || !polyface.data.point || polyface.data.point.length === 0) {
      return null;
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
      return null;
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
      return null;
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

  private extractColorFromGraphic(graphic: any): Color | undefined {
    const coordData = (graphic as any)?._coordinateData as any[] | undefined;
    const entry = coordData?.find((e) => e?.type === 'arc' && e.symbology?.lineColor);
    const toCesium = (cd?: ColorDef) => {
      if (!cd) return undefined;
      const c = cd.colors;
      const alpha = 255 - (c.t ?? 0);
      return Color.fromBytes(c.r, c.g, c.b, alpha);
    };
    if (entry) {
      const fromEntry = toCesium(entry.symbology?.lineColor as ColorDef | undefined);
      if (fromEntry)
        return fromEntry;
    }

    // Otherwise use graphic.symbology
    const symbology = graphic?.symbology;
    const colorDef = symbology?.color as ColorDef | undefined;
    return toCesium(colorDef);
  }

}
