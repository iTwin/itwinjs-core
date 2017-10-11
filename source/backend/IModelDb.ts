/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Guid, Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";
import { OpenMode, DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { ClassRegistry } from "../ClassRegistry";
import { Code } from "../Code";
import { Element, ElementLoadParams, ElementProps } from "../Element";
import { ElementAspect, ElementAspectProps, ElementMultiAspect, ElementUniqueAspect } from "../ElementAspect";
import { IModel } from "../IModel";
import { IModelVersion } from "../IModelVersion";
import { Model, ModelProps } from "../Model";
import { IModelToken } from "../IModel";
import { BriefcaseManager, KeepBriefcase, BriefcaseId } from "./BriefcaseManager";
import { ECSqlStatement } from "./ECSqlStatement";
import { IModelError, IModelStatus } from "../IModelError";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BindingValue } from "./BindingUtility";
import { CodeSpecs } from "./CodeSpecs";
import { Entity, EntityMetaData } from "../Entity";

// Initialize the backend side of remoting
import { IModelDbRemoting } from "../middle/IModelDbRemoting";
IModelDbRemoting;

class CachedECSqlStatement {
  public statement: ECSqlStatement;
  public useCount: number;
}

class ECSqlStatementCache {
  private statements: Map<string, CachedECSqlStatement> = new Map<string, CachedECSqlStatement>();

  public add(str: string, stmt: ECSqlStatement): void {

    assert(!stmt.isShared(), "when you add a statement to the cache, the cache takes ownership of it. You can't add a statement that is already being shared in some other way");
    assert(stmt.isPrepared(), "you must cache only cached statements.");

    const existing = this.statements.get(str);
    if (existing !== undefined) {
      assert(existing.useCount > 0, "you should only add a statement if all existing copies of it are in use.");
    }
    const cs = new CachedECSqlStatement();
    cs.statement = stmt;
    cs.statement.setIsShared(true);
    cs.useCount = 1;
    this.statements.set(str, cs);
  }

  public getCount(): number {
    return this.statements.size;
  }

  public find(str: string): CachedECSqlStatement | undefined {
    return this.statements.get(str);
  }

  public release(stmt: ECSqlStatement): void {
    for (const cs of this.statements) {
      const css = cs[1];
      if (css.statement === stmt) {
        if (css.useCount > 0) {
          css.useCount--;
          if (css.useCount === 0) {
            css.statement.reset();
            css.statement.clearBindings();
          }
        } else {
          assert(false, "double-release of cached statement");
        }
        // leave the statement in the cache, even if its use count goes to zero. See removeUnusedStatements and clearOnClose.
        // *** TODO: we should remove it if it is a duplicate of another unused statement in the cache. The trouble is that we don't have the ecsql for the statement,
        //           so we can't check for other equivalent statements.
        break;
      }
    }
  }

  public removeUnusedStatements(targetCount: number) {
    const keysToRemove = [];
    for (const cs of this.statements) {
      const css = cs[1];
      assert(css.statement.isShared());
      assert(css.statement.isPrepared());
      if (css.useCount === 0) {
        css.statement.setIsShared(false);
        css.statement.dispose();
        keysToRemove.push(cs[0]);
        if (keysToRemove.length >= targetCount)
          break;
      }
    }
    for (const k of keysToRemove) {
      this.statements.delete(k);
    }
  }

  public clearOnClose() {
    for (const cs of this.statements) {
      assert(cs[1].useCount === 0, "statement was never released: " + cs[0]);
      assert(cs[1].statement.isShared());
      assert(cs[1].statement.isPrepared());
      const stmt = cs[1].statement;
      if (stmt !== undefined) {
        stmt.setIsShared(false);
        stmt.dispose();
      }
    }
    this.statements.clear();
  }
}

/** Represents a physical copy (briefcase) of an iModel that can be accessed as a file. */
export class IModelDb extends IModel {
  public models: IModelDbModels;
  public elements: IModelDbElements;
  private statementCache: ECSqlStatementCache = new ECSqlStatementCache();
  private _maxStatementCacheCount = 20;
  public nativeDb: any;
  private _codeSpecs: CodeSpecs;

  public constructor(iModelToken: IModelToken, nativeDb: any) {
    super(iModelToken);
    this.nativeDb = nativeDb;
    this.models = new IModelDbModels(this);
    this.elements = new IModelDbElements(this);
  }

