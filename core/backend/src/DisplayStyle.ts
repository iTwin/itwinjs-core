/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ViewDefinitions
 */

import { CompressedId64Set, Id64, Id64Array, Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import {
  BisCodeSpec, Code, CodeScopeProps, CodeSpec, ColorDef, DisplayStyle3dProps, DisplayStyle3dSettings, DisplayStyle3dSettingsProps,
  DisplayStyleProps, DisplayStyleSettings, DisplayStyleSubCategoryProps, EntityReferenceSet, PlanProjectionSettingsProps, RenderSchedule, SkyBoxImageProps, ViewFlags,
} from "@itwin/core-common";
import { DefinitionElement, RenderTimeline } from "./Element";
import { IModelDb } from "./IModelDb";
import { IModelElementCloneContext } from "./IModelElementCloneContext";
import { DeserializeEntityArgs, ECSqlRow } from "./Entity";

/** A DisplayStyle defines the parameters for 'styling' the contents of a view.
 * Internally a DisplayStyle consists of a dictionary of several named 'styles' describing specific aspects of the display style as a whole.
 * Many ViewDefinitions may share the same DisplayStyle.
 * @public @preview
 */
export abstract class DisplayStyle extends DefinitionElement {
  public static override get className(): string { return "DisplayStyle"; }
  public abstract get settings(): DisplayStyleSettings;

  protected constructor(props: DisplayStyleProps, iModel: IModelDb) {
    super(props, iModel);
  }

  /** @beta */
  public static override deserialize(props: DeserializeEntityArgs): DisplayStyleProps {
    const elProps = super.deserialize(props) as DisplayStyleProps;
    const displayOptions = props.options?.element?.displayStyle;
    // Uncompress excludedElements if they are compressed
    if (!displayOptions?.compressExcludedElementIds && elProps.jsonProperties?.styles?.excludedElements) {
      const excludedElements = elProps.jsonProperties.styles.excludedElements;
      if (typeof excludedElements === "string" && excludedElements.startsWith("+")) {
        const ids: string[] = [];
        CompressedId64Set.decompressSet(excludedElements).forEach((id: string) => {
          ids.push(id);
        });
        elProps.jsonProperties.styles.excludedElements = ids;
      }
    }
    // Omit Schedule Script Element Ids if the option is set
    if (displayOptions?.omitScheduleScriptElementIds && elProps.jsonProperties?.styles?.scheduleScript) {
      const scheduleScript: RenderSchedule.ScriptProps = elProps.jsonProperties.styles.scheduleScript;
      elProps.jsonProperties.styles.scheduleScript = RenderSchedule.Script.removeScheduleScriptElementIds(scheduleScript);
    }
    return elProps;
  }

  /** @beta */
  public static override serialize(props: DisplayStyleProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);
    return inst;
  }

  /** Create a Code for a DisplayStyle given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel that contains the DisplayStyle and provides the scope for its name.
   * @param codeValue The DisplayStyle name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.displayStyle);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }

  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    for (const [id] of this.settings.subCategoryOverrides) {
      referenceIds.addElement(id);
    }

    for (const excludedElementId of this.settings.excludedElementIds)
      referenceIds.addElement(excludedElementId);

    if (this.settings.renderTimeline) {
      referenceIds.addElement(this.settings.renderTimeline);
    } else {
      const script = this.loadScheduleScript();
      if (script)
        script.script.discloseIds(referenceIds);
    }
  }

  /** @alpha */
  protected static override onCloned(context: IModelElementCloneContext, sourceElementProps: DisplayStyleProps, targetElementProps: DisplayStyleProps): void {
    super.onCloned(context, sourceElementProps, targetElementProps);

    if (!context.isBetweenIModels || !targetElementProps.jsonProperties?.styles)
      return;

    const settings = targetElementProps.jsonProperties.styles;
    if (settings.subCategoryOvr) {
      const targetOverrides: DisplayStyleSubCategoryProps[] = [];
      for (const ovr of settings.subCategoryOvr) {
        ovr.subCategory;
        const targetSubCategoryId = context.findTargetElementId(Id64.fromJSON(ovr.subCategory));
        if (Id64.isValid(targetSubCategoryId))
          targetOverrides.push({...ovr, subCategory: targetSubCategoryId});
      }
      settings.subCategoryOvr = targetOverrides;
    }

    if (settings.excludedElements) {
      const excluded: Id64Array = "string" === typeof settings.excludedElements ? CompressedId64Set.decompressArray(settings.excludedElements) : settings.excludedElements;
      const excludedTargetElements: Id64Array = [];
      for (const excludedElement of excluded) {
        const remapped = context.findTargetElementId(excludedElement);
        if (Id64.isValid(remapped))
          excludedTargetElements.push(remapped);
      }

      if (0 === excludedTargetElements.length)
        delete settings.excludedElements;
      else
        settings.excludedElements = CompressedId64Set.compressIds(OrderedId64Iterable.sortArray(excludedTargetElements));
    }

    if (settings.renderTimeline) {
      const renderTimeline = context.findTargetElementId(settings.renderTimeline);
      if (Id64.isValid(renderTimeline))
        settings.renderTimeline = renderTimeline;
      else
        delete settings.renderTimeline;
    } else if (settings.scheduleScript) {
      const scheduleScript = RenderTimeline.remapScript(context, settings.scheduleScript);
      if (scheduleScript.length > 0)
        settings.scheduleScript = scheduleScript;
      else
        delete settings.scheduleScript;
    }
  }

  public loadScheduleScript(): RenderSchedule.ScriptReference | undefined {
    let script;
    let sourceId;
    if (this.settings.renderTimeline) {
      const timeline = this.iModel.elements.tryGetElement<RenderTimeline>(this.settings.renderTimeline);
      if (timeline) {
        script = RenderSchedule.Script.fromJSON(timeline.scriptProps);
        sourceId = timeline.id;
      }
    } else if (this.settings.scheduleScriptProps) {
      script = RenderSchedule.Script.fromJSON(this.settings.scheduleScriptProps);
      sourceId = this.id;
    }

    return undefined !== sourceId && undefined !== script ? new RenderSchedule.ScriptReference(sourceId, script) : undefined;
  }
}

