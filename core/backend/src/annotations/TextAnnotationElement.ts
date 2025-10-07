/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { AnnotationTextStyleProps, BisCodeSpec, Code, CodeProps, CodeScopeProps, CodeSpec, ECVersionString, ElementGeometry, ElementGeometryBuilderParams, EntityReferenceSet, Placement2d, Placement2dProps, Placement3d, Placement3dProps, PlacementProps, TextAnnotation, TextAnnotation2dProps, TextAnnotation3dProps, TextAnnotationProps, TextStyleSettings, TextStyleSettingsProps, traverseTextBlockComponent, VersionedJSON } from "@itwin/core-common";
import { IModelDb } from "../IModelDb";
import { AnnotationElement2d, DefinitionElement, Drawing, GraphicalElement3d, OnElementIdArg, OnElementPropsArg } from "../Element";
import { assert, Id64, Id64String } from "@itwin/core-bentley";
import { layoutTextBlock, TextStyleResolver } from "./TextBlockLayout";
import { appendTextAnnotationGeometry } from "./TextAnnotationGeometry";
import { ElementDrivesTextAnnotation, TextAnnotationUsesTextStyleByDefault, TextBlockAndId } from "./ElementDrivesTextAnnotation";
import { IModelElementCloneContext } from "../IModelElementCloneContext";
import { CustomHandledProperty, DeserializeEntityArgs, ECSqlRow } from "../Entity";
import * as semver from "semver";

/** The version of the JSON stored in `TextAnnotation2d/3dProps.textAnnotationData` used by the code.
 * Uses the same semantics as [ECVersion]($ecschema-metadata).
 * @internal
*/
export const TEXT_ANNOTATION_JSON_VERSION = "1.0.0";

function validateAndMigrateVersionedJSON<T>(
  json: string,
  currentVersion: ECVersionString,
  migrate: (old: VersionedJSON<T>) => T
): VersionedJSON<T> | undefined {
  let parsed;
  try {
    parsed = JSON.parse(json) as VersionedJSON<T>;
  } catch {
    return undefined;
  }

  const version = parsed.version;
  if (typeof version !== "string" || !semver.valid(version))
    throw new Error("JSON version is missing or invalid.");

  if (typeof parsed.data !== "object" || parsed.data === null)
    throw new Error("JSON data is missing or invalid.");

  // Newer
  if (semver.gt(version, currentVersion))
    throw new Error(`JSON version ${parsed.version} is newer than supported version ${currentVersion}. Application update required to understand data.`);

  // Older
  if (semver.lt(version, currentVersion)) {
    parsed.data = migrate(parsed);
    parsed.version = currentVersion;
  }

  return parsed;
}

function migrateTextAnnotationData(oldData: VersionedJSON<TextAnnotationProps>): TextAnnotationProps {
  if (oldData.version === TEXT_ANNOTATION_JSON_VERSION) return oldData.data;

  // Place migration logic here.

  throw new Error(`Migration for textAnnotationData from version ${oldData.version} to ${TEXT_ANNOTATION_JSON_VERSION} failed.`);
}

/** Parses, validates, and potentially migrates the text annotation data from a JSON string.
 * @internal
 */
export function parseTextAnnotationData(json: string | undefined): VersionedJSON<TextAnnotationProps> | undefined {
  if (!json) return undefined;

  return validateAndMigrateVersionedJSON<TextAnnotationProps>(json, TEXT_ANNOTATION_JSON_VERSION, migrateTextAnnotationData);
}

function getElementGeometryBuilderParams(iModel: IModelDb, modelId: Id64String, categoryId: Id64String, _placementProps: PlacementProps, annotationProps?: TextAnnotationProps, textStyleId?: Id64String, _subCategory?: Id64String): ElementGeometryBuilderParams {
  const textBlock = TextAnnotation.fromJSON(annotationProps).textBlock;
  const textStyleResolver = new TextStyleResolver({textBlock, textStyleId: textStyleId ?? "", iModel});
  const layout = layoutTextBlock({ iModel, textBlock, textStyleResolver });
  const builder = new ElementGeometry.Builder();
  let scaleFactor = 1;
  const element = iModel.elements.getElement(modelId);
  if (element instanceof Drawing)
    scaleFactor = element.scaleFactor;
  appendTextAnnotationGeometry({ layout, textStyleResolver, scaleFactor, annotationProps: annotationProps ?? {}, builder, categoryId });

  return { entryArray: builder.entries };
}

