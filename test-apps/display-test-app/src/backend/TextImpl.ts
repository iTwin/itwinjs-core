import { AnnotationTextStyle, BriefcaseDb, Drawing, IModelDb, TextAnnotation2d } from "@itwin/core-backend";
import { Id64String } from "@itwin/core-bentley";
import { Placement2d, Placement2dProps, TextAnnotation, TextAnnotationProps, TextStyleSettings, TextStyleSettingsProps } from "@itwin/core-common";

export async function insertTextStyle(iModelKey: string, name: string, settingProps: TextStyleSettingsProps): Promise<Id64String> {
  const iModel = BriefcaseDb.findByKey(iModelKey);

  try {
    const annotationTextStyle = AnnotationTextStyle.create(
      iModel,
      IModelDb.dictionaryId,
      name,
      settingProps,
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

export async function deleteTextStyle(iModelKey: string, name: string): Promise<void> {
  const iModel = BriefcaseDb.findByKey(iModelKey);

  try {
    const textStyle = iModel.elements.getElement<AnnotationTextStyle>(AnnotationTextStyle.createCode(iModel, IModelDb.dictionaryId, name));

    iModel.elements.deleteDefinitionElements([textStyle.id]);

    iModel.saveChanges(`Deleted text style '${name}'`);
  } catch (e) {
    iModel.abandonChanges();
    throw e;
  }
}

export async function insertText(iModelKey: string, categoryId: Id64String, modelId: Id64String, placement: Placement2dProps, textAnnotationData?: TextAnnotationProps): Promise<Id64String> {
  const iModel = BriefcaseDb.findByKey(iModelKey);

  try {
    const annotation2d = TextAnnotation2d.create(
      iModel,
      categoryId,
      modelId,
      placement,
      textAnnotationData
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

export async function updateText(iModelKey: string, elementId: Id64String, categoryId?: Id64String, placement?: Placement2dProps, textAnnotationProps?: TextAnnotationProps): Promise<void> {
  const iModel = BriefcaseDb.findByKey(iModelKey);

  try {
    const text = iModel.elements.getElement<TextAnnotation2d>(elementId);

    if (categoryId)
      text.category = categoryId;

    if (placement)
      text.placement = Placement2d.fromJSON(placement);

    if (textAnnotationProps)
      text.setAnnotation(TextAnnotation.fromJSON(textAnnotationProps));

    await iModel.locks.acquireLocks({ shared: [text.model], exclusive: [elementId] });
    text.update();
    iModel.saveChanges('Updated annotation');
  } catch (e) {
    iModel.abandonChanges();
    throw e;
  }
}

export async function deleteText(iModelKey: string, elementId: Id64String): Promise<void> {
  const iModel = BriefcaseDb.findByKey(iModelKey);

  try {
    const text = iModel.elements.getElement<TextAnnotation2d>(elementId);

    text.delete();

    iModel.saveChanges(`Deleted text annotation`);
  } catch (e) {
    iModel.abandonChanges();
    throw e;
  }
}

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