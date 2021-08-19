/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult, Guid, Id64, Id64Set, Id64String } from "@bentley/bentleyjs-core";
import { Schema } from "@bentley/ecschema-metadata";
import { Transform } from "@bentley/geometry-core";
import {
  Code, CodeSpec, ElementAspectProps, ElementProps, FontProps, GeometricElement3dProps, IModel, ModelProps, Placement3d,
} from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import {
  AuxCoordSystem, CategorySelector, DisplayStyle3d, ECSqlStatement, Element, ElementAspect, ElementMultiAspect,
  ElementUniqueAspect, FunctionalSchema, GeometricElement3d, IModelDb, IModelJsFs, InformationPartitionElement,
  InformationRecordModel, Model, ModelSelector, PhysicalElement, PhysicalModel, PhysicalPartition, Relationship,
  RelationshipProps, SpatialCategory, SpatialViewDefinition, SubCategory, Subject,
} from "@bentley/imodeljs-backend";
import { IModelExporter, IModelExportHandler, IModelImporter, IModelTransformer } from "../imodeljs-transformer";

/** Test IModelTransformer that applies a 3d transform to all GeometricElement3d instances. */
export class IModelTransformer3d extends IModelTransformer {
  /** The Transform to apply to all GeometricElement3d instances. */
  private readonly _transform3d: Transform;
  /** Construct a new IModelTransformer3d */
  public constructor(sourceDb: IModelDb, targetDb: IModelDb, transform3d: Transform) {
    super(sourceDb, targetDb);
    this._transform3d = transform3d;
  }
  /** Override transformElement to apply a 3d transform to all GeometricElement3d instances. */
  protected override onTransformElement(sourceElement: Element): ElementProps {
    const targetElementProps: ElementProps = super.onTransformElement(sourceElement);
    if (sourceElement instanceof GeometricElement3d) { // can check the sourceElement since this IModelTransformer does not remap classes
      const placement = Placement3d.fromJSON((targetElementProps as GeometricElement3dProps).placement);
      if (placement.isValid) {
        placement.multiplyTransform(this._transform3d);
        (targetElementProps as GeometricElement3dProps).placement = placement;
      }
    }
    return targetElementProps;
  }
}

/** Test IModelTransformer that consolidates all PhysicalModels into one. */
export class PhysicalModelConsolidator extends IModelTransformer {
  /** Remap all source PhysicalModels to this one. */
  private readonly _targetModelId: Id64String;
  /** Construct a new PhysicalModelConsolidator */
  public constructor(sourceDb: IModelDb, targetDb: IModelDb, targetModelId: Id64String) {
    super(sourceDb, targetDb);
    this._targetModelId = targetModelId;
    this.importer.doNotUpdateElementIds.add(targetModelId);
  }
  /** Override shouldExportElement to remap PhysicalPartition instances. */
  protected override shouldExportElement(sourceElement: Element): boolean {
    if (sourceElement instanceof PhysicalPartition) {
      this.context.remapElement(sourceElement.id, this._targetModelId);
      // NOTE: must allow export to continue so the PhysicalModel sub-modeling the PhysicalPartition is processed
    }
    return super.shouldExportElement(sourceElement);
  }
}

