/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";
import { assert } from "chai";
import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "@bentley/imodeljs-clients";
import { ConnectClient, Project, IModelHubClient, Briefcase } from "@bentley/imodeljs-clients";
import { Code } from "../common/Code";
import { Gateway } from "../common/Gateway";
import { IModelError, IModelStatus } from "../common/IModelError";
import { Element } from "../backend/Element";
import { Model } from "../backend/Model";
import { IModelDb } from "../backend/IModelDb";
import { BriefcaseManager } from "../backend/BriefcaseManager";
import { SpatialCategory, DrawingCategory } from "../backend/Category";
import { ECSqlStatement } from "../backend/ECSqlStatement";
import { NodeAddonLoader } from "@bentley/imodeljs-nodeaddon/NodeAddonLoader";
import { NodeAddonRegistry } from "../backend/NodeAddonRegistry";
import { IModelGateway } from "../gateway/IModelGateway";

import * as path from "path";

// Initialize the gateway classes used by tests
Gateway.initialize(IModelGateway);

declare const __dirname: string;

// Initialize the Node addon used by tests
NodeAddonRegistry.registerAddon(NodeAddonLoader.loadAddon());

// Initialize the location where BriefcaseManager will create briefcases
BriefcaseManager.cachePath = path.join(__dirname, "output/cache/imodels");

export interface IModelTestUtilsOpenOptions {
  copyFilename?: string;
  enableTransactions?: boolean;
  openMode?: OpenMode;
}

export class IModelTestUtils {
  public static user = {
    email: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
  };

  public static connectClient = new ConnectClient("QA");
  public static hubClient = new IModelHubClient("QA");

  public static async getTestUserAccessToken(): Promise<AccessToken> {
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient("QA")).getToken(IModelTestUtils.user.email, IModelTestUtils.user.password);
    assert(authToken);

    const accessToken = await (new ImsDelegationSecureTokenClient("QA")).getToken(authToken!);
    assert(accessToken);

    return accessToken;
  }

  public static async getTestProjectId(accessToken: AccessToken, projectName: string): Promise<string> {
    const project: Project = await IModelTestUtils.connectClient.getProject(accessToken, {
      $select: "*",
      $filter: "Name+eq+'" + projectName + "'",
    });
    assert(project && project.wsgId);
    return project.wsgId;
  }

  public static async getTestIModelId(accessToken: AccessToken, projectId: string, iModelName: string): Promise<string> {
    const iModels = await IModelTestUtils.hubClient.getIModels(accessToken, projectId, {
      $select: "*",
      $filter: "Name+eq+'" + iModelName + "'",
    });
    assert(iModels.length > 0);
    assert(iModels[0].wsgId);

    return iModels[0].wsgId;
  }

  public static async deleteAllBriefcases(accessToken: AccessToken, iModelId: string) {
    const promises = new Array<Promise<void>>();
    const briefcases = await IModelTestUtils.hubClient.getBriefcases(accessToken, iModelId);
    briefcases.forEach((briefcase: Briefcase) => {
      promises.push(IModelTestUtils.hubClient.deleteBriefcase(accessToken, iModelId, briefcase.briefcaseId));
    });
    await Promise.all(promises);
  }

  private static getStat(name: string) {
    let stat: fs.Stats | undefined;
    try {
      stat = fs.statSync(name);
    } catch (err) {
      stat = undefined;
    }
    return stat;
  }

  public static async openIModel(filename: string, opts?: IModelTestUtilsOpenOptions): Promise<IModelDb> {
    const destPath = __dirname + "/output";
    if (!fs.existsSync(destPath))
      fs.mkdirSync(destPath);

    if (opts === undefined)
      opts = {};

    const srcName = __dirname + "/assets/" + filename;
    const dbName = destPath + "/" + (opts.copyFilename ? opts.copyFilename! : filename);
    const srcStat = IModelTestUtils.getStat(srcName);
    const destStat = IModelTestUtils.getStat(dbName);
    if (!srcStat || !destStat || srcStat.mtime.getTime() !== destStat.mtime.getTime()) {
      fs.copySync(srcName, dbName, { preserveTimestamps: true });
    }

    const iModel: IModelDb = await IModelDb.openStandalone(dbName, opts.openMode, opts.enableTransactions); // could throw Error
    assert.exists(iModel);
    return iModel!;
  }

  public static closeIModel(iModel: IModelDb) {
    iModel.closeStandalone();
  }

  // TODO: This needs a home
  public static queryCodeSpecId(imodel: IModelDb, name: string): Id64 | undefined {
    return imodel.withPreparedStatement("SELECT ecinstanceid FROM BisCore.CodeSpec WHERE Name=?", (stmt: ECSqlStatement) => {
      stmt.bindValues([name]);
      if (DbResult.BE_SQLITE_ROW !== stmt.step()) {
        return;
      }
      return new Id64(stmt.getRow().ecinstanceid);
    });
  }

  // TODO: This needs a home
  public static queryElementIdByCode(imodel: IModelDb, code: Code): Id64 {
    if (!code.spec.isValid()) {
      throw new IModelError(IModelStatus.InvalidCodeSpec);
    }
    if (code.value === undefined) {
      throw new IModelError(IModelStatus.InvalidCode);
    }
    return imodel.withPreparedStatement("SELECT ecinstanceid as id FROM " + Element.sqlName + " WHERE CodeSpec.Id=? AND CodeScope.Id=? AND CodeValue=?", (stmt: ECSqlStatement) => {
      stmt.bindValues([code.spec, new Id64(code.scope), code.value!]);
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw new IModelError(IModelStatus.NotFound);
      const id = new Id64(stmt.getRow().id);
      return id;
    });
  }

  /** Create a Code for a DrawingCategory given a name that is meant to be unique within the scope of the specified DefinitionModel
   * @param imodel  The IModel
   * @param parentModelId The scope of the category -- *** TODO: should be DefinitionModel
   * @param codeValue The name of the category
   * @return a Promise if the category's Code
   */
  public static createDrawingCategoryCode(imodel: IModelDb, definitionModelId: Id64, codeValue: string): Code {
    const codeSpec = imodel.codeSpecs.getCodeSpecByName(DrawingCategory.getCodeSpecName());
    return new Code({ spec: codeSpec.id, scope: definitionModelId.toString(), value: codeValue });
  }

  /** Create a Code for a SpatialCategory given a name that is meant to be unique within the scope of the specified DefinitionModelr hyy   t
   * @param imodel  The IModel
   * @param parentModelId The scope of the category -- *** TODO: should be DefinitionModel
   * @param codeValue The name of the category
   * @return a Promise if the category's Code
   */
  public static createSpatialCategoryCode(imodel: IModelDb, definitionModelId: Id64, codeValue: string): Code {
    const codeSpec = imodel.codeSpecs.getCodeSpecByName(SpatialCategory.getCodeSpecName());
    return new Code({ spec: codeSpec.id, scope: definitionModelId.toString(), value: codeValue });
  }

  // TODO: This needs a home
  public static getSpatialCategoryIdByName(imodel: IModelDb, categoryName: string, scopeId?: Id64): Id64 {
    if (scopeId === undefined)
      scopeId = Model.getDictionaryId();
    const code: Code = IModelTestUtils.createSpatialCategoryCode(imodel, scopeId, categoryName);
    const id: Id64 | undefined = IModelTestUtils.queryElementIdByCode(imodel, code);
    if (id === undefined)
      throw new IModelError(DbResult.BE_SQLITE_NOTFOUND);
    return id;
  }

}