  /** Get the briefcase ID of this iModel */
  public getBriefcaseId(): BriefcaseId {
    return new BriefcaseId(this.nativeDb.getBriefcaseId());
  }

  /** Open the iModel from a local file
   * @param fileName The file name of the iModel
   * @param openMode Open mode for database
   * @throws [[IModelError]]
   */
  public static async openStandalone(fileName: string, openMode: OpenMode = OpenMode.ReadWrite, enableTransactions: boolean = false): Promise<IModelDb> {
    return await BriefcaseManager.openStandalone(fileName, openMode, enableTransactions);
  }

  /** Open an iModel from the iModelHub */
  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode = OpenMode.ReadWrite, version: IModelVersion = IModelVersion.latest()): Promise<IModelDb> {
    return await BriefcaseManager.open(accessToken, iModelId, openMode, version);
  }

  /** Close this iModel, if it is currently open */
  public closeStandalone() {
    this.clearStatementCacheOnClose();
    if (!this.iModelToken)
      return;

    this.nativeDb.closeDgnDb();
    this.iModelToken.isOpen = false;

    BriefcaseManager.closeStandalone(this.iModelToken);
  }

  /** Close this iModel, if it is currently open. */
  public async close(accessToken: AccessToken, keepBriefcase: KeepBriefcase = KeepBriefcase.Yes): Promise<void> {
    this.clearStatementCacheOnClose();
    if (!this.iModelToken.isOpen)
      return;

    this.nativeDb.closeDgnDb();
    this.iModelToken.isOpen = false;

    await BriefcaseManager.close(accessToken, this.iModelToken, keepBriefcase);
  }

  /** Get a prepared ECSql statement - may require preparing the statement, if not found in the cache.
   * @param sql The ECSql statement to prepare
   */
  public getPreparedStatement(sql: string): ECSqlStatement {
    const cs = this.statementCache.find(sql);
    if (cs !== undefined && cs.useCount === 0) {  // we can only recycle a previously cached statement if nobody is currently using it.
      assert(cs.statement.isShared());
      assert(cs.statement.isPrepared());
      cs.useCount++;
      return cs.statement;
    }

    if (this.statementCache.getCount() > this._maxStatementCacheCount) {
      this.statementCache.removeUnusedStatements(this._maxStatementCacheCount);
    }

    const stmt = this.prepareStatement(sql);
    this.statementCache.add(sql, stmt);
    return stmt;
  }

  /** Use a prepared statement. This function takes care of preparing the statement and then releasing it.
   * @param sql The ECSql statement to execute
   * @param cb the callback to invoke on the prepared statement
   * @return the value returned by cb
   */
  public withPreparedStatement<T>(sql: string, cb: (stmt: ECSqlStatement) => T): T {
    const stmt = this.getPreparedStatement(sql);
    try {
      const val: T = cb(stmt);
      this.releasePreparedStatement(stmt);
      return val;
    } catch (err) {
      this.releasePreparedStatement(stmt);
      throw err;
    }
  }

  /** Execute a query against this iModel (overridden to improve performance)
   * @param sql The ECSql statement to execute
   * @param bindings Optional values to bind to placeholders in the statement.
   * @returns all rows as an array or an empty array if nothing was selected
   * @throws [[IModelError]] If the statement is invalid
   */
  public async executeQuery(sql: string, bindings?: BindingValue[] | Map<string, BindingValue> | any): Promise<any[]> {
    return this.withPreparedStatement(sql, (stmt: ECSqlStatement) => {
      if (bindings !== undefined)
        stmt.bindValues(bindings);
      const rows: any[] = [];
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        rows.push(stmt.getRow());
      }
      return rows;
    });
  }

  public releasePreparedStatement(stmt: ECSqlStatement): void {
    this.statementCache.release(stmt);
  }

  public clearStatementCacheOnClose(): void {
    this.statementCache.clearOnClose();
  }

  /** Commit pending changes to this iModel */
  public saveChanges() {
    if (!this.iModelToken || !this.nativeDb)
      throw new IModelError(DbResult.BE_SQLITE_ERROR);
    const stat = this.nativeDb.saveChanges();
    if (DbResult.BE_SQLITE_OK !== stat)
      throw new IModelError(stat);
  }

  /** Import an ECSchema. */
  public importSchema(schemafilename: string) {
      if (!this.iModelToken || !this.nativeDb)
        throw new IModelError(DbResult.BE_SQLITE_ERROR);
      const stat = this.nativeDb.importSchema(schemafilename);
      if (DbResult.BE_SQLITE_OK !== stat)
        throw new IModelError(stat);
    }

  /** Find an already open IModelDb from its token. Used by the remoting logic.
   * @hidden
   */
  public static find(iModelToken: IModelToken): IModelDb {
    const iModel = BriefcaseManager.getBriefcase(iModelToken);
    if (!iModel)
      throw new IModelError(IModelStatus.NotFound);
    return iModel;
  }

  /** Get access to the CodeSpecs in this IModel */
  public get codeSpecs(): CodeSpecs {
    if (this._codeSpecs === undefined)
      this._codeSpecs = new CodeSpecs(this);
    return this._codeSpecs;
  }

  /** @deprecated */
  public async getElementPropertiesForDisplay(elementId: string): Promise<string> {
    if (!this.iModelToken.isOpen)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    const {error, result: json} = await this.nativeDb.getElementPropertiesForDisplay(elementId);
    if (error)
    return Promise.reject(new IModelError(error.status));

    return json;
  }

  /** Prepare an ECSql statement.
   * @param sql The ECSql statement to prepare
   */
  public prepareStatement(sql: string): ECSqlStatement {
    if (!this.iModelToken.isOpen)
      throw new IModelError(IModelStatus.NotOpen);

    const stmt = new ECSqlStatement();
    stmt.prepare(this.nativeDb, sql);
    return stmt;
  }

  /** Construct an entity (element or model). This utility method knows how to fetch the required class metadata
   * if necessary in order to get the entity's class defined as a prerequisite.
   */
  public constructEntity(props: any): Entity {
    let entity: Entity;
    try {
      entity = ClassRegistry.createInstance(props);
    } catch (err) {
      if (!ClassRegistry.isClassNotFoundError(err) && !ClassRegistry.isMetaDataNotFoundError(err))
        throw err;
      // Probably, we have not yet loaded the metadata for this class and/or its superclasses. Do that now, and retry the create.
      this.loadMetaData(props.classFullName!);
      entity = ClassRegistry.createInstance(props);
    }
    return entity;
  }

  /** Get metadata for a class. This method will load the metadata from the DgnDb into the cache as a side-effect, if necessary. */
  public getMetaData(classFullName: string): EntityMetaData | undefined {
    let metadata = this.classMetaDataRegistry.find(classFullName);
    if (metadata === undefined) {
      this.loadMetaData(classFullName);
      metadata = this.classMetaDataRegistry.find(classFullName);
    }
    return metadata;
  }

  /*** @hidden */
  private loadMetaData(classFullName: string) {
    if (this.classMetaDataRegistry.find(classFullName))
      return;
    const className = classFullName.split(":");
    if (className.length !== 2)
      throw new IModelError(IModelStatus.BadArg);
    const { error, result: metaDataJson } = this.nativeDb.getECClassMetaDataSync(className[0], className[1]);
    if (error)
      throw new IModelError(error.status);

    const metaData = new EntityMetaData(JSON.parse(metaDataJson));
    this.classMetaDataRegistry.add(classFullName, metaData);
    // Recurse, to make sure that base class is cached.
    if (metaData.baseClasses !== undefined && metaData.baseClasses.length > 0)
      this.loadMetaData(metaData.baseClasses[0]);
  }

}

