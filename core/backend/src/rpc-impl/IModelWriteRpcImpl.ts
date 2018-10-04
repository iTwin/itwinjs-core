/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */
import { Id64, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import { AxisAlignedBox3d, RpcInterface, RpcManager, IModel, IModelToken, IModelWriteRpcInterface, ThumbnailProps, ImageSourceFormat, ElementProps } from "@bentley/imodeljs-common";
import { IModelDb, OpenParams, ExclusiveAccessOption } from "../IModelDb";
import { OpenIModelDbMemoizer } from "./OpenIModelDbMemoizer";
import { PhysicalPartition, InformationPartitionElement } from "../Element";
import { PhysicalModel, DictionaryModel } from "../Model";
import { SpatialCategory } from "../Category";

/**
 * The backend implementation of IModelWriteRpcInterface.
 * @hidden
 */
export class IModelWriteRpcImpl extends RpcInterface implements IModelWriteRpcInterface {
    public static register() { RpcManager.registerImpl(IModelWriteRpcInterface, IModelWriteRpcImpl); }

    public async openForWrite(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        return OpenIModelDbMemoizer.openIModelDb(activityContext, AccessToken.fromJson(accessToken)!, iModelToken, OpenParams.pullAndPush(ExclusiveAccessOption.TryReuseOpenBriefcase));
    }

    public async saveChanges(iModelToken: IModelToken, description?: string): Promise<void> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        IModelDb.find(iModelToken).saveChanges(description);
    }
    public async updateProjectExtents(iModelToken: IModelToken, newExtents: AxisAlignedBox3d): Promise<void> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        IModelDb.find(iModelToken).updateProjectExtents(newExtents);
    }

    public async saveThumbnail(iModelToken: IModelToken, val: Uint8Array): Promise<void> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const int16Val = new Uint16Array(val.buffer);
        const int32Val = new Uint32Array(val.buffer);
        const props: ThumbnailProps = { format: int16Val[1] === ImageSourceFormat.Jpeg ? "jpeg" : "png", width: int16Val[2], height: int16Val[3], image: new Uint8Array(val.buffer, 16, int16Val[0]) };
        const id = new Id64([int32Val[2], int32Val[3]]);
        if (!id.isValid || props.width === undefined || props.height === undefined || props.image.length <= 0)
            return Promise.reject(new Error("bad args"));

        if (0 !== IModelDb.find(iModelToken).views.saveThumbnail(id, props))
            return Promise.reject(new Error("failed to save thumbnail"));

        return Promise.resolve();
    }
    public async insertElement(iModelToken: IModelToken, elementProps: ElementProps): Promise<Id64> {
        return IModelDb.find(iModelToken).elements.insertElement(elementProps);
    }

    public async  createAndInsertPhysicalPartition(iModelToken: IModelToken, modelName: string): Promise<Id64> {
        const iModelDb = IModelDb.find(iModelToken);
        const modelCode = InformationPartitionElement.createCode(iModelDb, IModelDb.rootSubjectId, modelName);
        if (iModelDb.elements.queryElementIdByCode(modelCode) !== undefined)
            return Promise.reject("Model already exists");

        const modeledElementProps: ElementProps = {
            classFullName: PhysicalPartition.classFullName,
            iModel: iModelDb,
            parent: { id: IModel.rootSubjectId, relClassName: "BisCore:SubjectOwnsPartitionElements" },
            model: IModel.repositoryModelId,
            code: modelCode,
        };
        const modeledElement = iModelDb.elements.createElement(modeledElementProps);
        return iModelDb.elements.insertElement(modeledElement);
    }

    public async createAndInsertPhysicalModel(iModelToken: IModelToken, modeledElementId: Id64, privateModel: boolean = false): Promise<Id64> {
        const iModelDb = IModelDb.find(iModelToken);
        const newModel = iModelDb.models.createModel({ modeledElement: { id: modeledElementId }, classFullName: PhysicalModel.classFullName, isPrivate: privateModel });
        return iModelDb.models.insertModel(newModel);
    }
    // Create a SpatialCategory, insert it, and set its default appearance
    public async createAndInsertSpatialCategory(iModelToken: IModelToken, categoryName: string): Promise<Id64> {
        const iModelDb = IModelDb.find(iModelToken);
        const dictionary: DictionaryModel = iModelDb.models.getModel(IModel.dictionaryId) as DictionaryModel;
        const cat: SpatialCategory = SpatialCategory.create(dictionary, categoryName);
        cat.id = iModelDb.elements.insertElement(cat);
        return cat.id;
    }
}