/** A DisplayStyle for 2d views.
 * @public @preview
 */
export class DisplayStyle2d extends DisplayStyle {
  public static override get className(): string { return "DisplayStyle2d"; }
  private readonly _settings: DisplayStyleSettings;

  public get settings(): DisplayStyleSettings { return this._settings; }

  protected constructor(props: DisplayStyleProps, iModel: IModelDb) {
    super(props, iModel);
    this._settings = new DisplayStyleSettings(this.jsonProperties);
  }
  /** Create a DisplayStyle2d for use by a ViewDefinition.
   * @param iModelDb The iModel
   * @param definitionModelId The [[DefinitionModel]]
   * @param name The name/CodeValue of the DisplayStyle2d
   * @returns The newly constructed DisplayStyle2d element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string): DisplayStyle2d {
    const displayStyleProps: DisplayStyleProps = {
      classFullName: this.classFullName,
      code: this.createCode(iModelDb, definitionModelId, name),
      model: definitionModelId,
      isPrivate: false,
      jsonProperties: {
        styles: {
          backgroundColor: 0,
          monochromeColor: ColorDef.white.toJSON(),
          viewflags: ViewFlags.defaults,
        },
      },
    };
    return new DisplayStyle2d(displayStyleProps, iModelDb);
  }
  /** Insert a DisplayStyle2d for use by a ViewDefinition.
   * @param iModelDb Insert into this iModel
   * @param definitionModelId Insert the new DisplayStyle2d into this DefinitionModel
   * @param name The name of the DisplayStyle2d
   * @returns The Id of the newly inserted DisplayStyle2d element.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string): Id64String {
    const displayStyle = this.create(iModelDb, definitionModelId, name);
    return iModelDb.elements.insertElement(displayStyle.toJSON());
  }
}

/** Describes initial settings for a new [[DisplayStyle3d]].
 * Most properties are inherited from [DisplayStyle3dSettingsProps]($common), but for backwards compatibility reasons, this interface is slightly awkward:
 * - It adds a `viewFlags` member that differs only in case and type from [DisplayStyleSettingsProps.viewflags]($common); and
 * - It extends the type of [DisplayStyleSettingsProps.backgroundColor]($common) to include [ColorDef]($common).
 * These idiosyncrasies will be addressed in a future version of core-backend.
 * @see [[DisplayStyle3d.create]].
 * @public @preview
 */
export interface DisplayStyleCreationOptions extends Omit<DisplayStyle3dSettingsProps, "backgroundColor" | "scheduleScript"> {
  /** If supplied, the [ViewFlags]($common) applied by the display style.
   * If undefined, [DisplayStyle3dSettingsProps.viewflags]($common) will be used if present (note the difference in case); otherwise, default-constructed [ViewFlags]($common) will be used.
   */
  viewFlags?: ViewFlags;
  backgroundColor?: ColorDef | number;
}

/** A DisplayStyle for 3d views.
 * See [how to create a DisplayStyle3d]$(docs/learning/backend/CreateElements.md#DisplayStyle3d).
 * @public @preview
 */
export class DisplayStyle3d extends DisplayStyle {
  public static override get className(): string { return "DisplayStyle3d"; }
  private readonly _settings: DisplayStyle3dSettings;

  public get settings(): DisplayStyle3dSettings { return this._settings; }

  protected constructor(props: DisplayStyle3dProps, iModel: IModelDb) {
    super(props, iModel);
    this._settings = new DisplayStyle3dSettings(this.jsonProperties);
  }

  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    for (const textureId of this.settings.environment.sky.textureIds)
      referenceIds.addElement(textureId);

