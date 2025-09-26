import { AnnotationTextStyle, BriefcaseDb, Drawing, IModelDb, TextAnnotation2d, TextAnnotationUsesTextStyleByDefault } from "@itwin/core-backend";
import { Id64, Id64String } from "@itwin/core-bentley";
import { Placement2d, Placement2dProps, TextAnnotation, TextAnnotationProps, TextStyleSettings, TextStyleSettingsProps } from "@itwin/core-common";

/**
 * Inserts a new text style into the iModel.
 * @param iModelKey - Key to identify the iModel.
 * @param name - Name of the text style.
 * @param settingProps - Properties for the text style.
 * @returns The Id of the inserted text style.
 * @throws If insertion fails, abandons changes and rethrows the error.
 */
export async function insertTextStyle(iModelKey: string, name: string, settingProps: TextStyleSettingsProps): Promise<Id64String> {
  const iModel = BriefcaseDb.findByKey(iModelKey);

  try {
    const annotationTextStyle = AnnotationTextStyle.create(
      iModel,
      {
        definitionModelId: IModelDb.dictionaryId,
        name,
        settings: settingProps,
      }
    );

    await iModel.locks.acquireLocks({ shared: IModelDb.dictionaryId });
    const textStyleId = annotationTextStyle.insert();

    iModel.saveChanges(`Inserted text style '${name}'`);
    return textStyleId;
  } catch (e) {
    iModel.abandonChanges();
    throw e;
  }
}

/**
 * Updates an existing text style in the iModel.
 * @param iModelKey - Key to identify the iModel.
 * @param name - Name of the text style to update.
 * @param newSettingProps - New properties for the text style.
 * @throws If update fails, abandons changes and rethrows the error.
 */
export async function updateTextStyle(iModelKey: string, name: string, newSettingProps: TextStyleSettingsProps): Promise<void> {
  const iModel = BriefcaseDb.findByKey(iModelKey);

  try {
    const textStyle = iModel.elements.getElement<AnnotationTextStyle>(AnnotationTextStyle.createCode(iModel, IModelDb.dictionaryId, name));
    const settings = TextStyleSettings.fromJSON(newSettingProps);
    textStyle.settings = settings;

    await iModel.locks.acquireLocks({ shared: IModelDb.dictionaryId, exclusive: textStyle.id });
    textStyle.update();

    iModel.saveChanges(`Updated text style '${name}'`);
  } catch (e) {
    iModel.abandonChanges();
    throw e;
  }
}

/**
 * Deletes a text style from the iModel.
 * @param iModelKey - Key to identify the iModel.
 * @param name - Name of the text style to delete.
 * @throws If deletion fails, abandons changes and rethrows the error.
 */
export async function deleteTextStyle(iModelKey: string, name: string): Promise<void> {
  const iModel = BriefcaseDb.findByKey(iModelKey);

  try {
    const textStyle = iModel.elements.getElement<AnnotationTextStyle>(AnnotationTextStyle.createCode(iModel, IModelDb.dictionaryId, name));

    await iModel.locks.acquireLocks({ shared: IModelDb.dictionaryId, exclusive: textStyle.id });
    iModel.elements.deleteDefinitionElements([textStyle.id]);

    iModel.saveChanges(`Deleted text style '${name}'`);
  } catch (e) {
    iModel.abandonChanges();
    throw e;
  }
}

/**
 * Inserts a new text annotation element into the iModel.
 * @param iModelKey - Key to identify the iModel.
 * @param categoryId - Category Id for the annotation.
 * @param modelId - Model Id for the annotation.
 * @param placement - Placement properties for the annotation.
 * @param textAnnotationData - Optional text annotation properties.
 * @returns The Id of the inserted annotation.
 * @throws If insertion fails, abandons changes and rethrows the error.
 */
export async function insertText(iModelKey: string, categoryId: Id64String, modelId: Id64String, placement: Placement2dProps, defaultTextStyleId: Id64String, textAnnotationProps?: TextAnnotationProps): Promise<Id64String> {
  const iModel = BriefcaseDb.findByKey(iModelKey);

  try {
    const annotation2d = TextAnnotation2d.create(
      iModel,
      {
        category: categoryId,
        model: modelId,
        placement,
        defaultTextStyleId,
        textAnnotationProps
      }
    );

    await iModel.locks.acquireLocks({ shared: modelId });
    const annotationId = annotation2d.insert();

    iModel.saveChanges('Inserted annotation');
    return annotationId;
  } catch (e) {
    iModel.abandonChanges();
    throw e;
  }
}

/**
 * Updates an existing text annotation element in the iModel.
 * @param iModelKey - Key to identify the iModel.
 * @param elementId - Id of the annotation element to update.
 * @param categoryId - Optional new category Id.
 * @param placement - Optional new placement properties.
 * @param defaultTextStyleId - Optional new default text style Id.
 * @param textAnnotationProps - Optional new text annotation properties.
 * @throws If update fails, abandons changes and rethrows the error.
 */
export async function updateText(iModelKey: string, elementId: Id64String, categoryId?: Id64String, placement?: Placement2dProps, defaultTextStyleId?: Id64String, textAnnotationProps?: TextAnnotationProps): Promise<void> {
  const iModel = BriefcaseDb.findByKey(iModelKey);

  try {
    const text = iModel.elements.getElement<TextAnnotation2d>(elementId);

    if (categoryId)
      text.category = categoryId;

    if (placement)
      text.placement = Placement2d.fromJSON(placement);

    if (textAnnotationProps)
      text.setAnnotation(TextAnnotation.fromJSON(textAnnotationProps));

    if (defaultTextStyleId && Id64.isValid(defaultTextStyleId)) {
      text.defaultTextStyle = new TextAnnotationUsesTextStyleByDefault(defaultTextStyleId);
    }

    await iModel.locks.acquireLocks({ shared: [text.model], exclusive: [elementId] });
    text.update();
    iModel.saveChanges('Updated annotation');
  } catch (e) {
    iModel.abandonChanges();
    throw e;
  }
}

/**
 * Deletes a text annotation element from the iModel.
 * @param iModelKey - Key to identify the iModel.
 * @param elementId - Id of the annotation element to delete.
 * @throws If deletion fails, abandons changes and rethrows the error.
 */
export async function deleteText(iModelKey: string, elementId: Id64String): Promise<void> {
  const iModel = BriefcaseDb.findByKey(iModelKey);

  try {
    const text = iModel.elements.getElement<TextAnnotation2d>(elementId);

    await iModel.locks.acquireLocks({ shared: [text.model], exclusive: [elementId] });
    text.delete();

    iModel.saveChanges(`Deleted text annotation`);
  } catch (e) {
    iModel.abandonChanges();
    throw e;
  }
}

/**
 * Sets the scale factor for a drawing element in the iModel.
 * @param iModelKey - Key to identify the iModel.
 * @param modelId - Id of the drawing model.
 * @param scaleFactor - New scale factor to set.
 * @throws If update fails, abandons changes and rethrows the error.
 */
export async function setScaleFactor(iModelKey: string, modelId: Id64String, scaleFactor: number): Promise<void> {
  const iModel = BriefcaseDb.findByKey(iModelKey);

  try {
    const element = iModel.elements.getElement(modelId);
    if (element instanceof Drawing) {
      element.scaleFactor = scaleFactor;
      await iModel.locks.acquireLocks({ shared: [modelId], exclusive: [element.id] });
      element.update();
      iModel.saveChanges(`Updated scale factor for drawing ${element.id}`);
    }
  } catch (e) {
    iModel.abandonChanges();
    throw e;
  }
}