/** Test IModelTransformer that uses a SpatialViewDefinition to filter the iModel contents. */
export class FilterByViewTransformer extends IModelTransformer {
  private readonly _exportViewDefinitionId: Id64String;
  private readonly _exportModelSelectorId: Id64String;
  private readonly _exportCategorySelectorId: Id64String;
  private readonly _exportDisplayStyleId: Id64String;
  private readonly _exportModelIds: Id64Set;
  public constructor(sourceDb: IModelDb, targetDb: IModelDb, exportViewDefinitionId: Id64String) {
    super(sourceDb, targetDb);
    this._exportViewDefinitionId = exportViewDefinitionId;
    const exportViewDefinition = sourceDb.elements.getElement<SpatialViewDefinition>(exportViewDefinitionId, SpatialViewDefinition);
    this._exportCategorySelectorId = exportViewDefinition.categorySelectorId;
    this._exportModelSelectorId = exportViewDefinition.modelSelectorId;
    this._exportDisplayStyleId = exportViewDefinition.displayStyleId;
    const exportCategorySelector = sourceDb.elements.getElement<CategorySelector>(exportViewDefinition.categorySelectorId, CategorySelector);
    this.excludeCategoriesExcept(Id64.toIdSet(exportCategorySelector.categories));
    const exportModelSelector = sourceDb.elements.getElement<ModelSelector>(exportViewDefinition.modelSelectorId, ModelSelector);
    this._exportModelIds = Id64.toIdSet(exportModelSelector.models);
  }
  /** Excludes categories not referenced by the export view's CategorySelector */
  private excludeCategoriesExcept(exportCategoryIds: Id64Set): void {
    const sql = `SELECT ECInstanceId FROM ${SpatialCategory.classFullName}`;
    this.sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const categoryId = statement.getValue(0).getId();
        if (!exportCategoryIds.has(categoryId)) {
          this.exporter.excludeElementsInCategory(categoryId);
        }
      }
    });
  }
  /** Override of IModelTransformer.shouldExportElement that excludes other ViewDefinition-related elements that are not associated with the *export* ViewDefinition. */
  protected override shouldExportElement(sourceElement: Element): boolean {
    if (sourceElement instanceof PhysicalPartition) {
      return this._exportModelIds.has(sourceElement.id);
    } else if (sourceElement instanceof SpatialViewDefinition) {
      return sourceElement.id === this._exportViewDefinitionId;
    } else if (sourceElement instanceof CategorySelector) {
      return sourceElement.id === this._exportCategorySelectorId;
    } else if (sourceElement instanceof ModelSelector) {
      return sourceElement.id === this._exportModelSelectorId;
    } else if (sourceElement instanceof DisplayStyle3d) {
      return sourceElement.id === this._exportDisplayStyleId;
    }
    return super.shouldExportElement(sourceElement);
  }
}

/** Specialization of IModelTransformer for testing */
export class TestIModelTransformer extends IModelTransformer {
  public constructor(source: IModelDb | IModelExporter, target: IModelDb | IModelImporter) {
    super(source, target);
    this.initExclusions();
    this.initCodeSpecRemapping();
    this.initCategoryRemapping();
    this.initClassRemapping();
    this.initSubCategoryFilters();
  }

  /** Initialize some sample exclusion rules for testing */
  private initExclusions(): void {
    this.exporter.excludeCodeSpec("ExtraCodeSpec");
    this.exporter.excludeElementClass(AuxCoordSystem.classFullName); // want to exclude AuxCoordSystem2d/3d
    this.exporter.excludeElement(this.sourceDb.elements.queryElementIdByCode(Subject.createCode(this.sourceDb, IModel.rootSubjectId, "Only in Source"))!);
    this.exporter.excludeRelationshipClass("TestTransformerSource:SourceRelToExclude");
    this.exporter.excludeElementAspectClass("TestTransformerSource:SourceUniqueAspectToExclude");
    this.exporter.excludeElementAspectClass("TestTransformerSource:SourceMultiAspectToExclude");
  }

  /** Initialize some CodeSpec remapping rules for testing */
  private initCodeSpecRemapping(): void {
    this.context.remapCodeSpec("SourceCodeSpec", "TargetCodeSpec");
  }