/** The collection of models in an [[IModelDb]]. */
export class IModelDbModels {
  private _iModel: IModelDb;
  private _loaded: LRUMap<string, Model>;

  /** @hidden */
  public constructor(iModel: IModelDb, max: number = 500) { this._iModel = iModel; this._loaded = new LRUMap<string, Model>(max); }

  /** Get the Model with the specified identifier.
   * @param modelId The Model identifier.
   * @throws [[IModelError]]
   */
  public async getModel(modelId: Id64): Promise<Model> {
    if (!this._iModel.iModelToken.isOpen)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    // first see if the model is already in the local cache.
    const loaded = this._loaded.get(modelId.toString());
    if (loaded)
      return loaded;

    // Must go get the model from the iModel. Start by requesting the model's data.
    const {error, result: json} = await this._iModel.nativeDb.getModel(JSON.stringify({ id: modelId }));
    if (error)
      return Promise.reject(new IModelError(error.status));
    const props = JSON.parse(json) as ModelProps;
    props.iModel = this._iModel;

    const entity = this._iModel.constructEntity(props);
    assert(entity instanceof Model);
    const model = entity as Model;

    // We have created the model. Cache it before we return it.
    model.setPersistent(); // models in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
    this._loaded.set(model.id.toString(), model);
    return model;
  }

