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
import { Id64String } from "@itwin/core-bentley";

function updateAnnotation(element: TextAnnotation2d | TextAnnotation3d, annotation: TextAnnotation, subCategory: Id64String | undefined): boolean {
  const builder = new GeometryStreamBuilder();

  const params = new GeometryParams(element.category, subCategory);
  if (!builder.appendGeometryParamsChange(params)) {
    return false;
  }

  const props = produceTextAnnotationGeometry({ iModel: element.iModel, annotation });
  if (!builder.appendTextBlock(props)) {
    return false;
  }

  element.geom = builder.geometryStream;
  element.jsonProperties.annotation = annotation.toJSON();

  return true;
}

/** An element that displays textual content within a 2d model.
 * The text is stored as a [TextAnnotation]($common) from which the element's [geometry]($docs/learning/common/GeometryStream.md) and [Placement]($common) are computed.
 * @see [[setAnnotation]] to change the textual content.
 * @public
 */
export class TextAnnotation2d extends AnnotationElement2d {
  /** @internal */
  public static override get className(): string { return "TextAnnotation2d"; }
  protected constructor(props: TextAnnotation2dProps, iModel: IModelDb) { super(props, iModel); }

  public static fromJSON(props: TextAnnotation2dProps, iModel: IModelDb): TextAnnotation2d {
    return new TextAnnotation2d(props, iModel);
  }

  public override toJSON(): TextAnnotation2dProps {
    return super.toJSON();
  }

  /** Extract the textual content, if present.
   * @see [[setAnnotation]] to change it.
   */
  public getAnnotation(): TextAnnotation | undefined {
    const json = this.jsonProperties.annotation;
    return json ? TextAnnotation.fromJSON(json) : undefined;
  }

  /** Change the textual content, updating the element's geometry and placement accordingly.
   * @see [[getAnnotation]] to extract the current annotation.
   * @param annotation The new annotation
   * @param subCategory If specified, the subcategory on which to define the geometry; otherwise, the default subcategory of the element's category is used.
   * @returns true if the annotation was successfully updated.
   */
  public setAnnotation(annotation: TextAnnotation, subCategory?: Id64String): boolean {
    return updateAnnotation(this, annotation, subCategory);
  }
}

/** An element that displays textual content within a 3d model.
 * The text is stored as a [TextAnnotation]($common) from which the element's [geometry]($docs/learning/common/GeometryStream.md) and [Placement]($common) are computed.
 * @see [[setAnnotation]] to change the textual content.
 * @public
 */
export class TextAnnotation3d extends GraphicalElement3d {
  /** @internal */
  public static override get className(): string { return "TextAnnotation3d"; }
  protected constructor(props: TextAnnotation3dProps, iModel: IModelDb) { super(props, iModel); }

  public static fromJSON(props: TextAnnotation3dProps, iModel: IModelDb): TextAnnotation3d {
    return new TextAnnotation3d(props, iModel);
  }

  public override toJSON(): TextAnnotation3dProps {
    return super.toJSON();
  }

  /** Extract the textual content, if present.
   * @see [[setAnnotation]] to change it.
   */
  public getAnnotation(): TextAnnotation | undefined {
    const json = this.jsonProperties.annotation;
    return json ? TextAnnotation.fromJSON(json) : undefined;
  }

  /** Change the textual content, updating the element's geometry and placement accordingly.
   * @see [[getAnnotation]] to extract the current annotation.
   * @param annotation The new annotation
   * @param subCategory If specified, the subcategory on which to define the geometry; otherwise, the default subcategory of the element's category is used.
   * @returns true if the annotation was successfully updated.
   */
  public setAnnotation(annotation: TextAnnotation, subCategory?: Id64String): boolean {
    return updateAnnotation(this, annotation, subCategory);
  }
}
