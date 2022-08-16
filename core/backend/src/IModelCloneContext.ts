/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */
import * as assert from "assert";
import { ConcreteEntityId, ConcreteEntityIds, ConcreteEntityTypes, DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { Code, CodeScopeSpec, CodeSpec, ElementAspectProps, ElementProps, IModel, IModelError, PrimitiveTypeCode, PropertyMetaData, RelatedElement, RelatedElementProps } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { SubCategory } from "./Category";
import { Element } from "./Element";
import { IModelDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { SQLiteDb } from "./SQLiteDb";
import { ElementAspect } from "./ElementAspect";
import { ECClassNavPropReferenceCache, EntityRefType, nameForEntityRefType } from "./ECClassNavPropReferenceCache";
import { IModelSchemaLoader } from "./IModelSchemaLoader";
import { EntityUnifier } from "./EntityUnifier";

/** The context for transforming a *source* Element to a *target* Element and remapping internal identifiers to the target iModel.
 * @beta
 */
export class IModelCloneContext {
  /** The source IModelDb. */
  public readonly sourceDb: IModelDb;
  /** The target IModelDb. */
  public readonly targetDb: IModelDb;
  /** The native import context */
  private _nativeContext: IModelJsNative.ImportContext;
  /** the cache of types referenced by navigation properties */
  private _navPropRefCache: ECClassNavPropReferenceCache = new ECClassNavPropReferenceCache();

  /** Construct a new IModelCloneContext.
   * @param sourceDb The source IModelDb.
   * @param targetDb If provided the target IModelDb. If not provided, the source and target are the same IModelDb.
   */
  public constructor(sourceDb: IModelDb, targetDb?: IModelDb) {
    this.sourceDb = sourceDb;
    this.targetDb = (undefined !== targetDb) ? targetDb : sourceDb;
    this._nativeContext = new IModelHost.platform.ImportContext(this.sourceDb.nativeDb, this.targetDb.nativeDb);
  }

  public async initialize() {
    const schemaLoader = new IModelSchemaLoader(this.sourceDb);
    await this.sourceDb.withPreparedStatement(`
      SELECT Name FROM ECDbMeta.ECSchemaDef
      -- schemas defined before biscore are system schemas and no such entities can be transformed so ignore them
      WHERE ECInstanceId >= (SELECT ECInstanceId FROM ECDbMeta.ECSchemaDef WHERE Name='BisCore')
      -- ensure schema dependency order
      ORDER BY ECInstanceId
    `, async (stmt) => {
      let status: DbResult;
      while ((status = stmt.step()) === DbResult.BE_SQLITE_ROW) {
        const schemaName = stmt.getValue(0).getString();
        const schema = schemaLoader.getSchema(schemaName);
        await this._navPropRefCache.initSchema(schema);
      }
      if (status !== DbResult.BE_SQLITE_DONE) throw new IModelError(status, "unexpected query failure");
    });
  }

  public async create(...args: ConstructorParameters<typeof IModelCloneContext>): Promise<IModelCloneContext> {
    const instance = new IModelCloneContext(...args);
    await instance.initialize();
    return instance;
  }

  /** Returns `true` if this context is for transforming between 2 iModels and `false` if it for transforming within the same iModel. */
  public get isBetweenIModels(): boolean { return this.sourceDb !== this.targetDb; }

  /** Dispose any native resources associated with this IModelCloneContext. */
  public dispose(): void { this._nativeContext.dispose(); }

  /** Debugging aid that dumps the Id remapping details and other information to the specified output file.
   * @internal
   */
  public dump(outputFileName: string): void { this._nativeContext.dump(outputFileName); }

  /** Add a rule that remaps the specified source [CodeSpec]($common) to the specified target [CodeSpec]($common).
   * @param sourceCodeSpecName The name of the CodeSpec from the source iModel.
   * @param targetCodeSpecName The name of the CodeSpec from the target iModel.
   * @throws [[IModelError]] if either CodeSpec could not be found.
   */
  public remapCodeSpec(sourceCodeSpecName: string, targetCodeSpecName: string): void {
    const sourceCodeSpec: CodeSpec = this.sourceDb.codeSpecs.getByName(sourceCodeSpecName);
    const targetCodeSpec: CodeSpec = this.targetDb.codeSpecs.getByName(targetCodeSpecName);
    this._nativeContext.addCodeSpecId(sourceCodeSpec.id, targetCodeSpec.id);
  }

  /** Add a rule that remaps the specified source class to the specified target class. */
  public remapElementClass(sourceClassFullName: string, targetClassFullName: string): void {
    this._nativeContext.addClass(sourceClassFullName, targetClassFullName);
  }

  /** Add a rule that remaps the specified source Element to the specified target Element. */
  public remapElement(sourceId: Id64String, targetId: Id64String): void {
    this._nativeContext.addElementId(sourceId, targetId);
  }

  /** Remove a rule that remaps the specified source Element. */
  public removeElement(sourceId: Id64String): void {
    this._nativeContext.removeElementId(sourceId);
  }

  private _aspectRemapTable = new Map<Id64String, Id64String>();

  /** Add a rule that remaps the specified source ElementAspect to the specified target ElementAspect. */
  public remapElementAspect(aspectSourceId: Id64String, aspectTargetId: Id64String): void {
    this._aspectRemapTable.set(aspectSourceId, aspectTargetId);
  }

  /** Remove a rule that remaps the specified source ElementAspect */
  public removeElementAspect(aspectSourceId: Id64String): void {
    this._aspectRemapTable.delete(aspectSourceId);
  }

  /** Look up a target CodeSpecId from the source CodeSpecId.
   * @returns the target CodeSpecId or [Id64.invalid]($bentley) if a mapping not found.
   */
  public findTargetCodeSpecId(sourceId: Id64String): Id64String {
    if (Id64.invalid === sourceId) {
      return Id64.invalid;
    }
    return this._nativeContext.findCodeSpecId(sourceId);
  }

  /** Look up a target ElementId from the source ElementId.
   * @returns the target ElementId or [Id64.invalid]($bentley) if a mapping not found.
   */
  public findTargetElementId(sourceElementId: Id64String): Id64String {
    if (Id64.invalid === sourceElementId) {
      return Id64.invalid;
    }
    return this._nativeContext.findElementId(sourceElementId);
  }

  /** Look up a target AspectId from the source AspectId.
   * @returns the target AspectId or [Id64.invalid]($bentley) if a mapping not found.
   */
  public findTargetAspectId(sourceAspectId: Id64String): Id64String {
    return this._aspectRemapTable.get(sourceAspectId) ?? Id64.invalid;
  }

  /** Look up a target [ConcreteEntityId]($bentley) from a source [ConcreteEntityId]($bentley)
   * @returns the target CodeSpecId or a [ConcreteEntityId]($bentley) containing [Id64.invalid]($bentley) if a mapping is not found.
   */
  public findTargetEntityId(sourceEntityId: ConcreteEntityId): ConcreteEntityId {
    const [type, rawId] = ConcreteEntityIds.split(sourceEntityId);
    switch (type) {
      case ConcreteEntityTypes.CodeSpec:
        return `c${this.findTargetCodeSpecId(rawId)}`;
      case ConcreteEntityTypes.Model:
        const targetId = `m${this.findTargetElementId(rawId)}` as const;
        // Check if the model exists, `findTargetElementId` may have worked because the element exists when the model doesn't.
        // That can occur in the transformer since a submodeled element is imported before its submodel.
        return EntityUnifier.exists(this.targetDb, { concreteEntityId: targetId })
          ? targetId
          : ConcreteEntityIds.makeInvalid(ConcreteEntityTypes.Model);
      case ConcreteEntityTypes.Element:
        return `e${this.findTargetElementId(rawId)}`;
      case ConcreteEntityTypes.ElementAspect:
        return `a${this.findTargetAspectId(rawId)}`;
      case ConcreteEntityTypes.Relationship: {
        const makeGetConcreteEntityTypeSql = (property: string) => `
          CASE
            WHEN [${property}] IS (BisCore.ElementUniqueAspect) OR [${property}] IS (BisCore.ElementMultiAspect)
              THEN 'a'
            WHEN [${property}] IS (BisCore.Element)
              THEN 'e'
            WHEN [${property}] IS (BisCore.Model)
              THEN 'm'
            WHEN [${property}] IS (BisCore.CodeSpec)
              THEN 'c'
            WHEN [${property}] IS (BisCore.ElementRefersToElements) -- TODO: ElementDrivesElement still not handled by the transformer
              THEN 'r'
            ELSE 'error'
          END
        `;
        const relInSource = this.sourceDb.withPreparedStatement(
          `
          SELECT
            SourceECInstanceId,
            TargetECInstanceId,
            (${makeGetConcreteEntityTypeSql("SourceECClassId")}) AS SourceType,
            (${makeGetConcreteEntityTypeSql("TargetECClassId")}) AS TargetType
          FROM BisCore:ElementRefersToElements
          WHERE ECInstanceId=?
          `, (stmt) => {
            stmt.bindId(1, rawId);
            let status: DbResult;
            while ((status = stmt.step()) === DbResult.BE_SQLITE_ROW) {
              const sourceId = stmt.getValue(0).getId();
              const targetId = stmt.getValue(1).getId();
              const sourceType = stmt.getValue(2).getString() as ConcreteEntityTypes | "error";
              const targetType = stmt.getValue(3).getString() as ConcreteEntityTypes | "error";
              if (sourceType === "error" || targetType === "error")
                throw Error("relationship end had unknown root class");
              return {
                sourceId: `${sourceType}${sourceId}`,
                targetId: `${targetType}${targetId}`,
              } as const;
            }
            if (status !== DbResult.BE_SQLITE_DONE)
              throw new IModelError(status, "unexpected query failure");
            return undefined;
          });
        if (relInSource === undefined) break;
        // just in case prevent recursion
        if (relInSource.sourceId === sourceEntityId || relInSource.targetId === sourceEntityId)
          throw Error("link table relationship end was resolved to itself. This should be impossible");
        const relInTarget = {
          sourceId: this.findTargetEntityId(relInSource.sourceId),
          targetId: this.findTargetEntityId(relInSource.targetId),
        };
        const relInTargetId = this.sourceDb.withPreparedStatement(
          `
          SELECT ECInstanceId
          FROM BisCore:ElementRefersToElements
          WHERE SourceECInstanceId=?
            AND TargetECInstanceId=?
          `, (stmt) => {
            stmt.bindId(1, ConcreteEntityIds.toId64(relInTarget.sourceId));
            stmt.bindId(2, ConcreteEntityIds.toId64(relInTarget.targetId));
            let status: DbResult;
            if ((status = stmt.step()) === DbResult.BE_SQLITE_ROW)
              return stmt.getValue(0).getId();
            if (status !== DbResult.BE_SQLITE_DONE)
              throw new IModelError(status, "unexpected query failure");
            return Id64.invalid;
          });
        return `r${relInTargetId}`;
      }
    }
    return `${type}${Id64.invalid}`;
  }

  /** Filter out geometry entries in the specified SubCategory from GeometryStreams in the target iModel.
   * @note It is not possible to filter out a *default* SubCategory. A request to do so will be ignored.
   * @see [SubCategory.isDefaultSubCategory]($backend)
   */
  public filterSubCategory(sourceSubCategoryId: Id64String): void {
    const sourceSubCategory = this.sourceDb.elements.tryGetElement<SubCategory>(sourceSubCategoryId, SubCategory);
    if (sourceSubCategory && !sourceSubCategory.isDefaultSubCategory) {
      this._nativeContext.filterSubCategoryId(sourceSubCategoryId);
    }
  }

  /** Returns `true` if there are any SubCategories being filtered. */
  public get hasSubCategoryFilter(): boolean {
    return this._nativeContext.hasSubCategoryFilter();
  }

  /** Returns `true` if this SubCategory is being filtered. */
  public isSubCategoryFiltered(subCategoryId: Id64String): boolean {
    return this._nativeContext.isSubCategoryFiltered(subCategoryId);
  }

  /** Import the specified font from the source iModel into the target iModel.
   * @internal
   */
  public importFont(sourceFontNumber: number): void {
    this.targetDb.clearFontMap(); // so it will be reloaded with new font info
    this._nativeContext.importFont(sourceFontNumber);
  }

  /** Import a single CodeSpec from the source iModel into the target iModel.
   * @internal
   */
  public importCodeSpec(sourceCodeSpecId: Id64String): void {
    this._nativeContext.importCodeSpec(sourceCodeSpecId);
  }

  /** Clone the specified source Element into ElementProps for the target iModel.
   * @internal
   */
  public cloneElement(sourceElement: Element, cloneOptions?: IModelJsNative.CloneElementOptions): ElementProps {
    const targetElementProps: ElementProps = this._nativeContext.cloneElement(sourceElement.id, cloneOptions);
    // Ensure that all NavigationProperties in targetElementProps have a defined value so "clearing" changes will be part of the JSON used for update
    sourceElement.forEachProperty((propertyName: string, meta: PropertyMetaData) => {
      if ((meta.isNavigation) && (undefined === (sourceElement as any)[propertyName])) {
        (targetElementProps as any)[propertyName] = RelatedElement.none;
      }
    }, false); // exclude custom because C++ has already handled them
    if (this.isBetweenIModels) {
      // The native C++ cloneElement strips off federationGuid, want to put it back if transformation is between iModels
      targetElementProps.federationGuid = sourceElement.federationGuid;
      if (CodeScopeSpec.Type.Repository === this.targetDb.codeSpecs.getById(targetElementProps.code.spec).scopeType) {
        targetElementProps.code.scope = IModel.rootSubjectId;
      }
    }
    // unlike other references, code cannot be null. If it is null, use an empty code instead
    if (targetElementProps.code.scope === Id64.invalid || targetElementProps.code.spec === Id64.invalid) {
      targetElementProps.code = Code.createEmpty();
    }
    const jsClass = this.sourceDb.getJsClass<typeof Element>(sourceElement.classFullName);
    // eslint-disable-next-line @typescript-eslint/dot-notation
    jsClass["onCloned"](this, sourceElement.toJSON(), targetElementProps);
    return targetElementProps;
  }

  /** Clone the specified source Element into ElementProps for the target iModel.
   * @internal
   */
  public cloneElementAspect(sourceElementAspect: ElementAspect): ElementAspectProps {
    const targetElementAspectProps: ElementAspectProps = sourceElementAspect.toJSON();
    targetElementAspectProps.id = undefined;
    sourceElementAspect.forEachProperty((propertyName, propertyMetaData) => {
      if (propertyMetaData.isNavigation) {
        // copy via spread to prevent altering the source
        const sourceNavProp: RelatedElementProps | undefined = sourceElementAspect.asAny[propertyName];
        if (sourceNavProp?.id) {
          const navPropRefType = this._navPropRefCache.getNavPropRefType(sourceElementAspect.schemaName, sourceElementAspect.className, propertyName);
          /* eslint-disable @typescript-eslint/indent */
          const targetEntityId
            = navPropRefType === EntityRefType.Element || navPropRefType === EntityRefType.Model
              ? this.findTargetElementId(sourceNavProp.id)
            : navPropRefType === EntityRefType.Aspect
              ? this.findTargetAspectId(sourceNavProp.id)
            : navPropRefType === undefined
              ? assert(false,`nav prop ref type for '${propertyName}' was not in the cache, this is a bug.`) as never
            : assert(false, `unhandled navprop type '${nameForEntityRefType(navPropRefType)}`) as never;
          /* eslint-enable @typescript-eslint/indent */
          // spread the property in case toJSON did not deep-clone
          (targetElementAspectProps as any)[propertyName] = { ...(targetElementAspectProps as any)[propertyName], id: targetEntityId };
        }
      } else if ((PrimitiveTypeCode.Long === propertyMetaData.primitiveType) && ("Id" === propertyMetaData.extendedType)) {
        (targetElementAspectProps as any)[propertyName] = this.findTargetElementId(sourceElementAspect.asAny[propertyName]);
      }
    });
    return targetElementAspectProps;
  }

  /**
   * serialize state to a sqlite database at a given path
   * assumes the database has not already had any context state serialized to it
   * @internal
   */
  public saveStateToDb(db: SQLiteDb): void {
    this._nativeContext.saveStateToDb(db.nativeDb);
  }

  /**
   * load state from a sqlite database at a given path
   * @internal
   */
  public loadStateFromDb(db: SQLiteDb): void {
    this._nativeContext.loadStateFromDb(db.nativeDb);
  }
}
