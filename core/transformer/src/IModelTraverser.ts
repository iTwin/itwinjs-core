/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import {
  AccessToken,
  assert,
  DbResult,
  Id64,
  Id64String,
  IModelStatus,
  Logger,
} from "@itwin/core-bentley";
import {
  ECVersion,
  Schema,
  SchemaKey,
  SchemaKeyProps,
} from "@itwin/ecschema-metadata";
import { CodeSpec, FontProps, IModel, IModelError } from "@itwin/core-common";
import { TransformerLoggerCategory } from "./TransformerLoggerCategory";
import {
  BisCoreSchema,
  BriefcaseDb,
  BriefcaseManager,
  DefinitionModel,
  ECSqlStatement,
  Element,
  ElementMultiAspect,
  ElementRefersToElements,
  ElementUniqueAspect,
  GeometricElement,
  IModelDb,
  IModelHost,
  IModelJsNative,
  IModelSchemaLoader,
  Model,
  RecipeDefinitionElement,
  Relationship,
  RelationshipProps,
} from "@itwin/core-backend";

const loggerCategory = TransformerLoggerCategory.IModelTraverser;

// type Action = "update" | "delete"

type MaybeAsync<T> = T | PromiseLike<T>;

// type HookFunc<ItemType> = (item: ItemType) => MaybeAsync<HookResult>;

interface HookResult {
  // NOTE: defer should probably be an internal concept since how the heck do you handle a user deferal?
  result: "defer" | "skip" | "continue";
}

type HookResponse = MaybeAsync<HookResult | void>;

interface IModelTraverserOptions {
  /** A flag that indicates whether template models should be exported or not. The default is `true`.
   * @note If only exporting *instances* then template models can be skipped since they are just definitions that are cloned to create new instances.
   * @see [Model.isTemplate]($backend)
   */
  wantTemplateModels?: boolean;
  /** A flag that indicates whether *system* schemas should be exported or not. The default is `false`.
   * @see [[exportSchemas]]
   */
  wantSystemSchemas?: boolean;
  /** A flag that determines whether this IModelExporter should visit Elements or not. The default is `true`.
   * @note This flag is available as an optimization when the exporter doesn't need to visit elements, so can skip loading them.
   */
  visitElements?: boolean;
  /** A flag that determines whether this IModelExporter should visit Relationships or not. The default is `true`.
   * @note This flag is available as an optimization when the exporter doesn't need to visit relationships, so can skip loading them.
   */
  visitRelationships?: boolean;
  /** The number of entities exported before incremental progress should be reported via the [[onProgress]] callback. */
  progressInterval?: number;
}

const defaultOptions = {
  wantTemplateModels: true,
  wantSystemSchemas: false,
  visitElements: true,
  visitRelationships: true,
  progressInterval: 1000,
} as const;

/** the collection of hooks that a traverser needs to have
 * TODO rename all "hooks" to handlers
 * @beta
 */
interface HookableTraverser {
  onExportCodeSpec(_id: Id64String, _utils: { load(): CodeSpec, isUpdate?: boolean }): HookResponse;

  onExportFont(_font: FontProps, _utils: {isUpdate?: boolean}): HookResponse;

  onExportModel(
    _id: Id64String,
    _utils: { load(opts?: { wantGeometry?: boolean }): Model, isUpdate?: boolean }
  ): HookResponse;

  onDeleteModel(_modelId: Id64String): HookResponse;

  onExportElement(
    _id: Id64String,
    _utils: { load(opts?: { wantGeometry?: boolean }): Element, isUpdate?: boolean }
  ): HookResponse;

  onDeleteElement(_elementId: Id64String): HookResponse;

  onExportElementUniqueAspect(
    _id: Id64String,
    _utils: { load(): ElementUniqueAspect, isUpdate?: boolean }
  ): HookResponse;

  onExportElementMultiAspect(
    _id: Id64String,
    _utils: { load(): ElementMultiAspect, isUpdate?: boolean }
  ): HookResponse;

  onExportRelationship(
    _id: Id64String,
    _relClassFullName: string,
    _utils: { load(): Relationship, isUpdate?: boolean }
  ): HookResponse;

