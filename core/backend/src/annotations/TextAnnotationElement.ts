/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { AnnotationTextStyleProps, BisCodeSpec, Code, CodeProps, CodeScopeProps, CodeSpec, ElementGeometry, ElementGeometryBuilderParams, EntityReferenceSet, Placement2d, Placement2dProps, Placement3d, Placement3dProps, PlacementProps, TextAnnotation, TextAnnotation2dProps, TextAnnotation3dProps, TextAnnotationProps, TextStyleSettings, TextStyleSettingsProps } from "@itwin/core-common";
import { IModelDb } from "../IModelDb";
import { AnnotationElement2d, DefinitionElement, GraphicalElement3d, OnElementIdArg, OnElementPropsArg } from "../Element";
import { assert, Id64String } from "@itwin/core-bentley";
import { layoutTextBlock, TextStyleResolver } from "./TextBlockLayout";
import { appendTextAnnotationGeometry } from "./TextAnnotationGeometry";
import { ElementDrivesTextAnnotation, TextBlockAndId } from "./ElementDrivesTextAnnotation";

function parseTextAnnotationData(json: string | undefined): TextAnnotationProps | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

function getElementGeometryBuilderParams(iModel: IModelDb, modelId: Id64String, _placementProps: PlacementProps, stringifiedAnnotationProps: string, categoryId: Id64String, _subCategory?: Id64String): ElementGeometryBuilderParams {
  const annotationProps = parseTextAnnotationData(stringifiedAnnotationProps);
  const textBlock = TextAnnotation.fromJSON(annotationProps).textBlock;
  const textStyleResolver = new TextStyleResolver({textBlock, iModel, modelId});
  const layout = layoutTextBlock({ iModel, textBlock, textStyleResolver });
  const builder = new ElementGeometry.Builder();
  appendTextAnnotationGeometry({ layout, textStyleResolver, annotationProps: annotationProps ?? {}, builder, categoryId })

  return { entryArray: builder.entries };
}

/** An element that displays textual content within a 2d model.
 * The text is stored as a [TextAnnotation]($common) from which the element's [geometry]($docs/learning/common/GeometryStream.md) and [Placement]($common) are computed.
 * @see [[setAnnotation]] to change the textual content.
 * @public @preview
 */
export class TextAnnotation2d extends AnnotationElement2d /* implements ITextAnnotation */ {
  /** @internal */
  public static override get className(): string { return "TextAnnotation2d"; }
  /** Optional string containing the data associated with the text annotation. */
  private _textAnnotationData?: string;

  /** Extract the textual content, if present.
   * @see [[setAnnotation]] to change it.
   */
  public getAnnotation(): TextAnnotation | undefined {
    const textAnnotationProps = parseTextAnnotationData(this._textAnnotationData);
    return textAnnotationProps ? TextAnnotation.fromJSON(textAnnotationProps) : undefined;
  }

  /** Change the textual content of the `TextAnnotation2d`.
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

  /** Creates a new instance of `TextAnnotation2d` from its JSON representation. */
  public static fromJSON(props: TextAnnotation2dProps, iModel: IModelDb): TextAnnotation2d {
    return new TextAnnotation2d(props, iModel);
  }

  /**
   * Converts the current `TextAnnotation2d` instance to its JSON representation.
   * It also computes the `elementGeometryBuilderParams` property used to create the GeometryStream.

   * @inheritdoc
   */
  public override toJSON(): TextAnnotation2dProps {
    const props = super.toJSON() as TextAnnotation2dProps;
    props.textAnnotationData = this._textAnnotationData;
    if (this._textAnnotationData) {
      props.elementGeometryBuilderParams = getElementGeometryBuilderParams(this.iModel, this.model, this.placement, this._textAnnotationData, this.category);
    }

    return props;
  }

  /** Creates a new `TextAnnotation2d` instance with the specified properties.
   * @param iModelDb The iModel.
   * @param category The category ID for the annotation.
   * @param model The model ID where the annotation will be placed.
   * @param placement The placement properties for the annotation.
   * @param textAnnotationData Optional [[TextAnnotation]] JSON representation used to create the `TextAnnotation2d`. Essentially an empty element if not provided.
   * @param code Optional code for the element.
   */
  public static create(iModelDb: IModelDb, category: Id64String, model: Id64String, placement: Placement2dProps, textAnnotationData?: TextAnnotationProps, code?: CodeProps): TextAnnotation2d {
    const props: TextAnnotation2dProps = {
      classFullName: this.classFullName,
      textAnnotationData: JSON.stringify(textAnnotationData),
      placement,
      model,
      category,
      code: code ?? Code.createEmpty(),
    }
    return new this(props, iModelDb);
  }

