/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Range3d } from "@bentley/geometry-core/lib/Range";
import { GeometryStream, GeometryBuilder, GSCollection } from "@bentley/imodeljs-common/lib/geometry/GeometryStream";
import { ElementAlignedBox3d } from "@bentley/imodeljs-common/lib/geometry/Primitives";
import { DefinitionElement } from "./Element";
import { ElementProps } from "@bentley/imodeljs-common/lib/ElementProps";
import { IModelDb } from "./IModelDb";

/**
 * A Definition Element that specifies a collection of geometry that is meant to be reused across Geometric
 * Element instances. Leveraging Geometry Parts can help reduce file size and improve display performance.
 */
export class GeometryPart extends DefinitionElement {
  public geometry: GeometryStream;
  public bbox: ElementAlignedBox3d;
  public multiChunkGeomStream: boolean = false;
  public constructor(params: ElementProps, iModel: IModelDb) { super(params, iModel); }

  public toJSON(): any {
    const val = super.toJSON() as GeometryPart;
    val.GeometryStream = this.geometry;
    val.bbox = this.bbox;
  }

  /** Saves contents of builder to GeometryStream of this GeometryPart and updates the bounding box */
  public updateFromGeometryBuilder(builder: GeometryBuilder): boolean {
    if (!builder.isPartCreate)
      return false;   // Invalid builder for creating part geometry...

    if (0 === builder.currentSize)
      return false;

    this.geometry = builder.getGeometryStreamClone();

    let localRange: ElementAlignedBox3d;
    if (builder.is3d) {
      localRange = builder.placement3d.bbox;
    } else {
      const convertedRange = Range3d.createRange2d(builder.placement2d.bbox, 0);
      localRange = ElementAlignedBox3d.createFromPoints(convertedRange.low, convertedRange.high);
    }

    // NOTE: GeometryBuilder.CreateGeometryPart doesn't supply range... need to compute it...
    if (!localRange.isValid()) {
      const iterator = new GSCollection(this.geometry.geomStream);

      while (iterator.operation) {
        const geom = iterator.getGeometry();
        const range = new Range3d();

        if (geom !== undefined && geom.getRange(undefined, range))
          localRange.extendRange(range);

        iterator.nextOp();
      }

      if (!localRange.isValid())
        return false;
    }

    this.bbox.setFrom(localRange);
    return true;
  }
}
