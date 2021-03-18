// /*---------------------------------------------------------------------------------------------
// * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
// * See LICENSE.md in the project root for license terms and full copyright notice.
// *--------------------------------------------------------------------------------------------*/
// const fs = require("fs");
// import { get } from "request-promise-native";

// export class ConfigMapper {

//   private _argumentsMap: Map<string, string | undefined> | undefined;
//   private _wrapperArgumentsMap: Map<string, string | undefined> | undefined;

//   public constructor() {

//   }

//   public  async initializeConfigVariables(): Promise<void> {

//     return new Promise((resolve, reject) => {

//       try {

//         this._argumentsMap = new Map<string, string> ();
//         this._wrapperArgumentsMap = new Map<string, string> ();

//         // Bridge variables
//         this._argumentsMap.set ("server-repository", process.env.IMODEL_NAME);
//         this._argumentsMap.set ("server-project-guid", process.env.CONTEXT_ID);
//         this._argumentsMap.set ("server-environment", process.env.SERVER_ENVIRONMENT);
//         if (process.env.DMS_TYPE != null) {
//           this._argumentsMap.set ("dms-library", process.env.DMS_LIBRARY);
//           if (undefined !== process.env.DMS_INPUT_FILE_URL)
//             this._argumentsMap.set ("dms-inputFileUrn", process.env.DMS_INPUT_FILE_URL);
//           this._argumentsMap.set ("dms-type", process.env.DMS_TYPE);
//           this._argumentsMap.set ("dms-documentGuid", process.env["imbridge--dms-documentGuid"]);
//           this._argumentsMap.set ("dms-datasource", process.env["imbridge--dms-datasource"]);
//           this._argumentsMap.set ("dms-accessToken", process.env["imbridge--dms-accessToken"]);
//           this._argumentsMap.set ("dms-workspaceDir", process.env["imbridge--dms-workspaceDir"]);
//         }
//         this._argumentsMap.set ("thirdParty-accessToken", process.env["imbridge--thirdParty-accessToken"]);
//         this._argumentsMap.set ("fwk-staging-dir", process.env.FWK_STAGINGDIR);
//         this._argumentsMap.set ("fwk-jobrun-guid", process.env.FWK_JOBRUN_GUID);
//         // Local Variables
//         this._wrapperArgumentsMap.set ("server-nodeOidcCallBackUrl", process.env.TOKEN_URI);
//         this._wrapperArgumentsMap.set ("server-nodeAuthguid", `Token ${process.env.AUTH_GUID}`);

//         this._wrapperArgumentsMap.set ("Bridge_Name", process.env.Bridge_Name);
//         this._wrapperArgumentsMap.set ("BridgeExePath", process.env.FWK_BRIDGEDIR);
//         this._wrapperArgumentsMap.set ("imodelId", process.env.IMODEL_ID);
//         this._wrapperArgumentsMap.set ("BridgeName", process.env.BRIDGE_NAME);
//         this._wrapperArgumentsMap.set ("InputFileName", process.env.INPUT_FILE);
//         this._wrapperArgumentsMap.set ("WorkingDir", process.env.FWK_WORKDIR);

//         // Set iModelJs config variable for region code
//         switch (process.env.SERVER_ENVIRONMENT) {
//           case "DEV":
//             process.env.imjs_buddi_resolve_url_using_region = "103";
//             break;
//           case "QA":
//             process.env.imjs_buddi_resolve_url_using_region = "102";
//             break;
//           case "RELEASE":
//             process.env.imjs_buddi_resolve_url_using_region = "0";
//             break;
//           default:
//             process.env.imjs_buddi_resolve_url_using_region = "103";
//         }
//         resolve ();

//       } catch (error) {
//         // console.log(error);
//         reject ("Initialization Failed");
//       }

//     });
//   }

//   public async imodelServiceToken(): Promise<string> {
//     const tokenUrl = this.serverTokenUrl!;

//     const requestOptions = {method: "GET", json: true, uri: tokenUrl,
//       // eslint-disable-next-line @typescript-eslint/naming-convention
//       headers: {Authorization: this.serverAuthGuid},
//     };
//     // console.log("getting token from token endpoint..");
//     const token = await get(requestOptions);
//     return token;
//   }