  /**
   * Updates the geometry of the TextAnnotation2d on insert.
   * @inheritdoc
   * @beta
   */
  protected static override onInsert(arg: OnElementPropsArg): void {
    super.onInsert(arg);
    this.updateGeometry(arg.iModel, arg.props as TextAnnotation2dProps);
  }

  /**
   * Updates the geometry of the TextAnnotation2d on update.
   * @inheritdoc
   * @beta
   */
  protected static override onUpdate(arg: OnElementPropsArg): void {
    super.onUpdate(arg);
    this.updateGeometry(arg.iModel, arg.props as TextAnnotation2dProps);
  }

  /**
   * Populates the `elementGeometryBuilderParams` property in the [TextAnnotation2dProps]($common).
   * It only does this if the `elementGeometryBuilderParams` is not already set and if there is actually a text annotation to produce geometry for.
   */
  protected static updateGeometry(iModelDb: IModelDb, props: TextAnnotation2dProps): void {
    if (props.elementGeometryBuilderParams || !props.textAnnotationData) {
      return;
    }

    props.elementGeometryBuilderParams = getElementGeometryBuilderParams(iModelDb, props.model, props.placement ?? Placement2d.fromJSON(), props.textAnnotationData, props.category);
  }

  /**
   * Collects reference IDs used by this `TextAnnotation2d`.
   * @inheritdoc
   */
  protected override collectReferenceIds(ids: EntityReferenceSet): void {
    super.collectReferenceIds(ids);
    const annotation = this.getAnnotation();
    if (!annotation) {
      return;
    }
    if (annotation.textBlock.styleId)
      ids.addElement(annotation.textBlock.styleId);
  }

  /** @internal */
  public getTextBlocks(): Iterable<TextBlockAndId> {
    return getTextBlocks(this);
  }

  /** @internal */
  public updateTextBlocks(textBlocks: TextBlockAndId[]): void {
    return updateTextBlocks(this, textBlocks);
  }

  /** @internal */
  public static override onInserted(arg: OnElementIdArg): void {
    super.onInserted(arg);
    ElementDrivesTextAnnotation.updateFieldDependencies(arg.id, arg.iModel);
  }

  /** @internal */
  public static override onUpdated(arg: OnElementIdArg): void {
    super.onUpdated(arg);
    ElementDrivesTextAnnotation.updateFieldDependencies(arg.id, arg.iModel);
  }
}

/** An element that displays textual content within a 3d model.
 * The text is stored as a [TextAnnotation]($common) from which the element's [geometry]($docs/learning/common/GeometryStream.md) and [Placement]($common) are computed.
 * @see [[setAnnotation]] to change the textual content.
 * @public @preview
 */
export class TextAnnotation3d extends GraphicalElement3d /* implements ITextAnnotation */ {
  /** @internal */
  public static override get className(): string { return "TextAnnotation3d"; }
  /** Optional string containing the data associated with the text annotation. */
  private _textAnnotationData?: string;

  /** Extract the textual content, if present.
   * @see [[setAnnotation]] to change it.
   */
  public getAnnotation(): TextAnnotation | undefined {
    const textAnnotationProps = parseTextAnnotationData(this._textAnnotationData);
    return textAnnotationProps ? TextAnnotation.fromJSON(textAnnotationProps) : undefined;
  }

  /** Change the textual content of the `TextAnnotation3d`.
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

  /** Creates a new instance of `TextAnnotation3d` from its JSON representation. */
  public static fromJSON(props: TextAnnotation3dProps, iModel: IModelDb): TextAnnotation3d {
    return new TextAnnotation3d(props, iModel);
  }

