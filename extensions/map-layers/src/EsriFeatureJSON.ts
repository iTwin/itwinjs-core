/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ColorDef, ImageSource, ImageSourceFormat } from "@bentley/imodeljs-common";
import { DecorateContext, GraphicBuilder, GraphicPrimitive, GraphicType, imageElementFromImageSource, RenderGraphic } from "@bentley/imodeljs-frontend";
import { Point2d, Point3d, Range2d, XYProps } from "@bentley/geometry-core";

abstract class GeometryLayout {
  // Operations names
  public static readonly XY = "XY";
  public static readonly XYZ = "XYZ";
  public static readonly XYM = "XYM";
  public static readonly XYZM = "XYZM";
}

interface EsriFeatureReadOptions {
  unused: boolean;
}

export class EsriFeatureJSON  {
  private _defaultZDepth  = 0.0;  // TODO: figure out the proper value here

  public readPrimitives(_source: string, context: DecorateContext, addProjectExtent=false): GraphicPrimitive[]|undefined {
    let primitives = this.readFeaturesFromObject(JSON.parse(_source));

    if (addProjectExtent) {
      if (primitives === undefined) {
        primitives = [];
      }
      const vp = context.viewport;
      primitives?.push({type:"shape", points:vp.iModel.projectExtents.corners()});
    }

    return primitives;
  }

  protected getGeometryLayout(object: any) {
    let layout = GeometryLayout.XY;
    if (object === undefined) {
      return layout;
    }

    if (object.hasZ === true && object.hasM === true) {
      layout = GeometryLayout.XYZM;
    } else if (object.hasZ === true) {
      layout = GeometryLayout.XYZ;
    } else if (object.hasM === true) {
      layout = GeometryLayout.XYM;
    }
    return layout;
  }

  // Converts an [[x1,y1], [x2,y2], ...] to [x1,y1,x2,y2, ...]
  // stride is the number of dimensions
  // https://github.com/openlayers/openlayers/blob/7a2f87caca9ddc1912d910f56eb5637445fc11f6/src/ol/geom/flat/deflate.js#L26
  protected deflateCoordinates(
    flatCoordinates: number[],
    offset: number,
    coordinates: number[][],
    stride: number
  ) {
    for (let i = 0, ii = coordinates.length; i < ii; ++i) {
      const coordinate = coordinates[i];
      for (let j = 0; j < stride; ++j) {
        flatCoordinates[offset++] = coordinate[j];
      }
    }
    return offset;
  }

  /**
   * Is the linear ring oriented clockwise in a coordinate system with a bottom-left
   * coordinate origin? For a coordinate system with a top-left coordinate origin,
   * the ring's orientation is clockwise when this function returns false.
   * https://github.com/openlayers/openlayers/blob/7a2f87caca9ddc1912d910f56eb5637445fc11f6/src/ol/geom/flat/orient.js#L16
   */
  protected linearRingIsClockwise(flatCoordinates: number[], offset: number, end: number, stride: number) {
    let edge = 0;
    let x1 = flatCoordinates[end - stride];
    let y1 = flatCoordinates[end - stride + 1];
    for (; offset < end; offset += stride) {
      const x2 = flatCoordinates[offset];
      const y2 = flatCoordinates[offset + 1];
      edge += (x2 - x1) * (y2 + y1);
      x1 = x2;
      y1 = y2;
    }
    return edge === 0 ? undefined : edge > 0;
  }

