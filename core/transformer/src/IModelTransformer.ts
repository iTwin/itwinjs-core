/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */
import * as path from "path";
import * as Semver from "semver";
import { AccessToken, assert, DbResult, Guid, Id64, Id64Set, Id64String, IModelStatus, Logger, MarkRequired, OpenMode, YieldManager } from "@itwin/core-bentley";
import * as ECSchemaMetaData from "@itwin/ecschema-metadata";
import { Point3d, Transform } from "@itwin/core-geometry";
import {
  ChangeSummaryManager,
  ChannelRootAspect, DefinitionElement, DefinitionModel, DefinitionPartition, ECSqlStatement, Element, ElementAspect, ElementMultiAspect,
  ElementOwnsExternalSourceAspects, ElementRefersToElements, ElementUniqueAspect, Entity, ExternalSource, ExternalSourceAspect, ExternalSourceAttachment,
  FolderLink, GeometricElement2d, GeometricElement3d, IModelCloneContext, IModelDb, IModelHost, IModelJsFs, InformationPartitionElement, KnownLocations, Model,
  RecipeDefinitionElement, Relationship, RelationshipProps, Schema, SQLiteDb, Subject, SynchronizationConfigLink,
} from "@itwin/core-backend";
import {
  ChangeOpCode,
  Code, CodeSpec, ElementAspectProps, ElementProps, ExternalSourceAspectProps, FontProps, GeometricElement2dProps, GeometricElement3dProps, IModel,
  IModelError, ModelProps, Placement2d, Placement3d, PrimitiveTypeCode, PropertyMetaData, RelatedElement,
} from "@itwin/core-common";
import { IModelExporter, IModelExporterState, IModelExportHandler } from "./IModelExporter";
import { IModelImporter, IModelImporterState, OptimizeGeometryOptions } from "./IModelImporter";
import { TransformerLoggerCategory } from "./TransformerLoggerCategory";
import { PendingReferenceMap } from "./PendingReferenceMap";

const loggerCategory: string = TransformerLoggerCategory.IModelTransformer;

const nullLastProvenanceEntityInfo = {
  entityId: Id64.invalid,
  aspectId: Id64.invalid,
  aspectVersion: "",
  aspectKind: ExternalSourceAspect.Kind.Element,
};

/** Options provided to the [[IModelTransformer]] constructor.
 * @beta
 * @note if adding an option, you must explicitly add its serialization to [[IModelTransformer.saveStateToFile]]!
 */
export interface IModelTransformOptions {
  /** The Id of the Element in the **target** iModel that represents the **source** repository as a whole and scopes its [ExternalSourceAspect]($backend) instances.
   * When the goal is to consolidate multiple source iModels into a single target iModel, this option must be specified.
   */
  targetScopeElementId?: Id64String;

  /** Set to `true` if IModelTransformer should not record its provenance.
   * Provenance tracks a target element back to its corresponding source element and is essential for [[IModelTransformer.processChanges]] to work properly.
   * Turning off IModelTransformer provenance is really only relevant for producing snapshots or another one time transformations.
   * @note See the [[includeSourceProvenance]] option for determining whether existing source provenance is cloned into the target.
   * @note The default is `false` which means that new IModelTransformer provenance will be recorded.
   */
  noProvenance?: boolean;

  /** Set to `true` to clone existing source provenance into the target.
   * @note See the [[noProvenance]] option for determining whether new IModelTransformer provenance is recorded.
   * @note The default is `false` which means that existing provenance in the source will not be carried into the target.
   */
  includeSourceProvenance?: boolean;

  /** Flag that indicates that the target iModel was created by copying the source iModel.
   * This is common when the target iModel is intended to be a *branch* of the source iModel.
   * This *hint* is essential to properly initialize the source to target element mapping and to cause provenance to be recorded for future synchronizations.
   * @note This *hint* is typically only set for the first synchronization after the iModel was copied since every other synchronization can utilize the provenance.
   */
  wasSourceIModelCopiedToTarget?: boolean;

  /** Flag that indicates that the current source and target iModels are now synchronizing in the reverse direction from a prior synchronization.
   * The most common example is to first synchronize master to branch, make changes to the branch, and then reverse directions to synchronize from branch to master.
   * This means that the provenance on the (current) source is used instead.
   * @note This also means that only [[IModelTransformer.processChanges]] can detect deletes.
   */
  isReverseSynchronization?: boolean;

  /** Flag that indicates whether or not the transformation process needs to consider the source geometry before cloning/transforming.
   * For standard cases, it is not required to load the source GeometryStream in JavaScript since the cloning happens in native code.
   * Also, the target GeometryStream will be available in JavaScript prior to insert.
   * @note If the source geometry affects the class mapping or transformation logic, then this flag should be set to `true`. The default is `false`.
   * @see [IModelExporter.wantGeometry]($transformer)
   */
  loadSourceGeometry?: boolean;

  /** Flag that indicates whether or not the transformation process should clone using binary geometry.
   *
   * Prefer to never to set this flag. If you need geometry changes, instead override [[IModelTransformer.onTransformElement]]
   * and provide an [ElementGeometryBuilderParams]($backend) to the `elementGeometryBuilderParams`
   * property of [ElementProps]($common) instead, it is much faster. You can read geometry during the transformation by setting the
   * [[IModelTransformOptions.loadSourceGeometry]] property to `true`, and passing that to a [GeometryStreamIterator]($common)
   * @note this flag will be deprecated when `elementGeometryBuilderParams` is no longer an alpha API
   *
   * @default true
   */
  cloneUsingBinaryGeometry?: boolean;

  /** Flag that indicates that ids should be preserved while copying elements to the target
   * Intended only for pure-filter transforms, so you can keep parts of the source, while deleting others,
   * and element ids are guaranteed to be the same, (other entity ids are not, however)
   * @note The target must be empty.
   * @note It is invalid to insert elements during the transformation, do not use this with transformers that try to.
   * @note This does not preserve the ids of non-element entities such as link table relationships, or aspects, etc.
   * @default false
   * @beta
   */
  preserveElementIdsForFiltering?: boolean;

  /** The behavior to use when an element reference (id) is found stored as a reference on an element in the source,
   * but the referenced element does not actually exist in the source.
   * It is possible to craft an iModel with dangling references/invalidated relationships by, e.g., deleting certain
   * elements without fixing up references.
   *
   * @note "reject" will throw an error and reject the transformation upon finding this case.
   * @note "ignore" passes the issue down to consuming applications, iModels that have invalid element references
   *       like this can cause errors, and you should consider adding custom logic in your transformer to remove the
   *       reference depending on your use case.
   * @default "reject"
   * @beta
   * @deprecated use [[danglingReferencesBehavior]] instead, the use of the term *predecessors* was confusing and became inaccurate when the transformer could handle cycles
   */
  danglingPredecessorsBehavior?: "reject" | "ignore";

  /** The behavior to use when an element reference (id) is found stored as a reference on an element in the source,
   * but the referenced element does not actually exist in the source.
   * It is possible to craft an iModel with dangling references/invalidated relationships by, e.g., deleting certain
   * elements without fixing up references.
   *
   * @note "reject" will throw an error and reject the transformation upon finding this case.
   * @note "ignore" passes the issue down to consuming applications, iModels that have invalid element references
   *       like this can cause errors, and you should consider adding custom logic in your transformer to remove the
   *       reference depending on your use case.
   * @default "reject"
   * @beta
   */
  danglingReferencesBehavior?: "reject" | "ignore";

  /** If defined, options to be supplied to [[IModelImporter.optimizeGeometry]] by [[IModelTransformer.processChanges]] and [[IModelTransformer.processAll]]
   * as a post-processing step to optimize the geometry in the iModel.
   * @beta
   */
  optimizeGeometry?: OptimizeGeometryOptions;
}

/**
 * A container for tracking the state of a partially committed element and finalizing it when it's ready to be fully committed
 * @internal
 */
class PartiallyCommittedElement {
  public constructor(
    /**
     * A set of "model|element ++ ID64" pairs, e.g. `model0x11` or `element0x12`.
     * It is possible for the submodel of an element to be separately resolved from the actual element,
     * so its resolution must be tracked separately
     */
    private _missingReferences: Set<string>,
    private _onComplete: () => void
  ) {}
  public resolveReference(id: Id64String, isModelRef: boolean) {
    const key = PartiallyCommittedElement.makeReferenceKey(id, isModelRef);
    this._missingReferences.delete(key);
    if (this._missingReferences.size === 0) this._onComplete();
  }
  public static makeReferenceKey(id: Id64String, isModelRef: boolean) {
    return `${isModelRef ? "model" : "element"}${id}`;
  }
  public forceComplete() {
    this._onComplete();
  }
}

/**
 * A helper for checking the in-transformation processing state of an element,
 * whether it has been transformed, and if its submodel has been
 * @internal
 */
class ElementProcessState {
  public constructor(
    public elementId: string,
    /** whether or not this element needs to be processed */
    public needsElemImport: boolean,
    /** whether or not this element's submodel needs to be processed */
    public needsModelImport: boolean,
  ) {}
  public static fromElementAndTransformer(elementId: Id64String, transformer: IModelTransformer): ElementProcessState {
    // we don't need to load all of the props of the model to check if the model exists
    const dbHasModel = (db: IModelDb, id: Id64String) => db.withPreparedStatement("SELECT 1 FROM bis.Model WHERE ECInstanceId=? LIMIT 1", (stmt) => {
      stmt.bindId(1, id);
      const stepResult = stmt.step();
      if (stepResult === DbResult.BE_SQLITE_DONE) return false;
      if (stepResult === DbResult.BE_SQLITE_ROW) return true;
      else throw new IModelError(stepResult, "expected 1 or no rows");
    });
    const isSubModeled = dbHasModel(transformer.sourceDb, elementId);
    const idOfElemInTarget = transformer.context.findTargetElementId(elementId);
    const isElemInTarget = Id64.invalid !== idOfElemInTarget;
    const needsModelImport = isSubModeled && (!isElemInTarget || !dbHasModel(transformer.targetDb, idOfElemInTarget));
    return new ElementProcessState(elementId, !isElemInTarget, needsModelImport);
  }
  public get needsImport() { return this.needsElemImport || this.needsModelImport; }
}