  /**
   * Converts the current `TextAnnotation3d` instance to its JSON representation.
   * It also computes the `elementGeometryBuilderParams` property used to create the GeometryStream.
   * @inheritdoc
   */
  public override toJSON(): TextAnnotation3dProps {
    const props = super.toJSON() as TextAnnotation3dProps;
    props.textAnnotationData = this._textAnnotationData;
    if (this._textAnnotationData) {
      props.elementGeometryBuilderParams = getElementGeometryBuilderParams(this.iModel, this.model, this.placement, this._textAnnotationData, this.category);
    }

    return props;
  }

  /** Creates a new `TextAnnotation3d` instance with the specified properties.
   * @param iModelDb The iModel.
   * @param category The category ID for the annotation.
   * @param model The model ID where the annotation will be placed.
   * @param placement The placement properties for the annotation.
   * @param textAnnotationData Optional [[TextAnnotation]] JSON representation used to create the `TextAnnotation3d`. Essentially an empty element if not provided.
   * @param code Optional code for the element.
   */
  public static create(iModelDb: IModelDb, category: Id64String, model: Id64String, placement: Placement3dProps, textAnnotationData?: TextAnnotationProps, code?: CodeProps): TextAnnotation3d {
    const props: TextAnnotation3dProps = {
      classFullName: this.classFullName,
      textAnnotationData: JSON.stringify(textAnnotationData),
      placement,
      model,
      category,
      code: code ?? Code.createEmpty(),
    }
    return new this(props, iModelDb);
  }

  /**
   * Updates the geometry of the TextAnnotation3d on insert.
   * @inheritdoc
   * @beta
   */
  protected static override onInsert(arg: OnElementPropsArg): void {
    super.onInsert(arg);
    this.updateGeometry(arg.iModel, arg.props as TextAnnotation3dProps);
  }

  /**
   * Updates the geometry of the TextAnnotation3d on update.
   * @inheritdoc
   * @beta
   */
  protected static override onUpdate(arg: OnElementPropsArg): void {
    super.onUpdate(arg);
    this.updateGeometry(arg.iModel, arg.props as TextAnnotation3dProps);
  }

  /**
   * Populates the `elementGeometryBuilderParams` property in the [TextAnnotation3dProps]($common).
   * It only does this if the `elementGeometryBuilderParams` is not already set and if there is actually a text annotation to produce geometry for.
   */
  protected static updateGeometry(iModelDb: IModelDb, props: TextAnnotation3dProps): void {
    if (props.elementGeometryBuilderParams || !props.textAnnotationData) {
      return;
    }

    props.elementGeometryBuilderParams = getElementGeometryBuilderParams(iModelDb, props.model, props.placement ?? Placement3d.fromJSON(), props.textAnnotationData, props.category);
  }

  /**
   * Collects reference IDs used by this `TextAnnotation3d`.
   * @inheritdoc
   */
  protected override collectReferenceIds(ids: EntityReferenceSet): void {
    super.collectReferenceIds(ids);
    const annotation = this.getAnnotation();
    if (!annotation) {
      return;
    }
    if (annotation.textBlock.styleId)
      ids.addElement(annotation.textBlock.styleId);
  }

  /** @internal */
  public getTextBlocks(): Iterable<TextBlockAndId> {
    return getTextBlocks(this);
  }

  /** @internal */
  public updateTextBlocks(textBlocks: TextBlockAndId[]): void {
    return updateTextBlocks(this, textBlocks);
  }

  /** @internal */
  public static override onInserted(arg: OnElementIdArg): void {
    super.onInserted(arg);
    ElementDrivesTextAnnotation.updateFieldDependencies(arg.id, arg.iModel);
  }

  /** @internal */
  public static override onUpdated(arg: OnElementIdArg): void {
    super.onUpdated(arg);
    ElementDrivesTextAnnotation.updateFieldDependencies(arg.id, arg.iModel);
  }
}

function getTextBlocks(elem: TextAnnotation2d | TextAnnotation3d): Iterable<TextBlockAndId> {
  const annotation = elem.getAnnotation();
  return annotation ? [{ textBlock: annotation.textBlock, id: undefined }] : [];
}

