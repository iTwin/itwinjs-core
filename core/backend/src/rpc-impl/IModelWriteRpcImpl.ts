/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */
import { Id64, ClientRequestContext, Id64String, DbOpcode, assert, Id64Array, GuidString } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, LockLevel, LockType } from "@bentley/imodeljs-clients";
import { RpcInterface, RpcManager, IModelProps, IModelToken, IModelTokenProps, IModelWriteRpcInterface, ThumbnailProps, ImageSourceFormat, AxisAlignedBox3dProps, CodeProps, ElementProps, IModel, RelatedElement, SubCategoryAppearance, Code } from "@bentley/imodeljs-common";
import { BriefcaseIModelDb, IModelDb, OpenParams } from "../IModelDb";
import { Range3d } from "@bentley/geometry-core";
import { ConcurrencyControl, AuthorizedBackendRequestContext, PhysicalPartition, SubjectOwnsPartitionElements, PhysicalModel, SpatialCategory, Element } from "../imodeljs-backend";

class EditingFunctions {
  public static async createAndInsertPartition(rqctx: AuthorizedBackendRequestContext, iModelDb: IModelDb, newModelCode: CodeProps): Promise<Id64String> {
    assert(Code.isValid(newModelCode));
    const modeledElementProps: ElementProps = {
      classFullName: PhysicalPartition.classFullName,
      parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
      model: IModel.repositoryModelId,
      code: newModelCode,
    };
    const modeledElement: Element = iModelDb.elements.createElement(modeledElementProps);
    if (iModelDb instanceof BriefcaseIModelDb) {
      await iModelDb.concurrencyControl.requestResources(rqctx, [{ element: modeledElement, opcode: DbOpcode.Insert }]);
      rqctx.enter();
    }
    return iModelDb.elements.insertElement(modeledElement);
  }

  public static async createAndInsertPhysicalModel(rqctx: AuthorizedBackendRequestContext, iModelDb: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Promise<Id64String> {
    const newModel = iModelDb.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: privateModel });
    if (iModelDb instanceof BriefcaseIModelDb) {
      await iModelDb.concurrencyControl.requestResources(rqctx, [], [{ model: newModel, opcode: DbOpcode.Insert }]);
      rqctx.enter();
    }
    return iModelDb.models.insertModel(newModel);
  }

  public static async createAndInsertPhysicalPartitionAndModel(rqctx: AuthorizedBackendRequestContext, iModelDb: IModelDb, newModelCode: CodeProps, privateModel: boolean = false): Promise<Id64String> {
    const eid = await this.createAndInsertPartition(rqctx, iModelDb, newModelCode);
    rqctx.enter();
    const modeledElementRef = new RelatedElement({ id: eid });
    const mid = await this.createAndInsertPhysicalModel(rqctx, iModelDb, modeledElementRef, privateModel);
    rqctx.enter();
    assert(mid === eid);
    return eid;
  }

  public static async createAndInsertSpatialCategory(rqctx: AuthorizedBackendRequestContext, iModelDb: IModelDb, scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String> {
    const category = SpatialCategory.create(iModelDb, scopeModelId, categoryName);
    if (iModelDb instanceof BriefcaseIModelDb) {
      await iModelDb.concurrencyControl.requestResources(rqctx, [{ element: category, opcode: DbOpcode.Insert }]);
      rqctx.enter();
    }
    const categoryId = iModelDb.elements.insertElement(category);
    category.setDefaultAppearance(appearance);
    return categoryId;
  }
}

/**
 * The backend implementation of IModelWriteRpcInterface.
 * @internal
 */
export class IModelWriteRpcImpl extends RpcInterface implements IModelWriteRpcInterface {
  public static register() { RpcManager.registerImpl(IModelWriteRpcInterface, IModelWriteRpcImpl); }