  // This code converts an array of rings : [OuterRing1, Hole1_1, Hole1_2,..., OuterRing2, hole2_1, hole_2_1, ...]
  // into [[OuterRing1, Hole1_1, Hole1_2, ...], [OuterRing2, Hole2_1, Hole2_2, ..], ...]
  // so each hole is grouped with its corresponding outer ring.
  protected convertRings(rings: any, layout: string) {
    const flatRing: number[] = [];
    const outerRings: number[][][] = [];
    const holes: number[][] = [];
    let i, ii;
    for (i = 0, ii = rings.length; i < ii; ++i) {
      flatRing.length = 0;
      const test = new Range2d();
      test.setFromJSON(rings[i]);

      this.deflateCoordinates(flatRing, 0, rings[i], layout.length);

      // is this ring an outer ring? is it clockwise?
      const clockwise = this.linearRingIsClockwise(flatRing, 0, flatRing.length, layout.length);
      if (clockwise) {
        outerRings.push([rings[i]]);
      } else {
        holes.push(rings[i]);
      }
    }

    while (holes.length) {
      const hole = holes.shift();
      if (hole === undefined) {
        continue;
      }

      let matched = false;
      // loop over all outer rings and see if they contain our hole.
      // UNTESTED CODE
      // TODO: only supports 2D, needs 3d support?.
      for (i = outerRings.length - 1; i >= 0; i--) {
        const outerRing = outerRings[i][0];
        const outerRingRange = new Range2d();
        outerRingRange.setFromJSON(outerRing as any);
        const holeRange = new Range2d();
        holeRange.setFromJSON(hole as any);
        if (outerRingRange.containsRange(holeRange)) {
          outerRings[i].push(hole);
          matched = true;
          break;
        }
      }
      if (!matched) {
        // no outer rings contain this hole turn it into and outer
        // ring (reverse it)
        outerRings.push([hole.reverse()]);
      }
    }
    return outerRings;
  }

  protected readFeaturesFromObject(object: any, options?: EsriFeatureReadOptions): GraphicPrimitive[]|undefined  {
    if (object === undefined)
      return undefined;

    // Parse geometries
    let primitives: GraphicPrimitive[]|undefined;
    if (object.features === undefined) {
      primitives = [];
      const primitive = this.readFeatureFromObject(object, options);
      if (primitive !== undefined)
      primitives.push(primitive);
    } else {
      primitives = [];
      for (const feature of object.features) {
        if (feature !== undefined) {
          const primitive = this.readFeatureFromObject(feature, options);
          if (primitive !== undefined)
          primitives.push(primitive);
        }
      }
    }


    return primitives;
  }

  protected readFeatureFromObject(object: any, options?: EsriFeatureReadOptions): GraphicPrimitive|undefined {
    if (object === undefined)
      return undefined;

    return this.readGeometry(object.geometry, options);
  }

  protected readGeometry(object: any, _options?: EsriFeatureReadOptions): GraphicPrimitive|undefined {
    if (object === undefined)
      return undefined;

    if (typeof object.x === "number" && typeof object.x === "number") {
      /********* */
      /* Point */
      /********* */
      const squareSize = 10000;
      const squareRange = new Range2d(object.x, object.y, object.x+squareSize, object.y+squareSize);
      // builder.addPointString2d([Point2d.create(object.x, object.y)], this._defaultZDepth);

      const points = squareRange.corners3d(true, 0);
      return { type: "shape", points }
    } else if (object.rings) {
      /********* */
      /* Polygon */
      /********* */

      const layout = this.getGeometryLayout(object);
      const rings = this.convertRings(object.rings, layout);

      // Create a shape for every outer ring
      // TODO: holes
      for (let i = rings.length - 1; i >= 0; i--) {
        const outerRing = rings[i][0];
        const points = [];
        for (const point of outerRing) {
          const point2d = Point2d.create();
          point2d.setFromJSON(point as XYProps);
          points.push(point2d);
        }

        return { type: "shape2d", points, zDepth: this._defaultZDepth }
      }
      if (rings.length === 0)
        return undefined;
    }
    return undefined;
  }

  protected async createSampleIcon() {

    const imageData = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OURDRDBBMkZEMjdBMTFFMEFFOTVFRTBGMDE2NDc1MDUiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OURDRDBBMzBEMjdBMTFFMEFFOTVFRTBGMDE2NDc1MDUiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDoxRjE2MjU0QUQyNzkxMUUwQUU5NUVFMEYwMTY0NzUwNSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5RENEMEEyRUQyN0ExMUUwQUU5NUVFMEYwMTY0NzUwNSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgQ9khMAAAlOSURBVHja7JtrbBTX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";
    const imgSource = new ImageSource(imageData, ImageSourceFormat.Png);
    return imageElementFromImageSource(imgSource);

  }
}