/**
 * Apply a function to each Id64 in a supported container type of Id64s.
 * Currently only supports raw Id64String or RelatedElement-like objects containing an `id` property that is a Id64String,
 * which matches the possible containers of references in [Element.requiredReferenceKeys]($backend).
 * @internal
 */
function mapId64<R>(
  idContainer: Id64String | { id: Id64String } | undefined,
  func: (id: Id64String) => R
): R[] {
  const isId64String = (arg: any): arg is Id64String => {
    const isString = typeof arg === "string";
    assert(() => !isString || Id64.isValidId64(arg));
    return isString;
  };
  const isRelatedElem = (arg: any): arg is RelatedElement =>
    arg && typeof arg === "object" && "id" in arg;

  const results = [];

  // is a string if compressed or singular id64, but check for singular just checks if it's a string so do this test first
  if (idContainer === undefined) {
    // nothing
  } else if (isId64String(idContainer)) {
    results.push(func(idContainer));
  } else if (isRelatedElem(idContainer)) {
    results.push(func(idContainer.id));
  } else {
    throw Error([
      `Id64 container '${idContainer}' is unsupported.`,
      "Currently only singular Id64 strings or prop-like objects containing an 'id' property are supported.",
    ].join("\n"));
  }
  return results;
}

/** Arguments you can pass to [[IModelTransformer.initExternalSourceAspects]]
 * @beta
 */
export interface InitFromExternalSourceAspectsArgs {
  accessToken?: AccessToken;
  startChangesetId?: string;
}

/** Base class used to transform a source iModel into a different target iModel.
 * @see [iModel Transformation and Data Exchange]($docs/learning/transformer/index.md), [IModelExporter]($transformer), [IModelImporter]($transformer)
 * @beta
 */
export class IModelTransformer extends IModelExportHandler {
  /** The IModelExporter that will export from the source iModel. */
  public readonly exporter: IModelExporter;
  /** The IModelImporter that will import into the target iModel. */
  public readonly importer: IModelImporter;
  /** The normally read-only source iModel.
   * @note The source iModel will need to be read/write when provenance is being stored during a reverse synchronization.
   */
  public readonly sourceDb: IModelDb;
  /** The read/write target iModel. */
  public readonly targetDb: IModelDb;
  /** The IModelTransformContext for this IModelTransformer. */
  public readonly context: IModelCloneContext;
  /** The Id of the Element in the **target** iModel that represents the **source** repository as a whole and scopes its [ExternalSourceAspect]($backend) instances. */
  public get targetScopeElementId(): Id64String {
    return this._options.targetScopeElementId;
  }

  /** map of (unprocessed element, referencing processed element) pairs to the partially committed element that needs the reference resolved
   * and have some helper methods below for now */
  protected _pendingReferences = new PendingReferenceMap<PartiallyCommittedElement>();

  /** map of partially committed element ids to their partial commit progress */
  protected _partiallyCommittedElements = new Map<Id64String, PartiallyCommittedElement>();

  /** the options that were used to initialize this transformer */
  private readonly _options: MarkRequired<IModelTransformOptions, "targetScopeElementId" | "danglingReferencesBehavior">;

  /** Set if it can be determined whether this is the first source --> target synchronization. */
  private _isFirstSynchronization?: boolean;

  /** The element classes that are considered to define provenance in the iModel */
  public static get provenanceElementClasses(): (typeof Entity)[] {
    return [FolderLink, SynchronizationConfigLink, ExternalSource, ExternalSourceAttachment];
  }

  /** The element aspect classes that are considered to define provenance in the iModel */
  public static get provenanceElementAspectClasses(): (typeof Entity)[] {
    return [ExternalSourceAspect];
  }

  /** Construct a new IModelTransformer
   * @param source Specifies the source IModelExporter or the source IModelDb that will be used to construct the source IModelExporter.
   * @param target Specifies the target IModelImporter or the target IModelDb that will be used to construct the target IModelImporter.
   * @param options The options that specify how the transformation should be done.
   */
  public constructor(source: IModelDb | IModelExporter, target: IModelDb | IModelImporter, options?: IModelTransformOptions) {
    super();
    // initialize IModelTransformOptions
    this._options = {
      ...options,
      // non-falsy defaults
      cloneUsingBinaryGeometry: options?.cloneUsingBinaryGeometry ?? true,
      targetScopeElementId: options?.targetScopeElementId ?? IModel.rootSubjectId,
      // eslint-disable-next-line deprecation/deprecation
      danglingReferencesBehavior: options?.danglingReferencesBehavior ?? options?.danglingPredecessorsBehavior ?? "reject",
    };
    this._isFirstSynchronization = this._options.wasSourceIModelCopiedToTarget ? true : undefined;
    // initialize exporter and sourceDb
    if (source instanceof IModelDb) {
      this.exporter = new IModelExporter(source);
    } else {
      this.exporter = source;
    }
    this.sourceDb = this.exporter.sourceDb;
    this.exporter.registerHandler(this);
    this.exporter.wantGeometry = options?.loadSourceGeometry ?? false; // optimization to not load source GeometryStreams by default
    if (!this._options.includeSourceProvenance) { // clone provenance from the source iModel into the target iModel?
      IModelTransformer.provenanceElementClasses.forEach((cls) => this.exporter.excludeElementClass(cls.classFullName));
      IModelTransformer.provenanceElementAspectClasses.forEach((cls) => this.exporter.excludeElementAspectClass(cls.classFullName));
    }
    this.exporter.excludeElementAspectClass(ChannelRootAspect.classFullName); // Channel boundaries within the source iModel are not relevant to the target iModel
    this.exporter.excludeElementAspectClass("BisCore:TextAnnotationData"); // This ElementAspect is auto-created by the BisCore:TextAnnotation2d/3d element handlers
    // initialize importer and targetDb
    if (target instanceof IModelDb) {
      this.importer = new IModelImporter(target, { preserveElementIdsForFiltering: this._options.preserveElementIdsForFiltering });
    } else {
      this.importer = target;
      /* eslint-disable deprecation/deprecation */
      if (Boolean(this._options.preserveElementIdsForFiltering) !== this.importer.preserveElementIdsForFiltering) {
        Logger.logWarning(
          loggerCategory,
          [
            "A custom importer was passed as a target but its 'preserveElementIdsForFiltering' option is out of sync with the transformer's option.",
            "The custom importer target's option will be force updated to use the transformer's value.",
            "This behavior is deprecated and will be removed in a future version, throwing an error if they are out of sync.",
          ].join("\n")
        );
        this.importer.preserveElementIdsForFiltering = Boolean(this._options.preserveElementIdsForFiltering);
      }
      /* eslint-enable deprecation/deprecation */
    }
    this.targetDb = this.importer.targetDb;
    // initialize the IModelCloneContext
    this.context = new IModelCloneContext(this.sourceDb, this.targetDb);
  }

  /** Dispose any native resources associated with this IModelTransformer. */
  public dispose(): void {
    Logger.logTrace(loggerCategory, "dispose()");
    this.context.dispose();
  }

  /** Log current settings that affect IModelTransformer's behavior. */
  private logSettings(): void {
    Logger.logInfo(TransformerLoggerCategory.IModelExporter, `this.exporter.visitElements=${this.exporter.visitElements}`);
    Logger.logInfo(TransformerLoggerCategory.IModelExporter, `this.exporter.visitRelationships=${this.exporter.visitRelationships}`);
    Logger.logInfo(TransformerLoggerCategory.IModelExporter, `this.exporter.wantGeometry=${this.exporter.wantGeometry}`);
    Logger.logInfo(TransformerLoggerCategory.IModelExporter, `this.exporter.wantSystemSchemas=${this.exporter.wantSystemSchemas}`);
    Logger.logInfo(TransformerLoggerCategory.IModelExporter, `this.exporter.wantTemplateModels=${this.exporter.wantTemplateModels}`);
    Logger.logInfo(loggerCategory, `this.targetScopeElementId=${this.targetScopeElementId}`);
    Logger.logInfo(loggerCategory, `this._noProvenance=${this._options.noProvenance}`);
    Logger.logInfo(loggerCategory, `this._includeSourceProvenance=${this._options.includeSourceProvenance}`);
    Logger.logInfo(loggerCategory, `this._cloneUsingBinaryGeometry=${this._options.cloneUsingBinaryGeometry}`);
    Logger.logInfo(loggerCategory, `this._wasSourceIModelCopiedToTarget=${this._options.wasSourceIModelCopiedToTarget}`);
    Logger.logInfo(loggerCategory, `this._isReverseSynchronization=${this._options.isReverseSynchronization}`);
    Logger.logInfo(TransformerLoggerCategory.IModelImporter, `this.importer.autoExtendProjectExtents=${this.importer.options.autoExtendProjectExtents}`);
    Logger.logInfo(TransformerLoggerCategory.IModelImporter, `this.importer.simplifyElementGeometry=${this.importer.options.simplifyElementGeometry}`);
  }

  /** Return the IModelDb where IModelTransformer will store its provenance.
   * @note This will be [[targetDb]] except when it is a reverse synchronization. In that case it be [[sourceDb]].
   */
  public get provenanceDb(): IModelDb {
    return this._options.isReverseSynchronization ? this.sourceDb : this.targetDb;
  }

  /** Create an ExternalSourceAspectProps in a standard way for an Element in an iModel --> iModel transformation. */
  private initElementProvenance(sourceElementId: Id64String, targetElementId: Id64String): ExternalSourceAspectProps {
    const elementId = this._options.isReverseSynchronization ? sourceElementId : targetElementId;
    const aspectIdentifier = this._options.isReverseSynchronization ? targetElementId : sourceElementId;
    const aspectProps: ExternalSourceAspectProps = {
      classFullName: ExternalSourceAspect.classFullName,
      element: { id: elementId, relClassName: ElementOwnsExternalSourceAspects.classFullName },
      scope: { id: this.targetScopeElementId },
      identifier: aspectIdentifier,
      kind: ExternalSourceAspect.Kind.Element,
      version: this.sourceDb.elements.queryLastModifiedTime(sourceElementId),
    };
    aspectProps.id = this.queryExternalSourceAspectId(aspectProps);
    return aspectProps;
  }