/** Arguments supplied when creating a [[TextAnnotation2d]].
 * @beta
 */
export interface TextAnnotation2dCreateArgs {
  /** The category ID for the annotation. */
  category: Id64String;
  /** The model ID where the annotation will be placed. */
  model: Id64String;
  /** The placement properties for the annotation. */
  placement: Placement2dProps;
  /** The default text style ID for the annotation. */
  defaultTextStyleId?: Id64String;
  /** Optional [[TextAnnotation]] JSON representation used to create the `TextAnnotation2d`. Essentially an empty element if not provided. */
  textAnnotationProps?: TextAnnotationProps;
  /** Optional code for the element. */
  code?: CodeProps;
}

/** Arguments supplied when creating a [[TextAnnotation3d]].
 * @beta
 */
export interface TextAnnotation3dCreateArgs {
  /** The category ID for the annotation. */
  category: Id64String;
  /** The model ID where the annotation will be placed. */
  model: Id64String;
  /** The placement properties for the annotation. */
  placement: Placement3dProps;
  /** The default text style ID for the annotation. */
  defaultTextStyleId?: Id64String;
  /** Optional [[TextAnnotation]] JSON representation used to create the `TextAnnotation3d`. Essentially an empty element if not provided. */
  textAnnotationProps?: TextAnnotationProps;
  /** Optional code for the element. */
  code?: CodeProps;
}

/** An element that displays textual content within a 2d model.
 * The text is stored as a [TextAnnotation]($common) from which the element's [geometry]($docs/learning/common/GeometryStream.md) and [Placement]($common) are computed.
 * @see [[setAnnotation]] to change the textual content.
 * @public @preview
 */
export class TextAnnotation2d extends AnnotationElement2d /* implements ITextAnnotation */ {
  /** @internal */
  public static override get className(): string { return "TextAnnotation2d"; }
  /**
   * The default [[AnnotationTextStyle]] used by the TextAnnotation2d.
   * @beta
   */
  public defaultTextStyle?: TextAnnotationUsesTextStyleByDefault;
  /** The data associated with the text annotation. */
  private _textAnnotationProps?: TextAnnotationProps;

  /** Extract the textual content, if present.
   * @see [[setAnnotation]] to change it.
   */
  public getAnnotation(): TextAnnotation | undefined {
    return this._textAnnotationProps ? TextAnnotation.fromJSON(this._textAnnotationProps) : undefined;
  }

  /** Change the textual content of the `TextAnnotation2d`.
   * @see [[getAnnotation]] to extract the current annotation.
   * @param annotation The new annotation
   */
  public setAnnotation(annotation: TextAnnotation) {
    this._textAnnotationProps = annotation.toJSON();
  }

  protected constructor(props: TextAnnotation2dProps, iModel: IModelDb) {
    super(props, iModel);
    if (props.defaultTextStyle) {
      this.defaultTextStyle = new TextAnnotationUsesTextStyleByDefault(props.defaultTextStyle.id);
    }
    this._textAnnotationProps = parseTextAnnotationData(props.textAnnotationData)?.data;
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
    props.textAnnotationData = this._textAnnotationProps ? JSON.stringify({ version: TEXT_ANNOTATION_JSON_VERSION, data: this._textAnnotationProps }) : undefined;
    if (this._textAnnotationProps) {
      props.elementGeometryBuilderParams = getElementGeometryBuilderParams(this.iModel, this.model, this.category, this.placement, this._textAnnotationProps, this.defaultTextStyle ? this.defaultTextStyle.id : undefined);
    }

    return props;
  }

  /** Creates a new `TextAnnotation2d` instance with the specified properties.
   * @param iModelDb The iModel.
   * @param arg The arguments for creating the TextAnnotation2d.
   * @beta
   */
  public static create(iModelDb: IModelDb, arg: TextAnnotation2dCreateArgs): TextAnnotation2d {
    const elementProps: TextAnnotation2dProps = {
      classFullName: this.classFullName,
      textAnnotationData: arg.textAnnotationProps ? JSON.stringify({ version: TEXT_ANNOTATION_JSON_VERSION, data: arg.textAnnotationProps }) : undefined,
      defaultTextStyle: arg.defaultTextStyleId ? new TextAnnotationUsesTextStyleByDefault(arg.defaultTextStyleId).toJSON() : undefined,
      placement: arg.placement,
      model: arg.model,
      category: arg.category,
      code: arg.code ?? Code.createEmpty(),
    };
    return new this(elementProps, iModelDb);
  }