  onDeleteRelationship(
    _id: Id64String,
    _utils: { load(): Relationship, isUpdate?: boolean }
  ): HookResponse;

  onExportSchema(
    _key: SchemaKeyProps,
    _utils: { load(): Schema, isUpdate?: boolean }
  ): HookResponse;
}

/** Base class for low-level traversing of an iModel, with hooks/events
 * @note Most uses cases will not require a custom subclass of `IModelExporter`. Instead, it is more typical to subclass/customize [IModelExportHandler]($transformer).
 * @see [iModel Transformation and Data Exchange]($docs/learning/transformer/index.md), [[registerHandler]], [IModelTransformer]($transformer), [IModelImporter]($transformer)
 * @note this is intended to replace the IModelExporter class
 * @beta
 */
export class IModelTraverser implements HookableTraverser {
  public onExportCodeSpec: HookableTraverser["onExportCodeSpec"] = () => { };
  public onExportFont: HookableTraverser["onExportFont"] = () => { };
  public onExportModel: HookableTraverser["onExportModel"] = () => { };
  public onDeleteModel: HookableTraverser["onDeleteModel"] = () => { };
  public onExportElement: HookableTraverser["onExportElement"] = () => { };
  public onDeleteElement: HookableTraverser["onDeleteElement"] = () => { };
  public onExportElementUniqueAspect: HookableTraverser["onExportElementUniqueAspect"] = () => { };
  public onExportElementMultiAspect: HookableTraverser["onExportElementMultiAspect"] = () => { };
  public onExportRelationship: HookableTraverser["onExportRelationship"] = () => { };
  public onDeleteRelationship: HookableTraverser["onDeleteRelationship"] = () => { };
  public onExportSchema: HookableTraverser["onExportSchema"] = () => { };

  public onProgress = () => { };

  public readonly options: Readonly<Required<IModelTraverserOptions>>;

  /** The read-only source iModel. */
  public readonly sourceDb: IModelDb;
  /** Tracks the current total number of entities exported. */
  private _progressCounter: number = 0;
  /** Optionally cached entity change information */
  private _sourceDbChanges?: ChangedInstanceIds;

  public constructor(sourceDb: IModelDb, options: IModelTraverserOptions = {}) {
    this.options = { ...defaultOptions, ...options };
    this.sourceDb = sourceDb;
  }

  /** Export all entity instance types from the source iModel.
   * @note [[exportSchemas]] must be called separately.
   */
  public async exportAll(): Promise<void> {
    await this.exportCodeSpecs();
    await this.exportFonts();
    await this.exportModel(IModel.repositoryModelId);
    await this.exportRelationships(ElementRefersToElements.classFullName);
  }

  /** Export changes from the source iModel.
   * @param user The user
   * @param startChangesetId Include changes from this changeset up through and including the current changeset.
   * If this parameter is not provided, then just the current changeset will be exported.
   * @note To form a range of versions to export, set `startChangesetId` for the start (inclusive) of the desired range and open the source iModel as of the end (inclusive) of the desired range.
   */
  public async exportChanges(
    user?: AccessToken,
    startChangesetId?: string
  ): Promise<void> {
    if (!this.sourceDb.isBriefcaseDb()) {
      throw new IModelError(
        IModelStatus.BadRequest,
        "Must be a briefcase to export changes"
      );
    }
    if ("" === this.sourceDb.changeset.id) {
      await this.exportAll(); // no changesets, so revert to exportAll
      return;
    }
    if (undefined === startChangesetId) {
      startChangesetId = this.sourceDb.changeset.id;
    }
    this._sourceDbChanges = await ChangedInstanceIds.initialize(
      user,
      this.sourceDb,
      startChangesetId
    );
    await this.exportCodeSpecs();
    await this.exportFonts();
    await this.exportModelContents(IModel.repositoryModelId);
    await this.exportSubModels(IModel.repositoryModelId);
    await this.exportRelationships(ElementRefersToElements.classFullName);
    // handle deletes
    if (this.options.visitElements) {
      for (const elementId of this._sourceDbChanges.element.deleteIds) {
        await this.onDeleteElement(elementId);
      }
    }
    // WIP: handle ElementAspects?
    for (const modelId of this._sourceDbChanges.model.deleteIds) {
      await this.onDeleteModel(modelId);
    }
    if (this.options.visitRelationships) {
      for (const relInstanceId of this._sourceDbChanges.relationship
        .deleteIds) {
        await this.onDeleteRelationship(relInstanceId, {
          load: () =>
            this.sourceDb.relationships.getInstance("FIXME", relInstanceId),
        });
      }
    }
  }

