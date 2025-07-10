/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { AnnotationTextStyleProps, BisCodeSpec, Code, CodeProps, CodeScopeProps, CodeSpec, ConcreteEntityTypes, ElementGeometry, ElementGeometryBuilderParams, EntityReference, EntityReferenceSet, Placement2d, Placement2dProps, Placement3d, Placement3dProps, PlacementProps, TextAnnotation, TextAnnotation2dProps, TextAnnotation3dProps, TextAnnotationProps, TextStyleSettings, TextStyleSettingsProps } from "@itwin/core-common";
import { IModelDb } from "../IModelDb";
import { AnnotationElement2d, DefinitionElement, GraphicalElement3d, OnElementIdArg, OnElementPropsArg } from "../Element";
import { DbResult, Id64String } from "@itwin/core-bentley";
import { layoutTextBlock, TextStyleResolver } from "./TextBlockLayout";
import { appendTextAnnotationGeometry } from "./TextAnnotationGeometry";
import { CustomHandledProperty, DeserializeEntityArgs, ECSqlRow } from "../Entity";

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
export class TextAnnotation2d extends AnnotationElement2d {
  /** @internal */
  public static override get className(): string { return "TextAnnotation2d"; }
  public textAnnotationData?: string;

  /** Extract the textual content, if present.
   * @see [[setAnnotation]] to change it.
   */
  public getAnnotation(): TextAnnotation | undefined {
    const textAnnotationProps = parseTextAnnotationData(this.textAnnotationData);
    return textAnnotationProps ? TextAnnotation.fromJSON(textAnnotationProps) : undefined;
  }

  /** Change the textual content, updating the element's geometry and placement accordingly.
   * @see [[getAnnotation]] to extract the current annotation.
   * @param annotation The new annotation
   */
  public setAnnotation(annotation: TextAnnotation) {
    this.textAnnotationData = annotation ? JSON.stringify(annotation.toJSON()) : undefined;
  }

  protected constructor(props: TextAnnotation2dProps, iModel: IModelDb) {
    super(props, iModel);
    this.textAnnotationData = props.textAnnotationData;
  }

  public static fromJSON(props: TextAnnotation2dProps, iModel: IModelDb): TextAnnotation2d {
    return new TextAnnotation2d(props, iModel);
  }

  public override toJSON(): TextAnnotation2dProps {
    const props = super.toJSON() as TextAnnotation2dProps;
    props.textAnnotationData = this.textAnnotationData;
    if (this.textAnnotationData) {
      props.elementGeometryBuilderParams = getElementGeometryBuilderParams(this.iModel, this.model, this.placement, this.textAnnotationData, this.category);
    }

    return props;
  }

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

  protected static updateGeometry(iModelDb: IModelDb, props: TextAnnotation2dProps): void {
    if (props.elementGeometryBuilderParams || !props.textAnnotationData) {
      return;
    }

    props.elementGeometryBuilderParams = getElementGeometryBuilderParams(iModelDb, props.model, props.placement ?? Placement2d.fromJSON(), props.textAnnotationData, props.category);
  }

  protected override collectReferenceIds(ids: EntityReferenceSet): void {
    super.collectReferenceIds(ids);
    const annotation = this.getAnnotation();
    if (!annotation) {
      return;
    }
    annotation.discloseIds(ids);
  }

  /**
   * TextAnnotation2d custom HandledProps includes 'textAnnotationData'.
   * @inheritdoc
   * @beta
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
    const instance = props.row;
    elProps.textAnnotationData = instance.textAnnotationData ?? "";
    return elProps;
  }

  /**
   * TextAnnotation2d serializes 'textAnnotationData'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: TextAnnotation2dProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);
    inst.data = props.textAnnotationData;
    return inst;
  }
}

/** An element that displays textual content within a 3d model.
 * The text is stored as a [TextAnnotation]($common) from which the element's [geometry]($docs/learning/common/GeometryStream.md) and [Placement]($common) are computed.
 * @public @preview
 */
export class TextAnnotation3d extends GraphicalElement3d {
  /** @internal */
  public static override get className(): string { return "TextAnnotation3d"; }
  public textAnnotationData?: string;

  /** Extract the textual content, if present.
   * @see [[setAnnotation]] to change it.
   */
  public getAnnotation(): TextAnnotation | undefined {
    const textAnnotationProps = parseTextAnnotationData(this.textAnnotationData);
    return textAnnotationProps ? TextAnnotation.fromJSON(textAnnotationProps) : undefined;
  }