  /**
   * Updates the geometry of the TextAnnotation2d on insert and validates version.
   * @inheritdoc
   * @beta
   */
  protected static override onInsert(arg: OnElementPropsArg): void {
    super.onInsert(arg);
    this.validateVersionAndUpdateGeometry(arg);
  }

  /**
   * Updates the geometry of the TextAnnotation2d on update and validates version.
   * @inheritdoc
   * @beta
   */
  protected static override onUpdate(arg: OnElementPropsArg): void {
    super.onUpdate(arg);
    this.validateVersionAndUpdateGeometry(arg);
  }

  /**
   * Populates the `elementGeometryBuilderParams` property in the [TextAnnotation2dProps]($common).
   * Only does this if the `elementGeometryBuilderParams` is not already set and if there is actually a text annotation to produce geometry for.
   * Also, validates the version of the text annotation data and migrates it if necessary.
   * @beta
   */
  protected static validateVersionAndUpdateGeometry(arg: OnElementPropsArg): void {
    const props = arg.props as TextAnnotation2dProps;
    const textAnnotationData = parseTextAnnotationData(props.textAnnotationData);
    if (!props.elementGeometryBuilderParams && textAnnotationData) {
      props.elementGeometryBuilderParams = getElementGeometryBuilderParams(arg.iModel, props.model, props.category, props.placement ?? Placement2d.fromJSON(), textAnnotationData.data, props.defaultTextStyle?.id);
    }
  }

  /**
   * TextAnnotation2d custom HandledProps include 'textAnnotationData'.
   * @inheritdoc
   * @internal
   */
  protected static override readonly _customHandledProps: CustomHandledProperty[] = [
    { propertyName: "textAnnotationData", source: "Class" },
  ];

  /**
   * TextAnnotation2d deserializes 'textAnnotationData'.
   * @inheritdoc
   * @beta
   */
  public static override deserialize(props: DeserializeEntityArgs): TextAnnotation2dProps {
    const elProps = super.deserialize(props) as TextAnnotation2dProps;
    const textAnnotationData = parseTextAnnotationData(props.row.textAnnotationData);
    if (textAnnotationData) {
      elProps.textAnnotationData = JSON.stringify(textAnnotationData);
    }
    return elProps;
  }

