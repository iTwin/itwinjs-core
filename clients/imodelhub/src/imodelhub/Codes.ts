/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */

import * as deepAssign from "deep-assign";
import { GuidString, Id64String, IModelHubStatus, Logger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, ECJsonTypeMap, ResponseError, WsgInstance, WsgQuery, WsgRequestOptions } from "@bentley/itwin-client";
import { IModelHubClientLoggerCategory } from "../IModelHubClientLoggerCategories";
import { IModelBaseHandler } from "./BaseHandler";
import { AggregateResponseError, ArgumentCheck, IModelHubClientError, IModelHubError } from "./Errors";

const loggerCategory: string = IModelHubClientLoggerCategory.IModelHub;

/**
 * [Code]($common) state describes whether the code is currently in use or owned by a [[Briefcase]].
 * @internal
 */
export enum CodeState {
  /** Code with this state is not persisted in iModelHub. Code that is updated to 'Available' state is deleted from iModelHub. */
  Available = 0,
  /** Code is reserved by the [[Briefcase]], no one else is allowed to change its state. */
  Reserved = 1,
  /** Code is used in a [[ChangeSet]] committed to iModelHub. */
  Used = 2,
  /** Retired Code can not be reserved or used. It can only be deleted and then reserved again */
  Retired = 3,
}

/** Base class for [Code]($common)s.
 * @internal
 */
export class CodeBase extends WsgInstance {
  /** Code specification Id. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CodeSpecId")
  public codeSpecId?: Id64String;

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
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Code", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class HubCode extends CodeBase {
  /** The unique string that can be used as a name value in iModel. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Value")
  public value?: string;
}

/**
 * MultiCode: Data about codes grouped by CodeSpecId, State and Briefcase
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.MultiCode", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class MultiCode extends CodeBase {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Values")
  public values?: string[];
}

/**
 * Encodes part of the code to be used in URI
 * @param str Part of the code.
 * @returns Encoded part of a code.
 */
function encodeForCodeId(str: string): string {
  return encodeURIComponent(str.replace(/-/g, "_2D_"))
    .replace(/~/g, "~7E")
    .replace(/\*/g, "~2A")
    .replace(/%/g, "~");
}

/**
 * Gets encoded instance id for a code to be used in an URI.
 * @param code Code to get instance id for.
 * @returns Encoded code instance id.
 */
function getCodeInstanceId(code: HubCode): string | undefined {
  if (!code || !code.codeSpecId || !code.codeScope || !code.value)
    return undefined;

  return `'${code.codeSpecId}-${encodeForCodeId(code.codeScope)}-${encodeForCodeId(code.value)}'`;
}

/**
 * Object for specifying options when sending [Code]($common) update requests. See [[CodeHandler.update]].
 * @internal
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
 * @internal
 */
export class DefaultCodeUpdateOptionsProvider {
  protected _defaultOptions: CodeUpdateOptions;
  /**  Creates an instance of DefaultRequestOptionsProvider and sets up the default options. */
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
    const clonedOptions: CodeUpdateOptions = { ...options };
    deepAssign(options, this._defaultOptions);
    deepAssign(options, clonedOptions); // ensure the supplied options override the defaults
  }
}

/**
 * Error for conflicting [Code]($common)s. It contains an array of Codes that failed to acquire. This is returned when calling [[CodeHandler.update]] with [[CodeUpdateOptions.deniedCodes]] set to true.
 * @internal
 */
export class ConflictingCodesError extends IModelHubError {
  /** Codes that couldn't be updated due to other users owning them or setting them to [[CodeState.Retired]]. */
  public conflictingCodes?: HubCode[];

  /**
   * Create ConflictingCodesError from IModelHubError instance.
   * @param error IModelHubError to get error data from.
   * @returns Undefined if the error is not for a code conflict, otherwise newly created error instance.
   * @internal
   */
  public static fromError(error: IModelHubError): ConflictingCodesError | undefined {
    if (error.errorNumber !== IModelHubStatus.CodeReservedByAnotherBriefcase &&
      error.errorNumber !== IModelHubStatus.ConflictsAggregate) {
      return undefined;
    }
    const result = new ConflictingCodesError(error.errorNumber);
    deepAssign(result, error);
    result.addCodes(error);
    return result;
  }

  /**
   * Amend this error instance with conflicting codes from another IModelHubError.
   * @param error Error to get additional conflicting codes from.
   * @internal
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
      const code = ECJsonTypeMap.fromJson<HubCode>(HubCode, "wsg", instance);
      if (code) {
        this.conflictingCodes.push(code);
      }
    }
  }
}

/**
 * Query object for getting [Code]($common)s. You can use this to modify the query. See [[CodeHandler.get]].
 * @internal
 */
export class CodeQuery extends WsgQuery {
  private _isMultiCodeQuery = true;