  /** Export schemas from the source iModel.
   * @note This must be called separately from [[exportAll]] or [[exportChanges]].
   */
  public async exportSchemas(): Promise<void> {
    const sql =
      "SELECT Name, VersionMajor, VersionWrite, VersionMinor FROM ECDbMeta.ECSchemaDef ORDER BY ECInstanceId"; // ensure schema dependency order
    let readyToExport: boolean = this.options.wantSystemSchemas ? true : false;
    const schemaExportPromises: HookResponse[] = [];
    const schemaLoader = new IModelSchemaLoader(this.sourceDb);
    this.sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const schemaName = statement.getValue(0).getString();
        const versionMajor = statement.getValue(1).getInteger();
        const versionWrite = statement.getValue(2).getInteger();
        const versionMinor = statement.getValue(3).getInteger();
        if (!readyToExport) {
          readyToExport = schemaName === BisCoreSchema.schemaName; // schemas prior to BisCore are considered *system* schemas
        }
        const schemaKey = new SchemaKey(
          schemaName,
          new ECVersion(versionMajor, versionWrite, versionMinor)
        );
        if (readyToExport) {
          schemaExportPromises.push(
            this.onExportSchema(schemaKey.toJSON(), {
              load: () => schemaLoader.getSchema(schemaName),
            })
          );
        }
      }
    });

    await Promise.all(schemaExportPromises);
  }

  /** For logging, indicate the change type if known. */
  private getChangeOpSuffix(isUpdate: boolean | undefined): string {
    return isUpdate ? " UPDATE" : undefined === isUpdate ? "" : " INSERT";
  }

  /** Export all CodeSpecs from the source iModel.
   * @note This method is called from [[exportChanges]] and [[exportAll]], so it only needs to be called directly when exporting a subset of an iModel.
   */
  public async exportCodeSpecs(): Promise<void> {
    Logger.logTrace(loggerCategory, `exportCodeSpecs()`);
    const sql = `SELECT Name FROM BisCore:CodeSpec ORDER BY ECInstanceId`;
    await this.sourceDb.withPreparedStatement(
      sql,
      async (statement: ECSqlStatement): Promise<void> => {
        while (DbResult.BE_SQLITE_ROW === statement.step()) {
          const codeSpecName: string = statement.getValue(0).getString();
          await this.exportCodeSpecByName(codeSpecName);
        }
      }
    );
  }

  /** Export a single CodeSpec from the source iModel.
   * @note This method is called from [[exportChanges]] and [[exportAll]], so it only needs to be called directly when exporting a subset of an iModel.
   */
  public async exportCodeSpecByName(codeSpecName: string): Promise<void> {
    const codeSpec: CodeSpec = this.sourceDb.codeSpecs.getByName(codeSpecName);
    let isUpdate: boolean | undefined;
    if (undefined !== this._sourceDbChanges) {
      // is changeset information available?
      if (this._sourceDbChanges.codeSpec.insertIds.has(codeSpec.id)) {
        isUpdate = false;
      } else if (this._sourceDbChanges.codeSpec.updateIds.has(codeSpec.id)) {
        isUpdate = true;
      } else {
        return; // not in changeset, don't export
      }
    }

    // FIXME: avoid loading the codespec unless load is called
    const response = await this.onExportCodeSpec(codeSpec.id, {
      load: () => codeSpec,
    });
    if (!response || response.result === "continue")
      Logger.logTrace(
        loggerCategory,
        `exportCodeSpec(${codeSpecName})${this.getChangeOpSuffix(isUpdate)}`
      );
    return this.trackProgress();
  }

  /** Export a single CodeSpec from the source iModel.
   * @note This method is called from [[exportChanges]] and [[exportAll]], so it only needs to be called directly when exporting a subset of an iModel.
   */
  public async exportCodeSpecById(codeSpecId: Id64String): Promise<void> {
    const codeSpec: CodeSpec = this.sourceDb.codeSpecs.getById(codeSpecId);
    return this.exportCodeSpecByName(codeSpec.name);
  }

  /** Export all fonts from the source iModel.
   * @note This method is called from [[exportChanges]] and [[exportAll]], so it only needs to be called directly when exporting a subset of an iModel.
   */
  public async exportFonts(): Promise<void> {
    Logger.logTrace(loggerCategory, `exportFonts()`);
    for (const font of this.sourceDb.fontMap.fonts.values()) {
      await this.exportFontByNumber(font.id);
    }
  }

  /** Export a single font from the source iModel.
   * @note This method is called from [[exportChanges]] and [[exportAll]], so it only needs to be called directly when exporting a subset of an iModel.
   */
  public async exportFontByName(fontName: string): Promise<void> {
    Logger.logTrace(loggerCategory, `exportFontByName(${fontName})`);
    const font: FontProps | undefined = this.sourceDb.fontMap.getFont(fontName);
    if (undefined !== font) {
      await this.exportFontByNumber(font.id);
    }
  }

  /** Export a single font from the source iModel.
   * @note This method is called from [[exportChanges]] and [[exportAll]], so it only needs to be called directly when exporting a subset of an iModel.
   */
  public async exportFontByNumber(fontNumber: number): Promise<void> {
    let isUpdate: boolean | undefined;
    if (undefined !== this._sourceDbChanges) {
      // is changeset information available?
      const fontId: Id64String = Id64.fromUint32Pair(fontNumber, 0); // changeset information uses Id64String, not number
      if (this._sourceDbChanges.font.insertIds.has(fontId)) {
        isUpdate = false;
      } else if (this._sourceDbChanges.font.updateIds.has(fontId)) {
        isUpdate = true;
      } else {
        return; // not in changeset, don't export
      }
    }
    Logger.logTrace(loggerCategory, `exportFontById(${fontNumber})`);
    const font: FontProps | undefined =
      this.sourceDb.fontMap.getFont(fontNumber);
    if (undefined !== font) {
      await this.onExportFont(font, { isUpdate });
      return this.trackProgress();
    }
  }

  /** Export the model container, contents, and sub-models from the source iModel.
   * @note This method is called from [[exportChanges]] and [[exportAll]], so it only needs to be called directly when exporting a subset of an iModel.
   */
  public async exportModel(modeledElementId: Id64String): Promise<void> {
    const model: Model = this.sourceDb.models.getModel(modeledElementId);
    // TODO: remove
    if (model.isTemplate && !this.options.wantTemplateModels) {
      return;
    }
    Logger.logTrace(loggerCategory, `exportModel(${modeledElementId})`);
    // TODO: comopare behavior of onExportelement to just shouldExportElement here
    const response = await this.onExportElement(modeledElementId, {
      load: (opts) =>
        this.sourceDb.elements.getElement({ id: modeledElementId, ...opts }),
    });
    if (!response || response.result === "continue") {
      await this.exportModelContainer(model);
      if (this.options.visitElements) {
        await this.exportModelContents(modeledElementId);
      }
      await this.exportSubModels(modeledElementId);
    }
  }

  /** Export the model (the container only) from the source iModel. */
  private async exportModelContainer(model: Model): Promise<void> {
    let isUpdate: boolean | undefined;
    if (undefined !== this._sourceDbChanges) {
      // is changeset information available?
      if (this._sourceDbChanges.model.insertIds.has(model.id)) {
        isUpdate = false;
      } else if (this._sourceDbChanges.model.updateIds.has(model.id)) {
        isUpdate = true;
      } else {
        return; // not in changeset, don't export
      }
    }
    // FIXME: don't load model if we don't have to
    await this.onExportModel(model.id, { load: () => model, isUpdate });
    return this.trackProgress();
  }

  /** Export the model contents.
   * @param modelId The only required parameter
   * @param elementClassFullName Can be optionally specified if the goal is to export a subset of the model contents
   * @param skipRootSubject Decides whether or not to export the root Subject. It is normally left undefined except for internal implementation purposes.
   * @note This method is called from [[exportChanges]] and [[exportAll]], so it only needs to be called directly when exporting a subset of an iModel.
   */
  public async exportModelContents(
    modelId: Id64String,
    elementClassFullName: string = Element.classFullName,
    skipRootSubject?: boolean
  ): Promise<void> {
    if (skipRootSubject) {
      // NOTE: IModelTransformer.processAll should skip the root Subject since it is specific to the individual iModel and is not part of the changes that need to be synchronized
      // NOTE: IModelExporter.exportAll should not skip the root Subject since the goal is to export everything
      assert(modelId === IModel.repositoryModelId); // flag is only relevant when processing the RepositoryModel
    }
    if (!this.options.visitElements) {
      Logger.logTrace(
        loggerCategory,
        `visitElements=false, skipping exportModelContents(${modelId})`
      );
      return;
    }
    if (undefined !== this._sourceDbChanges) {
      // is changeset information available?
      if (
        !this._sourceDbChanges.model.insertIds.has(modelId) &&
        !this._sourceDbChanges.model.updateIds.has(modelId)
      ) {
        return; // this optimization assumes that the Model changes (LastMod) any time an Element in the Model changes
      }
    }
    Logger.logTrace(loggerCategory, `exportModelContents(${modelId})`);
    let sql: string;
    if (skipRootSubject) {
      sql = `SELECT ECInstanceId FROM ${elementClassFullName} WHERE Parent.Id IS NULL AND Model.Id=:modelId AND ECInstanceId!=:rootSubjectId ORDER BY ECInstanceId`;
    } else {
      sql = `SELECT ECInstanceId FROM ${elementClassFullName} WHERE Parent.Id IS NULL AND Model.Id=:modelId ORDER BY ECInstanceId`;
    }
    await this.sourceDb.withPreparedStatement(
      sql,
      async (statement: ECSqlStatement): Promise<void> => {
        statement.bindId("modelId", modelId);
        if (skipRootSubject) {
          statement.bindId("rootSubjectId", IModel.rootSubjectId);
        }
        while (DbResult.BE_SQLITE_ROW === statement.step()) {
          await this.exportElement(statement.getValue(0).getId());
        }
      }
    );
  }

  /** Export the sub-models directly below the specified model.
   * @note This method is called from [[exportChanges]] and [[exportAll]], so it only needs to be called directly when exporting a subset of an iModel.
   */
  public async exportSubModels(parentModelId: Id64String): Promise<void> {
    Logger.logTrace(loggerCategory, `exportSubModels(${parentModelId})`);
    const definitionModelIds: Id64String[] = [];
    const otherModelIds: Id64String[] = [];
    const sql = `SELECT ECInstanceId FROM ${Model.classFullName} WHERE ParentModel.Id=:parentModelId ORDER BY ECInstanceId`;
    this.sourceDb.withPreparedStatement(
      sql,
      (statement: ECSqlStatement): void => {
        statement.bindId("parentModelId", parentModelId);
        while (DbResult.BE_SQLITE_ROW === statement.step()) {
          const modelId: Id64String = statement.getValue(0).getId();
          const model: Model = this.sourceDb.models.getModel(modelId);
          if (model instanceof DefinitionModel) {
            definitionModelIds.push(modelId);
          } else {
            otherModelIds.push(modelId);
          }
        }
      }
    );
    // export DefinitionModels before other types of Models
    for (const definitionModelId of definitionModelIds) {
      await this.exportModel(definitionModelId);
    }
    for (const otherModelId of otherModelIds) {
      await this.exportModel(otherModelId);
    }
  }

  public static defaultsHooks: Pick<HookableTraverser, "onExportElement"> = {
    onExportElement(elemId, { load }) {
      // TODO could avoid a full load
      const elem = load();
      if (elem.classFullName === RecipeDefinitionElement.classFullName) {
        Logger.logInfo(
          loggerCategory,
          `Excluded RecipeDefinitionElement ${elemId} because wantTemplate=false`
        );
        return { result: "skip" };
      }
      return { result: "continue" };
    },
  };

  /** Export the specified element, its child elements (if applicable), and any owned ElementAspects.
   * @note This method is called from [[exportChanges]] and [[exportAll]], so it only needs to be called directly when exporting a subset of an iModel.
   */
  public async exportElement(elementId: Id64String): Promise<void> {
    if (!this.options.visitElements) {
      Logger.logTrace(
        loggerCategory,
        `visitElements=false, skipping exportElement(${elementId})`
      );
      return;
    }
    let isUpdate: boolean | undefined;
    if (undefined !== this._sourceDbChanges) {
      // is changeset information available?
      if (this._sourceDbChanges.element.insertIds.has(elementId)) {
        isUpdate = false;
      } else if (this._sourceDbChanges.element.updateIds.has(elementId)) {
        isUpdate = true;
      } else {
        // NOTE: This optimization assumes that the Element will change (LastMod) if an owned ElementAspect changes
        // NOTE: However, child elements may have changed without the parent changing
        return this.exportChildElements(elementId);
      }
    }
    Logger.logTrace(
      loggerCategory,
      `exportElement(${elementId})${this.getChangeOpSuffix(isUpdate)}`
    );
    // the order and `await`ing of calls beyond here is depended upon by the IModelTransformer for a current bug workaround
    const response = await this.onExportElement(elementId, {
      load: (opts) =>
        this.sourceDb.elements.getElement({
          id: elementId,
          ...opts,
        }),
    });
    if (!response || response.result === "continue") {
      await this.trackProgress();
      await this.exportElementAspects(elementId);
      return this.exportChildElements(elementId);
    }
  }

  /** Export the child elements of the specified element from the source iModel.
   * @note This method is called from [[exportChanges]] and [[exportAll]], so it only needs to be called directly when exporting a subset of an iModel.
   */
  public async exportChildElements(elementId: Id64String): Promise<void> {
    if (!this.options.visitElements) {
      Logger.logTrace(
        loggerCategory,
        `visitElements=false, skipping exportChildElements(${elementId})`
      );
      return;
    }
    const childElementIds: Id64String[] =
      this.sourceDb.elements.queryChildren(elementId);
    if (childElementIds.length > 0) {
      Logger.logTrace(loggerCategory, `exportChildElements(${elementId})`);
      for (const childElementId of childElementIds) {
        await this.exportElement(childElementId);
      }
    }
  }

  /** Export ElementAspects from the specified element from the source iModel. */
  private async exportElementAspects(elementId: Id64String): Promise<void> {
    const _uniqueAspects = await Promise.all(
      this.sourceDb.elements
        ._queryAspects(elementId, ElementUniqueAspect.classFullName, new Set())
        .map(async (uniqueAspect: ElementUniqueAspect) => {
          const isInsertChange =
            this._sourceDbChanges?.aspect.insertIds.has(uniqueAspect.id) ??
            false;
          const isUpdateChange =
            this._sourceDbChanges?.aspect.updateIds.has(uniqueAspect.id) ??
            false;
          const doExport =
            this._sourceDbChanges === undefined ||
            isInsertChange ||
            isUpdateChange;
          if (doExport) {
            const isKnownUpdate = this._sourceDbChanges
              ? isUpdateChange
              : undefined;
            await this.onExportElementUniqueAspect(
              uniqueAspect.id,
              // FIXME: avoid always loading
              { load: () => uniqueAspect, isUpdate: isKnownUpdate }
            );
            await this.trackProgress();
          }
        })
    );

    const _multiAspects = await Promise.all(
      this.sourceDb.elements
        ._queryAspects(elementId, ElementMultiAspect.classFullName, new Set())
        .map(async (a) =>
          // FIXME: don't load if not necessary
          this.onExportElementMultiAspect(a.id, { load: () => a })
        )
    );

    return this.trackProgress();
  }

  /** Exports all relationships that subclass from the specified base class.
   * @note This method is called from [[exportChanges]] and [[exportAll]], so it only needs to be called directly when exporting a subset of an iModel.
   */
  public async exportRelationships(
    baseRelClassFullName: string
  ): Promise<void> {
    if (!this.options.visitRelationships) {
      Logger.logTrace(
        loggerCategory,
        `visitRelationships=false, skipping exportRelationships()`
      );
      return;
    }
    Logger.logTrace(
      loggerCategory,
      `exportRelationships(${baseRelClassFullName})`
    );
    const sql = `SELECT ECInstanceId FROM ${baseRelClassFullName}`;
    await this.sourceDb.withPreparedStatement(
      sql,
      async (statement: ECSqlStatement): Promise<void> => {
        while (DbResult.BE_SQLITE_ROW === statement.step()) {
          const relInstanceId: Id64String = statement.getValue(0).getId();
          const relProps: RelationshipProps =
            this.sourceDb.relationships.getInstanceProps(
              baseRelClassFullName,
              relInstanceId
            );
          await this.exportRelationship(relProps.classFullName, relInstanceId); // must call exportRelationship using the actual classFullName, not baseRelClassFullName
        }
      }
    );
  }

  /** Export a relationship from the source iModel. */
  public async exportRelationship(
    relClassFullName: string,
    relInstanceId: Id64String
  ): Promise<void> {
    if (!this.options.visitRelationships) {
      Logger.logTrace(
        loggerCategory,
        `visitRelationships=false, skipping exportRelationship(${relClassFullName}, ${relInstanceId})`
      );
      return;
    }
    let isUpdate: boolean | undefined;
    if (undefined !== this._sourceDbChanges) {
      // is changeset information available?
      if (this._sourceDbChanges.relationship.insertIds.has(relInstanceId)) {
        isUpdate = false;
      } else if (
        this._sourceDbChanges.relationship.updateIds.has(relInstanceId)
      ) {
        isUpdate = true;
      } else {
        return; // not in changeset, don't export
      }
    }
    // passed changeset test, now apply standard exclusion rules
    Logger.logTrace(
      loggerCategory,
      `exportRelationship(${relClassFullName}, ${relInstanceId})`
    );
    await this.onExportRelationship(relInstanceId, relClassFullName, {
      load: () =>
        this.sourceDb.relationships.getInstance(
          relClassFullName,
          relInstanceId
        ),
      isUpdate,
    });
    await this.trackProgress();
  }

  /** Tracks incremental progress */
  private async trackProgress(): Promise<void> {
    this._progressCounter++;
    if (0 === this._progressCounter % this.options.progressInterval) {
      return this.onProgress();
    }
  }
}

