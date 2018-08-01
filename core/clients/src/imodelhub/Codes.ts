/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import * as deepAssign from "deep-assign";

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { ResponseError } from "./../Request";
import { WsgRequestOptions } from "./../WsgClient";

import { AccessToken } from "../Token";
import { Logger, IModelHubStatus } from "@bentley/bentleyjs-core";
import { ArgumentCheck } from "./Errors";
import { Query } from "./Query";
import { IModelBaseHandler } from "./BaseHandler";
import { IModelHubClientError, AggregateResponseError, IModelHubError } from "./index";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Code State enumeration */
export enum CodeState {
  /** Code with this state is not persisted in the database. Code that is updated to 'Available' state is deleted from the database */
  Available = 0,
  /** Code is reserved by the briefcase, no one else is allowed to change its state */
  Reserved = 1,
  /** Code is used in the changeSet committed to the server */
  Used = 2,
  /** Retired code can't be reserved or used. It can only be deleted and then reserved again */
  Retired = 3,
}

/** Base class for Code and MultiCode */
export class CodeBase extends WsgInstance {
  /** Code specification Id (hexadecimal ("0XA") or decimal ("10") string)) */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CodeSpecId")
  public codeSpecId?: string;

  /** Code scope */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CodeScope")
  public codeScope?: string;

  /** Code state */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.State")
  public state?: CodeState;

  /** Date the code was created */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedDate")
  public createdDate?: string;

  /** Id of the briefcase that owns/should-own code */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.BriefcaseId")
  public briefcaseId?: number;

  /** If set to true in a request, it will only check whether code state can be modified, but will not actually change it. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.QueryOnly")
  public queryOnly?: boolean;
}

/** Code */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Code", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class Code extends CodeBase {
  /** Code value */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Value")
  public value?: string;
}

/**
 * MultiCode
 * Data about codes grouped by CodeSpecId, State and Briefcase
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
  return encodeURIComponent(str.replace("-", "_0x2D_"))
    .replace("~", "~7E")
    .replace("*", "~2A")
    .replace("%", "~");
}

/**
 * Gets encoded instance id for a code to be used in an URI.
 * @param code Code to get instance id for.
 * @returns Encoded code instance id.
 */
function getCodeInstanceId(code: Code): string | undefined {
  if (!code || !code.codeSpecId || !code.codeScope || !code.value)
    return undefined;

  return `'${code.codeSpecId}-${encodeForCodeId(code.codeScope)}-${encodeForCodeId(code.value)}'`;
}

/**
 * Object for specifying options when sending code update requests.
 */
export interface CodeUpdateOptions {
  /** Return codes that couldn't be acquired. */
  deniedCodes?: boolean;
  /** Attempt to send all failed codes, ignoring iModel Hub limits. */
  unlimitedReporting?: boolean;
  /** Number of codes per single request. Multiple requests will be sent if there are more codes. */
  codesPerRequest?: number;
  /** If conflict happens, continue updating remaining codes instead of reverting everything. */
  continueOnConflict?: boolean;
}

/**
 * Provider for default CodeUpdateOptions, used by CodeHandler to set defaults.
 */
export class DefaultCodeUpdateOptionsProvider {
  protected defaultOptions: CodeUpdateOptions;
  /**
   * Creates an instance of DefaultRequestOptionsProvider and sets up the default options.
   */
  constructor() {
    this.defaultOptions = {
      codesPerRequest: 2000,
    };
  }

  /**
   * Augments options with the provider's default values.
   * @note The options passed in override any defaults where necessary.
   * @param options Options that should be augmented.
   */
  public async assignOptions(options: CodeUpdateOptions): Promise<void> {
    const clonedOptions: CodeUpdateOptions = Object.assign({}, options);
    deepAssign(options, this.defaultOptions);
    deepAssign(options, clonedOptions); // ensure the supplied options override the defaults
    return Promise.resolve();
  }
}

/** Error for conflicting codes */
export class ConflictingCodesError extends IModelHubError {
  public conflictingCodes?: Code[];

  /**
   * Create ConflictingCodesError from IModelHubError instance.
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
   * Amends this error instance with conflicting codes from another IModelHubError.
   * @param error Error to get additional conflicting codes from.
   * @hidden
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
 * Query object for getting Codes. You can use this to modify the query.
 * @see CodeHandler.get()
 */
export class CodeQuery extends Query {
  private _isMultiCodeQuery = true;

  /**
   * Used by the hanlder to check whether codes in query can be grouped.
   */
  public isMultiCodeQuery() {
    return this._isMultiCodeQuery;
  }