  /** Initialize some category remapping rules for testing */
  private initCategoryRemapping(): void {
    const subjectId = this.sourceDb.elements.queryElementIdByCode(Subject.createCode(this.sourceDb, IModel.rootSubjectId, "Subject"))!;
    const definitionModelId = this.sourceDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(this.sourceDb, subjectId, "Definition"))!;
    const sourceCategoryId = this.sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(this.sourceDb, definitionModelId, "SourcePhysicalCategory"))!;
    const targetCategoryId = this.targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(this.targetDb, IModel.dictionaryId, "TargetPhysicalCategory"))!;
    assert.isTrue(Id64.isValidId64(subjectId) && Id64.isValidId64(definitionModelId) && Id64.isValidId64(sourceCategoryId) && Id64.isValidId64(targetCategoryId));
    this.context.remapElement(sourceCategoryId, targetCategoryId);
    this.exporter.excludeElement(sourceCategoryId); // Don't process a specifically remapped element
  }

  /** Initialize some class remapping rules for testing */
  private initClassRemapping(): void {
    this.context.remapElementClass("TestTransformerSource:SourcePhysicalElement", "TestTransformerTarget:TargetPhysicalElement");
    this.context.remapElementClass("TestTransformerSource:SourcePhysicalElementUsesCommonDefinition", "TestTransformerTarget:TargetPhysicalElementUsesCommonDefinition");
    this.context.remapElementClass("TestTransformerSource:SourceInformationRecord", "TestTransformerTarget:TargetInformationRecord");
  }

  /** */
  private initSubCategoryFilters(): void {
    assert.isFalse(this.context.hasSubCategoryFilter);
    const sql = `SELECT ECInstanceId FROM ${SubCategory.classFullName} WHERE CodeValue=:codeValue`;
    this.sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindString("codeValue", "FilteredSubCategory");
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const subCategoryId = statement.getValue(0).getId();
        assert.isFalse(this.context.isSubCategoryFiltered(subCategoryId));
        this.context.filterSubCategory(subCategoryId);
        this.exporter.excludeElement(subCategoryId);
        assert.isTrue(this.context.isSubCategoryFiltered(subCategoryId));
      }
    });
    assert.isTrue(this.context.hasSubCategoryFilter);
  }

  /** Override shouldExportElement to exclude all elements from the Functional schema. */
  public override shouldExportElement(sourceElement: Element): boolean {
    return sourceElement.classFullName.startsWith(FunctionalSchema.schemaName) ? false : super.shouldExportElement(sourceElement);
  }

  /** Override transformElement to make sure that all target Elements have a FederationGuid */
  protected override onTransformElement(sourceElement: Element): ElementProps {
    const targetElementProps: any = super.onTransformElement(sourceElement);
    if (!targetElementProps.federationGuid) {
      targetElementProps.federationGuid = Guid.createValue();
    }
    if ("TestTransformerSource:SourcePhysicalElement" === sourceElement.classFullName) {
      targetElementProps.targetString = sourceElement.asAny.sourceString;
      targetElementProps.targetDouble = sourceElement.asAny.sourceDouble;
      targetElementProps.targetBinary = sourceElement.asAny.sourceBinary;
      targetElementProps.targetNavigation = {
        id: this.context.findTargetElementId(sourceElement.asAny.sourceNavigation.id),
        relClassName: "TestTransformerTarget:TargetPhysicalElementUsesTargetDefinition",
      };
    } else if ("TestTransformerSource:SourceInformationRecord" === sourceElement.classFullName) {
      targetElementProps.targetString = sourceElement.asAny.sourceString;
    }
    return targetElementProps;
  }

  /** Override transformElementAspect to remap Source*Aspect --> Target*Aspect */
  protected override onTransformElementAspect(sourceElementAspect: ElementAspect, targetElementId: Id64String): ElementAspectProps {
    const targetElementAspectProps: any = super.onTransformElementAspect(sourceElementAspect, targetElementId);
    if ("TestTransformerSource:SourceUniqueAspect" === sourceElementAspect.classFullName) {
      targetElementAspectProps.classFullName = "TestTransformerTarget:TargetUniqueAspect";
      targetElementAspectProps.targetDouble = targetElementAspectProps.sourceDouble;
      targetElementAspectProps.sourceDouble = undefined;
      targetElementAspectProps.targetString = targetElementAspectProps.sourceString;
      targetElementAspectProps.sourceString = undefined;
      targetElementAspectProps.targetLong = targetElementAspectProps.sourceLong; // Id64 value was already remapped by super.transformElementAspect()
      targetElementAspectProps.sourceLong = undefined;
      targetElementAspectProps.targetGuid = targetElementAspectProps.sourceGuid;
      targetElementAspectProps.sourceGuid = undefined;
    } else if ("TestTransformerSource:SourceMultiAspect" === sourceElementAspect.classFullName) {
      targetElementAspectProps.classFullName = "TestTransformerTarget:TargetMultiAspect";
      targetElementAspectProps.targetDouble = targetElementAspectProps.sourceDouble;
      targetElementAspectProps.sourceDouble = undefined;
      targetElementAspectProps.targetString = targetElementAspectProps.sourceString;
      targetElementAspectProps.sourceString = undefined;
      targetElementAspectProps.targetLong = targetElementAspectProps.sourceLong; // Id64 value was already remapped by super.transformElementAspect()
      targetElementAspectProps.sourceLong = undefined;
      targetElementAspectProps.targetGuid = targetElementAspectProps.sourceGuid;
      targetElementAspectProps.sourceGuid = undefined;
    }
    return targetElementAspectProps;
  }

  /** Override transformRelationship to remap SourceRelWithProps --> TargetRelWithProps */
  protected override onTransformRelationship(sourceRelationship: Relationship): RelationshipProps {
    const targetRelationshipProps: any = super.onTransformRelationship(sourceRelationship);
    if ("TestTransformerSource:SourceRelWithProps" === sourceRelationship.classFullName) {
      targetRelationshipProps.classFullName = "TestTransformerTarget:TargetRelWithProps";
      targetRelationshipProps.targetString = targetRelationshipProps.sourceString;
      targetRelationshipProps.sourceString = undefined;
      targetRelationshipProps.targetDouble = targetRelationshipProps.sourceDouble;
      targetRelationshipProps.sourceDouble = undefined;
      targetRelationshipProps.targetLong = targetRelationshipProps.sourceLong; // Id64 value was already remapped by super.transformRelationship()
      targetRelationshipProps.sourceLong = undefined;
      targetRelationshipProps.targetGuid = targetRelationshipProps.sourceGuid;
      targetRelationshipProps.sourceGuid = undefined;
    }
    return targetRelationshipProps;
  }
}