function makeExcluder<
  HookKey extends Exclude<
  Extract<keyof HookableTraverser, `onExport${string}`>,
  "onExportFont" | "onExportSchema"
  >
>(exclusionSet: Set<Parameters<HookableTraverser[HookKey]>[0]>) {
  type ExcludedType = Parameters<HookableTraverser[HookKey]>[0];
  return (item: ExcludedType): HookResponse => {
    return { result: exclusionSet.has(item) ? "skip" : "continue" };
  };
}

export const makeElementExcluder = (ids: Set<Id64String>) =>
  makeExcluder<"onExportElement">(ids);

export function makeCodeSpecByNameExcluder(exclusionSet: Set<string>) {
  return (
    ...[, utils]: Parameters<HookableTraverser["onExportCodeSpec"]>
  ): HookResponse => {
    const codeSpec = utils.load();
    if (exclusionSet.has(codeSpec.name)) {
      Logger.logInfo(loggerCategory, `Excluding CodeSpec: ${codeSpec.name}`);
      return { result: "skip" };
    }
    return { result: "continue" };
  };
}

export function makeElementInCategoryExcluder(exclusionSet: Set<Id64String>) {
  return (
    ...[, utils]: Parameters<HookableTraverser["onExportElement"]>
  ): HookResponse => {
    const element = utils.load(); // TODO; could do a simple query instead of loading the full element
    if (
      element instanceof GeometricElement &&
      exclusionSet.has(element.category)
    ) {
      Logger.logInfo(
        loggerCategory,
        `Excluded element ${element.id} by Category`
      );
      return { result: "skip" };
    }
    return { result: "continue" };
  };
}

