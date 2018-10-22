/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64String, Id64, ActivityLoggingContext } from "@bentley/bentleyjs-core/lib/bentleyjs-core";
import { XYZProps } from "@bentley/geometry-core/lib/geometry-core";
import {
    SubCategoryAppearance, CategorySelectorProps, CategoryProps, Code, CodeScopeSpec, CodeSpec, ColorDef, DefinitionElementProps,
    IModel, InformationPartitionElementProps, ModelSelectorProps, SpatialViewDefinitionProps,
} from "@bentley/imodeljs-common/lib/common";
import {
    CategorySelector, DisplayStyle3d, IModelDb, ModelSelector, OrthographicViewDefinition, PhysicalModel, PhysicalPartition,
    SpatialCategory, ViewDefinition, OpenParams,
} from "@bentley/imodeljs-backend/lib/backend";
import { AccessToken } from "@bentley/imodeljs-clients/lib";
import { IModelVersion } from "@bentley/imodeljs-common/lib/common";

const actx = new ActivityLoggingContext("");

/** Injectable handles for opening IModels andStatic functions to create Models, CodeSecs, Categories, Category Selector, Styles, and View Definitions */
export class IModelDbHandler {
    public constructor() { }
    public async openLatestIModelDb(accessToken: AccessToken, projectId: string, iModelId: string,
        openParams: OpenParams = OpenParams.pullAndPush(), iModelVersion: IModelVersion = IModelVersion.latest()): Promise<IModelDb> {
        return await IModelDb.open(actx, accessToken, projectId!, iModelId!, openParams, iModelVersion);
    }
    /** Insert a CodeSpec */
    public static insertCodeSpec(iModelDb: IModelDb, name: string, scopeType: CodeScopeSpec.Type): Id64String {
        const codeSpec = new CodeSpec(iModelDb, Id64.invalid, name, scopeType);
        iModelDb.codeSpecs.insert(codeSpec);
        return codeSpec.id;
    }

    /** Insert a PhysicalModel */
    public static insertPhysicalModel(iModelDb: IModelDb, modelName: string): Id64String {
        const partitionProps: InformationPartitionElementProps = {
            classFullName: PhysicalPartition.classFullName,
            model: IModel.repositoryModelId,
            parent: {
                id: IModel.rootSubjectId,
                relClassName: "BisCore:SubjectOwnsPartitionElements",
            },
            code: PhysicalPartition.createCode(iModelDb, IModel.rootSubjectId, modelName),
        };
        const partitionId: Id64String = iModelDb.elements.insertElement(partitionProps);
        const model: PhysicalModel = iModelDb.models.createModel({
            classFullName: PhysicalModel.classFullName,
            modeledElement: { id: partitionId },
        }) as PhysicalModel;
        return iModelDb.models.insertModel(model);
    }

    /** Insert a SpatialCategory */
    public static insertSpatialCategory(iModelDb: IModelDb, modelId: Id64String, name: string, color: ColorDef): Id64String {
        const categoryProps: CategoryProps = {
            classFullName: SpatialCategory.classFullName,
            model: modelId,
            code: SpatialCategory.createCode(iModelDb, modelId, name),
            isPrivate: false,
        };
        const categoryId: Id64String = iModelDb.elements.insertElement(categoryProps);
        const category: SpatialCategory = iModelDb.elements.getElement(categoryId) as SpatialCategory;
        category.setDefaultAppearance(new SubCategoryAppearance({ color }));
        iModelDb.elements.updateElement(category);
        return categoryId;
    }

    /** Insert a ModelSelector which is used to select which Models are displayed by a ViewDefinition. */
    public static insertModelSelector(iModelDb: IModelDb, modelId: Id64String, models: string[]): Id64String {
        const modelSelectorProps: ModelSelectorProps = {
            classFullName: ModelSelector.classFullName,
            model: modelId,
            code: Code.createEmpty(),
            models,
        };
        return iModelDb.elements.insertElement(modelSelectorProps);
    }

    /** Insert a CategorySelector which is used to select which categories are displayed by a ViewDefinition. */
    public static insertCategorySelector(iModelDb: IModelDb, modelId: Id64String, categories: string[]): Id64String {
        const categorySelectorProps: CategorySelectorProps = {
            classFullName: CategorySelector.classFullName,
            model: modelId,
            code: Code.createEmpty(),
            categories,
        };
        return iModelDb.elements.insertElement(categorySelectorProps);
    }

    /** Insert a DisplayStyle3d for use by a ViewDefinition. */
    public static insertDisplayStyle3d(iModelDb: IModelDb, modelId: Id64String): Id64String {
        const displayStyleProps: DefinitionElementProps = {
            classFullName: DisplayStyle3d.classFullName,
            model: modelId,
            code: Code.createEmpty(),
            isPrivate: false,
        };
        return iModelDb.elements.insertElement(displayStyleProps);
    }

    /** Insert an OrthographicViewDefinition */
    public static insertOrthographicViewDefinition(
        iModelDb: IModelDb,
        modelId: Id64String,
        viewName: string,
        modelSelectorId: Id64String,
        categorySelectorId: Id64String,
        displayStyleId: Id64String,
        origin: XYZProps,
        extents: XYZProps,
    ): Id64String {
        const viewDefinitionProps: SpatialViewDefinitionProps = {
            classFullName: OrthographicViewDefinition.classFullName,
            model: modelId,
            code: ViewDefinition.createCode(iModelDb, modelId, viewName),
            modelSelectorId,
            categorySelectorId,
            displayStyleId,
            origin,
            extents,
            cameraOn: false,
            camera: { eye: [0, 0, 0], lens: 0, focusDist: 0 }, // not used when cameraOn === false
        };
        return iModelDb.elements.insertElement(viewDefinitionProps);
    }
}