  /** Get the sub-model of the specified Element.
   * @param elementId The Element identifier.
   * @throws [[IModelError]]
   */
  public async getSubModel(modeledElementId: Id64 | Guid | Code): Promise<Model> {
    const modeledElement: Element = await this._iModel.elements.getElement(modeledElementId);
    if (modeledElement.id.equals(this._iModel.elements.rootSubjectId))
      return Promise.reject(new IModelError(IModelStatus.NotFound));

    return this.getModel(modeledElement.id);
  }

  /** The Id of the repository model. */
  public get repositoryModelId(): Id64 { return new Id64("0x1"); }
}

/** The collection of elements in an [[IModelDb]]. */
export class IModelDbElements {
  private _iModel: IModelDb;
  private _loaded: LRUMap<string, Element>;

  /** get the map of loaded elements */
  public get loaded() { return this._loaded; }

  /** @hidden */
  public constructor(iModel: IModelDb, maxElements: number = 2000) { this._iModel = iModel; this._loaded = new LRUMap<string, Element>(maxElements); }

  /** Private implementation details of getElement */
  private async _doGetElement(opts: ElementLoadParams): Promise<Element> {
    if (!this._iModel.iModelToken.isOpen)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    // first see if the element is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }

    // Must go get the element from the iModel. Start by requesting the element's data.
    const {error, result: json} = await this._iModel.nativeDb.getElement(JSON.stringify(opts));
    if (error)
      return Promise.reject(new IModelError(error.status));

    const props = JSON.parse(json) as ElementProps;
    props.iModel = this._iModel;

    const entity = this._iModel.constructEntity(props);
    const el = entity as Element;
    assert(el instanceof Element);

    // We have created the element. Cache it before we return it.
    el.setPersistent(); // elements in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
    this._loaded.set(el.id.toString(), el);
    return el;
  }

  /** Get an element by Id, FederationGuid, or Code
   * @throws [[IModelError]] if the element is not found.
   */
  public getElement(elementId: Id64 | Guid | Code): Promise<Element> {
    if (elementId instanceof Id64) return this._doGetElement({ id: elementId });
    if (elementId instanceof Guid) return this._doGetElement({ federationGuid: elementId.toString() });
    if (elementId instanceof Code) return this._doGetElement({ code: elementId });
    return Promise.reject(new IModelError(IModelStatus.BadArg));
  }

  /** Create a new element in memory.
   * @param elementProps The properties to use when creating the element.
   * @throws [[IModelError]] if there is a problem creating the element.
   */
  public createElement(elementProps: ElementProps): Element {
    const element: Element = this._iModel.constructEntity(elementProps) as Element;
    assert(element instanceof Element);
    return element;
  }

  /** Insert a new element.
   * @param el The data for the new element.
   * @returns The newly inserted element's Id.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public insertElement(el: Element): Id64 {
    if (!this._iModel.iModelToken.isOpen)
      throw new IModelError(IModelStatus.NotOpen);

    if (el.isPersistent()) {
      assert(false); // you cannot insert a persistent element. call copyForEdit
      return new Id64();
    }

    // Note that inserting an element is always done synchronously. That is because of constraints
    // on the native code side. Nevertheless, we want the signature of this method to be
    // that of an asynchronous method, since it must run in the services tier and will be
    // asynchronous from a remote client's point of view in any case.
    const {error, result: json} = this._iModel.nativeDb.insertElementSync(JSON.stringify(el));
    if (error)
      throw new IModelError(error.status);

    return new Id64(JSON.parse(json).id);
  }

  /** Update an existing element.
   * @param el An editable copy of the element, containing the new/proposed data.
   * @throws [[IModelError]] if unable to update the element.
   */
  public async updateElement(el: Element): Promise<void> {
    if (!this._iModel.iModelToken.isOpen)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    if (el.isPersistent()) {
      assert(false); // you cannot insert a persistent element. call copyForEdit
      return;
    }

    // Note that updating an element is always done synchronously. That is because of constraints
    // on the native code side. Nevertheless, we want the signature of this method to be
    // that of an asynchronous method, since it must run in the services tier and will be
    // asynchronous from a remote client's point of view in any case.
    const {error} = this._iModel.nativeDb.updateElementSync(JSON.stringify(el));
    if (error)
      return Promise.reject(new IModelError(error.status));

    // Discard from the cache, to make sure that the next fetch see the updated version.
    this._loaded.delete(el.id.toString());
  }