export function makeElementClassExcluder(setOfExcludedClassFullNames: Set<string>) {
  return (
    ...[, utils]: Parameters<HookableTraverser["onExportElement"]>
  ): HookResponse => {
    const element = utils.load(); // TODO; could do a simple query instead of loading the full element
    if (setOfExcludedClassFullNames.has(element.classFullName)) {
      Logger.logInfo(
        loggerCategory,
        `Excluded element ${element.id} by class: ${element.classFullName}`
      );
      return { result: "skip" };
    }
    return { result: "continue" };
  };
}

export function makeElementAspectClassExcluder(
  setOfExcludedAspectClassFullNames: Set<string>
) {
  return (
    ...[, utils]: Parameters<
    HookableTraverser[
      | "onExportElementUniqueAspect"
      | "onExportElementMultiAspect"]
    >
  ): HookResponse => {
    const aspect = utils.load(); // TODO; could do a simple query instead of loading full entity
    if (setOfExcludedAspectClassFullNames.has(aspect.classFullName)) {
      Logger.logInfo(
        loggerCategory,
        `Excluded ElementAspect by class: ${aspect.classFullName}`
      );
      return { result: "skip" };
    }
    return { result: "continue" };
  };
}

export function makeRelationshipClassExcluder(
  setOfExcludedRelationshipClassFullNames: Set<string>
) {
  return (
    ...[, relClassFullName]: Parameters<
    HookableTraverser["onExportRelationship"]
    >
  ): HookResponse => {
    if (setOfExcludedRelationshipClassFullNames.has(relClassFullName)) {
      Logger.logInfo(
        loggerCategory,
        `Excluded ElementAspect by class: ${relClassFullName}`
      );
      return { result: "skip" };
    }
    return { result: "continue" };
  };
}