//   public get serverTokenUrl(): string | undefined {
//     return this._wrapperArgumentsMap?.get ("server-nodeOidcCallBackUrl");
//   }

//   public get serverAuthGuid(): string | undefined {
//     return this._wrapperArgumentsMap?.get ("server-nodeAuthguid");
//   }

//   public set serverAuthGuid(authGuid: string | undefined) {
//     // console.log(`setting up new auth guid : ${authGuid}`);
//     this._wrapperArgumentsMap?.set ("server-nodeAuthguid", authGuid);
//   }

//   public get thirdPartyToken(): string | undefined {
//     if (this._argumentsMap?.get("thirdParty-accessToken") === undefined) {
//       return undefined;
//     }
//     const token: string = fs.readFileSync( this._argumentsMap?.get("thirdParty-accessToken"), "utf8");
//     if (!token.toLowerCase().startsWith("Bearer")) {
//       return `Bearer ${token}`;
//     }
//     return token;
//   }

//   public get workingDir(): string | undefined {
//     return this._wrapperArgumentsMap?.get("WorkingDir");
//   }

//   public get dmsType(): string | undefined {
//     return this._argumentsMap?.get("dms-type");
//   }

//   public get inputFileName(): string | undefined {
//     return this._wrapperArgumentsMap?.get("InputFileName");
//   }

//   public get activityId() {
//     return this._argumentsMap?.get("fwk-jobrun-guid");
//   }

//   public get documentGuid() {
//     return this._argumentsMap?.get("dms-documentGuid");
//   }

//   public get repositoryUrl() {
//     return this._argumentsMap?.get("dms-inputFileUrn");
//   }

//   public get contextId() {
//     return this._argumentsMap?.get("server-project-guid");
//   }

//   public get stagingDirectory() {
//     return this._argumentsMap?.get("fwk-staging-dir");
//   }

//   public get imodelId() {
//     const imodelId = this._argumentsMap?.get("server-repository");
//     if (
//       imodelId === undefined ||
//       imodelId === "" ||
//       ConfigMapper.isGuid(imodelId)
//     ) {
//       return undefined;
//     }
//     return imodelId;
//   }

//   public get frameworkExePath() {
//     return this._wrapperArgumentsMap?.get("BridgeExePath");
//   }

//   public get bridgeName() {
//     if (this._wrapperArgumentsMap?.get("BridgeName") === undefined)
//       return "Undefined";

//     return this._wrapperArgumentsMap?.get("BridgeName");
//   }

//   public static isGuid( guid: string ) {
//     const s = `${guid}`;
//     const result = s.match("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
//     if (result === null) {
//       return false;
//     }
//     return true;
//   }
// }
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const fs = require("fs");
import path = require("path");
import { Utilities } from "./Utilities";
import { Logger } from "@bentley/bentleyjs-core";
// import { HttpClientWrapper } from "./../HttpClient/HttpClientWrapper";
// import { Result } from "../BreifcaseManager/DocumentMapper";
// import { Token } from "./Token";
import { get } from "request-promise-native";

export class ConfigMapper {

  private _argumentsMap: Map<string, string | undefined> | undefined;
  private _wrapperArgumentsMap: Map<string, string | undefined> | undefined;
  private _emptyValueParameterWhitelist: string[] = [];
  // private _token: Token;

  public constructor() {
    // this._token = new Token();
  }

