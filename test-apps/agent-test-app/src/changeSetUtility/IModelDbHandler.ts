/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64String, Id64, ActivityLoggingContext } from "@bentley/bentleyjs-core/lib/bentleyjs-core";
import { CodeScopeSpec, CodeSpec } from "@bentley/imodeljs-common/lib/common";
import { IModelDb, OpenParams } from "@bentley/imodeljs-backend/lib/backend";
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
}
