/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { AnnotationTextStyleProps, BisCodeSpec, Code, CodeScopeProps, CodeSpec, ElementGeometry, FlatBufferGeometryStream, GeometryParams, GeometryStreamBuilder, GeometryStreamProps, Placement2dProps, TextAnnotation, TextAnnotation2dProps, TextAnnotation3dProps, TextAnnotationProps, TextStyleSettings, TextStyleSettingsProps } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";
import { AnnotationElement2d, DefinitionElement, GraphicalElement3d, OnElementIdArg, OnElementPropsArg } from "./Element";
import { produceTextAnnotationGeometry } from "./TextAnnotationGeometry";
import { Id64String } from "@itwin/core-bentley";

interface TempGeometryArgs {
  iModel: IModelDb;
  annotation: TextAnnotationProps;
  category: Id64String;
  subCategory?: Id64String;
  want: "flatbuffer" | "json";
}

export function produceGeometryTemp(args: TempGeometryArgs): FlatBufferGeometryStream | GeometryStreamProps | false {
  const builder = args.want === "flatbuffer" ? new ElementGeometry.Builder() : new GeometryStreamBuilder();

  const params = new GeometryParams(args.category, args.subCategory);
  if (!builder.appendGeometryParamsChange(params)) {
    return false;
  }

  const props = produceTextAnnotationGeometry({ iModel: args.iModel, annotation: TextAnnotation.fromJSON(args.annotation) });
  if (!builder.appendTextBlock(props)) {
    return false;
  }

  if (args.want === "flatbuffer") {
    return { format: "flatbuffer", data: (builder as ElementGeometry.Builder).entries };
  } else {
    return (builder as GeometryStreamBuilder).geometryStream;
  }
}

function updateAnnotation(element: TextAnnotation3d, annotation: TextAnnotation, subCategory: Id64String | undefined): boolean {
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
  element.textAnnotationData = annotation.toJSON();

  return true;
}

function parseTextAnnotationData(json: string | undefined): TextAnnotationProps | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

export interface TextAnnotation2dCreateArgs extends TextAnnotationXdCreateArgs {
  placement: Placement2dProps
}

export interface TextAnnotationXdCreateArgs {
  textAnnotationData: TextAnnotationProps,
  category: Id64String,
  model: Id64String,
  // Maybe temp? Related to creating geometry
  subCategory?: Id64String,
}

/** An element that displays textual content within a 2d model.
 * The text is stored as a [TextAnnotation]($common) from which the element's [geometry]($docs/learning/common/GeometryStream.md) and [Placement]($common) are computed.
 * @see [[setAnnotation]] to change the textual content.
 * @public
 */
export class TextAnnotation2d extends AnnotationElement2d {
  /** @internal */
  public static override get className(): string { return "TextAnnotation2d"; }
  public textAnnotationData: TextAnnotation;

  protected constructor(props: TextAnnotation2dProps, iModel: IModelDb) {
    super(props, iModel);
    const textAnnotationProps = parseTextAnnotationData(props.textAnnotationData);
    this.textAnnotationData = TextAnnotation.fromJSON(textAnnotationProps);
  }

  public static fromJSON(props: TextAnnotation2dProps, iModel: IModelDb): TextAnnotation2d {
    return new TextAnnotation2d(props, iModel);
  }

  public static createProps(args: TextAnnotation2dCreateArgs): TextAnnotation2dProps {
    const props: TextAnnotation2dProps = {
      classFullName: this.classFullName,
      textAnnotationData: JSON.stringify(args.textAnnotationData),
      placement: args.placement,
      model: args.model,
      category: args.category,
      code: Code.createEmpty(),
    }
    return props;
  }

  public override toJSON(): TextAnnotation2dProps {
    const props = super.toJSON() as TextAnnotation2dProps;
    props.textAnnotationData = JSON.stringify(this.textAnnotationData.toJSON());
    return props;
  }

