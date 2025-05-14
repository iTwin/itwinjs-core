import { AnnotationTextStyle, AnnotationTextStyleCreateArgs, BisCoreSchema, BriefcaseDb, IModelDb, produceGeometryTemp, TextAnnotation2d } from "@itwin/core-backend";
import { CreateTextAnnotationArgs, CreateTextStyleArgs, UpdateTextAnnotationArgs, UpdateTextStyleArgs } from "../common/DtaIpcInterface";
import { AnnotationTextStyleProps, FlatBufferGeometryStream, QueryRowFormat, SchemaState, TextAnnotation2dProps, TextStyleSettings } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley";


export async function insertTextAnnotation2d(args: CreateTextAnnotationArgs): Promise<string> {
  const db = BriefcaseDb.findByKey(args.iModelKey);
  // Is a set, so we can add the same channel multiple times
  db.channels.addAllowedChannel("DrawingProduction");

  // Create props
  const textAnnotationElemProps = TextAnnotation2d.createProps(args.annotationCreateArgs);
  // Produce geometry
  const elementGeometryBuilderParams = produceGeometryTemp({
    iModel: db,
    annotation: args.annotationCreateArgs.textAnnotationData,
    category: args.annotationCreateArgs.category,
    subCategory: args.annotationCreateArgs.subCategory,
    want: "flatbuffer",
  }) as FlatBufferGeometryStream;
  textAnnotationElemProps.elementGeometryBuilderParams = { entryArray: elementGeometryBuilderParams.data };

  // Insert the element
  await db.locks.acquireLocks({ shared: [args.annotationCreateArgs.model] });
  const textAnnotationId = db.elements.insertElement(textAnnotationElemProps);

  // Validate values
  const props = db.elements.getElementProps<TextAnnotation2dProps>(textAnnotationId);
  const elem = db.elements.getElement<TextAnnotation2d>(textAnnotationId);
  // eslint-disable-next-line no-console
  console.log("insertTextAnnotation2d", {props, elem});
  // eslint-disable-next-line no-console
  console.log("Text annotation:", textAnnotationId);
  db.saveChanges("insertTextAnnotation2d");
  return textAnnotationId;
}

export async function updateTextAnnotation2d(elementId: Id64String, args: UpdateTextAnnotationArgs): Promise<void> {
  const db = BriefcaseDb.findByKey(args.iModelKey);
  // Is a set, so we can add the same channel multiple times
  db.channels.addAllowedChannel("DrawingProduction");

  // Query the existing text annotation
  const elem = db.elements.getElement<TextAnnotation2d>(elementId);
  // Update geometry
  const elementGeometryBuilderParams = produceGeometryTemp({
    iModel: db,
    annotation: args.annotationUpdateArgs.textAnnotationData,
    category: elem.category,
    want: "flatbuffer",
  }) as FlatBufferGeometryStream;
  // Change properties
  const updateProps = {
    id: elem.id,
    textAnnotationData: JSON.stringify(args.annotationUpdateArgs.textAnnotationData),
    elementGeometryBuilderParams: { entryArray: elementGeometryBuilderParams.data }
  }
  await db.locks.acquireLocks({ shared: [elem.model], exclusive: [elementId] });
  db.elements.updateElement(updateProps);

  // Validate values
  const newElem = db.elements.getElement<TextAnnotation2d>(elementId);
  // eslint-disable-next-line no-console
  console.log("updateTextAnnotation2d", {elem, newElem});
  db.saveChanges("updateTextAnnotation2d");
}

export async function insertAnnotationTextStyle(args: CreateTextStyleArgs): Promise<string> {
  const db = BriefcaseDb.findByKey(args.iModelKey);
  // Is a set, so we can add the same channel multiple times
  db.channels.addAllowedChannel("DrawingProduction");
  // Create and insert the text style
  const createProps: AnnotationTextStyleCreateArgs = {
    iModelDb: db,
    definitionModelId: IModelDb.dictionaryId,
    settings: args.textStyleCreateArgs.settings,
    name: args.textStyleCreateArgs.name,
    description: args.textStyleCreateArgs.description,
  }
  const annotationTextStyle = AnnotationTextStyle.create(createProps);
  const json = annotationTextStyle.toJSON();
  await db.locks.acquireLocks({ shared: IModelDb.dictionaryId });
  const styleId = annotationTextStyle.insert();

  // Validate values
  const textStyle = db.elements.getElementProps<AnnotationTextStyleProps>(styleId);
  const styleElem = db.elements.tryGetElement<AnnotationTextStyle>(styleId);
  const settings = styleElem?.settings;
  // eslint-disable-next-line no-console
  console.log("insertAnnotationTextStyle", {json, textStyle, settings});
  db.saveChanges("insertAnnotationTextStyle");
  return styleId;
}