class ChangedInstanceOps {
  public insertIds = new Set<Id64String>();
  public updateIds = new Set<Id64String>();
  public deleteIds = new Set<Id64String>();
  public addFromJson(
    val: IModelJsNative.ChangedInstanceOpsProps | undefined
  ): void {
    if (undefined !== val) {
      if (undefined !== val.insert && Array.isArray(val.insert)) {
        val.insert.forEach((id: Id64String) => this.insertIds.add(id));
      }
      if (undefined !== val.update && Array.isArray(val.update)) {
        val.update.forEach((id: Id64String) => this.updateIds.add(id));
      }
      if (undefined !== val.delete && Array.isArray(val.delete)) {
        val.delete.forEach((id: Id64String) => this.deleteIds.add(id));
      }
    }
  }
}

class ChangedInstanceIds {
  public codeSpec = new ChangedInstanceOps();
  public model = new ChangedInstanceOps();
  public element = new ChangedInstanceOps();
  public aspect = new ChangedInstanceOps();
  public relationship = new ChangedInstanceOps();
  public font = new ChangedInstanceOps();
  private constructor() { }

  public static async initialize(
    accessToken: AccessToken | undefined,
    iModel: BriefcaseDb,
    firstChangesetId: string
  ): Promise<ChangedInstanceIds> {
    const iModelId = iModel.iModelId;
    const first = (
      await IModelHost.hubAccess.queryChangeset({
        iModelId,
        changeset: { id: firstChangesetId },
        accessToken,
      })
    ).index;
    const end = (
      await IModelHost.hubAccess.queryChangeset({
        iModelId,
        changeset: { id: iModel.changeset.id },
        accessToken,
      })
    ).index;
    const changesets = await IModelHost.hubAccess.downloadChangesets({
      accessToken,
      iModelId,
      range: { first, end },
      targetDir: BriefcaseManager.getChangeSetsPath(iModelId),
    });

    const changedInstanceIds = new ChangedInstanceIds();
    changesets.forEach((changeset): void => {
      const changesetPath = changeset.pathname;
      const statusOrResult =
        iModel.nativeDb.extractChangedInstanceIdsFromChangeSet(changesetPath);
      if (undefined !== statusOrResult.error) {
        throw new IModelError(
          statusOrResult.error.status,
          "Error processing changeset"
        );
      }
      if ("" !== statusOrResult.result) {
        const result: IModelJsNative.ChangedInstanceIdsProps = JSON.parse(
          statusOrResult.result
        );
        changedInstanceIds.codeSpec.addFromJson(result.codeSpec);
        changedInstanceIds.model.addFromJson(result.model);
        changedInstanceIds.element.addFromJson(result.element);
        changedInstanceIds.aspect.addFromJson(result.aspect);
        changedInstanceIds.relationship.addFromJson(result.relationship);
        changedInstanceIds.font.addFromJson(result.font);
      }
    });
    return changedInstanceIds;
  }
}
