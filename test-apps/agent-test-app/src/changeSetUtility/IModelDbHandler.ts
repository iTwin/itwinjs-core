/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64String, Id64, ActivityLoggingContext } from "@bentley/bentleyjs-core/lib/bentleyjs-core";
import { XYZProps } from "@bentley/geometry-core/lib/geometry-core";
import { CodeScopeSpec, CodeSpec, SpatialViewDefinitionProps } from "@bentley/imodeljs-common/lib/common";
import { IModelDb, OrthographicViewDefinition, ViewDefinition, OpenParams } from "@bentley/imodeljs-backend/lib/backend";
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