  public  async initializeConfigVariables(): Promise<void> {

    return new Promise((resolve, reject) => {

      try {

        this._argumentsMap = new Map<string, string> ();
        this._wrapperArgumentsMap = new Map<string, string> ();
        this._emptyValueParameterWhitelist = ["fwk-enable-crash-reporting", "fwk-all-docs-processed"];

        // Bridge variables
        this._argumentsMap.set ("server-repository", process.env.IMODEL_NAME);
        this._argumentsMap.set ("notifyUserEmail", process.env.NOTIFY_USER_EMAIL);
        // ??

        this._argumentsMap.set ("server-oidcCallBackUrl", (!process.env.CLIENT_ID && !process.env.TOKEN_URI) ? undefined : this.serverTokenUrl);

        this._argumentsMap.set ("server-project", process.env["server-project"]);
        this._argumentsMap.set ("server-project-guid", process.env.CONTEXT_ID);
        this._argumentsMap.set ("server-environment", process.env.SERVER_ENVIRONMENT);
        this._argumentsMap.set ("server-briefcaseId", process.env.SERVER_BRIEFCASEID);
        this._argumentsMap.set ("server-clientId", process.env.CLIENT_ID);
        this._argumentsMap.set ("server-clientSecret", process.env.CLIENT_SECRET);
        this._argumentsMap.set ("server-clientScope", process.env.CLIENT_SCOPE);

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

        // this._argumentsMap.set("server-authguid", `Token ${process.env.AUTH_GUID}`);
        this._argumentsMap.set ("thirdParty-accessToken", process.env["imbridge--thirdParty-accessToken"]);

        this._argumentsMap.set ("fwk-enable-crash-reporting", "");

        this._argumentsMap.set ("fwk-bridge-library", process.env.FWK_BRIDGE_LIBRARY);
        const fileName = process.env.INPUT_FILE !== undefined ? path.basename(process.env.INPUT_FILE) : "";
        const inputFile: string = `${process.env.FWK_STAGINGDIR!}\\${fileName}`;
        this._argumentsMap.set ("fwk-input", inputFile);
        // this._argumentsMap.set ("fwk-input-sheet", process.env.FWK_JOBRUN_GUID);
        this._argumentsMap.set ("fwk-revision-comment", process.env.JOB_DESTINATION);
        this._argumentsMap.set ("fwk-logging-config-file", process.env.Fwk_Logging_Config_File);
        this._argumentsMap.set ("fwk-argsJson", process.env.Fwk_ArgsJson);

        this._argumentsMap.set ("fwk-jobrun-guid", process.env.FWK_JOBRUN_GUID);
        this._argumentsMap.set ("fwk-assetsDir", process.env.FWK_ASSETSDIR);
        this._argumentsMap.set ("fwk-jobrequest-guid", process.env.FWK_JOBREQUEST_GUID);
        this._argumentsMap.set ("fwk-create-repository-if-necessary", process.env.CREATE_REPOSITORY_IF_NECESSARY);

        if (process.env.FWK_UNMAP_INPUT_FILE !== undefined)
          this._argumentsMap.set ("fwk-unmap-input-file", process.env.FWK_UNMAP_INPUT_FILE);

        if (undefined === process.env.SKIP_ASSIGN) {
          if (undefined === process.env["AZStorage.ConnString"])
            // Only default to skip if Affinity Report is not passed in
            this._argumentsMap.set("fwk-skip-assignment-check", "1");
        } else {
          this._argumentsMap.set("fwk-skip-assignment-check", process.env.SKIP_ASSIGN);
        }
        this._argumentsMap.set("fwk-status-message-sink-url", process.env.fwk_status_message_sink_url);
        this._argumentsMap.set ("fwk-status-message-interval", process.env.fwk_status_message_interval);
        this._argumentsMap.set ("fwk-staging-dir", process.env.FWK_STAGINGDIR);
        this._argumentsMap.set("fwk-logging-config-file", process.env["fwk-logging-config-file"]);
        this._argumentsMap.set ("server-user", process.env["server-user"]);

        // Local Variables
        this._wrapperArgumentsMap.set ("Seq.ServerUrl", process.env["Seq.ServerUrl"]);
        this._wrapperArgumentsMap.set ("Seq.ApiKey", process.env["Seq.ApiKey"]);
        this._wrapperArgumentsMap.set ("Seq.BridgeLoggingLevel", process.env["Seq.BridgeLoggingLevel"]);
        this._wrapperArgumentsMap.set ("Seq.DefaultLoggingLevel", process.env["Seq.DefaultLoggingLevel"]);

        this._wrapperArgumentsMap.set ("ServiceBus.ConnString", process.env["ServiceBus.ConnString"]);
        this._wrapperArgumentsMap.set ("ServiceBus.TopicName", process.env["ServiceBus.TopicName"]);

        this._wrapperArgumentsMap.set ("Bridge_Name", process.env.Bridge_Name);
        this._wrapperArgumentsMap.set ("BridgeVersion", process.env.Bridge_Version);
        this._wrapperArgumentsMap.set ("BridgeExePath", process.env.FWK_BRIDGEDIR);
        this._wrapperArgumentsMap.set ("job-time-out", process.env.FWK_TIMEOUT);
        this._wrapperArgumentsMap.set ("imodelId", process.env.IMODEL_ID);
        this._wrapperArgumentsMap.set ("allowTimeout", process.env.Allow_TimeOut);
        this._wrapperArgumentsMap.set ("BuildNumber", process.env.BUILD_NUMBER);
        this._wrapperArgumentsMap.set ("BridgeName", process.env.BRIDGE_NAME);
        this._wrapperArgumentsMap.set ("BridgeType", process.env.BRIDGE_TYPE);
        this._wrapperArgumentsMap.set ("UseCustomBriefcase", process.env.CUSTOM_BRIEFCASEID);
        this._wrapperArgumentsMap.set ("InputFileName", process.env.INPUT_FILE);

        this._wrapperArgumentsMap.set ("IModelJobDefinitionId", process.env["--imodelJobDefId"]);
        this._wrapperArgumentsMap.set ("IsLastFileInJob", process.env["--isLastFileInJob"]);
        this._wrapperArgumentsMap.set ("AzureBatch.PoolId", process.env["AzureBatch.PoolId"]);
        this._wrapperArgumentsMap.set ("server-accessToken", process.env["imbridge--server-token"]);
        this._wrapperArgumentsMap.set ("server-nodeAuthguid", `Token ${process.env.AUTH_GUID}`);
        this._wrapperArgumentsMap.set ("server-nodeOidcCallBackUrl", process.env.TOKEN_URI);
        this._wrapperArgumentsMap.set ("cleanupFilePattern", process.env.CLEANUP_FILE_PATTERN);
        this._wrapperArgumentsMap.set ("logtimeout", process.env.JOB_HANG_TIMEOUT);

        this._wrapperArgumentsMap.set ("WorkingDir", process.env.FWK_WORKDIR);
        this._wrapperArgumentsMap.set ("AZStorage.ConnString", process.env["AZStorage.ConnString"]);
        this._wrapperArgumentsMap.set ("AZStorage.BlobContainerName", process.env["AZStorage.BlobContainerName"]);

        // Set dynamic bridge variables
        const rawBridgeDynamicVariables = process.env.BridgeArguments;
        const bridgeDynamicVariables = rawBridgeDynamicVariables ? JSON.parse(rawBridgeDynamicVariables) : [];
        for (const variableName in bridgeDynamicVariables) {
          const variableValue = bridgeDynamicVariables[variableName];

          if (variableValue === false) {
            // False flag is the same as not passing it at all
            continue;
          }

          if (variableValue === true) {
            // For flag to be true it can be passed in without a value
            this._emptyValueParameterWhitelist.push(variableName);
            this._argumentsMap.set(variableName, "");
            continue;
          }

          this._argumentsMap.set(variableName, variableValue.toString());
        }

        // Set dynamic local variables
        const rawWrapperDynamicVariables = process.env.EnvironmentVariables;
        const wrapperDynamicVariables = rawWrapperDynamicVariables ? JSON.parse(rawWrapperDynamicVariables) : [];
        for (const variableName in wrapperDynamicVariables) {
          const variableValue = wrapperDynamicVariables[variableName];

          this._wrapperArgumentsMap.set(variableName, variableValue.toString());
        }

        // Update token with auth guid
        // this._token.AuthGuid = this.authGuid!;

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
        console.log(error);
        reject ("Initialization Failed");
      }

    });
  }
  public get bridgeType() {
    if (this._wrapperArgumentsMap?.get ("BridgeType") === undefined)
      return "Undefined";

    return this._wrapperArgumentsMap?.get ("BridgeType");
  }

