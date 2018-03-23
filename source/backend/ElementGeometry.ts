/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GeometryStreamProps, ElementAlignedBox3d, ElementProps } from "@bentley/imodeljs-common";
import { DefinitionElement } from "./Element";
import { IModelDb } from "./IModelDb";

/**
 * A Definition Element that specifies a collection of geometry that is meant to be reused across Geometric
 * Element instances. Leveraging Geometry Parts can help reduce file size and improve display performance.
 */
export class GeometryPart extends DefinitionElement {
  public geom?: GeometryStreamProps;
  public bbox: ElementAlignedBox3d;
  public constructor(params: ElementProps, iModel: IModelDb) { super(params, iModel); }

  public toJSON(): any {
    const val = super.toJSON() as GeometryPart;
    val.geom = this.geom;
    val.bbox = this.bbox;
  }
}