function updateTextBlocks(elem: TextAnnotation2d | TextAnnotation3d, textBlocks: TextBlockAndId[]): void {
  assert(textBlocks.length === 1);
  assert(textBlocks[0].id === undefined);

  const annotation = elem.getAnnotation();
  if (!annotation) {
    // We must obtain the TextBlockAndId from the element in the first place, so the only way we could end up here is if
    // somebody removed the text annotation after we called getTextBlocks. That's gotta be a mistake.
    throw new Error("Text annotation element has no text");
  }

  annotation.textBlock = textBlocks[0].textBlock;

  elem.setAnnotation(annotation);
  elem.update();
}

/**
 * The definition element that holds text style information.
 * The style is stored as a [TextStyleSettings]($common).
 * @beta
 */
export class AnnotationTextStyle extends DefinitionElement {
  /** @internal */
  public static override get className(): string { return "AnnotationTextStyle"; }
  /**
   * Optional text describing the `AnnotationTextStyle`.
   */
  public description?: string;
  /**
   * The text style settings for the `AnnotationTextStyle`.
   * @see [[TextStyleSettings]] for more information.
   */
  public settings: TextStyleSettings;

  protected constructor(props: AnnotationTextStyleProps, iModel: IModelDb) {
    super(props, iModel);
    this.description = props.description;
    const settingsProps = AnnotationTextStyle.parseTextStyleSettings(props.settings);
    this.settings = TextStyleSettings.fromJSON(settingsProps);
  }

  /**
   * Creates a Code for an `AnnotationTextStyle` given a name that is meant to be unique within the scope of the specified DefinitionModel.
   *
   * @param iModel - The IModelDb.
   * @param definitionModelId - The ID of the DefinitionModel that contains the AnnotationTextStyle and provides the scope for its name.
   * @param name - The AnnotationTextStyle name.
   */
  public static createCode(iModel: IModelDb, definitionModelId: CodeScopeProps, name: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.annotationTextStyle);
    return new Code({ spec: codeSpec.id, scope: definitionModelId, value: name });
  }

  /**
   * Creates a new instance of `AnnotationTextStyle` with the specified properties.
   *
   * @param iModelDb - The iModelDb.
   * @param definitionModelId - The ID of the [[DefinitionModel]].
   * @param name - The name to assign to the `AnnotationTextStyle`.
   * @param settings - Optional text style settings used to create the `AnnotationTextStyle`. Default settings will be used if not provided.
   * @param description - Optional description for the `AnnotationTextStyle`.
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, settings?: TextStyleSettingsProps, description?: string) {
    const props: AnnotationTextStyleProps = {
      classFullName: this.classFullName,
      model: definitionModelId,
      code: this.createCode(iModelDb, definitionModelId, name).toJSON(),
      description,
      settings: JSON.stringify(settings),
    }
    return new this(props, iModelDb);
  }

  /**
   * Converts the current `AnnotationTextStyle` instance to its JSON representation.
   * @inheritdoc
   */
  public override toJSON(): AnnotationTextStyleProps {
    const props = super.toJSON() as AnnotationTextStyleProps;
    props.description = this.description;
    props.settings = JSON.stringify(this.settings.toJSON());
    return props;
  }

  /** Creates a new instance of `AnnotationTextStyle` from its JSON representation. */
  public static fromJSON(props: AnnotationTextStyleProps, iModel: IModelDb): AnnotationTextStyle {
    return new AnnotationTextStyle(props, iModel);
  }

  /**
   * Validates that the AnnotationTextStyle's settings are valid before insert.
   * @inheritdoc
   * @beta
   */
  protected static override onInsert(arg: OnElementPropsArg): void {
    super.onInsert(arg);
    this.validateSettings(arg.props as AnnotationTextStyleProps);
  }

  /**
   * Validates that the AnnotationTextStyle's settings are valid before update.
   * @inheritdoc
   * @beta
   */
  protected static override onUpdate(arg: OnElementPropsArg): void {
    super.onUpdate(arg);
    this.validateSettings(arg.props as AnnotationTextStyleProps);
  }

  private static validateSettings(props: AnnotationTextStyleProps): void {
    const settingProps = AnnotationTextStyle.parseTextStyleSettings(props.settings);
    if (!settingProps) return;
    const settings = TextStyleSettings.fromJSON(settingProps);
    const errors = settings.getValidationErrors();
    if (errors.length > 0) {
      throw new Error(`Invalid AnnotationTextStyle settings: ${errors.join(", ")}`);
    }
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


