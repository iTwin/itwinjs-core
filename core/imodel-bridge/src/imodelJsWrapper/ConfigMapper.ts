/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const fs = require("fs");
import { get } from "request-promise-native";

export class ConfigMapper {

  private _argumentsMap: Map<string, string | undefined> | undefined;
  private _wrapperArgumentsMap: Map<string, string | undefined> | undefined;

  public constructor() {

  }

  public  async initializeConfigVariables(): Promise<void> {

    return new Promise((resolve, reject) => {

      try {

        this._argumentsMap = new Map<string, string> ();
        this._wrapperArgumentsMap = new Map<string, string> ();

        // Bridge variables
        this._argumentsMap.set ("server-repository", process.env.IMODEL_NAME);
        this._argumentsMap.set ("server-project-guid", process.env.CONTEXT_ID);
        this._argumentsMap.set ("server-environment", process.env.SERVER_ENVIRONMENT);
        if (process.env.DMS_TYPE != null) {
          this._argumentsMap.set ("dms-library", process.env.DMS_LIBRARY);
          if (undefined !== process.env.DMS_INPUT_FILE_URL)
            this._argumentsMap.set ("dms-inputFileUrn", process.env.DMS_INPUT_FILE_URL);
          this._argumentsMap.set ("dms-type", process.env.DMS_TYPE);
          this._argumentsMap.set ("dms-documentGuid", process.env["imbridge--dms-documentGuid"]);
          this._argumentsMap.set ("dms-datasource", process.env["imbridge--dms-datasource"]);
          this._argumentsMap.set ("dms-accessToken", process.env["imbridge--dms-accessToken"]);
          this._argumentsMap.set ("dms-workspaceDir", process.env["imbridge--dms-workspaceDir"]);
        }
        this._argumentsMap.set ("thirdParty-accessToken", process.env["imbridge--thirdParty-accessToken"]);
        this._argumentsMap.set ("fwk-staging-dir", process.env.FWK_STAGINGDIR);
        this._argumentsMap.set ("fwk-jobrun-guid", process.env.FWK_JOBRUN_GUID);
        // Local Variables
        this._wrapperArgumentsMap.set ("server-nodeOidcCallBackUrl", process.env.TOKEN_URI);
        this._wrapperArgumentsMap.set ("server-nodeAuthguid", `Token ${process.env.AUTH_GUID}`);

        this._wrapperArgumentsMap.set ("Bridge_Name", process.env.Bridge_Name);
        this._wrapperArgumentsMap.set ("BridgeExePath", process.env.FWK_BRIDGEDIR);
        this._wrapperArgumentsMap.set ("imodelId", process.env.IMODEL_ID);
        this._wrapperArgumentsMap.set ("BridgeName", process.env.BRIDGE_NAME);
        this._wrapperArgumentsMap.set ("InputFileName", process.env.INPUT_FILE);
        this._wrapperArgumentsMap.set ("WorkingDir", process.env.FWK_WORKDIR);

        // Set iModelJs config variable for region code
        switch (process.env.SERVER_ENVIRONMENT) {
          case "DEV":
            process.env.imjs_buddi_resolve_url_using_region = "103";
            break;
          case "QA":
            process.env.imjs_buddi_resolve_url_using_region = "102";
            break;
          case "RELEASE":
            process.env.imjs_buddi_resolve_url_using_region = "0";
            break;
          default:
            process.env.imjs_buddi_resolve_url_using_region = "103";
        }
        resolve ();

      } catch (error) {
        // console.log(error);
        reject ("Initialization Failed");
      }

    });
  }

  public async imodelServiceToken(): Promise<string> {
    const tokenUrl = this.serverTokenUrl!;

    const requestOptions = {method: "GET", json: true, uri: tokenUrl,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      headers: {Authorization: this.serverAuthGuid},
    };
    // console.log("getting token from token endpoint..");
    const token = await get(requestOptions);
    return token;
  }

  public get serverTokenUrl(): string | undefined {
    return this._wrapperArgumentsMap?.get ("server-nodeOidcCallBackUrl");
  }

  public get serverAuthGuid(): string | undefined {
    return this._wrapperArgumentsMap?.get ("server-nodeAuthguid");
  }

  public set serverAuthGuid(authGuid: string | undefined) {
    // console.log(`setting up new auth guid : ${authGuid}`);
    this._wrapperArgumentsMap?.set ("server-nodeAuthguid", authGuid);
  }

  public get thirdPartyToken(): string | undefined {
    if (this._argumentsMap?.get("thirdParty-accessToken") === undefined) {
      return undefined;
    }
    const token: string = fs.readFileSync( this._argumentsMap?.get("thirdParty-accessToken"), "utf8");
    if (!token.toLowerCase().startsWith("Bearer")) {
      return `Bearer ${token}`;
    }
    return token;
  }

  public get workingDir(): string | undefined {
    return this._wrapperArgumentsMap?.get("WorkingDir");
  }

  public get dmsType(): string | undefined {
    return this._argumentsMap?.get("dms-type");
  }

  public get inputFileName(): string | undefined {
    return this._wrapperArgumentsMap?.get("InputFileName");
  }

  public get activityId() {
    return this._argumentsMap?.get("fwk-jobrun-guid");
  }

  public get documentGuid() {
    return this._argumentsMap?.get("dms-documentGuid");
  }

  public get repositoryUrl() {
    return this._argumentsMap?.get("dms-inputFileUrn");
  }

  public get contextId() {
    return this._argumentsMap?.get("server-project-guid");
  }

  public get stagingDirectory() {
    return this._argumentsMap?.get("fwk-staging-dir");
  }

  public get imodelId() {
    const imodelId = this._argumentsMap?.get("server-repository");
    if (
      imodelId === undefined ||
      imodelId === "" ||
      ConfigMapper.isGuid(imodelId)
    ) {
      return undefined;
    }
    return imodelId;
  }

  public get frameworkExePath() {
    return this._wrapperArgumentsMap?.get("BridgeExePath");
  }

  public get bridgeName() {
    if (this._wrapperArgumentsMap?.get("BridgeName") === undefined)
      return "Undefined";

    return this._wrapperArgumentsMap?.get("BridgeName");
  }

  public static isGuid( guid: string ) {
    const s = `${guid}`;
    const result = s.match("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    if (result === null) {
      return false;
    }
    return true;
  }
}