  public async openForWrite(tokenProps: IModelTokenProps): Promise<IModelProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const openParams: OpenParams = OpenParams.pullAndPush();
    openParams.timeout = 1000;
    const db = await BriefcaseIModelDb.open(requestContext, iModelToken.contextId!, iModelToken.iModelId!, openParams);
    return db.toJSON();
  }

  public async saveChanges(tokenProps: IModelTokenProps, description?: string): Promise<void> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    IModelDb.find(iModelToken).saveChanges(description);
  }

  public async hasUnsavedChanges(tokenProps: IModelTokenProps): Promise<boolean> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    return IModelDb.find(iModelToken).txns.hasUnsavedChanges;
  }

  public async hasPendingTxns(tokenProps: IModelTokenProps): Promise<boolean> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    return IModelDb.find(iModelToken).txns.hasPendingTxns;
  }

  public async getParentChangeset(tokenProps: IModelTokenProps): Promise<string> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    return IModelDb.find(iModelToken).briefcase.parentChangeSetId;
  }

  public async updateProjectExtents(tokenProps: IModelTokenProps, newExtents: AxisAlignedBox3dProps): Promise<void> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    IModelDb.find(iModelToken).updateProjectExtents(Range3d.fromJSON(newExtents));
  }

  public async saveThumbnail(tokenProps: IModelTokenProps, val: Uint8Array): Promise<void> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const int32Val = new Uint32Array(val.buffer, 0, 6);
    const props: ThumbnailProps = { format: int32Val[1] === ImageSourceFormat.Jpeg ? "jpeg" : "png", width: int32Val[2], height: int32Val[3], image: new Uint8Array(val.buffer, 24, int32Val[0]) };
    const id = Id64.fromLocalAndBriefcaseIds(int32Val[4], int32Val[5]);
    if (!Id64.isValid(id) || props.width === undefined || props.height === undefined || props.image.length <= 0)
      return Promise.reject(new Error("bad args"));

    if (0 !== IModelDb.find(iModelToken).views.saveThumbnail(id, props))
      return Promise.reject(new Error("failed to save thumbnail"));

    return Promise.resolve();
  }

  public async lockModel(tokenProps: IModelTokenProps, modelId: Id64String, level: LockLevel): Promise<void> {
    const iModelDb = BriefcaseIModelDb.findByToken(IModelToken.fromJSON(tokenProps));
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const request = new ConcurrencyControl.Request();
    request.addLocks([{ type: LockType.Model, objectId: modelId, level }]);
    return iModelDb.concurrencyControl.request(requestContext, request);
  }

  public async synchConcurrencyControlResourcesCache(tokenProps: IModelTokenProps): Promise<void> {
    const iModelDb = BriefcaseIModelDb.findByToken(IModelToken.fromJSON(tokenProps));
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return iModelDb.concurrencyControl.syncCache(requestContext);
  }

  public async pullMergePush(tokenProps: IModelTokenProps, comment: string, doPush: boolean): Promise<GuidString> {
    const iModelDb = BriefcaseIModelDb.findByToken(IModelToken.fromJSON(tokenProps));
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    await iModelDb.pullAndMergeChanges(requestContext);
    requestContext.enter();
    const parentChangeSetId = iModelDb.briefcase.parentChangeSetId;
    if (doPush)
      await iModelDb.pushChanges(requestContext, comment);
    return parentChangeSetId;
  }

  public async doConcurrencyControlRequest(tokenProps: IModelTokenProps): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const iModelDb = BriefcaseIModelDb.findByToken(IModelToken.fromJSON(tokenProps));
    const rqctx = new AuthorizedBackendRequestContext(requestContext.accessToken);
    return iModelDb.concurrencyControl.request(rqctx);
  }

  public async getModelsAffectedByWrites(tokenProps: IModelTokenProps): Promise<Id64String[]> {
    const iModelDb = BriefcaseIModelDb.findByToken(IModelToken.fromJSON(tokenProps));
    return iModelDb.concurrencyControl.modelsAffectedByWrites;
  }

  public async deleteElements(tokenProps: IModelTokenProps, ids: Id64Array) {
    const iModelDb = IModelDb.find(IModelToken.fromJSON(tokenProps));
    ids.forEach((id) => iModelDb.elements.deleteElement(id));
  }

  public async requestResources(tokenProps: IModelTokenProps, elementIds: Id64Array, modelIds: Id64Array, opcode: DbOpcode): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const iModelDb = BriefcaseIModelDb.findByToken(IModelToken.fromJSON(tokenProps));
    const elements = elementIds.map((id: string) => ({ element: iModelDb.elements.getElement(id), opcode }));
    const models = modelIds.map((id: string) => ({ model: iModelDb.models.getModel(id), opcode }));
    return iModelDb.concurrencyControl.requestResources(requestContext, elements, models);
  }

  public async createAndInsertPhysicalModel(tokenProps: IModelTokenProps, newModelCode: CodeProps, privateModel: boolean): Promise<Id64String> {
    const iModelDb = IModelDb.find(IModelToken.fromJSON(tokenProps));
    return EditingFunctions.createAndInsertPhysicalPartitionAndModel(ClientRequestContext.current as AuthorizedClientRequestContext, iModelDb, newModelCode, privateModel);
  }

  public async createAndInsertSpatialCategory(tokenProps: IModelTokenProps, scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String> {
    const iModelDb = IModelDb.find(IModelToken.fromJSON(tokenProps));
    return EditingFunctions.createAndInsertSpatialCategory(ClientRequestContext.current as AuthorizedClientRequestContext, iModelDb, scopeModelId, categoryName, appearance);
  }
}