/** Specialization of IModelImporter that counts the number of times each callback is called. */
export class CountingIModelImporter extends IModelImporter {
  public numModelsInserted: number = 0;
  public numModelsUpdated: number = 0;
  public numElementsInserted: number = 0;
  public numElementsUpdated: number = 0;
  public numElementsDeleted: number = 0;
  public numElementAspectsInserted: number = 0;
  public numElementAspectsUpdated: number = 0;
  public numRelationshipsInserted: number = 0;
  public numRelationshipsUpdated: number = 0;
  public numRelationshipsDeleted: number = 0;
  public constructor(targetDb: IModelDb) {
    super(targetDb);
  }
  protected override onInsertModel(modelProps: ModelProps): Id64String {
    this.numModelsInserted++;
    return super.onInsertModel(modelProps);
  }
  protected override onUpdateModel(modelProps: ModelProps): void {
    this.numModelsUpdated++;
    super.onUpdateModel(modelProps);
  }
  protected override onInsertElement(elementProps: ElementProps): Id64String {
    this.numElementsInserted++;
    return super.onInsertElement(elementProps);
  }
  protected override onUpdateElement(elementProps: ElementProps): void {
    this.numElementsUpdated++;
    super.onUpdateElement(elementProps);
  }
  protected override onDeleteElement(elementId: Id64String): void {
    this.numElementsDeleted++;
    super.onDeleteElement(elementId);
  }
  protected override onInsertElementAspect(aspectProps: ElementAspectProps): void {
    this.numElementAspectsInserted++;
    super.onInsertElementAspect(aspectProps);
  }
  protected override onUpdateElementAspect(aspectProps: ElementAspectProps): void {
    this.numElementAspectsUpdated++;
    super.onUpdateElementAspect(aspectProps);
  }
  protected override onInsertRelationship(relationshipProps: RelationshipProps): Id64String {
    this.numRelationshipsInserted++;
    return super.onInsertRelationship(relationshipProps);
  }
  protected override onUpdateRelationship(relationshipProps: RelationshipProps): void {
    this.numRelationshipsUpdated++;
    super.onUpdateRelationship(relationshipProps);
  }
  protected override onDeleteRelationship(relationshipProps: RelationshipProps): void {
    this.numRelationshipsDeleted++;
    super.onDeleteRelationship(relationshipProps);
  }
}