  /** Create an ExternalSourceAspectProps in a standard way for a Relationship in an iModel --> iModel transformations.
   * The ExternalSourceAspect is meant to be owned by the Element in the target iModel that is the `sourceId` of transformed relationship.
   * The `identifier` property of the ExternalSourceAspect will be the ECInstanceId of the relationship in the source iModel.
   * The ECInstanceId of the relationship in the target iModel will be stored in the JsonProperties of the ExternalSourceAspect.
   */
  private initRelationshipProvenance(sourceRelationship: Relationship, targetRelInstanceId: Id64String): ExternalSourceAspectProps {
    const targetRelationship: Relationship = this.targetDb.relationships.getInstance(ElementRefersToElements.classFullName, targetRelInstanceId);
    const elementId = this._options.isReverseSynchronization ? sourceRelationship.sourceId : targetRelationship.sourceId;
    const aspectIdentifier = this._options.isReverseSynchronization ? targetRelInstanceId : sourceRelationship.id;
    const aspectProps: ExternalSourceAspectProps = {
      classFullName: ExternalSourceAspect.classFullName,
      element: { id: elementId, relClassName: ElementOwnsExternalSourceAspects.classFullName },
      scope: { id: this.targetScopeElementId },
      identifier: aspectIdentifier,
      kind: ExternalSourceAspect.Kind.Relationship,
      jsonProperties: JSON.stringify({ targetRelInstanceId }),
    };
    aspectProps.id = this.queryExternalSourceAspectId(aspectProps);
    return aspectProps;
  }

  private validateScopeProvenance(): void {
    const aspectProps: ExternalSourceAspectProps = {
      classFullName: ExternalSourceAspect.classFullName,
      element: { id: this.targetScopeElementId, relClassName: ElementOwnsExternalSourceAspects.classFullName },
      scope: { id: IModel.rootSubjectId }, // the root Subject scopes scope elements
      identifier: this._options.isReverseSynchronization ? this.targetDb.iModelId : this.sourceDb.iModelId, // the opposite side of where provenance is stored
      kind: ExternalSourceAspect.Kind.Scope,
    };
    aspectProps.id = this.queryExternalSourceAspectId(aspectProps); // this query includes "identifier"
    if (undefined === aspectProps.id) {
      // this query does not include "identifier" to find possible conflicts
      const sql = `SELECT ECInstanceId FROM ${ExternalSourceAspect.classFullName} WHERE Element.Id=:elementId AND Scope.Id=:scopeId AND Kind=:kind LIMIT 1`;
      const hasConflictingScope = this.provenanceDb.withPreparedStatement(sql, (statement: ECSqlStatement): boolean => {
        statement.bindId("elementId", aspectProps.element.id);
        statement.bindId("scopeId", aspectProps.scope.id);
        statement.bindString("kind", aspectProps.kind);
        return DbResult.BE_SQLITE_ROW === statement.step();
      });
      if (hasConflictingScope) {
        throw new IModelError(IModelStatus.InvalidId, "Provenance scope conflict");
      }
      if (!this._options.noProvenance) {
        this.provenanceDb.elements.insertAspect(aspectProps);
        this._isFirstSynchronization = true; // couldn't tell this is the first time without provenance
      }
    }
  }

  private queryExternalSourceAspectId(aspectProps: ExternalSourceAspectProps): Id64String | undefined {
    const sql = `SELECT ECInstanceId FROM ${ExternalSourceAspect.classFullName} WHERE Element.Id=:elementId AND Scope.Id=:scopeId AND Kind=:kind AND Identifier=:identifier LIMIT 1`;
    return this.provenanceDb.withPreparedStatement(sql, (statement: ECSqlStatement): Id64String | undefined => {
      statement.bindId("elementId", aspectProps.element.id);
      statement.bindId("scopeId", aspectProps.scope.id);
      statement.bindString("kind", aspectProps.kind);
      statement.bindString("identifier", aspectProps.identifier);
      return (DbResult.BE_SQLITE_ROW === statement.step()) ? statement.getValue(0).getId() : undefined;
    });
  }