  /**
   * TextAnnotation2d serializes 'textAnnotationData'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: TextAnnotation2dProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);
    if (props.textAnnotationData !== undefined) {
      inst.textAnnotationData = props.textAnnotationData;
    }
    return inst;
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

  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    collectReferenceIds(this, referenceIds);
  }

  /** @internal */
  protected static override onCloned(context: IModelElementCloneContext, srcProps: TextAnnotation2dProps, dstProps: TextAnnotation2dProps): void {
    super.onCloned(context, srcProps, dstProps);

    const srcElem = TextAnnotation2d.fromJSON(srcProps, context.sourceDb);
    ElementDrivesTextAnnotation.remapFields(srcElem, context);
    const anno = srcElem.getAnnotation();
dstProps.textAnnotationData = anno ? JSON.stringify({ version: TEXT_ANNOTATION_JSON_VERSION, data: anno.toJSON() }) : undefined;

    remapTextStyle(context, srcElem, dstProps);
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
  /**
   * The default [[AnnotationTextStyle]] used by the TextAnnotation3d.
   * @beta
   */
  public defaultTextStyle?: TextAnnotationUsesTextStyleByDefault;
  /** The data associated with the text annotation. */
  private _textAnnotationProps?: TextAnnotationProps;

  /** Extract the textual content, if present.
   * @see [[setAnnotation]] to change it.
   */
  public getAnnotation(): TextAnnotation | undefined {
    return this._textAnnotationProps ? TextAnnotation.fromJSON(this._textAnnotationProps) : undefined;
  }

  /** Change the textual content of the `TextAnnotation3d`.
   * @see [[getAnnotation]] to extract the current annotation.
   * @param annotation The new annotation
   */
  public setAnnotation(annotation: TextAnnotation) {
    this._textAnnotationProps = annotation.toJSON();
  }

  protected constructor(props: TextAnnotation3dProps, iModel: IModelDb) {
    super(props, iModel);
    if (props.defaultTextStyle) {
      this.defaultTextStyle = new TextAnnotationUsesTextStyleByDefault(props.defaultTextStyle.id);
    }
    this._textAnnotationProps = parseTextAnnotationData(props.textAnnotationData)?.data;
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
    props.textAnnotationData = this._textAnnotationProps ? JSON.stringify({ version: TEXT_ANNOTATION_JSON_VERSION, data: this._textAnnotationProps }) : undefined;
    if (this._textAnnotationProps) {
      props.elementGeometryBuilderParams = getElementGeometryBuilderParams(this.iModel, this.model, this.category, this.placement, this._textAnnotationProps, this.defaultTextStyle ? this.defaultTextStyle.id : undefined);
    }

    return props;
  }

  /** Creates a new `TextAnnotation3d` instance with the specified properties.
   * @param iModelDb The iModel.
   * @param arg The arguments for creating the TextAnnotation3d.
   * @beta
   */
  public static create(iModelDb: IModelDb, arg: TextAnnotation3dCreateArgs): TextAnnotation3d {
    const elementProps: TextAnnotation3dProps = {
      classFullName: this.classFullName,
      textAnnotationData: arg.textAnnotationProps ? JSON.stringify({ version: TEXT_ANNOTATION_JSON_VERSION, data: arg.textAnnotationProps }) : undefined,
      defaultTextStyle: arg.defaultTextStyleId ? new TextAnnotationUsesTextStyleByDefault(arg.defaultTextStyleId).toJSON() : undefined,
      placement: arg.placement,
      model: arg.model,
      category: arg.category,
      code: arg.code ?? Code.createEmpty(),
    };
    return new this(elementProps, iModelDb);
  }

  /**
   * Updates the geometry of the TextAnnotation3d on insert and validates version..
   * @inheritdoc
   * @beta
   */
  protected static override onInsert(arg: OnElementPropsArg): void {
    super.onInsert(arg);
    this.validateVersionAndUpdateGeometry(arg);
  }

  /**
   * Updates the geometry of the TextAnnotation3d on update and validates version..
   * @inheritdoc
   * @beta
   */
  protected static override onUpdate(arg: OnElementPropsArg): void {
    super.onUpdate(arg);
    this.validateVersionAndUpdateGeometry(arg);
  }

  /**
   * Populates the `elementGeometryBuilderParams` property in the [TextAnnotation3dProps]($common).
   * Only does this if the `elementGeometryBuilderParams` is not already set and if there is actually a text annotation to produce geometry for.
   * Also, validates the version of the text annotation data and migrates it if necessary.
   * @beta
   */
  protected static validateVersionAndUpdateGeometry(arg: OnElementPropsArg): void {
    const props = arg.props as TextAnnotation3dProps;
    const textAnnotationData = parseTextAnnotationData(props.textAnnotationData);
    if (!props.elementGeometryBuilderParams && textAnnotationData) {
      props.elementGeometryBuilderParams = getElementGeometryBuilderParams(arg.iModel, props.model, props.category, props.placement ?? Placement3d.fromJSON(), textAnnotationData.data, props.defaultTextStyle?.id);
    }
  }

  /**
   * TextAnnotation3d custom HandledProps include 'textAnnotationData'.
   * @inheritdoc
   * @internal
   */
  protected static override readonly _customHandledProps: CustomHandledProperty[] = [
    { propertyName: "textAnnotationData", source: "Class" },
  ];

  /**
   * TextAnnotation3d deserializes 'textAnnotationData'.
   * @inheritdoc
   * @beta
   */
  public static override deserialize(props: DeserializeEntityArgs): TextAnnotation3dProps {
    const elProps = super.deserialize(props) as TextAnnotation3dProps;
    const textAnnotationData = parseTextAnnotationData(props.row.textAnnotationData);
    if (textAnnotationData) {
      elProps.textAnnotationData = JSON.stringify(textAnnotationData);
    }
    return elProps;
  }

  /**
   * TextAnnotation3d serializes 'textAnnotationData'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: TextAnnotation3dProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);
    if (props.textAnnotationData !== undefined) {
      inst.textAnnotationData = props.textAnnotationData;
    }
    return inst;
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

  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    collectReferenceIds(this, referenceIds);
  }

  /** @internal */
  protected static override onCloned(context: IModelElementCloneContext, srcProps: TextAnnotation3dProps, dstProps: TextAnnotation3dProps): void {
    super.onCloned(context, srcProps, dstProps);

    const srcElem = TextAnnotation3d.fromJSON(srcProps, context.sourceDb);
    ElementDrivesTextAnnotation.remapFields(srcElem, context);
    const anno = srcElem.getAnnotation();
    dstProps.textAnnotationData = anno ? JSON.stringify({ version: TEXT_ANNOTATION_JSON_VERSION, data: anno.toJSON() }) : undefined;

    remapTextStyle(context, srcElem, dstProps);
  }
}

function remapTextStyle(
  context: IModelElementCloneContext,
  srcElem: TextAnnotation2d | TextAnnotation3d,
  dstProps: TextAnnotation2dProps | TextAnnotation3dProps
): void {
  const dstStyleId = AnnotationTextStyle.remapTextStyleId(srcElem.defaultTextStyle?.id ?? Id64.invalid, context);
  dstProps.defaultTextStyle = Id64.isValid(dstStyleId) ? new TextAnnotationUsesTextStyleByDefault(dstStyleId).toJSON() : undefined;
}

function collectReferenceIds(elem: TextAnnotation2d | TextAnnotation3d, referenceIds: EntityReferenceSet): void {
  const style = elem.defaultTextStyle?.id;
  if (style && Id64.isValidId64(style)) {
    referenceIds.addElement(style);
  }

  const block = elem.getAnnotation()?.textBlock;
  if (block) {
    for (const { child } of traverseTextBlockComponent(block)) {
      if (child.type === "field") {
        const hostId = child.propertyHost.elementId;
        if (Id64.isValidId64(hostId)) {
          referenceIds.addElement(hostId);
        }
      }
    }
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
}

/** The version of the JSON stored in `AnnotationTextStyleProps.settings` used by the code.
 * Uses the same semantics as [ECVersion]($ecschema-metadata).
 * @internal
*/
export const TEXT_STYLE_SETTINGS_JSON_VERSION = "1.0.0";

function migrateTextStyleSettings(oldData: VersionedJSON<TextStyleSettingsProps>): TextStyleSettingsProps {
  if (oldData.version === TEXT_STYLE_SETTINGS_JSON_VERSION) return oldData.data;

  // Place migration logic here.

  throw new Error(`Migration for settings from version ${oldData.version} to ${TEXT_STYLE_SETTINGS_JSON_VERSION} failed.`);
}

/** Arguments supplied when creating an [[AnnotationTextStyle]].
 * @beta
 */
export interface TextStyleCreateArgs {
  /** The ID of the [[DefinitionModel]]. */
  definitionModelId: Id64String;
  /** The name to assign to the [[AnnotationTextStyle]]. */
  name: string;
  /** Optional text style settings used to create the [[AnnotationTextStyle]]. Default settings will be used if not provided. */
  settings?: TextStyleSettingsProps;
  /** Optional description for the [[AnnotationTextStyle]]. */
  description?: string;
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
    this.settings = TextStyleSettings.fromJSON(settingsProps?.data);
  }

  /**
   * Creates a Code for an `AnnotationTextStyle` given a name that is meant to be unique within the scope of the specified DefinitionModel.
   *
   * @param iModel - The IModelDb.
   * @param definitionModelId - The ID of the DefinitionModel that contains the AnnotationTextStyle and provides the scope for its name.
   * @param name - The AnnotationTextStyle name.
   * @beta
   */
  public static createCode(iModel: IModelDb, definitionModelId: CodeScopeProps, name: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.annotationTextStyle);
    return new Code({ spec: codeSpec.id, scope: definitionModelId, value: name });
  }

