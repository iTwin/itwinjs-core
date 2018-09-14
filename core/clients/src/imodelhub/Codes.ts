/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import * as deepAssign from "deep-assign";

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { ResponseError } from "./../Request";
import { WsgRequestOptions } from "./../WsgClient";

import { AccessToken } from "../Token";
import { Logger, IModelHubStatus, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { ArgumentCheck } from "./Errors";
import { Query } from "./Query";
import { IModelBaseHandler } from "./BaseHandler";
import { IModelHubClientError, AggregateResponseError, IModelHubError } from "./index";

const loggingCategory = "imodeljs-clients.imodelhub";

/**
 * [Code]($common) state describes whether the code is currently in use or owned by a [[Briefcase]].
 */
export enum CodeState {
  /** Code with this state is not persisted in iModelHub. Code that is updated to 'Available' state is deleted from the iModelHub. */
  Available = 0,
  /** Code is reserved by the [[Briefcase]], no one else is allowed to change its state. */
  Reserved = 1,
  /** Code is used in a [[ChangeSet]] committed to the iModelHub. */
  Used = 2,
  /** Retired Code can not be reserved or used. It can only be deleted and then reserved again */
  Retired = 3,
}

/** Base class for [Code]($common)s. */
export class CodeBase extends WsgInstance {
  /** Code specification Id (hexadecimal ("0XA") or decimal ("10") string)). */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CodeSpecId")
  public codeSpecId?: string;

  /** Code scope. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CodeScope")
  public codeScope?: string;

  /** Code state. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.State")
  public state?: CodeState;

  /** Date the Code was created. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedDate")
  public createdDate?: string;

  /** Id of the Briefcase that owns the Code. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.BriefcaseId")
  public briefcaseId?: number;

  /** If set to true in a request, it will only check whether code state can be modified, but will not actually change it. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.QueryOnly")
  public queryOnly?: boolean;
}

/**
 * Code instance. Codes ensure uniqueness of names in the file.
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Code", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class Code extends CodeBase {
  /** The unique string that can be used as a name value in iModel. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Value")
  public value?: string;
}

/**
 * MultiCode
 * Data about codes grouped by CodeSpecId, State and Briefcase
 * @hidden
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.MultiCode", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class MultiCode extends CodeBase {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Values")
  public values?: string[];
}

/**
 * Encodes part of the code to be used in URI
 * @hidden
 * @param str Part of the code.
 * @returns Encoded part of a code.
 */
function encodeForCodeId(str: string): string {
  return encodeURIComponent(str.replace("-", "_0x2D_"))
    .replace("~", "~7E")
    .replace("*", "~2A")
    .replace("%", "~");
}

/**
 * Gets encoded instance id for a code to be used in an URI.
 * @hidden
 * @param code Code to get instance id for.
 * @returns Encoded code instance id.
 */
function getCodeInstanceId(code: Code): string | undefined {
  if (!code || !code.codeSpecId || !code.codeScope || !code.value)
    return undefined;

  return `'${code.codeSpecId}-${encodeForCodeId(code.codeScope)}-${encodeForCodeId(code.value)}'`;
}

/**
 * Object for specifying options when sending [Code]($common) update requests. See [[CodeHandler.update]].
 */
export interface CodeUpdateOptions {
  /** Return [Code]($common)s that could not be acquired. Conflicting Codes will be set to [[ConflictingCodesError.conflictingCodes]]. If unlimitedReporting is enabled and CodesPerRequest value is high, some conflicting Codes could be missed.  */
  deniedCodes?: boolean;
  /** Attempt to get all failed [Code]($common)s, ignoring iModelHub limits. Server responses might fail when trying to return large number of conflicting Codes. */
  unlimitedReporting?: boolean;
  /** Number of [Code]($common)s per single request. Multiple requests will be sent if there are more Codes. If an error happens on a subsequent request, previous successful updates will not be reverted. */
  codesPerRequest?: number;
  /** Don't fail request on a conflict. If conflict occurs, [Code]($common)s that didn't have conflicts will be updated and any remaining subsequent requests will still be sent. */
  continueOnConflict?: boolean;
}

/**
 * Provider for default CodeUpdateOptions, used by CodeHandler to set defaults.
 * @hidden
 */
export class DefaultCodeUpdateOptionsProvider {
  protected _defaultOptions: CodeUpdateOptions;
  /**
   * Creates an instance of DefaultRequestOptionsProvider and sets up the default options.
   */
  constructor() {
    this._defaultOptions = {
      codesPerRequest: 2000,
    };
  }

  /**
   * Augments options with the provider's default values. The options passed in override any defaults where necessary.
   * @param options Options that should be augmented.
   */
  public async assignOptions(options: CodeUpdateOptions): Promise<void> {
    const clonedOptions: CodeUpdateOptions = Object.assign({}, options);
    deepAssign(options, this._defaultOptions);
    deepAssign(options, clonedOptions); // ensure the supplied options override the defaults
    return Promise.resolve();
  }
}

/**
 * Error for conflicting [Code]($common)s. It contains an array of Codes that failed to acquire. This is returned when calling [[CodeHandler.update]] with [[CodeUpdateOptions.deniedCodes]] set to true.
 */
export class ConflictingCodesError extends IModelHubError {
  /**
   * Codes that couldn't be updated due to other users owning them or setting them to [[CodeState.Retired]].
   */
  public conflictingCodes?: Code[];

  /**
   * Create ConflictingCodesError from IModelHubError instance.
   * @hidden
   * @param error IModelHubError to get error data from.
   * @returns Undefined if the error is not for a code conflict, otherwise newly created error instance.
   */
  public static fromError(error: IModelHubError): ConflictingCodesError | undefined {
    if (error.errorNumber !== IModelHubStatus.CodeReservedByAnotherBriefcase &&
      error.errorNumber !== IModelHubStatus.ConflictsAggregate) {
      return undefined;
    }
    const result = new ConflictingCodesError(error.errorNumber!);
    deepAssign(result, error);
    result.addCodes(error);
    return result;
  }

  /**
   * Amend this error instance with conflicting codes from another IModelHubError.
   * @hidden
   * @param error Error to get additional conflicting codes from.
   */
  public addCodes(error: IModelHubError) {
    if (!error.data || !error.data.ConflictingCodes) {
      return;
    }
    if (!this.conflictingCodes) {
      this.conflictingCodes = [];
    }
    for (const value of (error.data.ConflictingCodes as any[])) {
      const instance = { className: "Code", schemaName: "iModelScope", properties: value };
      const code = ECJsonTypeMap.fromJson<Code>(Code, "wsg", instance);
      if (code) {
        this.conflictingCodes.push(code);
      }
    }
  }
}

/**
 * Query object for getting [Code]($common)s. You can use this to modify the query. See [[CodeHandler.get]].
 */
export class CodeQuery extends Query {
  private _isMultiCodeQuery = true;

  /**
   * Used by the handler to check whether codes in query can be grouped.
   * @hidden
   */
  public get isMultiCodeQuery() {
    return this._isMultiCodeQuery;
  }

  /**
   * Query Codes by [[Briefcase]] id.
   * @param briefcaseId Id of the Briefcase.
   * @returns This query.
   * @throws [[IModelHubError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if briefcaseId is undefined or has an invalid [[Briefcase]] id value.
   */
  public byBriefcaseId(briefcaseId: number) {
    ArgumentCheck.validBriefcaseId("briefcaseId", briefcaseId);
    this.addFilter(`BriefcaseId+eq+${briefcaseId}`);
    return this;
  }

  /**
   * Query Codes by CodeSpec id.
   * @param codeSpecId Id of the CodeSpec.
   * @returns This query.
   * @throws [[IModelHubError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if codeSpecId is undefined or empty.
   */
  public byCodeSpecId(codeSpecId: string) {
    ArgumentCheck.defined("codeSpecId", codeSpecId);
    this.addFilter(`CodeSpecId+eq+'${codeSpecId}'`);
    return this;
  }

  /**
   * Query Codes by Code scope.
   * @param codeScope Scope of the Code.
   * @returns This query.
   * @throws [[IModelHubError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if codeScope is undefined or empty.
   */
  public byCodeScope(codeScope: string) {
    ArgumentCheck.defined("codeScope", codeScope);
    this.addFilter(`CodeScope+eq+'${codeScope}'`);
    return this;
  }

  /**
   * Query [Code]($common)s by their instance ids.
   * @param codes Codes to query. They must have their codeSpec, scope and value set.
   * @returns This query.
   * @throws [[IModelHubError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if codes array is undefined, empty or it contains invalid [Code]($common) values.
   */
  public byCodes(codes: Code[]) {
    ArgumentCheck.nonEmptyArray("codes", codes);
    this._isMultiCodeQuery = false;
    if (codes.length < 1) {
      throw IModelHubClientError.invalidArgument("codes");
    }

    let filter = "$id+in+[";

    let index = 0;
    for (const code of codes) {
      const id = getCodeInstanceId(code);
      ArgumentCheck.valid(`codes[${index}]`, id);

      if (0 !== index++)
        filter += ",";
      filter += id;
    }

    filter += "]";

    this.addFilter(filter);
    return this;
  }

  /**
   * Select only top entries from the query. This is applied after [[Query.skip]] parameter.
   * @param n Number of top entries to select.
   * @returns This query.
   */
  public top(n: number) {
    this._isMultiCodeQuery = false;
    return super.top(n);
  }

  /**
   * Query unavailable [Code]($common)s. It will include all Codes owned by other [[Briefcase]]s.
   * @param briefcaseId Id of the Briefcase.
   * @returns This query.
   * @throws [[IModelHubError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if briefcaseId is undefined or has an invalid [[Briefcase]] id value.
   */
  public unavailableCodes(briefcaseId: number) {
    ArgumentCheck.validBriefcaseId("briefcaseId", briefcaseId);
    const filter = `BriefcaseId+ne+${briefcaseId}`;
    this.addFilter(filter);
    return this;
  }
}

/** Type of [[CodeSequence]] results. */
export enum CodeSequenceType {
  /** Return largest already used value. */
  LargestUsed = 0,
  /** Return next available value in the sequence. */
  NextAvailable = 1,
}

/** Sequence of [Code]($common)s matching a pattern. This class allows getting next available index based [Code]($common) */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.CodeSequence", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class CodeSequence extends WsgInstance {
  /** Code specification Id (hexadecimal ("0XA") or decimal ("10") string)). */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CodeSpecId")
  public codeSpecId?: string;

  /** Code scope. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CodeScope")
  public codeScope?: string;

  /** Pattern describing the sequence. # characters will be replaced with the index. Only a single group of # characters is allowed in the pattern. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ValuePattern")
  public valuePattern?: string;

  /** Suggested index value returned from the query. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Value")
  public value?: string;

  /** Starting index of the sequence. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.StartIndex")
  public startIndex?: number;

  /** Index difference between two consecutive members in this sequence. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.IncrementBy")
  public incrementBy?: number;

  /** Type of the sequence results. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Type")
  public type?: CodeSequenceType;
}

/**
 * Handler for querying [[CodeSequence]]s. Use [[CodeHandler.Sequences]] to get an instance of this class.
 */
export class CodeSequenceHandler {
  private _handler: IModelBaseHandler;

  /**
   * Constructor for CodeHandler.
   * @hidden
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Get relative url for Code sequence requests.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   */
  private getRelativeUrl(imodelId: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/CodeSequence/`;
  }

  /**
   * Get an index value based on the [[CodeSequence]]. This only suggests the last used or next available index value in the sequence and does not reserve the Code.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @param sequence Code sequence describing the format of the Code value.
   * @returns Resolves to the suggested index value.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, sequence: CodeSequence): Promise<string> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Querying code sequence for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    const result = await this._handler.postInstance<CodeSequence>(alctx, CodeSequence, token, this.getRelativeUrl(imodelId), sequence);
    alctx.enter();
    Logger.logTrace(loggingCategory, `Queried code sequence for iModel ${imodelId}`);

    return result.value!;
  }
}

/**
 * Handler for managing [Code]($common)s. Use [[IModelClient.Codes]] to get an instance of this class. In most cases, you should use [ConcurrencyControl]($backend) methods instead. You can read more about concurrency control [here]($docs/learning/backend/concurrencycontrol).
 */
export class CodeHandler {
  private _handler: IModelBaseHandler;
  private static _defaultUpdateOptionsProvider: DefaultCodeUpdateOptionsProvider;

  /**
   * Constructor for CodeHandler.
   * @hidden
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /** Get handler for querying [[CodeSequence]]s. */
  public Sequences(): CodeSequenceHandler {
    return new CodeSequenceHandler(this._handler);
  }

  /**
   * Get relative url for Code requests.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @param codeId Id of the code.
   */
  private getRelativeUrl(imodelId: string, multiCode = true, codeId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/${multiCode ? "MultiCode" : "Code"}/${codeId || ""}`;
  }

  /** Convert Codes to MultiCodes. */
  private static convertCodesToMultiCodes(codes: Code[]): MultiCode[] {
    const map = new Map<string, MultiCode>();
    for (const code of codes) {
      const id: string = `${code.codeScope}-${code.codeSpecId}-${code.state}`;

      if (map.has(id)) {
        map.get(id)!.values!.push(code.value!);
      } else {
        const multiCode = new MultiCode();
        multiCode.changeState = "new";
        multiCode.briefcaseId = code.briefcaseId;
        multiCode.codeScope = code.codeScope;
        multiCode.codeSpecId = code.codeSpecId;
        multiCode.state = code.state;
        multiCode.values = [code.value!];
        map.set(id, multiCode);
      }
    }
    return Array.from(map.values());
  }

  /** Convert MultiCodes to Codes. */
  private static convertMultiCodesToCodes(multiCodes: MultiCode[]): Code[] {
    const result: Code[] = [];

    for (const multiCode of multiCodes) {
      for (const value of multiCode.values!) {
        const code = new Code();
        code.briefcaseId = multiCode.briefcaseId;
        code.codeScope = multiCode.codeScope;
        code.codeSpecId = multiCode.codeSpecId;
        code.state = multiCode.state;
        code.value = value;
        result.push(code);
      }
    }

    return result;
  }

  /**
   * Augment update options with defaults returned by the DefaultCodeUpdateOptionsProvider. The options passed in by clients override any defaults where necessary.
   * @param options Options the caller wants to augment with the defaults.
   * @returns Promise resolves after the defaults are setup.
   */
  private async setupOptionDefaults(options: CodeUpdateOptions): Promise<void> {
    if (!CodeHandler._defaultUpdateOptionsProvider)
      CodeHandler._defaultUpdateOptionsProvider = new DefaultCodeUpdateOptionsProvider();
    return CodeHandler._defaultUpdateOptionsProvider.assignOptions(options);
  }

  /** Send partial request for code updates */
  private async updateInternal(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, codes: Code[], updateOptions?: CodeUpdateOptions): Promise<Code[]> {
    alctx.enter();
    let requestOptions: WsgRequestOptions | undefined;
    if (updateOptions) {
      requestOptions = {};
      requestOptions.CustomOptions = {};
      if (updateOptions.deniedCodes === false) {
        requestOptions.CustomOptions.DetailedError_Codes = "false";
      }
      if (updateOptions.unlimitedReporting) {
        requestOptions.CustomOptions.DetailedError_MaximumInstances = "-1";
      }
      if (updateOptions.continueOnConflict) {
        requestOptions.CustomOptions.ConflictStrategy = "Continue";
      }
      if (Object.getOwnPropertyNames(requestOptions.CustomOptions).length === 0)
        requestOptions = undefined;
    }

    const result = await this._handler.postInstances<MultiCode>(alctx, MultiCode, token, `/Repositories/iModel--${imodelId}/$changeset`, CodeHandler.convertCodesToMultiCodes(codes), requestOptions);
    return CodeHandler.convertMultiCodesToCodes(result);
  }

  /**
   * Update multiple [Code]($common)s. This call can simultaneously reserve new Codes and update states of already owned Codes. If large amount of Codes are updated, they are split across multiple requests. See [[CodeUpdateOptions.codesPerRequest]]. Default is 2000 Codes per request.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @param codes Codes to update. Requires briefcaseId, state, codeSpecId, codeScope and value to be set on every instance. briefcaseId must be the same for every Code. Set queryOnly to true to just check if a Code can be reserved.
   * @param updateOptions Options for the update request. You can set this to change how conflicts are handled or to handle different amount of Codes per request.
   * @returns The code that was just obtained from the server.
   * @throws [[ConflictingCodesError]] when [[CodeUpdateOptions.deniedCodes]] is set and conflicts occured. See [Handling Conflicts]($docs/learning/iModelHub/Codes/#handling-conflicts) section for more information.
   * @throws [[AggregateResponseError]] when multiple requests where sent and more than 1 of the following errors occured.
   * @throws [[IModelHubError]] with status indicating a conflict. See [Handling Conflicts]($docs/learning/iModelHub/Codes/#handling-conflicts) section for more information.
   * @throws [[IModelHubError]] with [IModelHubStatus.InvalidBriefcase]($bentley) when including Codes with different briefcaseId values in the request.
   * @throws [[IModelHubError]] with [IModelHubStatus.OperationFailed]($bentley) when including multiple identical Codes in the request.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, codes: Code[], updateOptions?: CodeUpdateOptions): Promise<Code[]> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Requesting codes for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.nonEmptyArray("codes", codes);

    updateOptions = updateOptions || {};
    this.setupOptionDefaults(updateOptions);

    const result: Code[] = [];
    let conflictError: ConflictingCodesError | undefined;
    const aggregateError = new AggregateResponseError();

    for (let i = 0; i < codes.length; i += updateOptions.codesPerRequest!) {
      const chunk = codes.slice(i, i + updateOptions.codesPerRequest!);
      try {
        result.push(...await this.updateInternal(alctx, token, imodelId, chunk, updateOptions));
        alctx.enter();
      } catch (error) {
        alctx.enter();
        if (error instanceof ResponseError) {
          if (updateOptions && updateOptions.deniedCodes && error instanceof IModelHubError && (
            error.errorNumber === IModelHubStatus.CodeReservedByAnotherBriefcase ||
            error.errorNumber === IModelHubStatus.ConflictsAggregate)) {
            if (conflictError) {
              conflictError.addCodes(error);
            } else {
              conflictError = ConflictingCodesError.fromError(error);
            }
            if (!updateOptions.continueOnConflict) {
              return Promise.reject(conflictError);
            }
          } else {
            aggregateError.errors.push(error);
          }
        }
      }
    }

    if (conflictError) {
      return Promise.reject(conflictError);
    }

    if (aggregateError.errors.length > 0) {
      return Promise.reject(aggregateError.errors.length > 1 ? aggregateError : aggregateError.errors[0]);
    }

    Logger.logTrace(loggingCategory, `Requested ${codes.length} codes for iModel ${imodelId}`);

    return result;
  }

  /**
   * Get the [Code]($common)s that have been issued for the iModel.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @param query Optional query object to filter the queried Codes or select different data from them.
   * @returns Resolves to an array of Codes matching the query.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, query: CodeQuery = new CodeQuery()): Promise<Code[]> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Querying codes for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    let codes: Code[];
    if (query.isMultiCodeQuery) {
      const multiCodes = await this._handler.getInstances<MultiCode>(alctx, MultiCode, token, this.getRelativeUrl(imodelId), query.getQueryOptions());
      alctx.enter();
      codes = CodeHandler.convertMultiCodesToCodes(multiCodes);
    } else {
      codes = await this._handler.postQuery<Code>(alctx, Code, token, this.getRelativeUrl(imodelId, false), query.getQueryOptions());
      alctx.enter();
    }

    Logger.logTrace(loggingCategory, `Queried ${codes.length} codes for iModel ${imodelId}`);

    return codes;
  }

  /**
   * Delete all [Code]($common)s owned by the specified [[Briefcase]].
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @param briefcaseId Id of the Briefcacase.
   * @throws [[IModelHubError]] with [IModelHubStatus.BriefcaseDoesNotExist]($bentley) if [[Briefcase]] with specified briefcaseId does not exist. This can happen if number was not given as a Briefcase id yet, or Briefcase with that id was already deleted.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if [[Briefcase]] belongs to another user and user sending the request does not have ManageResources permission.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async deleteAll(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, briefcaseId: number): Promise<void> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Deleting all codes from briefcase ${briefcaseId} in iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.validBriefcaseId("briefcaseId", briefcaseId);

    await this._handler.delete(alctx, token, this.getRelativeUrl(imodelId, false, `DiscardReservedCodes-${briefcaseId}`));

    Logger.logTrace(loggingCategory, `Deleted all codes from briefcase ${briefcaseId} in iModel ${imodelId}`);
  }
}
