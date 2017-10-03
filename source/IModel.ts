/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ClassRegistry, MetaDataRegistry } from "./ClassRegistry";
import { Code } from "./Code";
import { Element, ElementLoadParams, ElementProps } from "./Element";
import { ElementAspect, ElementAspectProps, ElementMultiAspect, ElementUniqueAspect } from "./ElementAspect";
import { IModelStatus, IModelError } from "./IModelError";
import { Model, ModelProps } from "./Model";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { Guid, Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";
import { BriefcaseToken, BriefcaseManager } from "./backend/BriefcaseManager";
import { ECSqlStatement } from "./backend/ECSqlStatement";

/** An abstract class representing an instance of an iModel. */
export class IModel {
  protected _briefcaseKey: BriefcaseToken | undefined;
  public elements: Elements;
  public models: Models;
  private _classMetaDataRegistry: MetaDataRegistry;
  protected toJSON(): any { return undefined; } // we don't have any members that are relevant to JSON
  public get briefcaseKey(): BriefcaseToken|undefined { return this._briefcaseKey; }

  protected constructor() {
    this.elements = new Elements(this);
    this.models = new Models(this);
  }

  /** Get the meta data for the specified class defined in imodel iModel, blocking until the result is returned.
   * @param schemaName The name of the schema
   * @param className The name of the class
   * @returns On success, the BentleyReturn result property will be the class meta data in JSON format.
   */
  public getECClassMetaDataSync(schemaName: string, className: string): string {
    if (!this.briefcaseKey)
      throw new IModelError(IModelStatus.NotOpen);
    return BriefcaseManager.getECClassMetaDataSync(this.briefcaseKey, schemaName, className);
  }

  /** @deprecated */
  public getElementPropertiesForDisplay(elementId: string): Promise<string> {
    if (!this.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));
    return BriefcaseManager.getElementPropertiesForDisplay(this.briefcaseKey, elementId);
  }

  /** Get the meta data for the specified class defined in imodel iModel (asynchronously).
   * @param schemaName The name of the schema
   * @param className The name of the class
   * @returns The class meta data in JSON format.
   * @throws [[IModelError]]
   */
  public getECClassMetaData(schemaName: string, className: string): Promise<string> {
    if (!this.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));
    return BriefcaseManager.getECClassMetaData(this.briefcaseKey, schemaName, className);
  }

  /** Get the ClassMetaDataRegistry for this iModel */
  public get classMetaDataRegistry(): MetaDataRegistry {
    if (!this._classMetaDataRegistry)
      this._classMetaDataRegistry = new MetaDataRegistry(this);
    return this._classMetaDataRegistry;
  }

  /**
   * Execute a query against this iModel
   * @param sql The ECSql statement to execute
   * @returns all rows in JSON syntax or the empty string if nothing was selected
   * @throws [[IModelError]] If the statement is invalid
   */
  public executeQuery(sql: string): Promise<string> {
    if (!this.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));
    return BriefcaseManager.executeQuery(this.briefcaseKey, sql);
  }

  /**
   * Prepare an ECSql statement.
   * @param ecsql The ECSql statement to prepare
   */
  public prepareECSqlStatement(ecsql: string): ECSqlStatement {
    if (!this.briefcaseKey)
      throw new IModelError(IModelStatus.NotOpen);
    return BriefcaseManager.prepareECSqlStatement(this.briefcaseKey!, ecsql);
  }

}

/** The collection of Models in an iModel  */
export class Models {
  private _iModel: IModel;
  private _loaded: LRUMap<string, Model>;

  public constructor(iModel: IModel, max: number = 500) { this._iModel = iModel; this._loaded = new LRUMap<string, Model>(max); }