  /**
   * Creates a new instance of `AnnotationTextStyle` with the specified properties.
   *
   * @param iModelDb - The iModelDb.
   * @param arg - The arguments for creating the AnnotationTextStyle.
   * @beta
   */
  public static create(iModelDb: IModelDb, arg: TextStyleCreateArgs): AnnotationTextStyle {
    const props: AnnotationTextStyleProps = {
      classFullName: this.classFullName,
      model: arg.definitionModelId,
      code: this.createCode(iModelDb, arg.definitionModelId, arg.name).toJSON(),
      description: arg.description,
      settings: arg.settings ? JSON.stringify({version: TEXT_STYLE_SETTINGS_JSON_VERSION, data: arg.settings}) : undefined,
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
    props.settings = JSON.stringify({version: TEXT_STYLE_SETTINGS_JSON_VERSION, data: this.settings.toJSON()});
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
    const settings = TextStyleSettings.fromJSON(settingProps.data);
    const errors = settings.getValidationErrors();
    if (errors.length > 0) {
      throw new Error(`Invalid AnnotationTextStyle settings: ${errors.join(", ")}`);
    }
  }

  /**
   * AnnotationTextStyle custom HandledProps include 'settings'.
   * @inheritdoc
   * @beta
   */
  protected static override readonly _customHandledProps: CustomHandledProperty[] = [
    { propertyName: "settings", source: "Class" },
  ];

  /**
   * AnnotationTextStyle deserializes 'settings'.
   * @inheritdoc
   * @beta
   */
  public static override deserialize(props: DeserializeEntityArgs): AnnotationTextStyleProps {
    const elProps = super.deserialize(props) as AnnotationTextStyleProps;
    const settings = this.parseTextStyleSettings(props.row.settings);
    if (settings) {
      elProps.settings = JSON.stringify(settings);
    }
    return elProps;
  }

  /**
   * AnnotationTextStyle serializes 'settings'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: AnnotationTextStyleProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);
    if (props.settings !== undefined) {
      inst.settings = props.settings;
    }
    return inst;
  }

  /** Parses, validates, and potentially migrates the text style settings data from a JSON string. */
  private static parseTextStyleSettings(json: string | undefined): VersionedJSON<TextStyleSettingsProps> | undefined {
    if (!json) return undefined;
    return validateAndMigrateVersionedJSON<TextStyleSettingsProps>(json, TEXT_STYLE_SETTINGS_JSON_VERSION, migrateTextStyleSettings);
  }

  /** When copying an element from one iModel to another, returns the Id of the AnnotationTextStyle in the `context`'s target iModel
   * corresponding to `sourceTextStyleId`, or [Id64.invalid]($bentley) if no corresponding text style exists.
   * If a text style with the same [Code]($common) exists in the target iModel, the style Id will be remapped to refer to that style.
   * Otherwise, a copy of the style will be imported into the target iModel and its element Id returned.
   * Implementations of [[ITextAnnotation]] should invoke this function when implementing their [[Element._onCloned]] method.
   * @throws Error if an attempt to import the text style failed.
   */
  public static remapTextStyleId(sourceTextStyleId: Id64String, context: IModelElementCloneContext): Id64String {
    // No remapping necessary if there's no text style or we're not copying to a different iModel.
    if (!Id64.isValid(sourceTextStyleId) || !context.isBetweenIModels) {
      return sourceTextStyleId;
    }

    // If the style's already been remapped, we're finished.
    let dstStyleId: Id64String | undefined = context.findTargetElementId(sourceTextStyleId);
    if (Id64.isValid(dstStyleId)) {
      return dstStyleId;
    }

    // Look up the style. It really ought to exist.
    const srcStyle = context.sourceDb.elements.tryGetElement<AnnotationTextStyle>(sourceTextStyleId);
    if (!srcStyle) {
      return Id64.invalid;
    }

    // If a style with the same code exists in the target iModel, remap to that one.
    dstStyleId = context.targetDb.elements.queryElementIdByCode(srcStyle.code);
    if (undefined !== dstStyleId) {
      return dstStyleId;
    }

    // Copy the style into the target iModel and remap its Id.
    const dstStyleProps = context.cloneElement(srcStyle);
    dstStyleId = context.targetDb.elements.insertElement(dstStyleProps);
    context.remapElement(sourceTextStyleId, dstStyleId);
    return dstStyleId;
  }

  protected static override onCloned(context: IModelElementCloneContext, srcProps: AnnotationTextStyleProps, dstProps: AnnotationTextStyleProps): void {
    super.onCloned(context, srcProps, dstProps);
    if (!context.isBetweenIModels) {
      return;
    }

    const settingsProps = AnnotationTextStyle.parseTextStyleSettings(srcProps.settings);
    const font = TextStyleSettings.fromJSON(settingsProps?.data).font;

    const fontsToEmbed = [];
    for (const file of context.sourceDb.fonts.queryEmbeddedFontFiles()) {
      if (file.type === font.type && file.faces.some((face) => face.familyName === font.name)) {
        fontsToEmbed.push(file);
      }
    }

    await Promise.all(fontsToEmbed.map((file) => context.targetDb.fonts.embedFontFile({ file })));
  }
}
