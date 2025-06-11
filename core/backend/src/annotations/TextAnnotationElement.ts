/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { Code, CodeProps, ElementGeometry, ElementGeometryBuilderParams, Placement2d, Placement2dProps, Placement3d, Placement3dProps, PlacementProps, TextAnnotation, TextAnnotation2dProps, TextAnnotation3dProps, TextAnnotationProps } from "@itwin/core-common";
import { IModelDb } from "../IModelDb";
import { AnnotationElement2d, GraphicalElement3d, OnElementPropsArg } from "../Element";
import { Id64String } from "@itwin/core-bentley";
import { layoutTextBlock } from "./TextBlockLayout";
import { appendTextAnnotationGeometry } from "./TextAnnotationGeometry";

export interface TextAnnotation3dCreateArgs extends TextAnnotationXdCreateArgs {
  placement: Placement3dProps;
}

export interface TextAnnotation2dCreateArgs extends TextAnnotationXdCreateArgs {
  placement: Placement2dProps;
}

export interface TextAnnotationXdCreateArgs {
  textAnnotationData?: TextAnnotationProps;
  category: Id64String;
  model: Id64String;
  code?: CodeProps;
}

function getElementGeometryBuilderParams(iModel: IModelDb, _placementProps: PlacementProps, stringifiedAnnotationProps: string, categoryId: Id64String, _subCategory?: Id64String): ElementGeometryBuilderParams {
  const annotationProps = parseTextAnnotationData(stringifiedAnnotationProps);
  const textBlock = TextAnnotation.fromJSON(annotationProps).textBlock;
  const layout = layoutTextBlock({ iModel, textBlock });
  const builder = new ElementGeometry.Builder();
  appendTextAnnotationGeometry({ layout, annotationProps: annotationProps ?? {}, builder, categoryId })

  return { entryArray: builder.entries };
}

function parseTextAnnotationData(json: string | undefined): TextAnnotationProps | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

export class TextAnnotation2d extends AnnotationElement2d {
  /** @internal */
  public static override get className(): string { return "TextAnnotation2d"; }
  private _textAnnotationData?: string;

  /** Extract the textual content, if present.
   * @see [[setAnnotation]] to change it.
   */
  public getAnnotation(): TextAnnotation | undefined {
    const textAnnotationProps = parseTextAnnotationData(this._textAnnotationData);
    return textAnnotationProps ? TextAnnotation.fromJSON(textAnnotationProps) : undefined;
  }

  /** Change the textual content, updating the element's geometry and placement accordingly.
   * @see [[getAnnotation]] to extract the current annotation.
   * @param annotation The new annotation
   */
  public setAnnotation(annotation: TextAnnotation) {
    this._textAnnotationData = annotation ? JSON.stringify(annotation.toJSON()) : undefined;
  }

  protected constructor(props: TextAnnotation2dProps, iModel: IModelDb) {
    super(props, iModel);
    this._textAnnotationData = props.textAnnotationData;
  }

  public static fromJSON(props: TextAnnotation2dProps, iModel: IModelDb): TextAnnotation2d {
    return new TextAnnotation2d(props, iModel);
  }

  public override toJSON(): TextAnnotation2dProps {
    const props = super.toJSON() as TextAnnotation2dProps;
    props.textAnnotationData = this._textAnnotationData;
    if (this._textAnnotationData) {
      props.elementGeometryBuilderParams = getElementGeometryBuilderParams(this.iModel, this.placement, this._textAnnotationData, this.category);
    }

    return props;
  }

  public static create(iModelDb: IModelDb, args: TextAnnotation2dCreateArgs): TextAnnotation2d {
    const props: TextAnnotation2dProps = {
      classFullName: this.classFullName,
      textAnnotationData: JSON.stringify(args.textAnnotationData),
      placement: args.placement,
      model: args.model,
      category: args.category,
      code: args.code ?? Code.createEmpty(),
    }
    return new this(props, iModelDb);
  }

  protected static override onInsert(arg: OnElementPropsArg): void {
    super.onInsert(arg);
    this.updateGeometry(arg.iModel, arg.props as TextAnnotation2dProps);
  }

  protected static override onUpdate(arg: OnElementPropsArg): void {
    super.onUpdate(arg);
    this.updateGeometry(arg.iModel, arg.props as TextAnnotation2dProps);
  }

  protected static updateGeometry(iModelDb: IModelDb, props: TextAnnotation2dProps): void {
    if (props.elementGeometryBuilderParams || !props.textAnnotationData) {
      return;
    }

    props.elementGeometryBuilderParams = getElementGeometryBuilderParams(iModelDb, props.placement ?? Placement2d.fromJSON(), props.textAnnotationData, props.category);
  }
}

/** An element that displays textual content within a 3d model.
 * The text is stored as a [TextAnnotation]($common) from which the element's [geometry]($docs/learning/common/GeometryStream.md) and [Placement]($common) are computed.
 * @public @preview
 */
export class TextAnnotation3d extends GraphicalElement3d {
  /** @internal */
  public static override get className(): string { return "TextAnnotation3d"; }
  private _textAnnotationData?: string;

  /** Extract the textual content, if present.
   * @see [[setAnnotation]] to change it.
   */
  public getAnnotation(): TextAnnotation | undefined {
    const textAnnotationProps = parseTextAnnotationData(this._textAnnotationData);
    return textAnnotationProps ? TextAnnotation.fromJSON(textAnnotationProps) : undefined;
  }

  /** Change the textual content, updating the element's geometry and placement accordingly.
   * @see [[getAnnotation]] to extract the current annotation.
   * @param annotation The new annotation
   */
  public setAnnotation(annotation: TextAnnotation) {
    this._textAnnotationData = annotation ? JSON.stringify(annotation.toJSON()) : undefined;
  }

  protected constructor(props: TextAnnotation3dProps, iModel: IModelDb) {
    super(props, iModel);
    this._textAnnotationData = props.textAnnotationData;
  }

  public static fromJSON(props: TextAnnotation3dProps, iModel: IModelDb): TextAnnotation3d {
    return new TextAnnotation3d(props, iModel);
  }

  public override toJSON(): TextAnnotation3dProps {
    const props = super.toJSON() as TextAnnotation3dProps;
    props.textAnnotationData = this._textAnnotationData;
    if (this._textAnnotationData) {
      props.elementGeometryBuilderParams = getElementGeometryBuilderParams(this.iModel, this.placement, this._textAnnotationData, this.category);
    }

    return props;
  }

  public static create(iModelDb: IModelDb, args: TextAnnotation3dCreateArgs): TextAnnotation3d {
    const props: TextAnnotation3dProps = {
      classFullName: this.classFullName,
      textAnnotationData: JSON.stringify(args.textAnnotationData),
      placement: args.placement,
      model: args.model,
      category: args.category,
      code: args.code ?? Code.createEmpty(),
    }
    return new this(props, iModelDb);
  }

  protected static override onInsert(arg: OnElementPropsArg): void {
    super.onInsert(arg);
    this.updateGeometry(arg.iModel, arg.props as TextAnnotation3dProps);
  }

  protected static override onUpdate(arg: OnElementPropsArg): void {
    super.onUpdate(arg);
    this.updateGeometry(arg.iModel, arg.props as TextAnnotation3dProps);
  }

  protected static updateGeometry(iModelDb: IModelDb, props: TextAnnotation3dProps): void {
    if (props.elementGeometryBuilderParams || !props.textAnnotationData) {
      return;
    }

    props.elementGeometryBuilderParams = getElementGeometryBuilderParams(iModelDb, props.placement ?? Placement3d.fromJSON(), props.textAnnotationData, props.category);
  }
}