  /**
   * Default page size which is used when querying Codes
   * @internal
   */
  public static defaultPageSize: number = 10000;

  /** Constructor that sets default page size. */
  constructor() {
    super();
    this.pageSize(CodeQuery.defaultPageSize);
  }

  /**
   * Used by the handler to check whether codes in query can be grouped.
   * @internal
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
  public byCodeSpecId(codeSpecId: Id64String) {
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
  public byCodes(codes: HubCode[]) {
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

/** Type of [[CodeSequence]] results.
 * @internal
 */
export enum CodeSequenceType {
  /** Return largest already used value. */
  LargestUsed = 0,
  /** Return next available value in the sequence. */
  NextAvailable = 1,
}

/** Sequence of [Code]($common)s matching a pattern. This class allows getting next available index based [Code]($common)
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.CodeSequence", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class CodeSequence extends WsgInstance {
  /** Code specification Id (hexadecimal ("0XA") or decimal ("10") string)). */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CodeSpecId")
  public codeSpecId?: Id64String;

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
 * @internal
 */
export class CodeSequenceHandler {
  private _handler: IModelBaseHandler;

  /**
   * Constructor for CodeHandler.
   * @param handler Handler for WSG requests.
   * @internal
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /** Get relative url for Code sequence requests.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   */
  private getRelativeUrl(iModelId: GuidString) {
    return `/Repositories/iModel--${iModelId}/iModelScope/CodeSequence/`;
  }

  /** Get an index value based on the [[CodeSequence]]. This only suggests the last used or next available index value in the sequence and does not reserve the Code.
   * @param requestContext The client request context
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param sequence Code sequence describing the format of the Code value.
   * @returns Resolves to the suggested index value.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, sequence: CodeSequence): Promise<string> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Querying code sequence for iModel", () => ({ iModelId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);

    const result = await this._handler.postInstance<CodeSequence>(requestContext, CodeSequence, this.getRelativeUrl(iModelId), sequence);
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Queried code sequence for iModel", () => ({ iModelId }));

    return result.value!;
  }
}

/**
 * Handler for managing [Code]($common)s. Use [[IModelClient.Codes]] to get an instance of this class. In most cases, you should use [ConcurrencyControl]($backend) methods instead. You can read more about concurrency control [here]($docs/learning/backend/concurrencycontrol).
 * @internal
 */
export class CodeHandler {
  private _handler: IModelBaseHandler;
  private static _defaultUpdateOptionsProvider: DefaultCodeUpdateOptionsProvider;

  /**
   * Constructor for CodeHandler.
   * @param handler Handler for WSG requests.
   * @internal
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /** Get handler for querying [[CodeSequence]]s. */
  public get sequences(): CodeSequenceHandler {
    return new CodeSequenceHandler(this._handler);
  }

  /** Get relative url for Code requests.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param codeId Id of the code.
   */
  private getRelativeUrl(iModelId: GuidString, multiCode = true, codeId?: string) {
    return `/Repositories/iModel--${iModelId}/iModelScope/${multiCode ? "MultiCode" : "Code"}/${codeId || ""}`;
  }