export async function updateAnnotationTextStyle(elementId: Id64String, args: UpdateTextStyleArgs): Promise<void> {
  const db = BriefcaseDb.findByKey(args.iModelKey);
  // Is a set, so we can add the same channel multiple times
  db.channels.addAllowedChannel("DrawingProduction");
  // Query the existing text style
  const style = db.elements.getElement<AnnotationTextStyle>(elementId);
  if (args.textStyleUpdateArgs.name) {
    style.code = AnnotationTextStyle.createCode(db, style.model, args.textStyleUpdateArgs.name);
  }
  style.settings = TextStyleSettings.fromJSON(args.textStyleUpdateArgs.settings);
  await db.locks.acquireLocks({ shared: [IModelDb.dictionaryId], exclusive: [elementId] });
  style.update();

  // Validate values
  const textStyle = db.elements.getElementProps<AnnotationTextStyleProps>(elementId);
  const styleElem = db.elements.getElement<AnnotationTextStyle>(elementId);
  const settings = styleElem.settings;
  // eslint-disable-next-line no-console
  console.log("insertAnnotationTextStyle", {textStyle, settings});
  db.saveChanges("updateAnnotationTextStyle");
}

export async function deleteTextAnnotations(args: {iModelKey: string}): Promise<void> {
  const db = BriefcaseDb.findByKey(args.iModelKey);
  // Is a set, so we can add the same channel multiple times
  db.channels.addAllowedChannel("DrawingProduction");
  const defElements: string[] = [];
  for await (const row of db.createQueryReader("SELECT ECInstanceId from BisCore:AnnotationTextStyle", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
    // eslint-disable-next-line no-console
    console.log("deleting element:", row.id);
    defElements.push(row.id);
  }
  try {
    // Try to delete definition elements while they are still used, should fail
    db.elements.deleteDefinitionElements(defElements);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log("Error deleting definition elements as expected", err);
  }
  db.saveChanges("deleteTextAnnotations");
  for await (const row of db.createQueryReader("SELECT ECInstanceId from BisCore:TextAnnotation2d", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
    // eslint-disable-next-line no-console
    console.log("deleting element:", row.id);
    db.elements.deleteElement(row.id);
  }
  db.elements.deleteDefinitionElements(defElements);
  db.saveChanges("deleteTextAnnotations");
}

// Does nothing...
export async function upgradeSchemas(fileName: string): Promise<void> {
  let state = BriefcaseDb.validateSchemas(fileName, true);
  if (state === SchemaState.UpgradeRecommended) {
    await BriefcaseDb.upgradeSchemas({
      fileName,
      readonly: false
    });
  }
  state = BriefcaseDb.validateSchemas(fileName, true);
  // eslint-disable-next-line no-console
  console.log({state});
}

export async function schemaVersion(args: {iModelKey: string}): Promise<string | undefined> {
  const db = BriefcaseDb.findByKey(args.iModelKey);
  const version = db.querySchemaVersion(BisCoreSchema.schemaName);
  // eslint-disable-next-line no-console
  console.log("schemaVersion", {version});
  return version;
}

export async function importSchema(args: {iModelKey: string}): Promise<string | undefined> {
  const db = BriefcaseDb.findByKey(args.iModelKey);
  const version = db.querySchemaVersion(BisCoreSchema.schemaName);

  if (version === "1.0.17") {
    return version;
  }

  // Force import
  const schemaPath = "D:/core/itwinjs-core/test-apps/display-test-app/assets/schemas/BisCore.01.00.17.ecschema.xml";
  // Pull and merge
  await db.pullChanges();

  // Push any local changes - a changeset containing schema imports should not have any other kind of changes
  db.abandonChanges();
  // await db.pushChanges({
  //   description: "Pushing any local changes before provisioning the core schema."
  // });

  // Obtain schema lock
  await db.acquireSchemaLock();

  // Perform schema import
  await db.importSchemas([schemaPath]);

  // Push schema import
  db.saveChanges();
  // await db.pushChanges({
  //   description: "Pushing BisCore.01.00.17.ecschema."
  // });

  // Release schema lock
  await db.locks.releaseAllLocks();

  return version;
}