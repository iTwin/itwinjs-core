/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Point2d, Range2d, Transform } from "@itwin/core-geometry";
import { esriPBuffer } from "../internal";
const esriGeometryType = esriPBuffer.FeatureCollectionPBuffer.GeometryType;

const samplePngIcon = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OURDRDBBMkZEMjdBMTFFMEFFOTVFRTBGMDE2NDc1MDUiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OURDRDBBMzBEMjdBMTFFMEFFOTVFRTBGMDE2NDc1MDUiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDoxRjE2MjU0QUQyNzkxMUUwQUU5NUVFMEYwMTY0NzUwNSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5RENEMEEyRUQyN0ExMUUwQUU5NUVFMEYwMTY0NzUwNSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgQ9khMAAAlOSURBVHja7JtrbBTX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";
const sampleIconImg = new Image();
sampleIconImg.src = `data:image/png;base64,${samplePngIcon}`;
const iconSize = 16;
const iconSizeHalf = 0.5*iconSize;

export class ArcGisFeaturePBF  {
  private _defaultZDepth  = 0.0;  // TODO: figure out the proper value here
  public transform = Transform.createIdentity();

  public readRenderGraphics(collection: esriPBuffer.FeatureCollectionPBuffer, context: CanvasRenderingContext2D) {
    const perfoBegin = performance.now();

    if (!collection.has_queryResult || !collection.queryResult.has_featureResult || collection?.queryResult?.featureResult?.features === undefined)
      return;

    let coordsOffet = 0;
    const geomType = collection.queryResult.featureResult.geometryType;
    const dim = (collection.queryResult.featureResult.hasM  ||  collection.queryResult.featureResult.hasZ) ? 3 : 2;

    // console.log(`Nb Feature: ${collection.queryResult.featureResult.features.length}`);
    if ( geomType === esriGeometryType.esriGeometryTypePoint ||
         geomType === esriGeometryType.esriGeometryTypeMultipoint) {
      for (const feature of collection.queryResult.featureResult.features) {
        const geometryLenths = feature.geometry.lengths;
        const geometryCoords = feature.geometry.coords;
        if (geometryLenths.length === 0) {
          // Strangely, for points, 'lengths' array is empty, so we assume there is a single vertex in 'coords' array.
          if (geometryCoords.length >= dim) {
            context.drawImage(sampleIconImg, geometryCoords[0]-iconSizeHalf, geometryCoords[1]-iconSizeHalf, iconSize, iconSize);
          }
        } else {
          // Needs testing, no multi-point datatsets so far.
          // I assume 'lenghts' array will get populated and 'coords' array will look similar to line/polygons.
          for (const vertexCount of geometryLenths) {
            let lastPtX = 0, lastPtY = 0;
            for (let vertexIdx=0 ; vertexIdx <vertexCount; vertexIdx++) {
              const pX = geometryCoords[coordsOffet+(vertexIdx*2)];
              const pY = geometryCoords[coordsOffet+(vertexIdx*2)+1];
              lastPtX = (vertexIdx === 0) ? pX : lastPtX+pX;
              lastPtY = (vertexIdx === 0) ? pY : lastPtY+pY;

              context.drawImage(sampleIconImg, lastPtX-iconSizeHalf, lastPtY-iconSizeHalf, iconSize, iconSize);
            }
            coordsOffet+=dim*vertexCount;
          }
        }

      }
    } else if (
      geomType === esriGeometryType.esriGeometryTypePolyline ||
      geomType === esriGeometryType.esriGeometryTypePolygon) {
      const fill = (geomType === esriGeometryType.esriGeometryTypePolygon);

      for (const feature of collection.queryResult.featureResult.features) {
        if (feature?.has_geometry) {
          this.renderPathFeature(feature, context, fill, dim);
        }
      }
    }
    console.log(`Paint time: ${performance.now() - perfoBegin}`);
  }

  protected renderPathFeature(feature: esriPBuffer.FeatureCollectionPBuffer.Feature, context: CanvasRenderingContext2D, fill: boolean, dim: number) {
    // Leep track of our position in the in the 'coords' array:
    // Everytime we loop on the 'lengths' array, the position
    // to start reading vertices in the 'coords' must be the sum of all previously read vertices.
    let coordsOffet = 0;

    const geometryLenths = feature.geometry.lengths;
    const geometryCoords = feature.geometry.coords;
    // Begin the path here.
    // Note: Even though path is closed inside the 'geometryLenths' loop,
    //       it's import to begin the path only once.
    context.beginPath();
    // console.log ("context.beginPath();");
    for (const vertexCount of geometryLenths) {
      let lastPtX = 0, lastPtY = 0;
      for (let vertexIdx=0 ; vertexIdx <vertexCount; vertexIdx++) {
        const pX = geometryCoords[coordsOffet+(vertexIdx*dim)];
        const pY = geometryCoords[coordsOffet+(vertexIdx*dim)+1];
        if (vertexIdx === 0) {
          // first vertex is "absolute"
          // console.log (`context.moveTo(${pX}, ${pY});`);
          context.moveTo(pX, pY);
          lastPtX = pX;
          lastPtY = pY;
        } else {
          // following vertices are relative to the previous one (not really well documented by ESRI)
          lastPtX = lastPtX+pX;
          lastPtY = lastPtY+pY;
          // console.log (`context.moveTo(${lastPtX}, ${lastPtY});`);
          context.lineTo(lastPtX, lastPtY);
        }

      }
      coordsOffet+=dim*vertexCount;
      if (fill) {
        // console.log (`context.closePath();`);

        // ClosePath but do not 'fill' here, only at the very end (otherwise it will mess up holes)
        context.closePath();
      }
    }

    if (fill) {
      // console.log (`context.fillStyle = "#0000FF99";`);
      // console.log (`context.closePath();`);
      context.fillStyle = "#0000FF99";
      context.fill();
    }
    // console.log (` context.strokeStyle = "yellow";`);
    // console.log (`context.stroke();`);
    context.strokeStyle = "yellow";
    context.stroke();  // draw line path or polygon outline
  }
}