    if (this.settings.planProjectionSettings)
      for (const planProjectionSetting of this.settings.planProjectionSettings)
        referenceIds.addElement(planProjectionSetting[0]);

    const groups = this.settings.contours.groups;
    for (const group of groups) {
      const subCategories = group.subCategories;
      for (const subCategoryId of subCategories) {
        referenceIds.addElement(subCategoryId);
      }
    }
  }

  /** @alpha */
  protected static override onCloned(context: IModelElementCloneContext, sourceElementProps: DisplayStyle3dProps, targetElementProps: DisplayStyle3dProps): void {
    super.onCloned(context, sourceElementProps, targetElementProps);
    if (context.isBetweenIModels) {
      const convertTexture = (id: string) => Id64.isValidId64(id) ? context.findTargetElementId(id) : id;

      const skyBoxImageProps: SkyBoxImageProps | undefined = targetElementProps?.jsonProperties?.styles?.environment?.sky?.image;
      if (skyBoxImageProps?.texture && Id64.isValidId64(skyBoxImageProps.texture))
        skyBoxImageProps.texture = convertTexture(skyBoxImageProps.texture);

      if (skyBoxImageProps?.textures) {
        skyBoxImageProps.textures.front = convertTexture(skyBoxImageProps.textures.front);
        skyBoxImageProps.textures.back = convertTexture(skyBoxImageProps.textures.back);
        skyBoxImageProps.textures.left = convertTexture(skyBoxImageProps.textures.left);
        skyBoxImageProps.textures.right = convertTexture(skyBoxImageProps.textures.right);
        skyBoxImageProps.textures.top = convertTexture(skyBoxImageProps.textures.top);
        skyBoxImageProps.textures.bottom = convertTexture(skyBoxImageProps.textures.bottom);
      }

      if (targetElementProps?.jsonProperties?.styles?.planProjections) {
        const remappedPlanProjections: { [modelId: string]: PlanProjectionSettingsProps } = {};
        for (const entry of Object.entries(targetElementProps.jsonProperties.styles.planProjections)) {
          const remappedModelId: Id64String = context.findTargetElementId(entry[0]);
          if (Id64.isValidId64(remappedModelId)) {
            remappedPlanProjections[remappedModelId] = entry[1];
          }
        }
        targetElementProps.jsonProperties.styles.planProjections = remappedPlanProjections;
      }

      const groups = targetElementProps?.jsonProperties?.styles?.contours?.groups;
      if (groups) {
        for (const group of groups) {
          if (group.subCategories) {
            const subCategories = CompressedId64Set.decompressArray(group.subCategories);
            const remappedSubCategories: Id64String[] = [];
            for (const subCategoryId of subCategories) {
              const remappedSubCategoryId: Id64String = context.findTargetElementId(subCategoryId);
              if (Id64.isValidId64(remappedSubCategoryId)) {
                remappedSubCategories.push(remappedSubCategoryId);
              }
            }
            group.subCategories = CompressedId64Set.sortAndCompress(remappedSubCategories);
          }
        }
      }
    }
  }

  /** Create a DisplayStyle3d for use by a ViewDefinition.
   * @param iModelDb The iModel
   * @param definitionModelId The [[DefinitionModel]]
   * @param name The name/CodeValue of the DisplayStyle3d
   * @returns The newly constructed DisplayStyle3d element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, options?: DisplayStyleCreationOptions): DisplayStyle3d {
    options = options ?? {};
    let viewflags = options.viewFlags?.toJSON();
    if (!viewflags)
      viewflags = options.viewflags ?? new ViewFlags().toJSON();

    const backgroundColor = options.backgroundColor instanceof ColorDef ? options.backgroundColor.toJSON() : options.backgroundColor;

    const settings: DisplayStyle3dSettingsProps = {
      ...options,
      viewflags,
      backgroundColor,
    };

    const displayStyleProps: DisplayStyle3dProps = {
      classFullName: this.classFullName,
      code: this.createCode(iModelDb, definitionModelId, name),
      model: definitionModelId,
      jsonProperties: { styles: settings },
      isPrivate: false,

    };

    return new DisplayStyle3d(displayStyleProps, iModelDb);
  }
  /**
   * Insert a DisplayStyle3d for use by a ViewDefinition.
   * @param iModelDb Insert into this iModel
   * @param definitionModelId Insert the new DisplayStyle3d into this [[DefinitionModel]]
   * @param name The name of the DisplayStyle3d
   * @returns The Id of the newly inserted DisplayStyle3d element.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, options?: DisplayStyleCreationOptions): Id64String {
    const displayStyle = this.create(iModelDb, definitionModelId, name, options);
    return iModelDb.elements.insertElement(displayStyle.toJSON());
  }
}