  /** Iterate all matching ExternalSourceAspects in the provenance iModel (target unless reverse sync) and call a function for each one. */
  private forEachTrackedElement(fn: (sourceElementId: Id64String, targetElementId: Id64String) => void): void {
    if (!this.provenanceDb.containsClass(ExternalSourceAspect.classFullName)) {
      throw new IModelError(IModelStatus.BadSchema, "The BisCore schema version of the target database is too old");
    }
    const sql = `SELECT Identifier,Element.Id FROM ${ExternalSourceAspect.classFullName} WHERE Scope.Id=:scopeId AND Kind=:kind`;
    this.provenanceDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindId("scopeId", this.targetScopeElementId);
      statement.bindString("kind", ExternalSourceAspect.Kind.Element);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const aspectIdentifier: Id64String = statement.getValue(0).getString(); // ExternalSourceAspect.Identifier is of type string
        const elementId: Id64String = statement.getValue(1).getId();
        if (this._options.isReverseSynchronization) {
          fn(elementId, aspectIdentifier); // provenance coming from the sourceDb
        } else {
          fn(aspectIdentifier, elementId); // provenance coming from the targetDb
        }
      }
    });
  }

  /** Initialize the source to target Element mapping from ExternalSourceAspects in the target iModel.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   * @note Passing an [[InitFromExternalSourceAspectsArgs]] is required when processing changes, to remap any elements that may have been deleted.
   *       You must await the returned promise as well in this case. The synchronous behavior has not changed but is deprecated and won't process everything.
   */
  public initFromExternalSourceAspects(args?: InitFromExternalSourceAspectsArgs): Promise<void>;
  /** @deprecated returning void is deprecated, return a promise, and handle returned promises appropriately */
  public initFromExternalSourceAspects(): void;
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  public initFromExternalSourceAspects(args?: InitFromExternalSourceAspectsArgs): void | Promise<void> {
    this.forEachTrackedElement((sourceElementId: Id64String, targetElementId: Id64String) => {
      this.context.remapElement(sourceElementId, targetElementId);
    });
    if (args) return this.remapDeletedSourceElements(args);
  }

  /** When processing deleted elements in a reverse synchronization, the [[provenanceDb]] (usually a branch iModel) has already
   * deleted the [ExternalSourceAspect]($backend)s that tell us which elements in the reverse synchronization target (usually
   * a master iModel) should be deleted. We must use the changesets to get the values of those before they were deleted.
   */
  private async remapDeletedSourceElements(args: InitFromExternalSourceAspectsArgs) {
    // we need a connected iModel with changes to remap elements with deletions
    if (this.sourceDb.iTwinId === undefined) return;

    try {
      const startChangesetId = args.startChangesetId ?? this.sourceDb.changeset.id;
      const firstChangesetIndex = (
        await IModelHost.hubAccess.queryChangeset({
          iModelId: this.sourceDb.iModelId,
          changeset: { id: startChangesetId },
          accessToken: args.accessToken,
        })
      ).index;
      const changesetIds = await ChangeSummaryManager.createChangeSummaries({
        accessToken: args.accessToken,
        iModelId: this.sourceDb.iModelId,
        iTwinId: this.sourceDb.iTwinId,
        range: { first: firstChangesetIndex },
      });

      ChangeSummaryManager.attachChangeCache(this.sourceDb);
      for (const changesetId of changesetIds) {
        this.sourceDb.withPreparedStatement(
          `
          SELECT esac.Element.Id, esac.Identifier
          FROM ecchange.change.InstanceChange ic
          JOIN BisCore.ExternalSourceAspect.Changes(:changesetId, 'BeforeDelete') esac
            ON ic.ChangedInstance.Id=esac.ECInstanceId
          WHERE ic.OpCode=:opcode
            AND ic.Summary.Id=:changesetId
            AND esac.Scope.Id=:targetScopeElementId
            -- not yet documented ecsql feature to check class id
            AND ic.ChangedInstance.ClassId IS (ONLY BisCore.ExternalSourceAspect)
          `,
          (stmt) => {
            stmt.bindInteger("opcode", ChangeOpCode.Delete);
            stmt.bindInteger("changesetId", changesetId);
            stmt.bindInteger("targetScopeElementId", this.targetScopeElementId);
            while (DbResult.BE_SQLITE_ROW === stmt.step()) {
              const targetId = stmt.getValue(0).getId();
              const sourceId: Id64String = stmt.getValue(1).getString(); // BisCore.ExternalSourceAspect.Identifier stores a hex Id64String
              // TODO: maybe delete and don't just remap
              this.context.remapElement(targetId, sourceId);
            }
          }
        );
      }
    } finally {
      if (ChangeSummaryManager.isChangeCacheAttached(this.sourceDb))
        ChangeSummaryManager.detachChangeCache(this.sourceDb);
    }
  }

  /** Returns `true` if *brute force* delete detections should be run.
   * @note Not relevant for processChanges when change history is known.
   */
  private shouldDetectDeletes(): boolean {
    if (this._isFirstSynchronization) return false; // not necessary the first time since there are no deletes to detect
    if (this._options.isReverseSynchronization) return false; // not possible for a reverse synchronization since provenance will be deleted when element is deleted
    return true;
  }

  /** Detect Element deletes using ExternalSourceAspects in the target iModel and a *brute force* comparison against Elements in the source iModel.
   * @see processChanges
   * @note This method is called from [[processAll]] and is not needed by [[processChanges]], so it only needs to be called directly when processing a subset of an iModel.
   * @throws [[IModelError]] If the required provenance information is not available to detect deletes.
   */
  public async detectElementDeletes(): Promise<void> {
    if (this._options.isReverseSynchronization) {
      throw new IModelError(IModelStatus.BadRequest, "Cannot detect deletes when isReverseSynchronization=true");
    }
    const targetElementsToDelete: Id64String[] = [];
    this.forEachTrackedElement((sourceElementId: Id64String, targetElementId: Id64String) => {
      if (undefined === this.sourceDb.elements.tryGetElementProps(sourceElementId)) {
        // if the sourceElement is not found, then it must have been deleted, so propagate the delete to the target iModel
        targetElementsToDelete.push(targetElementId);
      }
    });
    targetElementsToDelete.forEach((targetElementId: Id64String) => {
      this.importer.deleteElement(targetElementId);
    });
  }

  /** This no longer has any effect except emitting a warning
   * @deprecated
   */
  protected skipElement(_sourceElement: Element): void {
    Logger.logWarning(loggerCategory, `Tried to defer/skip an element, which is no longer necessary`);
  }

  /** Transform the specified sourceElement into ElementProps for the target iModel.
   * @param sourceElement The Element from the source iModel to transform.
   * @returns ElementProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
   * @note This can be called more than once for an element in arbitrary order, so it should not have side-effects.
   */
  public onTransformElement(sourceElement: Element): ElementProps {
    Logger.logTrace(loggerCategory, `onTransformElement(${sourceElement.id}) "${sourceElement.getDisplayLabel()}"`);
    const targetElementProps: ElementProps = this.context.cloneElement(sourceElement, { binaryGeometry: this._options.cloneUsingBinaryGeometry });
    if (sourceElement instanceof Subject) {
      if (targetElementProps.jsonProperties?.Subject?.Job) {
        // don't propagate source channels into target (legacy bridge case)
        targetElementProps.jsonProperties.Subject.Job = undefined;
      }
    }
    return targetElementProps;
  }

  /** Returns true if a change within sourceElement is detected.
   * @param sourceElement The Element from the source iModel
   * @param targetElementId The Element from the target iModel to compare against.
   * @note A subclass can override this method to provide custom change detection behavior.
   */
  protected hasElementChanged(sourceElement: Element, targetElementId: Id64String): boolean {
    const aspects: ElementAspect[] = this.targetDb.elements.getAspects(targetElementId, ExternalSourceAspect.classFullName);
    for (const aspect of aspects) {
      const sourceAspect = aspect as ExternalSourceAspect;
      if ((sourceAspect.identifier === sourceElement.id) && (sourceAspect.scope.id === this.targetScopeElementId) && (sourceAspect.kind === ExternalSourceAspect.Kind.Element)) {
        const lastModifiedTime: string = sourceElement.iModel.elements.queryLastModifiedTime(sourceElement.id);
        return (lastModifiedTime !== sourceAspect.version);
      }
    }
    return true;
  }

  /** callback to perform when a partial element says it's ready to be completed
   * transforms the source element with all references now valid, then updates the partial element with the results
   */
  private makePartialElementCompleter(sourceElem: Element) {
    return () => {
      const sourceElemId = sourceElem.id;
      const targetElemId = this.context.findTargetElementId(sourceElem.id);
      if (targetElemId === Id64.invalid)
        throw Error(`${sourceElemId} has not been inserted into the target, a completer cannot be made for it. This is a bug.`);
      const targetElemProps = this.onTransformElement(sourceElem);
      this.targetDb.elements.updateElement({...targetElemProps, id: targetElemId});
      this._partiallyCommittedElements.delete(sourceElemId);
    };
  }

  /** collect references this element has that are yet to be mapped, and if necessary create a
   * PartiallyCommittedElement for it to track resolution of unmapped references
   */
  private collectUnmappedReferences(element: Element) {
    const missingReferences = new Set<string>();
    let thisPartialElem: PartiallyCommittedElement | undefined;

    for (const referenceId of element.getReferenceIds()) {
      const referenceState = ElementProcessState.fromElementAndTransformer(referenceId, this);
      if (!referenceState.needsImport) continue;
      Logger.logTrace(loggerCategory, `Deferred resolution of reference '${referenceId}' of element '${element.id}'`);
      // TODO: instead of loading the entire element run a small has query
      const reference = this.sourceDb.elements.tryGetElement(referenceId);
      if (reference === undefined) {
        Logger.logWarning(loggerCategory, `Source element (${element.id}) "${element.getDisplayLabel()}" has a dangling reference (${referenceId})`);
        switch (this._options.danglingReferencesBehavior) {
          case "ignore":
            continue;
          case "reject":
            throw new IModelError(
              IModelStatus.NotFound,
              [
                `Found a reference to an element "${referenceId}" that doesn't exist while looking for references of "${element.id}".`,
                "This must have been caused by an upstream application that changed the iModel.",
                "You can set the IModelTransformerOptions.danglingReferencesBehavior option to 'ignore' to ignore this, but this will leave the iModel",
                "in a state where downstream consuming applications will need to handle the invalidity themselves. In some cases, writing a custom",
                "transformer to remove the reference and fix affected elements may be suitable.",
              ].join("\n")
            );
        }
      }
      if (thisPartialElem === undefined) {
        thisPartialElem = new PartiallyCommittedElement(missingReferences, this.makePartialElementCompleter(element));
        if (!this._partiallyCommittedElements.has(element.id))
          this._partiallyCommittedElements.set(element.id, thisPartialElem);
      }
      if (referenceState.needsModelImport) {
        missingReferences.add(PartiallyCommittedElement.makeReferenceKey(referenceId, true));
        this._pendingReferences.set({referenced: referenceId, referencer: element.id, isModelRef: true}, thisPartialElem);
      }
      if (referenceState.needsElemImport) {
        missingReferences.add(PartiallyCommittedElement.makeReferenceKey(referenceId, false));
        this._pendingReferences.set({referenced: referenceId, referencer: element.id, isModelRef: false}, thisPartialElem);
      }
    }
  }

  /** Cause the specified Element and its child Elements (if applicable) to be exported from the source iModel and imported into the target iModel.
   * @param sourceElementId Identifies the Element from the source iModel to import.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processElement(sourceElementId: Id64String): Promise<void> {
    if (sourceElementId === IModel.rootSubjectId) {
      throw new IModelError(IModelStatus.BadRequest, "The root Subject should not be directly imported");
    }
    return this.exporter.exportElement(sourceElementId);
  }

  /** Import child elements into the target IModelDb
   * @param sourceElementId Import the child elements of this element in the source IModelDb.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processChildElements(sourceElementId: Id64String): Promise<void> {
    return this.exporter.exportChildElements(sourceElementId);
  }

  /** Override of [IModelExportHandler.shouldExportElement]($transformer) that is called to determine if an element should be exported from the source iModel.
   * @note Reaching this point means that the element has passed the standard exclusion checks in IModelExporter.
   */
  public override shouldExportElement(_sourceElement: Element): boolean { return true; }

  /**
   * If they haven't been already, import all of the required references
   * @internal do not call, override or implement this, it will be removed
   */
  public override async preExportElement(sourceElement: Element): Promise<void> {
    const elemClass = sourceElement.constructor as typeof Element;

    const unresolvedReferencesProcessStates = elemClass.requiredReferenceKeys
      .map((referenceKey) => {
        const idContainer = sourceElement[referenceKey as keyof Element];
        return mapId64(idContainer, (id) => {
          if (id === Id64.invalid || id === IModel.rootSubjectId) return; // not allowed to directly export the root subject
          if (!this.context.isBetweenIModels) {
            // Within the same iModel, can use existing DefinitionElements without remapping
            // This is relied upon by the TemplateModelCloner
            // TODO: extract this out to only be in the TemplateModelCloner
            const asDefinitionElem = this.sourceDb.elements.tryGetElement(id, DefinitionElement);
            if (asDefinitionElem && !(asDefinitionElem instanceof RecipeDefinitionElement)) {
              this.context.remapElement(id, id);
            }
          }
          return ElementProcessState.fromElementAndTransformer(id, this);
        });
      })
      .flat()
      .filter((maybeProcessState): maybeProcessState is ElementProcessState =>
        maybeProcessState !== undefined && maybeProcessState.needsImport
      );

    if (unresolvedReferencesProcessStates.length > 0) {
      for (const processState of unresolvedReferencesProcessStates) {
        // must export element first if not done so
        if (processState.needsElemImport) await this.exporter.exportElement(processState.elementId);
        if (processState.needsModelImport) await this.exporter.exportModel(processState.elementId);
      }
    }
  }

  /** Override of [IModelExportHandler.onExportElement]($transformer) that imports an element into the target iModel when it is exported from the source iModel.
   * This override calls [[onTransformElement]] and then [IModelImporter.importElement]($transformer) to update the target iModel.
   */
  public override onExportElement(sourceElement: Element): void {
    let targetElementId: Id64String | undefined;
    let targetElementProps: ElementProps;
    if (this._options.preserveElementIdsForFiltering) {
      targetElementId = sourceElement.id;
      targetElementProps = this.onTransformElement(sourceElement);
    } else if (this._options.wasSourceIModelCopiedToTarget) {
      targetElementId = sourceElement.id;
      targetElementProps = this.targetDb.elements.getElementProps(targetElementId);
    } else {
      targetElementId = this.context.findTargetElementId(sourceElement.id);
      targetElementProps = this.onTransformElement(sourceElement);
    }
    // if an existing remapping was not yet found, check by Code as long as the CodeScope is valid (invalid means a missing reference so not worth checking)
    if (!Id64.isValidId64(targetElementId) && Id64.isValidId64(targetElementProps.code.scope)) {
      targetElementId = this.targetDb.elements.queryElementIdByCode(new Code(targetElementProps.code));
      if (undefined !== targetElementId) {
        const targetElement: Element = this.targetDb.elements.getElement(targetElementId);
        if (targetElement.classFullName === targetElementProps.classFullName) { // ensure code remapping doesn't change the target class
          this.context.remapElement(sourceElement.id, targetElementId); // record that the targeElement was found by Code
        } else {
          targetElementId = undefined;
          targetElementProps.code = Code.createEmpty(); // clear out invalid code
        }
      }
    }
    if (undefined !== targetElementId && Id64.isValidId64(targetElementId)) {
      // compare LastMod of sourceElement to ExternalSourceAspect of targetElement to see there are changes to import
      if (!this.hasElementChanged(sourceElement, targetElementId)) {
        return;
      }
    }

    this.collectUnmappedReferences(sourceElement);

    // TODO: untangle targetElementId state...
    if (targetElementId === Id64.invalid)
      targetElementId = undefined;

    targetElementProps.id = targetElementId; // targetElementId will be valid (indicating update) or undefined (indicating insert)
    if (!this._options.wasSourceIModelCopiedToTarget) {
      this.importer.importElement(targetElementProps); // don't need to import if iModel was copied
    }
    this.context.remapElement(sourceElement.id, targetElementProps.id!); // targetElementProps.id assigned by importElement

    // now that we've mapped this elem we can fix unmapped references to it
    for (const referencer of this._pendingReferences.getReferencers(sourceElement.id)) {
      const isModelRef = false; // we're in onExportElement so no
      const key = {referencer, referenced: sourceElement.id, isModelRef};
      const pendingRef = this._pendingReferences.get(key);
      if (!pendingRef) continue;
      pendingRef.resolveReference(sourceElement.id, isModelRef);
      this._pendingReferences.delete(key);
    }

    if (!this._options.noProvenance) {
      const aspectProps: ExternalSourceAspectProps = this.initElementProvenance(sourceElement.id, targetElementProps.id!);
      if (aspectProps.id === undefined) {
        this.provenanceDb.elements.insertAspect(aspectProps);
        aspectProps.id = this.queryExternalSourceAspectId(aspectProps);
      } else {
        this.provenanceDb.elements.updateAspect(aspectProps);
      }
      assert(aspectProps.id !== undefined);
      this.markLastProvenance(aspectProps as MarkRequired<ExternalSourceAspectProps, "id">, { isRelationship: false });
    }
  }

  /** Override of [IModelExportHandler.onDeleteElement]($transformer) that is called when [IModelExporter]($transformer) detects that an Element has been deleted from the source iModel.
   * This override propagates the delete to the target iModel via [IModelImporter.deleteElement]($transformer).
   */
  public override onDeleteElement(sourceElementId: Id64String): void {
    const targetElementId: Id64String = this.context.findTargetElementId(sourceElementId);
    if (Id64.isValidId64(targetElementId)) {
      this.importer.deleteElement(targetElementId);
    }
  }

  /** Override of [IModelExportHandler.onExportModel]($transformer) that is called when a Model should be exported from the source iModel.
   * This override calls [[onTransformModel]] and then [IModelImporter.importModel]($transformer) to update the target iModel.
   */
  public override onExportModel(sourceModel: Model): void {
    if (IModel.repositoryModelId === sourceModel.id) {
      return; // The RepositoryModel should not be directly imported
    }
    const targetModeledElementId: Id64String = this.context.findTargetElementId(sourceModel.id);
    const targetModelProps: ModelProps = this.onTransformModel(sourceModel, targetModeledElementId);
    this.importer.importModel(targetModelProps);
    for (const referencer of this._pendingReferences.getReferencers(sourceModel.id)) {
      const isModelRef = true; // we're in onExportModel so yes
      const key = { referencer, referenced: sourceModel.id, isModelRef };
      const pendingRef = this._pendingReferences.get(key);
      if (!pendingRef) continue;
      pendingRef.resolveReference(sourceModel.id, isModelRef);
      this._pendingReferences.delete(key);
    }
  }

  /** Override of [IModelExportHandler.onDeleteModel]($transformer) that is called when [IModelExporter]($transformer) detects that a [Model]($backend) has been deleted from the source iModel. */
  public override onDeleteModel(sourceModelId: Id64String): void {
    // It is possible and apparently occasionally sensical to delete a model without deleting its underlying element.
    // - If only the model is deleted, [[initFromExternalSourceAspects]] will have already remapped the underlying element since it still exists.
    // - If both were deleted, [[remapDeletedSourceElements]] will find and remap the deleted element making this operation valid
    const targetModelId: Id64String = this.context.findTargetElementId(sourceModelId);
    if (Id64.isValidId64(targetModelId)) {
      this.importer.deleteModel(targetModelId);
    }
  }

  /** Cause the model container, contents, and sub-models to be exported from the source iModel and imported into the target iModel.
   * @param sourceModeledElementId Import this [Model]($backend) from the source IModelDb.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processModel(sourceModeledElementId: Id64String): Promise<void> {
    return this.exporter.exportModel(sourceModeledElementId);
  }

  /** Cause the model contents to be exported from the source iModel and imported into the target iModel.
   * @param sourceModelId Import the contents of this model from the source IModelDb.
   * @param targetModelId Import into this model in the target IModelDb. The target model must exist prior to this call.
   * @param elementClassFullName Optional classFullName of an element subclass to limit import query against the source model.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processModelContents(sourceModelId: Id64String, targetModelId: Id64String, elementClassFullName: string = Element.classFullName): Promise<void> {
    this.targetDb.models.getModel(targetModelId); // throws if Model does not exist
    this.context.remapElement(sourceModelId, targetModelId); // set remapping in case importModelContents is called directly
    return this.exporter.exportModelContents(sourceModelId, elementClassFullName);
  }

  /** Cause all sub-models that recursively descend from the specified Subject to be exported from the source iModel and imported into the target iModel. */
  private async processSubjectSubModels(sourceSubjectId: Id64String): Promise<void> {
    // import DefinitionModels first
    const childDefinitionPartitionSql = `SELECT ECInstanceId FROM ${DefinitionPartition.classFullName} WHERE Parent.Id=:subjectId`;
    await this.sourceDb.withPreparedStatement(childDefinitionPartitionSql, async (statement: ECSqlStatement) => {
      statement.bindId("subjectId", sourceSubjectId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        await this.processModel(statement.getValue(0).getId());
      }
    });
    // import other partitions next
    const childPartitionSql = `SELECT ECInstanceId FROM ${InformationPartitionElement.classFullName} WHERE Parent.Id=:subjectId`;
    await this.sourceDb.withPreparedStatement(childPartitionSql, async (statement: ECSqlStatement) => {
      statement.bindId("subjectId", sourceSubjectId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const modelId: Id64String = statement.getValue(0).getId();
        const model: Model = this.sourceDb.models.getModel(modelId);
        if (!(model instanceof DefinitionModel)) {
          await this.processModel(modelId);
        }
      }
    });
    // recurse into child Subjects
    const childSubjectSql = `SELECT ECInstanceId FROM ${Subject.classFullName} WHERE Parent.Id=:subjectId`;
    await this.sourceDb.withPreparedStatement(childSubjectSql, async (statement: ECSqlStatement) => {
      statement.bindId("subjectId", sourceSubjectId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        await this.processSubjectSubModels(statement.getValue(0).getId());
      }
    });
  }

  /** Transform the specified sourceModel into ModelProps for the target iModel.
   * @param sourceModel The Model from the source iModel to be transformed.
   * @param targetModeledElementId The transformed Model will *break down* or *detail* this Element in the target iModel.
   * @returns ModelProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
   */
  public onTransformModel(sourceModel: Model, targetModeledElementId: Id64String): ModelProps {
    const targetModelProps: ModelProps = sourceModel.toJSON();
    // don't directly edit deep object since toJSON performs a shallow clone
    targetModelProps.modeledElement = { ...targetModelProps.modeledElement, id: targetModeledElementId };
    targetModelProps.id = targetModeledElementId;
    targetModelProps.parentModel = this.context.findTargetElementId(targetModelProps.parentModel!);
    return targetModelProps;
  }

  /** Import elements that were deferred in a prior pass.
   * @deprecated This method is no longer necessary since the transformer no longer needs to defer elements
   */
  public async processDeferredElements(_numRetries: number = 3): Promise<void> {}

  private finalizeTransformation() {
    if (this._partiallyCommittedElements.size > 0) {
      Logger.logWarning(
        loggerCategory,
        [
          "The following elements were never fully resolved:",
          [...this._partiallyCommittedElements.keys()].join(","),
          "This indicates that either some references were excluded from the transformation",
          "or the source has dangling references.",
        ].join("\n")
      );
      for (const partiallyCommittedElem of this._partiallyCommittedElements.values()) {
        partiallyCommittedElem.forceComplete();
      }
    }
  }

  /** Imports all relationships that subclass from the specified base class.
   * @param baseRelClassFullName The specified base relationship class.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processRelationships(baseRelClassFullName: string): Promise<void> {
    return this.exporter.exportRelationships(baseRelClassFullName);
  }

  /** Override of [IModelExportHandler.shouldExportRelationship]($transformer) that is called to determine if a [Relationship]($backend) should be exported.
   * @note Reaching this point means that the relationship has passed the standard exclusion checks in [IModelExporter]($transformer).
   */
  public override shouldExportRelationship(_sourceRelationship: Relationship): boolean { return true; }

  /** Override of [IModelExportHandler.onExportRelationship]($transformer) that imports a relationship into the target iModel when it is exported from the source iModel.
   * This override calls [[onTransformRelationship]] and then [IModelImporter.importRelationship]($transformer) to update the target iModel.
   */
  public override onExportRelationship(sourceRelationship: Relationship): void {
    const targetRelationshipProps: RelationshipProps = this.onTransformRelationship(sourceRelationship);
    const targetRelationshipInstanceId: Id64String = this.importer.importRelationship(targetRelationshipProps);
    if (!this._options.noProvenance && Id64.isValidId64(targetRelationshipInstanceId)) {
      const aspectProps: ExternalSourceAspectProps = this.initRelationshipProvenance(sourceRelationship, targetRelationshipInstanceId);
      if (undefined === aspectProps.id) {
        this.provenanceDb.elements.insertAspect(aspectProps);
        aspectProps.id = this.queryExternalSourceAspectId(aspectProps);
      }
      assert(aspectProps.id !== undefined);
      this.markLastProvenance(aspectProps as MarkRequired<ExternalSourceAspectProps, "id">, { isRelationship: true });
    }
  }

  /** Override of [IModelExportHandler.onDeleteRelationship]($transformer) that is called when [IModelExporter]($transformer) detects that a [Relationship]($backend) has been deleted from the source iModel.
   * This override propagates the delete to the target iModel via [IModelImporter.deleteRelationship]($transformer).
   */
  public override onDeleteRelationship(sourceRelInstanceId: Id64String): void {
    const sql = `SELECT ECInstanceId,JsonProperties FROM ${ExternalSourceAspect.classFullName} aspect` +
      ` WHERE aspect.Scope.Id=:scopeId AND aspect.Kind=:kind AND aspect.Identifier=:identifier LIMIT 1`;
    this.targetDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindId("scopeId", this.targetScopeElementId);
      statement.bindString("kind", ExternalSourceAspect.Kind.Relationship);
      statement.bindString("identifier", sourceRelInstanceId);
      if (DbResult.BE_SQLITE_ROW === statement.step()) {
        const json: any = JSON.parse(statement.getValue(1).getString());
        if (undefined !== json.targetRelInstanceId) {
          const targetRelationship = this.targetDb.relationships.tryGetInstance(ElementRefersToElements.classFullName, json.targetRelInstanceId);
          if (targetRelationship) {
            this.importer.deleteRelationship(targetRelationship.toJSON());
          }
          this.targetDb.elements.deleteAspect(statement.getValue(0).getId());
        }
      }
    });
  }

  private _yieldManager = new YieldManager();

  /** Detect Relationship deletes using ExternalSourceAspects in the target iModel and a *brute force* comparison against relationships in the source iModel.
   * @see processChanges
   * @note This method is called from [[processAll]] and is not needed by [[processChanges]], so it only needs to be called directly when processing a subset of an iModel.
   * @throws [[IModelError]] If the required provenance information is not available to detect deletes.
   */
  public async detectRelationshipDeletes(): Promise<void> {
    if (this._options.isReverseSynchronization) {
      throw new IModelError(IModelStatus.BadRequest, "Cannot detect deletes when isReverseSynchronization=true");
    }
    const aspectDeleteIds: Id64String[] = [];
    const sql = `SELECT ECInstanceId,Identifier,JsonProperties FROM ${ExternalSourceAspect.classFullName} aspect WHERE aspect.Scope.Id=:scopeId AND aspect.Kind=:kind`;
    await this.targetDb.withPreparedStatement(sql, async (statement: ECSqlStatement) => {
      statement.bindId("scopeId", this.targetScopeElementId);
      statement.bindString("kind", ExternalSourceAspect.Kind.Relationship);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const sourceRelInstanceId: Id64String = Id64.fromJSON(statement.getValue(1).getString());
        if (undefined === this.sourceDb.relationships.tryGetInstanceProps(ElementRefersToElements.classFullName, sourceRelInstanceId)) {
          const json: any = JSON.parse(statement.getValue(2).getString());
          if (undefined !== json.targetRelInstanceId) {
            const targetRelationship: Relationship = this.targetDb.relationships.getInstance(ElementRefersToElements.classFullName, json.targetRelInstanceId);
            this.importer.deleteRelationship(targetRelationship.toJSON());
          }
          aspectDeleteIds.push(statement.getValue(0).getId());
        }
        await this._yieldManager.allowYield();
      }
    });
    this.targetDb.elements.deleteAspect(aspectDeleteIds);
  }

  /** Transform the specified sourceRelationship into RelationshipProps for the target iModel.
   * @param sourceRelationship The Relationship from the source iModel to be transformed.
   * @returns RelationshipProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
   */
  protected onTransformRelationship(sourceRelationship: Relationship): RelationshipProps {
    const targetRelationshipProps: RelationshipProps = sourceRelationship.toJSON();
    targetRelationshipProps.sourceId = this.context.findTargetElementId(sourceRelationship.sourceId);
    targetRelationshipProps.targetId = this.context.findTargetElementId(sourceRelationship.targetId);
    sourceRelationship.forEachProperty((propertyName: string, propertyMetaData: PropertyMetaData) => {
      if ((PrimitiveTypeCode.Long === propertyMetaData.primitiveType) && ("Id" === propertyMetaData.extendedType)) {
        (targetRelationshipProps as any)[propertyName] = this.context.findTargetElementId(sourceRelationship.asAny[propertyName]);
      }
    });
    return targetRelationshipProps;
  }

  /** Override of [IModelExportHandler.onExportElementUniqueAspect]($transformer) that imports an ElementUniqueAspect into the target iModel when it is exported from the source iModel.
   * This override calls [[onTransformElementAspect]] and then [IModelImporter.importElementUniqueAspect]($transformer) to update the target iModel.
   */
  public override onExportElementUniqueAspect(sourceAspect: ElementUniqueAspect): void {
    const targetElementId: Id64String = this.context.findTargetElementId(sourceAspect.element.id);
    const targetAspectProps: ElementAspectProps = this.onTransformElementAspect(sourceAspect, targetElementId);
    this.importer.importElementUniqueAspect(targetAspectProps);
  }

  /** Override of [IModelExportHandler.onExportElementMultiAspects]($transformer) that imports ElementMultiAspects into the target iModel when they are exported from the source iModel.
   * This override calls [[onTransformElementAspect]] for each ElementMultiAspect and then [IModelImporter.importElementMultiAspects]($transformer) to update the target iModel.
   * @note ElementMultiAspects are handled as a group to make it easier to differentiate between insert, update, and delete.
   */
  public override onExportElementMultiAspects(sourceAspects: ElementMultiAspect[]): void {
    const targetElementId: Id64String = this.context.findTargetElementId(sourceAspects[0].element.id);
    // Transform source ElementMultiAspects into target ElementAspectProps
    const targetAspectPropsArray: ElementAspectProps[] = sourceAspects.map((sourceAspect: ElementMultiAspect) => {
      return this.onTransformElementAspect(sourceAspect, targetElementId);
    });
    if (this._options.includeSourceProvenance) {
      this.importer.importElementMultiAspects(targetAspectPropsArray, (a: ElementMultiAspect) => {
        return (a instanceof ExternalSourceAspect) ? a.scope.id !== this.targetScopeElementId : true; // filter out ExternalSourceAspects added by IModelTransformer
      });
    } else {
      this.importer.importElementMultiAspects(targetAspectPropsArray);
    }
  }

  /** Transform the specified sourceElementAspect into ElementAspectProps for the target iModel.
   * @param sourceElementAspect The ElementAspect from the source iModel to be transformed.
   * @param targetElementId The ElementId of the target Element that will own the ElementAspects after transformation.
   * @returns ElementAspectProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
   */
  protected onTransformElementAspect(sourceElementAspect: ElementAspect, _targetElementId: Id64String): ElementAspectProps {
    const targetElementAspectProps: ElementAspectProps = sourceElementAspect.toJSON();
    targetElementAspectProps.id = undefined;
    sourceElementAspect.forEachProperty((propertyName: string, propertyMetaData: PropertyMetaData) => {
      if (propertyMetaData.isNavigation) {
        if (sourceElementAspect.asAny[propertyName]?.id) {
          (targetElementAspectProps as any)[propertyName].id = this.context.findTargetElementId(sourceElementAspect.asAny[propertyName].id);
        }
      } else if ((PrimitiveTypeCode.Long === propertyMetaData.primitiveType) && ("Id" === propertyMetaData.extendedType)) {
        (targetElementAspectProps as any)[propertyName] = this.context.findTargetElementId(sourceElementAspect.asAny[propertyName]);
      }
    });
    return targetElementAspectProps;
  }

  /** The directory where schemas will be exported, a random temporary directory */
  protected _schemaExportDir: string = path.join(KnownLocations.tmpdir, Guid.createValue());

  /** Override of [IModelExportHandler.shouldExportSchema]($transformer) that is called to determine if a schema should be exported
   * @note the default behavior doesn't import schemas older than those already in the target
   */
  public override shouldExportSchema(schemaKey: ECSchemaMetaData.SchemaKey): boolean {
    const versionInTarget = this.targetDb.querySchemaVersion(schemaKey.name);
    if (versionInTarget === undefined)
      return true;
    return Semver.gt(`${schemaKey.version.read}.${schemaKey.version.write}.${schemaKey.version.minor}`, Schema.toSemverString(versionInTarget));
  }

  /** Override of [IModelExportHandler.onExportSchema]($transformer) that serializes a schema to disk for [[processSchemas]] to import into
   * the target iModel when it is exported from the source iModel. */
  public override async onExportSchema(schema: ECSchemaMetaData.Schema): Promise<void> {
    this.sourceDb.nativeDb.exportSchema(schema.name, this._schemaExportDir);
  }

  /** Cause all schemas to be exported from the source iModel and imported into the target iModel.
   * @note For performance reasons, it is recommended that [IModelDb.saveChanges]($backend) be called after `processSchemas` is complete.
   * It is more efficient to process *data* changes after the schema changes have been saved.
   */
  public async processSchemas(): Promise<void> {
    try {
      IModelJsFs.mkdirSync(this._schemaExportDir);
      await this.exporter.exportSchemas();
      const exportedSchemaFiles = IModelJsFs.readdirSync(this._schemaExportDir);
      if (exportedSchemaFiles.length === 0)
        return;
      const schemaFullPaths = exportedSchemaFiles.map((s) => path.join(this._schemaExportDir, s));
      return await this.targetDb.importSchemas(schemaFullPaths);
    } finally {
      IModelJsFs.removeSync(this._schemaExportDir);
    }
  }

  /** Cause all fonts to be exported from the source iModel and imported into the target iModel.
 * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
 */
  public async processFonts(): Promise<void> {
    return this.exporter.exportFonts();
  }

  /** Override of [IModelExportHandler.onExportFont]($transformer) that imports a font into the target iModel when it is exported from the source iModel. */
  public override onExportFont(font: FontProps, _isUpdate: boolean | undefined): void {
    this.context.importFont(font.id);
  }

  /** Cause all CodeSpecs to be exported from the source iModel and imported into the target iModel.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processCodeSpecs(): Promise<void> {
    return this.exporter.exportCodeSpecs();
  }

  /** Cause a single CodeSpec to be exported from the source iModel and imported into the target iModel.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processCodeSpec(codeSpecName: string): Promise<void> {
    return this.exporter.exportCodeSpecByName(codeSpecName);
  }

  /** Override of [IModelExportHandler.shouldExportCodeSpec]($transformer) that is called to determine if a CodeSpec should be exported from the source iModel.
   * @note Reaching this point means that the CodeSpec has passed the standard exclusion checks in [IModelExporter]($transformer).
   */
  public override shouldExportCodeSpec(_sourceCodeSpec: CodeSpec): boolean { return true; }

  /** Override of [IModelExportHandler.onExportCodeSpec]($transformer) that imports a CodeSpec into the target iModel when it is exported from the source iModel. */
  public override onExportCodeSpec(sourceCodeSpec: CodeSpec): void {
    this.context.importCodeSpec(sourceCodeSpec.id);
  }

  /** Recursively import all Elements and sub-Models that descend from the specified Subject */
  public async processSubject(sourceSubjectId: Id64String, targetSubjectId: Id64String): Promise<void> {
    this.sourceDb.elements.getElement(sourceSubjectId, Subject); // throws if sourceSubjectId is not a Subject
    this.targetDb.elements.getElement(targetSubjectId, Subject); // throws if targetSubjectId is not a Subject
    this.context.remapElement(sourceSubjectId, targetSubjectId);
    await this.processChildElements(sourceSubjectId);
    await this.processSubjectSubModels(sourceSubjectId);
    return this.processDeferredElements(); // eslint-disable-line deprecation/deprecation
  }

  /** Export everything from the source iModel and import the transformed entities into the target iModel.
 * @note [[processSchemas]] is not called automatically since the target iModel may want a different collection of schemas.
 */
  public async processAll(): Promise<void> {
    Logger.logTrace(loggerCategory, "processAll()");
    this.logSettings();
    this.validateScopeProvenance();
    await this.initFromExternalSourceAspects();
    await this.exporter.exportCodeSpecs();
    await this.exporter.exportFonts();
    // The RepositoryModel and root Subject of the target iModel should not be transformed.
    await this.exporter.exportChildElements(IModel.rootSubjectId); // start below the root Subject
    await this.exporter.exportModelContents(IModel.repositoryModelId, Element.classFullName, true); // after the Subject hierarchy, process the other elements of the RepositoryModel
    await this.exporter.exportSubModels(IModel.repositoryModelId); // start below the RepositoryModel
    await this.exporter.exportRelationships(ElementRefersToElements.classFullName);
    await this.processDeferredElements(); // eslint-disable-line deprecation/deprecation
    if (this.shouldDetectDeletes()) {
      await this.detectElementDeletes();
      await this.detectRelationshipDeletes();
    }

    if (this._options.optimizeGeometry)
      this.importer.optimizeGeometry(this._options.optimizeGeometry);

    this.importer.computeProjectExtents();
    this.finalizeTransformation();
  }

  private _lastProvenanceEntityInfo = nullLastProvenanceEntityInfo;

  private markLastProvenance(sourceAspect: MarkRequired<ExternalSourceAspectProps, "id">, { isRelationship = false }) {
    this._lastProvenanceEntityInfo = {
      entityId: sourceAspect.element.id,
      aspectId: sourceAspect.id,
      aspectVersion: sourceAspect.version ?? "",
      aspectKind: isRelationship ? ExternalSourceAspect.Kind.Relationship : ExternalSourceAspect.Kind.Element,
    };
  }

  /** @internal the name of the table where javascript state of the transformer is serialized in transformer state dumps */
  public static readonly jsStateTable = "TransformerJsState";

  /** @internal the name of the table where the target state heuristics is serialized in transformer state dumps */
  public static readonly lastProvenanceEntityInfoTable = "LastProvenanceEntityInfo";

  /**
   * Load the state of the active transformation from an open SQLiteDb
   * You can override this if you'd like to load from custom tables in the resumable dump state, but you should call
   * this super implementation
   * @note the SQLiteDb must be open
   */
  protected loadStateFromDb(db: SQLiteDb): void {
    const lastProvenanceEntityInfo: IModelTransformer["_lastProvenanceEntityInfo"] = db.withSqliteStatement(
      `SELECT entityId, aspectId, aspectVersion, aspectKind FROM ${IModelTransformer.lastProvenanceEntityInfoTable}`,
      (stmt) => {
        if (DbResult.BE_SQLITE_ROW !== stmt.step())
          throw Error(
            "expected row when getting lastProvenanceEntityId from target state table"
          );
        return {
          entityId: stmt.getValueString(0),
          aspectId: stmt.getValueString(1),
          aspectVersion: stmt.getValueString(2),
          aspectKind: stmt.getValueString(3) as ExternalSourceAspect.Kind,
        };
      }
    );
    const targetHasCorrectLastProvenance =
      // ignore provenance check if it's null since we can't bind those ids
      !Id64.isValidId64(lastProvenanceEntityInfo.aspectId) ||
      !Id64.isValidId64(lastProvenanceEntityInfo.entityId) ||
      this.provenanceDb.withPreparedStatement(`
        SELECT Version FROM ${ExternalSourceAspect.classFullName}
        WHERE Scope.Id=:scopeId
          AND ECInstanceId=:aspectId
          AND Kind=:kind
          AND Element.Id=:entityId
      `,
      (statement: ECSqlStatement): boolean => {
        statement.bindId("scopeId", this.targetScopeElementId);
        statement.bindId("aspectId", lastProvenanceEntityInfo.aspectId);
        statement.bindString("kind", lastProvenanceEntityInfo.aspectKind);
        statement.bindId("entityId", lastProvenanceEntityInfo.entityId);
        const stepResult = statement.step();
        switch (stepResult) {
          case DbResult.BE_SQLITE_ROW:
            const version = statement.getValue(0).getString();
            return version === lastProvenanceEntityInfo.aspectVersion;
          case DbResult.BE_SQLITE_DONE:
            return false;
          default:
            throw new IModelError(IModelStatus.SQLiteError, `got sql error ${stepResult}`);
        }
      });
    if (!targetHasCorrectLastProvenance)
      throw Error([
        "Target for resuming from does not have the expected provenance ",
        "from the target that the resume state was made with",
      ].join("\n"));
    this._lastProvenanceEntityInfo = lastProvenanceEntityInfo;

    const state = db.withSqliteStatement(`SELECT data FROM ${IModelTransformer.jsStateTable}`, (stmt) => {
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw Error("expected row when getting data from js state table");
      return JSON.parse(stmt.getValueString(0)) as TransformationJsonState;
    });
    if (state.transformerClass !== this.constructor.name)
      throw Error("resuming from a differently named transformer class, it is not necessarily valid to resume with a different transformer class");
    // force assign to readonly options since we do not know how the transformer subclass takes options to pass to the superclass
    (this as any)._options = state.options;
    this.context.loadStateFromDb(db);
    this.importer.loadStateFromJson(state.importerState);
    this.exporter.loadStateFromJson(state.exporterState);
    this.loadAdditionalStateJson(state.additionalState);
  }

  /**
   * Return a new transformer instance with the same remappings state as saved from a previous [[IModelTransformer.saveStateToFile]] call.
   * This allows you to "resume" an iModel transformation, you will have to call [[IModelTransformer.processChanges]]/[[IModelTransformer.processAll]]
   * again but the remapping state will cause already mapped elements to be skipped.
   * To "resume" an iModel Transformation you need:
   * - the sourceDb at the same changeset
   * - the same targetDb in the state in which it was before
   * @param statePath the path to the serialized state of the transformer, use [[IModelTransformer.saveStateToFile]] to get this from an existing transformer instance
   * @param constructorArgs remaining arguments that you would normally pass to the Transformer subclass you are using, usually (sourceDb, targetDb)
   * @note custom transformers with custom state may need to override this method in order to handle loading their own custom state somewhere
   */
  public static resumeTransformation<SubClass extends new(...a: any[]) => IModelTransformer = typeof IModelTransformer>(
    this: SubClass,
    statePath: string,
    ...constructorArgs: ConstructorParameters<SubClass>
  ): InstanceType<SubClass> {
    const transformer = new this(...constructorArgs);
    const db = new SQLiteDb();
    db.openDb(statePath, OpenMode.Readonly);
    try {
      transformer.loadStateFromDb(db);
    } finally {
      db.closeDb();
    }
    return transformer as InstanceType<SubClass>;
  }

  /**
   * You may override this to store arbitrary json state in a transformer state dump, useful for some resumptions
   * @see [[IModelTransformer.saveStateToFile]]
   */
  protected getAdditionalStateJson(): any {
    return {};
  }

  /**
   * You may override this to load arbitrary json state in a transformer state dump, useful for some resumptions
   * @see [[IModelTransformer.loadStateFromFile]]
   */
  protected loadAdditionalStateJson(_additionalState: any): void {}

  /**
   * Save the state of the active transformation to an open SQLiteDb
   * You can override this if you'd like to write custom tables to the resumable dump state, but you should call
   * this super implementation
   * @note the SQLiteDb must be open
   */
  protected saveStateToDb(db: SQLiteDb): void {
    const jsonState: TransformationJsonState = {
      transformerClass: this.constructor.name,
      options: this._options,
      importerState: this.importer.saveStateToJson(),
      exporterState: this.exporter.saveStateToJson(),
      additionalState: this.getAdditionalStateJson(),
    };
    this.context.saveStateToDb(db);
    if (DbResult.BE_SQLITE_DONE !== db.executeSQL(
      `CREATE TABLE ${IModelTransformer.jsStateTable} (data TEXT)`
    )) throw Error("Failed to create the js state table in the state database");
    if (DbResult.BE_SQLITE_DONE !== db.executeSQL(`
      CREATE TABLE ${IModelTransformer.lastProvenanceEntityInfoTable} (
        -- because we cannot bind the invalid id which we use for our null state, we actually store the id as a hex string
        entityId TEXT,
        aspectId TEXT,
        aspectVersion TEXT,
        aspectKind TEXT
      )
    `)) throw Error("Failed to create the target state table in the state database");
    db.saveChanges();
    db.withSqliteStatement(
      `INSERT INTO ${IModelTransformer.jsStateTable} (data) VALUES (?)`,
      (stmt) => {
        stmt.bindString(1, JSON.stringify(jsonState));
        if (DbResult.BE_SQLITE_DONE !== stmt.step()) throw Error("Failed to insert options into the state database");
      });
    db.withSqliteStatement(
      `INSERT INTO ${IModelTransformer.lastProvenanceEntityInfoTable} (entityId, aspectId, aspectVersion, aspectKind) VALUES (?,?,?,?)`,
      (stmt) => {
        stmt.bindString(1, this._lastProvenanceEntityInfo.entityId);
        stmt.bindString(2, this._lastProvenanceEntityInfo.aspectId);
        stmt.bindString(3, this._lastProvenanceEntityInfo.aspectVersion);
        stmt.bindString(4, this._lastProvenanceEntityInfo.aspectKind);
        if (DbResult.BE_SQLITE_DONE !== stmt.step()) throw Error("Failed to insert options into the state database");
      });
    db.saveChanges();
  }

  /**
   * Save the state of the active transformation to a file path, if a file at the path already exists, it will be overwritten
   * This state can be used by [[IModelTransformer.resumeTransformation]] to resume a transformation from this point.
   * The serialization format is a custom sqlite database.
   * @note custom transformers with custom state may override [[IModelTransformer.saveStateToDb]] or [[IModelTransformer.getAdditionalStateJson]]
   *       and [[IModelTransformer.loadStateFromDb]] (with a super call) or [[IModelTransformer.loadAdditionalStateJson]]
   *       if they have custom state that needs to be stored with
   *       potentially inside the same sqlite file in separate tables
   */
  public saveStateToFile(nativeStatePath: string): void {
    const db = new SQLiteDb();
    if (IModelJsFs.existsSync(nativeStatePath))
      IModelJsFs.unlinkSync(nativeStatePath);
    db.createDb(nativeStatePath);
    try {
      this.saveStateToDb(db);
      db.saveChanges();
    } finally {
      db.closeDb();
    }
  }

  /** Export changes from the source iModel and import the transformed entities into the target iModel.
 * Inserts, updates, and deletes are determined by inspecting the changeset(s).
 * @param accessToken A valid access token string
 * @param startChangesetId Include changes from this changeset up through and including the current changeset.
 * If this parameter is not provided, then just the current changeset will be exported.
 * @note To form a range of versions to process, set `startChangesetId` for the start (inclusive) of the desired range and open the source iModel as of the end (inclusive) of the desired range.
 */
  public async processChanges(accessToken: AccessToken, startChangesetId?: string): Promise<void> {
    Logger.logTrace(loggerCategory, "processChanges()");
    this.logSettings();
    this.validateScopeProvenance();
    await this.initFromExternalSourceAspects({accessToken, startChangesetId});
    await this.exporter.exportChanges(accessToken, startChangesetId);
    await this.processDeferredElements(); // eslint-disable-line deprecation/deprecation

    if (this._options.optimizeGeometry)
      this.importer.optimizeGeometry(this._options.optimizeGeometry);

    this.importer.computeProjectExtents();
    this.finalizeTransformation();
  }
}