  /** Get the Model with the specified identifier.
   * @param modelId The Model identifier.
   * @throws [[IModelError]]
   */
  public async getModel(modelId: Id64): Promise<Model> {
    if (!this._iModel.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    // first see if the model is already in the local cache.
    const loaded = this._loaded.get(modelId.toString());
    if (loaded)
      return loaded;

    // Must go get the model from the iModel. Start by requesting the model's data.
    const json: string = await BriefcaseManager.getModel(this._iModel.briefcaseKey, JSON.stringify({ id: modelId }));
    const props = JSON.parse(json) as ModelProps;
    props.iModel = this._iModel;

    const entity = await ClassRegistry.createInstance(props);
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

/** The collection of Elements in an iModel  */
export class Elements {
  private _iModel: IModel;
  private _loaded: LRUMap<string, Element>;

  /** get the map of loaded elements */
  public get loaded() { return this._loaded; }

  public constructor(iModel: IModel, maxElements: number = 2000) { this._iModel = iModel; this._loaded = new LRUMap<string, Element>(maxElements); }

  /** Private implementation details of getElement */
  private async _doGetElement(opts: ElementLoadParams): Promise<Element> {
    if (!this._iModel.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    // first see if the element is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }

    // Must go get the element from the iModel. Start by requesting the element's data.
    const json = await BriefcaseManager.getElement(this._iModel.briefcaseKey, JSON.stringify(opts));
    const props = JSON.parse(json) as ElementProps;
    props.iModel = this._iModel;

    const entity = await ClassRegistry.createInstance(props);
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
    assert(false);
    return Promise.reject(new IModelError(IModelStatus.BadArg));
  }

  /** Create a new element in memory.
   * @param elementProps The properties to use when creating the element.
   * @throws [[IModelError]] if there is a problem creating the element.
   */
  public async createElement(elementProps: ElementProps): Promise<Element> {
    const element: Element = await ClassRegistry.createInstance(elementProps) as Element;
    assert(element instanceof Element);
    return element;
  }

  /** Insert a new element.
   * @param el The data for the new element.
   * @returns The newly inserted element's Id.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public async insertElement(el: Element): Promise<Id64> {
    if (!this._iModel.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    if (el.isPersistent()) {
      assert(false); // you cannot insert a persistent element. call copyForEdit
      return new Id64();
    }
    const json: string = await BriefcaseManager.insertElement(this._iModel.briefcaseKey, JSON.stringify(el));
    return new Id64(JSON.parse(json).id);
  }

  /** Update an existing element.
   * @param el An editable copy of the element, containing the new/proposed data.
   * @throws [[IModelError]] if unable to update the element.
   */
  public async updateElement(el: Element): Promise<void> {
    if (!this._iModel.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    if (el.isPersistent()) {
      assert(false); // you cannot insert a persistent element. call copyForEdit
      return;
    }
    await BriefcaseManager.updateElement(this._iModel.briefcaseKey, JSON.stringify(el));

    // Discard from the cache, to make sure that the next fetch see the updated version.
    this._loaded.delete(el.id.toString());
  }

  /** Delete an existing element.
   * @param el The element to be deleted
   * @throws [[IModelError]]
   */
  public async deleteElement(el: Element): Promise<void> {
    if (!this._iModel.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    await BriefcaseManager.deleteElement(this._iModel.briefcaseKey, el.id.toString());

    // Discard from the cache
    this._loaded.delete(el.id.toString());
  }

  /** Query for the child elements of the specified element.
   * @returns Returns an array of child element identifiers.
   * @throws [[IModelError]]
   */
  public async queryChildren(elementId: Id64): Promise<Id64[]> {
    const rowsJson: string = await this._iModel.executeQuery("SELECT ECInstanceId as id FROM " + Element.sqlName + " WHERE Parent.Id=" + elementId.toString()); // WIP: need to bind!
    const childIds: Id64[] = [];
    JSON.parse(rowsJson).forEach((row: any) => childIds.push(new Id64(row.id))); // WIP: executeQuery should return ECInstanceId as a string
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
    const rowsJson: string = await this._iModel.executeQuery("SELECT * FROM [" + name[0] + "].[" + name[1] + "] WHERE Element.Id=" + elementId.toString()); // WIP: need to bind!
    const rows: any[] = JSON.parse(rowsJson);
    if (!rows || rows.length === 0)
      return Promise.reject(new IModelError(IModelStatus.NotFound));

    const aspects: ElementAspect[] = [];
    for (const row of rows) {
      const aspectProps: ElementAspectProps = row; // start with everything that SELECT * returned
      aspectProps.classFullName = aspectClassName; // add in property required by EntityProps
      aspectProps.iModel = this._iModel; // add in property required by EntityProps
      aspectProps.element = elementId; // add in property required by ElementAspectProps
      aspectProps.classId = undefined; // clear property from SELECT * that we don't want in the final instance

      const entity = await ClassRegistry.createInstance(aspectProps);
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
