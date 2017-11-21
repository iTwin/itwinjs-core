/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Range3d } from "@bentley/geometry-core/lib/PointVector";
import { GeometryStream, GeometryBuilder, GSCollection } from "../common/geometry/GeometryStream";
import { ElementAlignedBox3d } from "../common/geometry/Primitives";
import { DefinitionElement } from "./Element";
import { ElementProps } from "../common/ElementProps";
import { IModelDb } from "./IModelDb";

/** Resulting part from a geometry stream that can be appended to an Element. */
export class GeometryPart extends DefinitionElement {
  public geometry: GeometryStream;
  public bbox: ElementAlignedBox3d;
  // private graphics;
  public multiChunkGeomStream: boolean = false;

  public constructor(params: ElementProps, iModel: IModelDb) {
    super(params, iModel);
  }

  public toJSON(): any {
    const val = super.toJSON() as GeometryPart;
    val.GeometryStream = this.geometry;
    val.bbox = this.bbox;
  }

  /*
  public static fromJSON(json: any): GeometryPart | undefined {
  }
  */

  /** Saves contents of builder to GeometryStream of this GeometryPart and updates the bounding box */
  public updateFromGeometryBuilder(builder: GeometryBuilder): boolean {
    if (!builder.isPartCreate)
      return false;   // Invalid builder for creating part geometry...

    if (0 === builder.currentSize)
      return false;

    this.geometry = new GeometryStream(builder.getGeometryStreamCopy());

    let localRange: ElementAlignedBox3d;
    if (builder.is3d) {
      localRange = builder.placement3d.bbox;
    } else {
      const convertedRange = Range3d.createRange2d(builder.placement2d.bbox, 0);
      localRange = new ElementAlignedBox3d(convertedRange.low, convertedRange.high);
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