/** Specialization of IModelImporter that creates an InformationRecordElement for each PhysicalElement that it imports. */
export class RecordingIModelImporter extends CountingIModelImporter {
  public constructor(targetDb: IModelDb) {
    super(targetDb);
  }
  protected override onInsertModel(modelProps: ModelProps): Id64String {
    const modelId: Id64String = super.onInsertModel(modelProps);
    const model: Model = this.targetDb.models.getModel(modelId);
    if (model instanceof PhysicalModel) {
      const modeledElement: Element = this.targetDb.elements.getElement(model.modeledElement.id);
      if (modeledElement instanceof PhysicalPartition) {
        const parentSubjectId: Id64String = modeledElement.parent!.id; // InformationPartitionElements are always parented to Subjects
        const recordPartitionId: Id64String = InformationRecordModel.insert(this.targetDb, parentSubjectId, `Records for ${model.name}`);
        this.targetDb.relationships.insertInstance({
          classFullName: "TestTransformerTarget:PhysicalPartitionIsTrackedByRecords",
          sourceId: modeledElement.id,
          targetId: recordPartitionId,
        });
      }
    }
    return modelId;
  }
  protected override onInsertElement(elementProps: ElementProps): Id64String {
    const elementId: Id64String = super.onInsertElement(elementProps);
    const element: Element = this.targetDb.elements.getElement(elementId);
    if (element instanceof PhysicalElement) {
      const recordPartitionId: Id64String = this.getRecordPartitionId(element.model);
      if (Id64.isValidId64(recordPartitionId)) {
        this.insertAuditRecord("Insert", recordPartitionId, element);
      }
    }
    return elementId;
  }
  protected override onUpdateElement(elementProps: ElementProps): void {
    super.onUpdateElement(elementProps);
    const element: Element = this.targetDb.elements.getElement(elementProps.id!);
    if (element instanceof PhysicalElement) {
      const recordPartitionId: Id64String = this.getRecordPartitionId(element.model);
      if (Id64.isValidId64(recordPartitionId)) {
        this.insertAuditRecord("Update", recordPartitionId, element);
      }
    }
  }
  protected override onDeleteElement(elementId: Id64String): void {
    const element: Element = this.targetDb.elements.getElement(elementId);
    if (element instanceof PhysicalElement) {
      const recordPartitionId: Id64String = this.getRecordPartitionId(element.model);
      if (Id64.isValidId64(recordPartitionId)) {
        this.insertAuditRecord("Delete", recordPartitionId, element);
      }
    }
    super.onDeleteElement(elementId); // delete element after AuditRecord is inserted
  }
  private getRecordPartitionId(physicalPartitionId: Id64String): Id64String {
    const sql = "SELECT TargetECInstanceId FROM TestTransformerTarget:PhysicalPartitionIsTrackedByRecords WHERE SourceECInstanceId=:physicalPartitionId";
    return this.targetDb.withPreparedStatement(sql, (statement: ECSqlStatement): Id64String => {
      statement.bindId("physicalPartitionId", physicalPartitionId);
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getId() : Id64.invalid;
    });
  }
  private insertAuditRecord(operation: string, recordPartitionId: Id64String, physicalElement: PhysicalElement): Id64String {
    const auditRecord: any = {
      classFullName: "TestTransformerTarget:AuditRecord",
      model: recordPartitionId,
      code: Code.createEmpty(),
      userLabel: `${operation} of ${physicalElement.getDisplayLabel()} at ${new Date()}`,
      operation,
      physicalElement: { id: physicalElement.id },
    };
    return this.targetDb.elements.insertElement(auditRecord);
  }
}