  /** Change the textual content, updating the element's geometry and placement accordingly.
   * @see [[getAnnotation]] to extract the current annotation.
   * @param annotation The new annotation
   */
  public setAnnotation(annotation: TextAnnotation) {
    this.textAnnotationData = annotation ? JSON.stringify(annotation.toJSON()) : undefined;
  }

  protected constructor(props: TextAnnotation3dProps, iModel: IModelDb) {
    super(props, iModel);
    this.textAnnotationData = props.textAnnotationData;
  }

  public static fromJSON(props: TextAnnotation3dProps, iModel: IModelDb): TextAnnotation3d {
    return new TextAnnotation3d(props, iModel);
  }

  public override toJSON(): TextAnnotation3dProps {
    const props = super.toJSON() as TextAnnotation3dProps;
    props.textAnnotationData = this.textAnnotationData;
    if (this.textAnnotationData) {
      props.elementGeometryBuilderParams = getElementGeometryBuilderParams(this.iModel, this.model, this.placement, this.textAnnotationData, this.category);
    }

    return props;
  }

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

  protected static updateGeometry(iModelDb: IModelDb, props: TextAnnotation3dProps): void {
    if (props.elementGeometryBuilderParams || !props.textAnnotationData) {
      return;
    }

    props.elementGeometryBuilderParams = getElementGeometryBuilderParams(iModelDb, props.model, props.placement ?? Placement3d.fromJSON(), props.textAnnotationData, props.category);
  }

  protected override collectReferenceIds(ids: EntityReferenceSet): void {
    super.collectReferenceIds(ids);
    const annotation = this.getAnnotation();
    if (!annotation) {
      return;
    }
    annotation.discloseIds(ids);
  }

  /**
   * TextAnnotation3d custom HandledProps includes 'textAnnotationData'.
   * @inheritdoc
   * @beta
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
    const instance = props.row;
    elProps.textAnnotationData = instance.textAnnotationData ?? "";
    return elProps;
  }

  /**
   * TextAnnotation3d serializes 'textAnnotationData'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: TextAnnotation3dProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);
    inst.data = props.textAnnotationData;
    return inst;
  }
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

  public override toJSON(): AnnotationTextStyleProps {
    const props = super.toJSON() as AnnotationTextStyleProps;
    props.description = this.description;
    props.settings = JSON.stringify(this.settings.toJSON());
    return props;
  }

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
    const settingProps = AnnotationTextStyle.parseTextStyleSettings((arg.props as AnnotationTextStyleProps).settings);
    if (!settingProps) return;
    const settings = TextStyleSettings.fromJSON(settingProps);
    const errors = settings.getValidationErrors();
    if (errors.length > 0) {
      throw new Error(`Invalid AnnotationTextStyle settings: ${errors.join(", ")}`);
    }
  }

  /**
   * Checks that the AnnotationTextStyle is not in use before deleting it.
   * @note The in use check is done here instead of in `deleteDefinitionElements`.
   * @throws an error if it is referenced by any [[TextAnnotation2d]] or [[TextAnnotation3d]] elements.
   * @inheritdoc
   * @beta
   */
  protected static override onDelete(arg: OnElementIdArg): void {
    super.onDelete(arg);
    const query = `
      SELECT TextAnnotationData FROM BisCore.TextAnnotation2d
        UNION ALL
      SELECT TextAnnotationData FROM BisCore.TextAnnotation3d
    `;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    arg.iModel.withPreparedStatement(query, (statement) => {
      const referenceIds = new EntityReferenceSet();
      const key = ConcreteEntityTypes.Element + arg.id as EntityReference;
      while (statement.step() === DbResult.BE_SQLITE_ROW) {
        const row = statement.getRow();
        const textAnnotationProps = parseTextAnnotationData(row.textAnnotationData);
        if (textAnnotationProps) {
          const textAnnotation = TextAnnotation.fromJSON(textAnnotationProps);
          textAnnotation.discloseIds(referenceIds);
          if (referenceIds.has(key)) {
            throw new Error("Cannot delete AnnotationTextStyle because it is referenced by a TextAnnotation element");
          }
        }
      }
    });
  }

  private static parseTextStyleSettings(json: string | undefined): TextStyleSettingsProps | undefined {
    if (!json) return undefined;
    try {
      return JSON.parse(json);
    } catch {
      return undefined;
    }
  }

  /**
   * AnnotationTextStyle custom HandledProps includes 'settings'.
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
    const instance = props.row;
    elProps.settings = instance.settings ?? "";
    return elProps;
  }

  /**
   * AnnotationTextStyle serializes 'settings'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: AnnotationTextStyleProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);
    inst.data = props.settings;
    return inst;
  }
}