  /**
   * Query Codes by Briefcase id.
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
   * Query Codes by Code Scope.
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
   * Query Codes by their instance ids.
   * @param codes Codes to query. They must have their CodeSpec, Scope and Value set.
   * @returns This query.
   * @throws [[IModelHubError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if codes array is undefined, empty or it
   * contains not valid [[Code]] values.
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
   * Select only top entries from the query.
   * This is applied after @see Query.skip parameter.
   * @param n Number of top entries to select.
   * @returns This query.
   */
  public top(n: number) {
    this._isMultiCodeQuery = false;
    return super.top(n);
  }

  /**
   * Query unavailable Codes.
   * @param briefcaseId Id of the briefcase.
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

/**
 * Handler for all methods related to @see Code instances.
 */
export class CodeHandler {
  private _handler: IModelBaseHandler;
  private static _defaultUpdateOptionsProvider: DefaultCodeUpdateOptionsProvider;

  /**
   * Constructor for CodeHandler. Should use @see IModelClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Gets relative url for Code requests.
   * @param imodelId Id of the iModel.
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
   * Augments update options with defaults returned by the DefaultCodeUpdateOptionsProvider.
   * @note The options passed in by clients override any defaults where necessary.
   * @param options Options the caller wants to eaugment with the defaults.
   * @returns Promise resolves after the defaults are setup.
   */
  private async setupOptionDefaults(options: CodeUpdateOptions): Promise<void> {
    if (!CodeHandler._defaultUpdateOptionsProvider)
      CodeHandler._defaultUpdateOptionsProvider = new DefaultCodeUpdateOptionsProvider();
    return CodeHandler._defaultUpdateOptionsProvider.assignOptions(options);
  }

  /** Send partial request for code updates */
  private async updateInternal(token: AccessToken, imodelId: string, codes: Code[], updateOptions?: CodeUpdateOptions): Promise<Code[]> {
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

    const result = await this._handler.postInstances<MultiCode>(MultiCode, token, `/Repositories/iModel--${imodelId}/$changeset`, CodeHandler.convertCodesToMultiCodes(codes), requestOptions);
    return CodeHandler.convertMultiCodesToCodes(result);
  }

  // CodeReservedByAnotherBriefcaseException, CodeStateInvalidException, CodeDoesNotExistException, iModelHubOperationFailedException

  /**
   * Updates multiple codes.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param codes Code to reserve. Requires briefcaseId to be set in the code. Can also set state, codeSpecId, codeScope and value. Set queryOnly to true
   * to just check if a code can be reserved.
   * @param updateOptions Options for the update request.
   * @returns The code that was just obtained from the server.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(token: AccessToken, imodelId: string, codes: Code[], updateOptions?: CodeUpdateOptions): Promise<Code[]> {
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
        result.push(...await this.updateInternal(token, imodelId, chunk, updateOptions));
      } catch (error) {
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
   * Gets the codes that have been issued for the iModel.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param query Object used to modify results of this query.
   * @returns Resolves to an array of codes.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(token: AccessToken, imodelId: string, query: CodeQuery = new CodeQuery()): Promise<Code[]> {
    Logger.logInfo(loggingCategory, `Querying codes for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    let codes: Code[];
    if (query.isMultiCodeQuery()) {
      const multiCodes = await this._handler.getInstances<MultiCode>(MultiCode, token, this.getRelativeUrl(imodelId), query.getQueryOptions());
      codes = CodeHandler.convertMultiCodesToCodes(multiCodes);
    } else {
      codes = await this._handler.postQuery<Code>(Code, token, this.getRelativeUrl(imodelId, false), query.getQueryOptions());
    }

    Logger.logTrace(loggingCategory, `Queried ${codes.length} codes for iModel ${imodelId}`);

    return codes;
  }

  /**
   * Deletes all codes owned by the specified briefcase
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param briefcaseId Id of the briefcacase
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async deleteAll(token: AccessToken, imodelId: string, briefcaseId: number): Promise<void> {
    Logger.logInfo(loggingCategory, `Deleting all codes from briefcase ${briefcaseId} in iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.validBriefcaseId("briefcaseId", briefcaseId);

    await this._handler.delete(token, this.getRelativeUrl(imodelId, false, `DiscardReservedCodes-${briefcaseId}`));

    Logger.logTrace(loggingCategory, `Deleted all codes from briefcase ${briefcaseId} in iModel ${imodelId}`);
  }
}