  protected static override onInsert(arg: OnElementPropsArg): void {
    super.onInsert(arg);
    // Validate that fontName and lineHeight are provided and valid. Throw an error if not.
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
  public textAnnotationData?: TextAnnotationProps;

  protected constructor(props: TextAnnotation3dProps, iModel: IModelDb) {
    super(props, iModel);
    this.textAnnotationData = parseTextAnnotationData(props.textAnnotationData);
  }

  public static fromJSON(props: TextAnnotation3dProps, iModel: IModelDb): TextAnnotation3d {
    return new TextAnnotation3d(props, iModel);
  }

  public override toJSON(): TextAnnotation3dProps {
    const props = super.toJSON() as TextAnnotation3dProps;
    props.textAnnotationData = JSON.stringify(this.textAnnotationData);
    return props;
  }

  /** Extract the textual content, if present.
   * @see [[setAnnotation]] to change it.
   */
  public getAnnotation(): TextAnnotation | undefined {
    return this.textAnnotationData ? TextAnnotation.fromJSON(this.textAnnotationData) : undefined;
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

export interface AnnotationTextStyleCreateArgs {
  /** The IModel that will contain the AnnotationTextStyle. */
  iModelDb: IModelDb;
  /** The text style settings that will be in the AnnotationTextStyle. */
  settings: TextStyleSettingsProps;
  /** The Id of the [DefinitionModel]($backend) that will contain this AnnotationTextStyle element. */
  definitionModelId: Id64String;
  /** The name of the AnnotationTextStyle. */
  name: string;
  /** The description of the AnnotationTextStyle. */
  description?: string;
}

export class AnnotationTextStyle extends DefinitionElement {
  /** @internal */
  public static override get className(): string { return "AnnotationTextStyle"; }
  public description?: string;
  public settings: TextStyleSettings;

  protected constructor(props: AnnotationTextStyleProps, iModel: IModelDb) {
    super(props, iModel);
    this.description = props.description;
    const settingsProps = AnnotationTextStyle.parseTextStyleSettings(props.settings);
    this.settings = TextStyleSettings.fromJSON(settingsProps);
  }

  public static createCode(iModel: IModelDb, definitionModelId: CodeScopeProps, name: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.annotationTextStyle);
    return new Code({ spec: codeSpec.id, scope: definitionModelId, value: name });
  }

  public static create(args: AnnotationTextStyleCreateArgs) {
    const props: AnnotationTextStyleProps = {
      classFullName: this.classFullName,
      model: args.definitionModelId,
      code: this.createCode(args.iModelDb, args.definitionModelId, args.name).toJSON(),
      description: args.description,
      settings: JSON.stringify(args.settings),
    }
    return new this(props, args.iModelDb);
  }

  public override toJSON(): AnnotationTextStyleProps {
    const props = super.toJSON() as AnnotationTextStyleProps;
    props.description = this.description;
    props.settings = JSON.stringify(this.settings.toJSON());
    return props;
  }

  public static fromJSON(props: AnnotationTextStyleProps, iModel: IModelDb): AnnotationTextStyle {
    return new AnnotationTextStyle(props, iModel);
  }

  /** TODO: This is fine. However, do NOT be overly restrictive.
   * Do not disallow things that should be allowed in normal circumstances. Forcing font name works. But what about lineHeight?
   * TextStyleSettings does not allow undefined values. This has been manageable because it has default values it can fall back to.
   * However, our hypothesis is that these defaults values are not usually meaningful.
   */
  protected static override onInsert(arg: OnElementPropsArg): void {
    super.onInsert(arg);
    // Validate that fontName and lineHeight/numbers > 0 are provided and valid. Throw an error if not.
  }

  /** TODO: Is it better to do this at the application layer? Yes, not here.
   * How should core know which elements use this style and how to produce geometry for them? Especially, if we are making update and geometry two separate steps.
   * We could determine the elements via a similar mechanism to checking that the style is not used when deleting it (querying into C++). Expensive!
   * We could also update the geometry of all the elements that we expect to need updating/know how to update, and leave the application layer to handle the rest.
   */
  protected static override onUpdated(arg: OnElementIdArg): void {
    super.onUpdated(arg);
    // Find all elements that reference this style
    // Update their geometry
  }

  /** TODO: We need to ensure that nothing is using this element before deleting it.
   * To delete a definition element, `deleteDefinitionElements` must be called on the IModelDb.
   * However, that calls into the C++, and C++ does not appear to check for this element's usage: https://github.com/iTwin/imodel-native/blob/3b4e515cf2279ffc70eb135ef3f327c786954382/iModelJsNodeAddon/JsInteropDgnDb.cpp#L1505
   * Instead of implementing in C++, we could implement here, especially if we are doing a similar scan in `onUpdated`.
   * TODO: VERIFY that `deleteDefinitionElements` fails to prevent deletion if this element is used.
   */
  protected static override onDelete(arg: OnElementIdArg): void {
    super.onDelete(arg);
    // Find all elements that reference this style
    // Throw an error if any are found
  }

  private static parseTextStyleSettings(json: string | undefined): TextStyleSettingsProps | undefined {
    if (!json) return undefined;
    try {
      return JSON.parse(json);
    } catch {
      return undefined;
    }
  }
}