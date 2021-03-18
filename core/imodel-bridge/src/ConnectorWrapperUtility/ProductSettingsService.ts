/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DocumentMapping, Result } from "./DocumentMapper";
import { Logger } from "@bentley/bentleyjs-core";
const req = require("sync-request");

export class ProductSettingService {
  public static productId: string = "2661";

  public static async releaseLockByDocument({
    token,
    imodelId,
    documentId,
    contextId,
  }: {
    token: string;
    imodelId: string;
    documentId: string;
    contextId: string;
  }): Promise<boolean> {
    const briefCaseId = await this.getBriefCaseId(token, imodelId, documentId, contextId);
    if (briefCaseId === undefined) {
      Logger.logError("IModelBridgeFWK", " BriefCaseId does not exists lock release failed");
      return false;
    }
    const status = await this.releaseLockByIModelBriefCase(token, imodelId, briefCaseId.toString());

    if (status === false) {
      return false;
    }
    return true;
  }

  public static async releaseLockByIModelBriefCase(token: string, imodelId: string, briefCaseId: string): Promise<boolean> {
    const value = await this.releaseAllIModelHubLocks(token, imodelId, briefCaseId.toString());

    Logger.logInfo(
      "iModelBridgeFwk Wrapper",
      `[iModelBridgeService.NodeJsWrapper]: ProductSettingService:ReleaseLockByIModelBriefCase-- Release Lock Result::${value}`
    );
    if (value === true) return value;
    return false;
  }

  public static async releaseSchemaLockByDocument({
    token,
    imodelId,
    documentId,
    contextId,
  }: {
    token: string;
    imodelId: string;
    documentId: string;
    contextId: string;
  }): Promise<boolean> {
    const briefCaseId = await this.getBriefCaseId(token, imodelId, documentId, contextId);

    if (briefCaseId === undefined) {
      Logger.logError(
        "ProductSettingsService.ts",
        " ProductSettingService:ReleaseSchemaLockByDocument-- BriefCaseId does not exists schema lock release failed"
      );
      return false;
    }
    const status = await this.releaseSchemaLockByIModelBriefCase(token, imodelId, briefCaseId.toString());

    if (status === false) {
      return false;
    }
    return true;
  }

  public static async releaseSchemaLockByIModelBriefCase(token: string, imodelId: string, briefCaseId: string): Promise<boolean> {
    const value = await this.releaseSchemaLock(token, imodelId, briefCaseId.toString());
    if (value === true) return value;
    return false;
  }

  private static async getBriefCaseId(token: string, imodelId: string, documentId: string, contextId: string): Promise<number | undefined> {
    const url = URLResolver.productSettingsServiceDocumentURL(this.productId, contextId, imodelId);

    const result: Result<DocumentMapping> | undefined = await HttpClientWrapper.getRequest(url, token);

    Logger.logInfo(
      "ProductSettingsService.ts",
      `[iModelBridgeService.NodeJsWrapper]: ProductSettingService:GetBriefCaseId-- Document Mapping Result::${result?.statusCode}`
    );

    if (result?.statusCode === 200) {
      const documentMap: DocumentMapping = result.value;
      if (documentMap !== null && documentMap !== undefined) {
        const document = documentMap.properties.documents.find((doc) => doc.id.toLowerCase() === documentId.toLowerCase());

        Logger.logInfo(
          "iModelBridgeFwk Wrapper",
          `[iModelBridgeService.NodeJsWrapper]: ProductSettingService:GetBriefCaseId--Document Map::${document}`
        );
        if (document !== null && document !== undefined) {
          return document.briefcaseId;
        }
      }
    }
    return undefined;
  }

  private static async releaseAllIModelHubLocks(token: string, imodelId: string, briefCaseId: string): Promise<any> {
    const url = URLResolver.imodelHubDeleteLockURL(imodelId, briefCaseId);
    Logger.logInfo(
      "iModelBridgeFwk Wrapper",
      `[iModelBridgeService.NodeJsWrapper]: ProductSettingService:ReleaseAllIModelHubLocks-- ImodelHubDeleteLock Delete Request`
    );
    return HttpClientWrapper.deleteRequest(url, token);
  }

  private static async releaseSchemaLock(token: string, imodelId: string, briefCaseId: string): Promise<boolean | undefined> {
    const url = URLResolver.imodelHubSchemaLockURL(imodelId, briefCaseId);

    Logger.logInfo(
      "iModelBridgeFwk Wrapper",
      `[iModelBridgeService.NodeJsWrapper]: ProductSettingService:ReleaseSchemaLock-- ImodelHubSchema Lock Release URL ${url}`
    );
    return HttpClientWrapper.deleteRequest(url, token);
  }
}

class HttpClientWrapper {

  public static  async getRequest<T>(url: string, token: string, isTokenRequest = false): Promise<any> {
    const res = req("GET", url, {
      headers: { Authorization: token },
    });

    try {
      const json = await res.getBody("utf8");
      if (!isTokenRequest) {
      }
      if (json.statusCode === undefined) {
        const jsonObj: T = JSON.parse(json);
        return {statusCode: 200, value: jsonObj};
      }
      return {statusCode: json.statusCode, value: json.body};
    } catch (err) {
    }
  }

  public static  async deleteRequest(url: string, token: string): Promise<any>  {
    try {
      const res = req("DELETE", url, {
        headers: { Authorization: token },
      });
      if (res.statusCode === 200)
        return true;
      return false;
    } catch (err) {
      return false;
    }
  }

  public static  async postRequest(url: string, token: string, jsonObj: any): Promise<any>  {
    const res = req("POST", url, {
      headers: { Authorization: token },
      json: jsonObj,
    });
    const json = await res.getBody("utf8");
    return json.statusCode;
  }
}

export class URLResolver {

  public static productSettingsServiceDocumentURL(productId: string, contextId: string, iModel: string): string {
    if (process.env["ProductSettings.URL"] === undefined) {
      throw new Error("ProductSettings.URL environment variable is not defined.");
    }
    return `${process.env["ProductSettings.URL"]}Application/${productId}/Context/${contextId}/iModel/${iModel}/Setting/DocumentMapping/Documents`;
  }

  public static imodelHubDeleteLockURL(imodelId: string, briefCaseId: string): string {
    if (process.env["ImodelHubApi.URL"] === undefined) {
      throw new Error("ImodelHubApi.URL environment variable is not defined.");
    }
    return `${process.env["ImodelHubApi.URL"]}/sv1.1/Repositories/iModel--${imodelId}/iModelScope/Lock/DeleteAll-${briefCaseId}`;
  }

  public static imodelHubSchemaLockURL(imodelId: string, briefCaseId: string): string {
    if (process.env["ImodelHubApi.URL"] === undefined) {
      throw new Error("ImodelHubApi.URL environment variable is not defined.");
    }
    return `${process.env["ImodelHubApi.URL"]}/sv1.1/Repositories/iModel--${imodelId}/iModelScope/Lock/3-1-${briefCaseId}`;
  }

  public static imodelBridgeServiceUpdateUrl(): string {
    if (process.env["ImodelBridgeService.URL"] === undefined) {
      return "";
    }
    return `${process.env["ImodelBridgeService.URL"]}/api/bridgenodejobstatus`;
  }

  public static imsUrl(): string {
    return `${process.env["IMS.URL"]}`;
  }
}