  /** Convert Codes to MultiCodes. */
  private static convertCodesToMultiCodes(codes: HubCode[]): MultiCode[] {
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
  private static convertMultiCodesToCodes(multiCodes: MultiCode[]): HubCode[] {
    const result: HubCode[] = [];

    for (const multiCode of multiCodes) {
      for (const value of multiCode.values!) {
        const code = new HubCode();
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
  private async updateInternal(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, codes: HubCode[], updateOptions?: CodeUpdateOptions): Promise<HubCode[]> {
    requestContext.enter();
    let requestOptions: WsgRequestOptions | undefined;
    if (updateOptions) {
      requestOptions = {};
      requestOptions.CustomOptions = {};
      if (updateOptions.deniedCodes === false) {
        requestOptions.CustomOptions.DetailedError_Codes = "false"; // eslint-disable-line @typescript-eslint/naming-convention
      }
      if (updateOptions.unlimitedReporting) {
        requestOptions.CustomOptions.DetailedError_MaximumInstances = "-1"; // eslint-disable-line @typescript-eslint/naming-convention
      }
      if (updateOptions.continueOnConflict) {
        requestOptions.CustomOptions.ConflictStrategy = "Continue";
      }
      if (Object.getOwnPropertyNames(requestOptions.CustomOptions).length === 0)
        requestOptions = undefined;
    }

    const result = await this._handler.postInstances<MultiCode>(requestContext, MultiCode, `/Repositories/iModel--${iModelId}/$changeset`, CodeHandler.convertCodesToMultiCodes(codes), requestOptions);
    return CodeHandler.convertMultiCodesToCodes(result);
  }

  /**
   * Update multiple [Code]($common)s. This call can simultaneously reserve new Codes and update states of already owned Codes. If large amount of Codes are updated, they are split across multiple requests. See [[CodeUpdateOptions.codesPerRequest]]. Default is 2000 Codes per request.
   * @param requestContext The client request context
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param codes Codes to update. Requires briefcaseId, state, codeSpecId, codeScope and value to be set on every instance. briefcaseId must be the same for every Code. Set queryOnly to true to just check if a Code can be reserved.
   * @param updateOptions Options for the update request. You can set this to change how conflicts are handled or to handle different amount of Codes per request.
   * @returns The code that was just obtained from the server.
   * @throws [[ConflictingCodesError]] when [[CodeUpdateOptions.deniedCodes]] is set and conflicts occurred. See [Handling Conflicts]($docs/learning/iModelHub/CodesAndLocksConflicts.md) for more information.
   * @throws [[AggregateResponseError]] when multiple requests where sent and more than 1 of the following errors occurred.
   * @throws [[IModelHubError]] with status indicating a conflict. See [Handling Conflicts]($docs/learning/iModelHub/CodesAndLocksConflicts.md) section for more information.
   * @throws [[IModelHubError]] with [IModelHubStatus.InvalidBriefcase]($bentley) when including Codes with different briefcaseId values in the request.
   * @throws [[IModelHubError]] with [IModelHubStatus.OperationFailed]($bentley) when including multiple identical Codes in the request.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, codes: HubCode[], updateOptions?: CodeUpdateOptions): Promise<HubCode[]> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Requesting codes for iModel", () => ({ iModelId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);
    ArgumentCheck.nonEmptyArray("codes", codes);

    updateOptions = updateOptions || {};
    await this.setupOptionDefaults(updateOptions);

    const result: HubCode[] = [];
    let conflictError: ConflictingCodesError | undefined;
    const aggregateError = new AggregateResponseError();

    for (let i = 0; i < codes.length; i += updateOptions.codesPerRequest!) {
      const chunk = codes.slice(i, i + updateOptions.codesPerRequest!);
      try {
        result.push(...await this.updateInternal(requestContext, iModelId, chunk, updateOptions));
        requestContext.enter();
      } catch (error) {
        requestContext.enter();
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
              throw conflictError;
            }
          } else {
            aggregateError.errors.push(error);
          }
        }
      }
    }

    if (conflictError) {
      throw conflictError;
    }

    if (aggregateError.errors.length > 0) {
      throw aggregateError.errors.length > 1 ? aggregateError : aggregateError.errors[0];
    }

    Logger.logTrace(loggerCategory, `Requested ${codes.length} codes for iModel`, () => ({ iModelId }));
    return result;
  }

  /**
   * Get the [Code]($common)s that have been issued for the iModel.
   * @param requestContext The client request context
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param query Optional query object to filter the queried Codes or select different data from them.
   * @returns Resolves to an array of Codes matching the query.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, query: CodeQuery = new CodeQuery()): Promise<HubCode[]> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Querying codes for iModel", () => ({ iModelId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);

    let codes: HubCode[];
    if (query.isMultiCodeQuery) {
      const multiCodes = await this._handler.getInstances<MultiCode>(requestContext, MultiCode, this.getRelativeUrl(iModelId), query.getQueryOptions());
      requestContext.enter();
      codes = CodeHandler.convertMultiCodesToCodes(multiCodes);
    } else {
      codes = await this._handler.postQuery<HubCode>(requestContext, HubCode, this.getRelativeUrl(iModelId, false), query.getQueryOptions());
      requestContext.enter();
    }

    Logger.logTrace(loggerCategory, `Queried ${codes.length} codes for iModel`, () => ({ iModelId }));
    return codes;
  }

  /** Delete all [Code]($common)s owned by the specified [[Briefcase]].
   * @param requestContext The client request context
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param briefcaseId Id of the Briefcase.
   * @throws [[IModelHubError]] with [IModelHubStatus.BriefcaseDoesNotExist]($bentley) if [[Briefcase]] with specified briefcaseId does not exist. This can happen if number was not given as a Briefcase id yet, or Briefcase with that id was already deleted.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if [[Briefcase]] belongs to another user and user sending the request does not have ManageResources permission.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async deleteAll(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, briefcaseId: number): Promise<void> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Deleting all codes from briefcase", () => ({ briefcaseId, iModelId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);
    ArgumentCheck.validBriefcaseId("briefcaseId", briefcaseId);

    await this._handler.delete(requestContext, this.getRelativeUrl(iModelId, false, `DiscardReservedCodes-${briefcaseId}`));

    Logger.logTrace(loggerCategory, "Deleted all codes from briefcase", () => ({ briefcaseId, iModelId }));
  }
}