/** Specialization of IModelExport that exports to an output text file. */
export class IModelToTextFileExporter extends IModelExportHandler {
  public outputFileName: string;
  public exporter: IModelExporter;
  private _shouldIndent: boolean = true;
  private _firstFont: boolean = true;
  private _firstRelationship: boolean = true;
  public constructor(sourceDb: IModelDb, outputFileName: string) {
    super();
    this.outputFileName = outputFileName;
    this.exporter = new IModelExporter(sourceDb);
    this.exporter.registerHandler(this);
    this.exporter.wantGeometry = false;
  }
  public async export(): Promise<void> {
    this._shouldIndent = true;
    await this.exporter.exportSchemas();
    this.writeSeparator();
    await this.exporter.exportAll();
  }
  public async exportChanges(requestContext: AuthorizedClientRequestContext, startChangeSetId?: string): Promise<void> {
    this._shouldIndent = false;
    return this.exporter.exportChanges(requestContext, startChangeSetId);
  }
  private writeLine(line: string, indentLevel: number = 0): void {
    if (this._shouldIndent) {
      for (let i = 0; i < indentLevel; i++) {
        IModelJsFs.appendFileSync(this.outputFileName, "  ");
      }
    }
    IModelJsFs.appendFileSync(this.outputFileName, line);
    IModelJsFs.appendFileSync(this.outputFileName, "\n");
  }
  private writeSeparator(): void {
    this.writeLine("--------------------------------");
  }
  private formatOperationName(isUpdate: boolean | undefined): string {
    if (undefined === isUpdate) return "";
    return isUpdate ? ", UPDATE" : ", INSERT";
  }
  private getIndentLevelForElement(element: Element): number {
    if (!this._shouldIndent) {
      return 0;
    }
    if ((undefined !== element.parent) && (Id64.isValidId64(element.parent.id))) {
      const parentElement: Element = this.exporter.sourceDb.elements.getElement(element.parent.id);
      return 1 + this.getIndentLevelForElement(parentElement);
    }
    return 1;
  }
  private getIndentLevelForElementAspect(aspect: ElementAspect): number {
    if (!this._shouldIndent) {
      return 0;
    }
    const element: Element = this.exporter.sourceDb.elements.getElement(aspect.element.id);
    return 1 + this.getIndentLevelForElement(element);
  }
  protected override async onExportSchema(schema: Schema): Promise<void> {
    this.writeLine(`[Schema] ${schema.name}`);
    return super.onExportSchema(schema);
  }
  protected override onExportCodeSpec(codeSpec: CodeSpec, isUpdate: boolean | undefined): void {
    this.writeLine(`[CodeSpec] ${codeSpec.id}, ${codeSpec.name}${this.formatOperationName(isUpdate)}`);
    super.onExportCodeSpec(codeSpec, isUpdate);
  }
  protected override onExportFont(font: FontProps, isUpdate: boolean | undefined): void {
    if (this._firstFont) {
      this.writeSeparator();
      this._firstFont = false;
    }
    this.writeLine(`[Font] ${font.id}, ${font.name}`);
    super.onExportFont(font, isUpdate);
  }
  protected override onExportModel(model: Model, isUpdate: boolean | undefined): void {
    this.writeSeparator();
    this.writeLine(`[Model] ${model.classFullName}, ${model.id}, ${model.name}${this.formatOperationName(isUpdate)}`);
    super.onExportModel(model, isUpdate);
  }
  protected override onExportElement(element: Element, isUpdate: boolean | undefined): void {
    const indentLevel: number = this.getIndentLevelForElement(element);
    this.writeLine(`[Element] ${element.classFullName}, ${element.id}, ${element.getDisplayLabel()}${this.formatOperationName(isUpdate)}`, indentLevel);
    super.onExportElement(element, isUpdate);
  }
  protected override onDeleteElement(elementId: Id64String): void {
    this.writeLine(`[Element] ${elementId}, DELETE`);
    super.onDeleteElement(elementId);
  }
  protected override onExportElementUniqueAspect(aspect: ElementUniqueAspect, isUpdate: boolean | undefined): void {
    const indentLevel: number = this.getIndentLevelForElementAspect(aspect);
    this.writeLine(`[Aspect] ${aspect.classFullName}, ${aspect.id}${this.formatOperationName(isUpdate)}`, indentLevel);
    super.onExportElementUniqueAspect(aspect, isUpdate);
  }
  protected override onExportElementMultiAspects(aspects: ElementMultiAspect[]): void {
    const indentLevel: number = this.getIndentLevelForElementAspect(aspects[0]);
    for (const aspect of aspects) {
      this.writeLine(`[Aspect] ${aspect.classFullName}, ${aspect.id}`, indentLevel);
    }
    super.onExportElementMultiAspects(aspects);
  }
  protected override onExportRelationship(relationship: Relationship, isUpdate: boolean | undefined): void {
    if (this._firstRelationship) {
      this.writeSeparator();
      this._firstRelationship = false;
    }
    this.writeLine(`[Relationship] ${relationship.classFullName}, ${relationship.id}${this.formatOperationName(isUpdate)}`);
    super.onExportRelationship(relationship, isUpdate);
  }
  protected override onDeleteRelationship(relInstanceId: Id64String): void {
    this.writeLine(`[Relationship] ${relInstanceId}, DELETE`);
    super.onDeleteRelationship(relInstanceId);
  }
}