/** @internal the json part of a transformation's state */
interface TransformationJsonState {
  transformerClass: string;
  options: IModelTransformOptions;
  importerState: IModelImporterState;
  exporterState: IModelExporterState;
  additionalState?: any;
}

/** IModelTransformer that clones the contents of a template model.
 * @beta
 */
export class TemplateModelCloner extends IModelTransformer {
  /** The Placement to apply to the template. */
  private _transform3d?: Transform;
  /** Accumulates the mapping of sourceElementIds to targetElementIds from the elements in the template model that were cloned. */
  private _sourceIdToTargetIdMap?: Map<Id64String, Id64String>;
  /** Construct a new TemplateModelCloner
   * @param sourceDb The source IModelDb that contains the templates to clone
   * @param targetDb Optionally specify the target IModelDb where the cloned template will be inserted.
   *                 Typically this is left unspecified, and the default is to use the sourceDb as the target
   * @note The expectation is that the template definitions are within the same iModel where instances will be placed.
   */
  public constructor(sourceDb: IModelDb, targetDb: IModelDb = sourceDb) {
    const target = new IModelImporter(targetDb, {
      autoExtendProjectExtents: false, // autoExtendProjectExtents is intended for transformation service use cases, not template --> instance cloning
    });
    super(sourceDb, target, { noProvenance: true }); // WIP: need to decide the proper way to handle provenance
  }
  /** Place a template from the sourceDb at the specified placement in the target model within the targetDb.
   * @param sourceTemplateModelId The Id of the template model in the sourceDb
   * @param targetModelId The Id of the target model (must be a subclass of GeometricModel3d) where the cloned component will be inserted.
   * @param placement The placement for the cloned component.
   * @note *Required References* like the SpatialCategory must be remapped before calling this method.
   * @returns The mapping of sourceElementIds from the template model to the instantiated targetElementIds in the targetDb in case further processing is required.
   */
  public async placeTemplate3d(sourceTemplateModelId: Id64String, targetModelId: Id64String, placement: Placement3d): Promise<Map<Id64String, Id64String>> {
    this.context.remapElement(sourceTemplateModelId, targetModelId);
    this._transform3d = Transform.createOriginAndMatrix(placement.origin, placement.angles.toMatrix3d());
    this._sourceIdToTargetIdMap = new Map<Id64String, Id64String>();
    await this.exporter.exportModelContents(sourceTemplateModelId);
    // Note: the source --> target mapping was needed during the template model cloning phase (remapping parent/child, for example), but needs to be reset afterwards
    for (const sourceElementId of this._sourceIdToTargetIdMap.keys()) {
      const targetElementId = this.context.findTargetElementId(sourceElementId);
      this._sourceIdToTargetIdMap.set(sourceElementId, targetElementId);
      this.context.removeElement(sourceElementId); // clear the underlying native remapping context for the next clone operation
    }
    return this._sourceIdToTargetIdMap; // return the sourceElementId -> targetElementId Map in case further post-processing is required.
  }
  /** Place a template from the sourceDb at the specified placement in the target model within the targetDb.
   * @param sourceTemplateModelId The Id of the template model in the sourceDb
   * @param targetModelId The Id of the target model (must be a subclass of GeometricModel2d) where the cloned component will be inserted.
   * @param placement The placement for the cloned component.
   * @note *Required References* like the DrawingCategory must be remapped before calling this method.
   * @returns The mapping of sourceElementIds from the template model to the instantiated targetElementIds in the targetDb in case further processing is required.
   */
  public async placeTemplate2d(sourceTemplateModelId: Id64String, targetModelId: Id64String, placement: Placement2d): Promise<Map<Id64String, Id64String>> {
    this.context.remapElement(sourceTemplateModelId, targetModelId);
    this._transform3d = Transform.createOriginAndMatrix(Point3d.createFrom(placement.origin), placement.rotation);
    this._sourceIdToTargetIdMap = new Map<Id64String, Id64String>();
    await this.exporter.exportModelContents(sourceTemplateModelId);
    // Note: the source --> target mapping was needed during the template model cloning phase (remapping parent/child, for example), but needs to be reset afterwards
    for (const sourceElementId of this._sourceIdToTargetIdMap.keys()) {
      const targetElementId = this.context.findTargetElementId(sourceElementId);
      this._sourceIdToTargetIdMap.set(sourceElementId, targetElementId);
      this.context.removeElement(sourceElementId); // clear the underlying native remapping context for the next clone operation
    }
    return this._sourceIdToTargetIdMap; // return the sourceElementId -> targetElementId Map in case further post-processing is required.
  }
  /** Cloning from a template requires this override of onTransformElement. */
  public override onTransformElement(sourceElement: Element): ElementProps {
    const referenceIds: Id64Set = sourceElement.getReferenceIds();
    referenceIds.forEach((referenceId: Id64String) => {
      if (Id64.invalid === this.context.findTargetElementId(referenceId)) {
        if (this.context.isBetweenIModels) {
          throw new IModelError(IModelStatus.BadRequest, `Remapping for source dependency ${referenceId} not found for target iModel`);
        } else {
          const definitionElement = this.sourceDb.elements.tryGetElement<DefinitionElement>(referenceId, DefinitionElement);
          if (definitionElement && !(definitionElement instanceof RecipeDefinitionElement)) {
            this.context.remapElement(referenceId, referenceId); // when in the same iModel, can use existing DefinitionElements without remapping
          } else {
            throw new IModelError(IModelStatus.BadRequest, `Remapping for dependency ${referenceId} not found`);
          }
        }
      }
    });
    const targetElementProps: ElementProps = super.onTransformElement(sourceElement);
    targetElementProps.federationGuid = Guid.createValue(); // clone from template should create a new federationGuid
    targetElementProps.code = Code.createEmpty(); // clone from template should not maintain codes
    if (sourceElement instanceof GeometricElement3d) {
      const placement = Placement3d.fromJSON((targetElementProps as GeometricElement3dProps).placement);
      if (placement.isValid) {
        placement.multiplyTransform(this._transform3d!);
        (targetElementProps as GeometricElement3dProps).placement = placement;
      }
    } else if (sourceElement instanceof GeometricElement2d) {
      const placement = Placement2d.fromJSON((targetElementProps as GeometricElement2dProps).placement);
      if (placement.isValid) {
        placement.multiplyTransform(this._transform3d!);
        (targetElementProps as GeometricElement2dProps).placement = placement;
      }
    }
    this._sourceIdToTargetIdMap!.set(sourceElement.id, Id64.invalid); // keep track of (source) elementIds from the template model, but the target hasn't been inserted yet
    return targetElementProps;
  }
}
