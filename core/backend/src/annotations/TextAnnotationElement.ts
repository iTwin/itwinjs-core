/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { ElementGeometry, ElementGeometryBuilderParams, PlacementProps, TextAnnotation, TextAnnotation2dProps, TextAnnotation3dProps, TextAnnotationProps } from "@itwin/core-common";
import { IModelDb } from "../IModelDb";
import { AnnotationElement2d, GraphicalElement3d } from "../Element";
import { assert, Id64String } from "@itwin/core-bentley";
import { layoutTextBlock } from "./TextBlockLayout";
import { appendTextAnnotationGeometry } from "./TextAnnotationGeometry";
import { ITextAnnotation, TextBlockAndId } from "./ElementDrivesTextAnnotation";

function getElementGeometryBuilderParams(iModel: IModelDb, _placementProps: PlacementProps, annotationProps: TextAnnotationProps, categoryId: Id64String, _subCategory?: Id64String): ElementGeometryBuilderParams {
  const textBlock = TextAnnotation.fromJSON(annotationProps).textBlock;
  const layout = layoutTextBlock({ iModel, textBlock });
  const builder = new ElementGeometry.Builder();
  appendTextAnnotationGeometry({ layout, annotationProps, builder, categoryId })

  return { entryArray: builder.entries };
}

/** An element that displays textual content within a 2d model.
 * The text is stored as a [TextAnnotation]($common) from which the element's [geometry]($docs/learning/common/GeometryStream.md) and [Placement]($common) are computed.
 * @see [[setAnnotation]] to change the textual content.
 * @public @preview
 */
export class TextAnnotation2d extends AnnotationElement2d implements ITextAnnotation {
  /** @internal */
  public static override get className(): string { return "TextAnnotation2d"; }
  protected constructor(props: TextAnnotation2dProps, iModel: IModelDb) { super(props, iModel); }

  public static fromJSON(props: TextAnnotation2dProps, iModel: IModelDb): TextAnnotation2d {
    return new TextAnnotation2d(props, iModel);
  }

  public override toJSON(): TextAnnotation2dProps {
    const props = super.toJSON();
    props.elementGeometryBuilderParams = getElementGeometryBuilderParams(this.iModel, this.placement, this.jsonProperties.annotation, this.category);

    return props;
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
   */
  public setAnnotation(annotation: TextAnnotation) {
    this.jsonProperties.annotation = annotation.toJSON();
  }

  /** @internal */
  public getTextBlocks(): Iterable<TextBlockAndId> {
    return getTextBlocks(this);
  }

  /** @internal */
  public updateTextBlocks(textBlocks: TextBlockAndId[]): void {
    return updateTextBlocks(this, textBlocks);
  }
}

/** An element that displays textual content within a 3d model.
 * The text is stored as a [TextAnnotation]($common) from which the element's [geometry]($docs/learning/common/GeometryStream.md) and [Placement]($common) are computed.
 * @see [[setAnnotation]] to change the textual content.
 * @public @preview
 */
export class TextAnnotation3d extends GraphicalElement3d implements ITextAnnotation {
  /** @internal */
  public static override get className(): string { return "TextAnnotation3d"; }
  protected constructor(props: TextAnnotation3dProps, iModel: IModelDb) { super(props, iModel); }

  public static fromJSON(props: TextAnnotation3dProps, iModel: IModelDb): TextAnnotation3d {
    return new TextAnnotation3d(props, iModel);
  }

  public override toJSON(): TextAnnotation3dProps {
    const props = super.toJSON();
    props.elementGeometryBuilderParams = getElementGeometryBuilderParams(this.iModel, this.placement, this.jsonProperties.annotation, this.category);

    return props;
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
   */
  public setAnnotation(annotation: TextAnnotation) {
    this.jsonProperties.annotation = annotation.toJSON();
  }

  /** @internal */
  public getTextBlocks(): Iterable<TextBlockAndId> {
    return getTextBlocks(this);
  }

  /** @internal */
  public updateTextBlocks(textBlocks: TextBlockAndId[]): void {
    return updateTextBlocks(this, textBlocks);
  }
}

function getTextBlocks(elem: TextAnnotation2d | TextAnnotation3d): Iterable<TextBlockAndId> {
  const annotation = elem.getAnnotation();
  return annotation ? [{ textBlock: annotation.textBlock, id: undefined }] : [];
}

function updateTextBlocks(elem: TextAnnotation2d | TextAnnotation3d, textBlocks: TextBlockAndId[]): void {
  assert(textBlocks.length === 1);
  assert(textBlocks[0].id === undefined);

  let annotation = elem.getAnnotation();
  if (!annotation) {
    annotation = TextAnnotation.create({ textBlock: textBlocks[0].textBlock });
  } else {
    annotation.textBlock = textBlocks[0].textBlock;
  }

  elem.setAnnotation(annotation);
  elem.update();
}
