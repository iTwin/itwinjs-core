/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Range3d, Transform } from "@bentley/geometry-core/lib/PointVector";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { GeometryStream, GeometryBuilder, Iterator } from "../common/geometry/GeometryStream";
import { IModelStatus } from "../common/IModelError";
import { AxisAlignedBox3d, ElementAlignedBox3d, Placement2d, Placement3d } from "../common/geometry/Primitives";
import { DefinitionElement } from "./Element";
import { ElementProps } from "../common/ElementProps";
import { IModelDb } from "./IModelDb";

export abstract class GeometrySource {
  public abstract getAsGeometrySource2d(): GeometrySource2d | undefined;  // Either this method or getAsGeometrySource3d must return non-null
  public abstract getAsGeometrySource3d(): GeometrySource3d | undefined;  // Either this method or getAsGeometrySource2d must return non-null
  public abstract getCategoryId(): Id64;
  public abstract setCategoryId(id: Id64): void;
  public abstract getGeometryStream(): GeometryStream;
  public abstract toElement(): Element | undefined;
  public abstract calculateRange3d(): AxisAlignedBox3d;

  // TODO: Add methods for Elements and GraphicPtrs

  public is3d(): boolean { return this.getAsGeometrySource3d() !== undefined; }
  public is2d(): boolean { return this.getAsGeometrySource2d() !== undefined; }
  public hasGeometry(): boolean { return this.getGeometryStream().hasGeometry(); }
  public getPlacementTransform(): Transform {
    const source3d = this.getAsGeometrySource3d();
    return (source3d !== undefined) ? source3d.getPlacement().getTransform() : this.getAsGeometrySource2d()!.getPlacement().getTransform();
  }

    /** Saves contents of builder to GeometryStream of this GeometrySource and updates the element aligned bounding box.
     *  Note: For a builder using CreateWithAutoPlacement this also updates the placement origin/angles using the local coordinate system computed
     *  from the first appended GeometricPrimitive.
     */
  public updateFromGeometryBuilder(builder: GeometryBuilder): boolean {
    if (!builder.isPartCreate)
      return false;   // Invalid builder for creating element geometry...

    if (builder.currentSize === 0)
      return false;

    if (!builder.havePlacement)
      return false;

    if (!this.getCategoryId().equals(builder.geometryParams.categoryId))
      return false;

    // const el = this.toElement();

    // if (el === undefined || (el !== undefined && ))
    //  return false;

    if (builder.is3d) {
      if (!builder.placement3d.isValid())
        return false;

      const source3d = this.getAsGeometrySource3d();
      if (source3d === undefined)
        return false;

      source3d.setPlacement(builder.placement3d);
    } else {
      if (!builder.placement2d.isValid())
        return false;

      const source2d = this.getAsGeometrySource2d();
      if (source2d === undefined)
        return false;

      source2d.setPlacement(builder.placement2d);
    }

    this.getGeometryStream().saveRef(builder.getGeometryStreamCopy());
    return true;
  }
}

export abstract class GeometrySource2d extends GeometrySource {
  public abstract getPlacement(): Placement2d;
  public abstract setPlacement(placement: Placement2d): IModelStatus;

  public getAsGeometrySource3d() { return undefined; }
  public calculateRange3d(): AxisAlignedBox3d { return this.getPlacement().calculateRange(); }
}

export abstract class GeometrySource3d extends GeometrySource {
  public abstract getPlacement(): Placement3d;
  public abstract setPlacement(placement: Placement3d): IModelStatus;

  public getAsGeometrySource2d() { return undefined; }
  public calculateRange3d(): AxisAlignedBox3d { return this.getPlacement().calculateRange(); }
}

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
      const iterator = Iterator.create(this.geometry.geomStream);

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