  /** Delete an existing element.
   * @param el The element to be deleted
   * @throws [[IModelError]]
   */
  public async deleteElement(el: Element): Promise<void> {
    if (!this._iModel.iModelToken.isOpen)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    // Note that deleting an element is always done synchronously. That is because of constraints
    // on the native code side. Nevertheless, we want the signature of this method to be
    // that of an asynchronous method, since it must run in the services tier and will be
    // asynchronous from a remote client's point of view in any case.
    const {error} = this._iModel.nativeDb.deleteElementSync(el.id.toString());
    if (error)
      return Promise.reject(new IModelError(error.status));

    // Discard from the cache
    this._loaded.delete(el.id.toString());
  }

  /** Query for the child elements of the specified element.
   * @returns Returns an array of child element identifiers.
   * @throws [[IModelError]]
   */
  public async queryChildren(elementId: Id64): Promise<Id64[]> {
    const rows: any[] = await this._iModel.executeQuery("SELECT ECInstanceId as id FROM " + Element.sqlName + " WHERE Parent.Id=?", [elementId]);
    const childIds: Id64[] = [];
    for (const row of rows) {
      childIds.push(new Id64(row.id));
    }
    return Promise.resolve(childIds);
  }

  /** The Id of the root subject element. */
  public get rootSubjectId(): Id64 { return new Id64("0x1"); }

  /** Get the root subject element. */
  public getRootSubject(): Promise<Element> { return this.getElement(this.rootSubjectId); }

  /** Query for aspects rows (by aspect class name) associated with this element.
   * @throws [[IModelError]]
   */
  private async _queryAspects(elementId: Id64, aspectClassName: string): Promise<ElementAspect[]> {
    const name = aspectClassName.split(":");
    const rows: any[] = await this._iModel.executeQuery("SELECT * FROM [" + name[0] + "].[" + name[1] + "] WHERE Element.Id=?", [elementId]);
    if (rows.length === 0)
      return Promise.reject(new IModelError(IModelStatus.NotFound));

    const aspects: ElementAspect[] = [];
    for (const row of rows) {
      const aspectProps: ElementAspectProps = row; // start with everything that SELECT * returned
      aspectProps.classFullName = aspectClassName; // add in property required by EntityProps
      aspectProps.iModel = this._iModel; // add in property required by EntityProps
      aspectProps.element = elementId; // add in property required by ElementAspectProps
      aspectProps.classId = undefined; // clear property from SELECT * that we don't want in the final instance

      const entity = this._iModel.constructEntity(aspectProps);
      assert(entity instanceof ElementAspect);
      const aspect = entity as ElementAspect;
      aspect.setPersistent();
      aspects.push(aspect);
    }

    return aspects;
  }

  /** Get an ElementUniqueAspect instance (by class name) that is related to the specified element.
   * @throws [[IModelError]]
   */
  public async getUniqueAspect(elementId: Id64, aspectClassName: string): Promise<ElementUniqueAspect> {
    const aspects: ElementAspect[] = await this._queryAspects(elementId, aspectClassName);
    assert(aspects[0] instanceof ElementUniqueAspect);
    return aspects[0];
  }

  /** Get the ElementMultiAspect instances (by class name) that are related to the specified element.
   * @throws [[IModelError]]
   */
  public async getMultiAspects(elementId: Id64, aspectClassName: string): Promise<ElementMultiAspect[]> {
    const aspects: ElementAspect[] = await this._queryAspects(elementId, aspectClassName);
    return aspects;
  }
}
