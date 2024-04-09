/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { GeometryParams, GeometryStreamBuilder, TextAnnotation, TextAnnotation2dProps, TextAnnotation3dProps } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";
import { AnnotationElement2d, GraphicalElement3d } from "./Element";
import { produceTextAnnotationGeometry } from "./TextAnnotationGeometry";

function updateAnnotation(element: TextAnnotation2d | TextAnnotation3d, annotation: TextAnnotation): boolean {
  const builder = new GeometryStreamBuilder();

  // ###TODO no way to place on non-default subcategory?
  const params = new GeometryParams(element.category);
  if (!builder.appendGeometryParamsChange(params)) {
    return false;
  }

  const props = produceTextAnnotationGeometry({ iModel: element.iModel, annotation });
  if (!builder.appendTextBlock(props)) {
    return false;
  }

  // ###TODO will placement bounding box be computed for me on insert/update?
  element.geom = builder.geometryStream;

  element.jsonProperties.annotation = annotation.toJSON();

  return true;
}

/** 2D Text Annotation ###TODO better documentation...
 * @public
 */
export class TextAnnotation2d extends AnnotationElement2d {
  /** @internal */
  public static override get className(): string { return "TextAnnotation2d"; }
  protected constructor(props: TextAnnotation2dProps, iModel: IModelDb) { super(props, iModel); }

  public override toJSON(): TextAnnotation2dProps {
    return super.toJSON();
  }

  public getAnnotation(): TextAnnotation | undefined {
    const json = this.jsonProperties.annotation;
    return json ? TextAnnotation.fromJSON(json) : undefined;
  }

  public setAnnotation(annotation: TextAnnotation): boolean {
    return updateAnnotation(this, annotation);
  }
}

/** 3D Text Annotation ###TODO better documentation...
 * @public
 */
export class TextAnnotation3d extends GraphicalElement3d {
  /** @internal */
  public static override get className(): string { return "TextAnnotation3d"; }
  protected constructor(props: TextAnnotation3dProps, iModel: IModelDb) { super(props, iModel); }

  public override toJSON(): TextAnnotation3dProps {
    return super.toJSON();
  }

  public getAnnotation(): TextAnnotation | undefined {
    const json = this.jsonProperties.annotation;
    return json ? TextAnnotation.fromJSON(json) : undefined;
  }

  public setAnnotation(annotation: TextAnnotation): boolean {
    return updateAnnotation(this, annotation);
  }
}