  public getLogTimeOut(): number | undefined {
    if (this._wrapperArgumentsMap!.get ("logtimeout") === undefined) {
      return undefined;
    }
    return Number(this._wrapperArgumentsMap?.get ("logtimeout"));
  }

  public getBuddiCode(): string {

    if (process.env.SERVER_ENVIRONMENT === null || process.env.SERVER_ENVIRONMENT === undefined) {
      return "103";
    }

    switch (process.env.SERVER_ENVIRONMENT?.toUpperCase()) {
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
    return process.env.imjs_buddi_resolve_url_using_region;
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

  public get dmsAccessToken(): string | undefined {

    if (this._argumentsMap?.get ("dms-accessToken") === undefined) {
      return undefined;
    }
    const token: string = fs.readFileSync(this._argumentsMap?.get ("dms-accessToken"), "utf8");
    return token;
  }

  public get thirdPartyToken(): string | undefined {
    if (this._argumentsMap?.get ("thirdParty-accessToken") === undefined) {
      return undefined;
    }
    const token: string = fs.readFileSync(this._argumentsMap?.get ("thirdParty-accessToken"), "utf8");
    if (!token.toLowerCase().startsWith ("Bearer")) {
      return `Bearer ${token}`;
    }
    return token;
  }

  public get WorkingDir(): string | undefined {
    return this._wrapperArgumentsMap?.get ("WorkingDir");
  }

  public get DmsType(): string | undefined {
    return this._argumentsMap?.get ("dms-type");
  }

  public get InputFileName(): string | undefined {
    return this._wrapperArgumentsMap?.get ("InputFileName");
  }

  public get activityId() {
    return this._argumentsMap?.get ("fwk-jobrun-guid");
  }

  public get jobRequestId() {
    return this._argumentsMap?.get ("fwk-jobrequest-guid");
  }

  public get notifyUserEmail() {
    return this._argumentsMap?.get ("notifyUserEmail");
  }

  public get documentGuid() {
    return this._argumentsMap?.get ("dms-documentGuid");
  }

  public get repositoryUrl() {
    return this._argumentsMap?.get ("dms-inputFileUrn");
  }

  public get briefCaseId() {
    return this._argumentsMap?.get ("server-briefcaseId");
  }

  public get contextId() {
    return this._argumentsMap?.get ("server-project-guid");
  }

  public get datasource() {
    return this._argumentsMap?.get ("dms-datasource");
  }

  public get serverEnvironment() {
    return this._argumentsMap?.get ("server-environment");
  }

  public get iModelName() {
    return this._argumentsMap?.get ("server-repository");
  }

  public get stagingDirectory() {
    return this._argumentsMap?.get ("fwk-staging-dir");
  }

  public get imodelId() {
    const imodelId = this._argumentsMap?.get ("server-repository");
    if (imodelId === undefined || imodelId === "" || !Utilities.isGuid(imodelId)) {
      return undefined;
    }
    return imodelId;
  }

  public get revisonComment() {
    return this._argumentsMap?.get ("fwk-revision-comment");
  }

  public get clientCredId(): string | undefined {
    if (this._argumentsMap?.get ("server-clientId") === undefined)
      return undefined;

    return this._argumentsMap?.get ("server-clientId");
  }

  public get clientCredSecret(): string | undefined {
    const clientSecret = this._argumentsMap?.get ("server-clientSecret");
    if (clientSecret) {
      return Buffer.from(clientSecret, "base64").toString(); // atob(clientSecret);
    } else {
      return undefined;
    }
  }

  public get ccScopes(): string | undefined {
    if (this._argumentsMap?.get ("server-clientScope") === undefined)
      return undefined;

    return this._argumentsMap?.get ("server-clientScope");
  }

  public get frameworkExePath() {
    if (Utilities.isEmpty(this._wrapperArgumentsMap?.get ("BridgeExePath"))) {
      return "C:\\Bridge\\iModelBridgeFwk.exe";
    }

    return this._wrapperArgumentsMap?.get ("BridgeExePath");
  }

  public get jobTimeout(): number {
    if (this._wrapperArgumentsMap!.get ("job-time-out") === undefined) {
      return (48 * 60);
    }
    return Number(this._wrapperArgumentsMap?.get ("job-time-out"));
  }

  public get seqServerUrl() {
    return Utilities.cleanString(this._wrapperArgumentsMap?.get ("Seq.ServerUrl"));
  }

  public get seqApiKey() {
    return Utilities.cleanString(this._wrapperArgumentsMap?.get ("Seq.ApiKey"));
  }

  public get defaultLoggingLevel() {
    if (this._wrapperArgumentsMap?.get ("Seq.DefaultLoggingLevel") === undefined)
      return "Error";
    return this._wrapperArgumentsMap?.get ("Seq.DefaultLoggingLevel");
  }

  public get bridgeLoggingLevel() {
    return this._wrapperArgumentsMap?.get ("Seq.BridgeLoggingLevel");
  }

  public get bridgeName() {
    if (this._wrapperArgumentsMap?.get ("BridgeName") === undefined)
      return "Undefined";

    return this._wrapperArgumentsMap?.get ("BridgeName");
  }

  public get useCustomBriefcase() {
    if (this._wrapperArgumentsMap?.get ("UseCustomBriefcase") === undefined)
      return false;
    return this._wrapperArgumentsMap.get ("UseCustomBriefcase");
  }

  public get bridgeVersion() {
    if (this._wrapperArgumentsMap?.get ("BridgeVersion") === undefined)
      return "1.0";

    return this._wrapperArgumentsMap?.get ("BridgeVersion");
  }

  public get buildNumber() {
    if (this._wrapperArgumentsMap?.get ("BuildNumber") === undefined)
      return undefined;

    return this._wrapperArgumentsMap?.get ("BuildNumber");
  }

  public get serviceBusConnectionString() {
    return this._wrapperArgumentsMap?.get ("ServiceBus.ConnString");
  }

  public get serviceBusStopTopic() {
    return this._wrapperArgumentsMap?.get ("ServiceBus.TopicName");
  }

  public get azStorageConnectionString() {
    return this._wrapperArgumentsMap?.get ("AZStorage.ConnString");
  }

  public get azStorageBlobContainerName() {
    return this._wrapperArgumentsMap?.get ("AZStorage.BlobContainerName");
  }

  public set fwkaffinityMappingJsonFile(filePath: string | undefined) {
    this._argumentsMap?.set ("fwk-affinityMappingJsonFile", filePath);
  }

  public get fwkaffinityMappingJsonFile() {
    return this._argumentsMap?.get ("fwk-affinityMappingJsonFile");
  }

  public get serviceBusEventBroadcastTopic() {
    return this._wrapperArgumentsMap?.get("ServiceBus.EventBroadcastTopicName");
  }

  public get isTimeoutAllow(): boolean {
    if (this._wrapperArgumentsMap?.get ("allowTimeout") === undefined || this._wrapperArgumentsMap?.get ("allowTimeout")?.toLowerCase() === "false")
      return false;
    return true;
  }

  public get imodelJobDefId(): string|undefined {
    return this._wrapperArgumentsMap?.get ("IModelJobDefinitionId");
  }

  public get IsLastFileInJob(): boolean|undefined {
    if (this._wrapperArgumentsMap?.get ("IsLastFileInJob") === undefined || this._wrapperArgumentsMap?.get ("IsLastFileInJob")?.toLowerCase() === "false")
      return false;
    return true;
  }

  public get delayMinutesBeforeBridging(): number | undefined {
    const rawValue = this._wrapperArgumentsMap?.get("delayMinutesBeforeBridging");
    return rawValue ? Number.parseInt(rawValue) : undefined;
  }

  public get azureJobId(): string | undefined {
    return this._wrapperArgumentsMap?.get("AzureBatch.JobId");
  }

  public get azureTaskId(): string | undefined {
    return this._wrapperArgumentsMap?.get("AzureBatch.TaskId");
  }

  public get azureBatchPoolId(): string | undefined {
    return this._wrapperArgumentsMap?.get("AzureBatch.PoolId");
  }

  public get syncRunId(): string | undefined {
    return this._wrapperArgumentsMap?.get("syncRunId");
  }

  public get cleanupFilePattern(): string | undefined {
    return this._wrapperArgumentsMap?.get ("cleanupFilePattern");
  }

  public get serverAuthGuid(): string | undefined {
    return this._wrapperArgumentsMap?.get ("server-nodeAuthguid");
  }

  public set serverAuthGuid(authGuid: string | undefined) {
    console.log(`setting up new auth guid : ${authGuid}`);
    this._wrapperArgumentsMap?.set ("server-nodeAuthguid", authGuid);
  }

  public get serverTokenUrl(): string | undefined {
    return this._wrapperArgumentsMap?.get ("server-nodeOidcCallBackUrl");
  }

  public get serverAccessToken(): string | undefined {
    return this._wrapperArgumentsMap?.get ("server-accessToken");
  }

  public async createRspFile(fileName: string): Promise<string> {

    return new Promise((resolve, reject) => {
      try {

        if (this.stagingDirectory === undefined || this.stagingDirectory === "") {
          console.log ("Error Staging directory is empty.");
          return;
        }

        if (this._argumentsMap !== undefined) {
          const dir = Utilities.cleanString (this.stagingDirectory);
          const affinityReport = `${dir}/AffinityReport.json`;
          if (fs.existsSync(affinityReport)) {
            console.log(`AffinityReport :${affinityReport} has found and passing to the bridge.`);
            this._argumentsMap?.set ("fwk-affinityMappingJsonFile", affinityReport);
          }

          const rspFile = path.join(dir, fileName);
          const argsFileStream = fs.createWriteStream(rspFile, { flags: "w" });
          const argsMap = this._argumentsMap;
          argsFileStream.on("open", (fd: any) => {
            console.log(`fd value ${fd}`);
            for (const [key, value] of argsMap) {
              let line = `--${key}`;

              if (!Utilities.isEmpty(value)) {
                line += `="${value}"\r\n`;
                argsFileStream.write(line);
              } else if (Utilities.isEmpty(value) && Utilities.isEmptyVariableAllowed(key, this._emptyValueParameterWhitelist)) {
                line += "\r\n";
                argsFileStream.write(line);
              }
            }
            argsFileStream.end();
          }).on("close", () => {
            console.log(`${rspFile}: file created successfully`);
            resolve(rspFile);
          }).on("error", (err: any) => {
            console.log(err);
            console.log(`Error while creating file: ${err}`);
            resolve(rspFile);
          });
        }
      } catch (error) {
        console.log(error);
        reject ("Initialization Failed");
      }
    });
  }

  public async createUpdateRspFile(fileName: string): Promise<string> {
    // If this file was unmapped on first execution, we need to remove that for the cleanup execution
    if (this._argumentsMap?.has ("fwk-unmap-input-file"))
      this._argumentsMap?.delete ("fwk-unmap-input-file");
    this._argumentsMap?.set ("fwk-all-docs-processed", "");
    return this.createRspFile(fileName);
  }

  public async printBasicJobDetails() {
    let jobDetails: string  = `Job details: contextId:${this._argumentsMap?.get ("server-project-guid")} iModelName:${this._argumentsMap?.get ("server-repository")} serverEnvironment:${this._argumentsMap?.get ("server-environment")}
    serverBriefcaseId:${this._argumentsMap?.get ("server-briefcaseId")} inputFilename:${process.env.INPUT_FILE} skipAssignString:${this._argumentsMap?.get ("fwk-skip-assignment-check")}
    createRepositoryIfNecessary:${this._argumentsMap?.get ("fwk-create-repository-if-necessary")} dms_type:${this._argumentsMap?.get ("dms-type")} dms_documentId:${process.env["imbridge--dms-documentGuid"]}
    dms_datasourceUrl:${process.env["imbridge--dms-datasource"]} notifyUserEmail:${this._argumentsMap?.get ("notifyUserEmail")}`;

    const dmsType = this._argumentsMap?.get ("dms-type");
    if (dmsType !== undefined && dmsType !== "3")
      jobDetails += ` dms_inputFileUrn:${this._argumentsMap?.get ("dms-inputFileUrn")}`;

    Logger.logTrace("ConfigMapper",`[iModelBridgeService.NodeJsWrapper]: ConfigMapper:printBasicJobDetails-- ${jobDetails}`);
  }

  public async exportToken(): Promise<void> {
    const filePath = path.join(`${this.stagingDirectory}`, `exportToken.txt`);

    console.log (`File Path: ${filePath}`);
    this._argumentsMap!.set ("server-accessToken", filePath);

    if (!fs.existsSync(filePath)) {
      try {
        const token = await this.imodelServiceToken();
        const writeStream = fs.createWriteStream(filePath);
        writeStream.write(token, "UTF-8");
        // the finish event is emitted when all data has been flushed from the stream
        writeStream.on("finish", () => {
          console.log("wrote all data to file");
        });
        // close the stream
        writeStream.end();
      } catch (ex) {
        console.log(`Exception export Result ${filePath} ${ex}`);
        throw ex;
      }
    }

  }

}