/** Specialization of IModelExport that counts occurrences of classes. */
export class ClassCounter extends IModelExportHandler {
  public outputFileName: string;
  public exporter: IModelExporter;
  private _modelClassCounts: Map<string, number> = new Map<string, number>();
  private _elementClassCounts: Map<string, number> = new Map<string, number>();
  private _aspectClassCounts: Map<string, number> = new Map<string, number>();
  private _relationshipClassCounts: Map<string, number> = new Map<string, number>();
  public constructor(sourceDb: IModelDb, outputFileName: string) {
    super();
    this.outputFileName = outputFileName;
    this.exporter = new IModelExporter(sourceDb);
    this.exporter.registerHandler(this);
    this.exporter.wantGeometry = false;
  }
  public async count(): Promise<void> {
    await this.exporter.exportAll();
    this.outputAllClassCounts();
  }
  private incrementClassCount(map: Map<string, number>, classFullName: string): void {
    const count: number | undefined = map.get(classFullName);
    if (undefined === count) {
      map.set(classFullName, 1);
    } else {
      map.set(classFullName, 1 + count);
    }
  }
  private sortClassCounts(map: Map<string, number>): any[] {
    return Array.from(map).sort((a: [string, number], b: [string, number]): number => {
      if (a[1] === b[1]) {
        return a[0] > b[0] ? 1 : -1;
      } else {
        return a[1] > b[1] ? -1 : 1;
      }
    });
  }
  private outputAllClassCounts(): void {
    this.outputClassCounts("Model", this.sortClassCounts(this._modelClassCounts));
    this.outputClassCounts("Element", this.sortClassCounts(this._elementClassCounts));
    this.outputClassCounts("ElementAspect", this.sortClassCounts(this._aspectClassCounts));
    this.outputClassCounts("Relationship", this.sortClassCounts(this._relationshipClassCounts));
  }
  private outputClassCounts(title: string, classCounts: Array<[string, number]>): void {
    IModelJsFs.appendFileSync(this.outputFileName, `=== ${title} Class Counts ===\n`);
    classCounts.forEach((value: [string, number]) => {
      IModelJsFs.appendFileSync(this.outputFileName, `${value[1]}, ${value[0]}\n`);
    });
    IModelJsFs.appendFileSync(this.outputFileName, `\n`);
  }
  protected override onExportModel(model: Model, isUpdate: boolean | undefined): void {
    this.incrementClassCount(this._modelClassCounts, model.classFullName);
    super.onExportModel(model, isUpdate);
  }
  protected override onExportElement(element: Element, isUpdate: boolean | undefined): void {
    this.incrementClassCount(this._elementClassCounts, element.classFullName);
    super.onExportElement(element, isUpdate);
  }
  protected override onExportElementUniqueAspect(aspect: ElementUniqueAspect, isUpdate: boolean | undefined): void {
    this.incrementClassCount(this._aspectClassCounts, aspect.classFullName);
    super.onExportElementUniqueAspect(aspect, isUpdate);
  }
  protected override onExportElementMultiAspects(aspects: ElementMultiAspect[]): void {
    for (const aspect of aspects) {
      this.incrementClassCount(this._aspectClassCounts, aspect.classFullName);
    }
    super.onExportElementMultiAspects(aspects);
  }
  protected override onExportRelationship(relationship: Relationship, isUpdate: boolean | undefined): void {
    this.incrementClassCount(this._relationshipClassCounts, relationship.classFullName);
    super.onExportRelationship(relationship, isUpdate);
  }
}
