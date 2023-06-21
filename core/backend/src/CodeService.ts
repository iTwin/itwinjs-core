/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BentleyError, GuidString, IModelStatus, MarkRequired, Mutable } from "@itwin/core-bentley";
import { CodeProps, FontId, FontType } from "@itwin/core-common";
import { CloudSqlite } from "./CloudSqlite";
import { IModelDb } from "./IModelDb";
import { SettingObject } from "./workspace/Settings";
import { VersionedSqliteDb } from "./SQLiteDb";

/**
 * The services for querying, reserving, updating, and deleting codes for a BriefcaseDb (available via `BriefcaseDb.codeService`) whenever it is opened for write access.
 * See [CodeService]($docs/learning/backend/CodeService).
 * @alpha
 */
export interface CodeService {
  /** @internal */
  close: () => void;

  initialize(iModel: IModelDb): Promise<void>;

  /** the index for external Codes for this CodeService */
  readonly externalCodes?: CloudSqlite.DbAccess<CodeService.CodesDb, CodeService.ReadMethods, CodeService.WriteMethods>;

  /** the index for internal Codes for this CodeService */
  readonly internalCodes?: CloudSqlite.DbAccess<CodeService.InternalCodes, CodeService.InternalReadMethods, CodeService.InternalWriteMethods>;

  /**
   * Application-supplied parameters for reserving new codes.
   */
  readonly appParams: CodeService.AuthorAndOrigin;

  /**
   * Verify that the Code of a to-be-inserted or to-be-updated Element:
   * 1. has already been reserved,
   * 2. if the element has a `federationGuid`, it must match the reserved value. If the federationGuid is undefined,
   * the value from the code index is returned.
   *
   * If not, throw an exception. Elements with no CodeValue are ignored.
   * @note this method is automatically called whenever elements are added or updated by a BriefcaseDb with a CodeService.
   */
  verifyCode(props: CodeService.ElementCodeProps): void;
}

/** @alpha */
export namespace CodeService {

  export interface WriteMethods {
    /** Add a new code spec to this code service.
     */
    addCodeSpec(val: CodeService.NameAndJson): Promise<void>;

    /**
     * Add all of the codes and code specs from this CodeService's BriefcaseDb into the code index.
     * @returns the number of codes actually added.
     * @note It is not necessary to call this method unless the BriefcaseDb somehow becomes out of sync with its CodeService,
     * for example when migrating iModels to a new code service. It is safe (but relatively expensive) to call this method multiple times, since
     * any codes or code specs that are already in the index are ignored.
     */
    addAllCodes(iModel: IModelDb): Promise<number>;

    /**
     * Attempt to reserve a single proposed code.
     * @throws `CodeService.Error` if the proposed code cannot be reserved.
     */
    reserveCode(code: CodeService.ProposedCode): Promise<void>;

    /**
     * Attempt to reserve an array of proposed codes.
     * @returns number of codes actually reserved.
     * @see the `problems` member of the `CodeService.Error` exception
     * @note If you have a set of codes to reserve, it is considerably more efficient to do them as an array rather than one at a time.
     * @throws `CodeService.Error` if any of the proposed code cannot be reserved. The details for each failed code are in the `problems` member.
     */
    reserveCodes(arg: CodeService.ReserveCodesArgs): Promise<number>;

    /**
     * Attempt to reserve the next available code for a code sequence and scope.
     */
    reserveNextAvailableCode(arg: CodeService.ReserveNextArgs): Promise<void>;

    /**
     * Attempt to reserve an array of the next available codes for a code sequence and scope.
     * The length of the array determines the number of codes requested. The values for the new codes are returned
     * in the array, so they can be associated with the supplied GUIDs.
     * @returns number of codes actually reserved.
     */
    reserveNextAvailableCodes(arg: CodeService.ReserveNextArrayArgs): Promise<number>;

    /**
     * Update the properties of a single code.
     */
    updateCode(props: CodeService.UpdatedCode): Promise<void>;

    /**
     * Update the properties of an array codes.
     * @note If you have a set of codes to update, it is considerably more efficient to do them as an array rather than one at a time.
     * @returns number of codes actually updated.
     */
    updateCodes(arg: CodeService.UpdateCodesArgs): Promise<number>;

    /** Delete an array of codes by their guids. */
    deleteCodes(guid: CodeService.CodeGuid[]): Promise<void>;
  }

  export interface ReadMethods {
    /**
     * Find the next available value for the supplied `SequenceScope`.
     * If the sequence is full (there are no available values), this will throw an exception with `errorId="SequenceFull"`
     * @param from the sequence and scope to search
     * @returns the next available CodeValue in the sequence.
     */
    findNextAvailable(from: CodeService.SequenceScope): CodeService.CodeValue;

    /**
     * Find the highest currently used value for the supplied `SequenceScope`
     * @param from the sequence and scope to search
     * @returns the highest used value, or undefined if no values have been used.
     */
    findHighestUsed(from: CodeService.SequenceScope): CodeService.CodeValue | undefined;

    /** Determine whether a code is present in this CodeIndex by its Guid. */
    isCodePresent(guid: CodeService.CodeGuid): boolean;

    /** Get the data for a code in this CodeIndex by its Guid.
     * @returns the data for the code or undefined if no code is present for the supplied Guid.
     */
    getCode(guid: CodeService.CodeGuid): CodeService.CodeEntry | undefined;

    /** Look up a code by its Scope, Spec, and Value.
     * @returns the Guid of the code, or undefined if not present.
     */
    findCode(code: CodeService.ScopeSpecAndValue): CodeService.CodeGuid | undefined;

    /** Look up a code spec by its name
     * @throws if the spec is not present.
     */
    getCodeSpec(props: CodeService.CodeSpecName): CodeService.NameAndJson;

    /** Call a `CodeIteration` function for all codes in this index, optionally filtered by a `CodeFilter ` */
    forAllCodes(iter: CodeService.CodeIteration, filter?: CodeService.CodeFilter): void;

    /** Call an iteration function for all code specs in this index, optionally filtered by a `ValueFilter ` */
    forAllCodeSpecs(iter: CodeService.NameAndJsonIteration, filter?: CodeService.ValueFilter): void;

    /**
     * Verify that the Code of a to-be-inserted or to-be-updated Element:
     * 1. has already been reserved,
     * 2. if the element has a `federationGuid`, it must match the reserved value. If the federationGuid is undefined,
     * the value from the code index is returned.
     *
     * If not, throw an exception. Elements with no CodeValue are ignored.
     * @note this method is automatically called whenever elements are added or updated by a BriefcaseDb with a CodeService.
     */
    verifyCode(specName: string, arg: CodeService.ElementCodeProps): void;
  }

  export type CodesDb = VersionedSqliteDb & WriteMethods & ReadMethods;

  export interface InternalWriteMethods extends WriteMethods {
    /**  @internal */
    reserveFontId(props: CodeService.FontIndexProps): Promise<FontId>;
    /**  @internal */
    reserveBisCodeSpecs(specs: CodeService.BisCodeSpecIndexProps[]): Promise<void>;
  }
  export interface InternalReadMethods extends ReadMethods {
    /**  @internal */
    verifyBisCodeSpec(spec: CodeService.BisCodeSpecIndexProps): void;
  }

  export type InternalCodes = CodesDb & InternalWriteMethods & InternalReadMethods;

  /** @internal */
  const codeSequences = new Map<string, CodeSequence>();

  /** @internal */
  export let createForIModel: ((db: IModelDb) => Promise<CodeService>) | undefined;

  /** Register an instance of a`CodeSequence` so it can be looked up by name. */
  export function registerSequence(seq: CodeSequence) {
    codeSequences.set(seq.sequenceName, seq);
  }

  /** Get a previously registered `CodeSequence` by its name.
   * @throws if no sequence by that name was registered.
   */
  export function getSequence(name: string): CodeSequence {
    const seq = codeSequences.get(name);
    if (!seq)
      throw new Error("SequenceNotFound", -1, `code sequence ${name} not found`);
    return seq;
  }

  /**
   * Turn a `CodePops` for the briefcase of this CodeService into a `ScopeAndSpec` object for use with a CodeService.
   * This is necessary because the `spec` member of `CodeProps` refers to the id of a code spec in the iModel, and
   * the `scope` member refers to the element Id of the scope element in the iModel. This helper function
   * converts the spec Id to the spec name and looks up the `FederationGuid` of the scope element.
   */
  export function makeScopeAndSpec(iModel: IModelDb, code: CodeProps): CodeService.ScopeAndSpec {
    const scopeGuid = iModel.elements.getElementProps({ id: code.scope, onlyBaseProperties: true }).federationGuid;
    if (undefined === scopeGuid)
      throw new CodeService.Error("MissingGuid", IModelStatus.InvalidCode, "code scope element has no federationGuid");

    return { scopeGuid, specName: iModel.codeSpecs.getById(code.spec).name };
  }

  /** Turn a `CodeProps` and  `ProposedCodeProps` into a `ProposedCode` for use with a CodeService.
   * @see [[makeScopeAndSpec]] for explanation of why this is necessary.
   */
  export function makeProposedCode(arg: CodeService.MakeProposedCodeArgs): CodeService.ProposedCode {
    return {
      ...arg.props,
      value: arg.code.value,
      ...makeScopeAndSpec(arg.iModel, arg.code),
    };
  }

  /** The name of a code spec */
  export type CodeSpecName = string;

  /**
   * The name that identifies the "originator" of a code. Usually this is the Guid of the iModel from which a code was added,
   * but can also be used to identify a system or type from an external code service.
   */
  export type CodeOriginName = string;

  /** The name that identifies the "author" of a code. Generally, this is intended to be the name of a person or group that helps identify the purpose of the code. */
  export type AuthorName = string;

  /** The value for a code. */
  export type CodeValue = string;

  /** The guid for a code. This identifies the real-world entity associated with the code. */
  export type CodeGuid = GuidString;

  /** The guid of the scope for a code. This identifies the real-world entity that provides the uniqueness scope for code values. */
  export type ScopeGuid = GuidString;

  /** An optional number associated with a code that may be used for "status" information. Values must be defined by applications. */
  export type CodeState = number;

  /** The return status of an iteration function. The value "stop" causes the iteration to terminate. */
  export type IterationReturn = void | "stop";

  /** An iteration function over codes in a code index. It is called with the Guid of a each code. */
  export type CodeIteration = (guid: GuidString) => IterationReturn;

  /** An iteration function over code specs in a code index. It is called with the name and json of a each code spec. */
  export type NameAndJsonIteration = (nameAndJson: NameAndJson) => IterationReturn;

  /** Argument for reserving an array of new codes. */
  export interface ReserveCodesArgs {
    /** an array of proposed codes to reserve.
     * @note the guid of each proposed code must be supplied by the caller.
     */
    readonly codes: CodeService.ProposedCode[];
    /** If true, unless all codes are available, don't reserve any codes. Otherwise reserve all available codes. */
    readonly allOrNothing?: true;
  }

  /** Argument for reserving a code from a code sequence. */
  export interface ReserveNextArgs {
    /** the properties of the new code */
    readonly code: CodeService.ProposedCodeProps;
    /** The code sequence and scope for the new code. */
    readonly from: SequenceScope;
  }

  /** Argument for reserving an array of codes from a code sequence. */
  export interface ReserveNextArrayArgs {
    /** an array of proposed codes to reserve.  */
    readonly codes: CodeService.ProposedCodeProps[];
    /** The code sequence and scope for the new codes. */
    readonly from: CodeService.SequenceScope;
    /** If true, and in the event that the code sequence does not have enough available codes to fulfill all the entries in `codes`,
     * return as many as possible. Otherwise no codes are reserved. The `problems` member of the exception can be used to determine how many codes were available.
     * @note if `asManyAsPossible` is true, no error is thrown if the sequence becomes full. You must check the return value to see how many
     * were actually available. The `value` member will be undefined for any proposed codes that were not reserved.
     */
    readonly asManyAsPossible?: true;
  }

  /** Argument for updating an array of codes. */
  export interface UpdateCodesArgs {
    /** Properties of the codes to update */
    readonly props: CodeService.UpdatedCode[];
    /** If true, unless all codes are updated, don't update any codes. Otherwise update all possible codes. */
    readonly allOrNothing?: true;
  }

  /** Arguments for CodeService.makeProposedCode  */
  export interface MakeProposedCodeArgs {
    readonly iModel: IModelDb;
    readonly code: Required<CodeProps>;
    readonly props: CodeService.CodeGuidStateJson;
  }

  /** The properties of an Element to be checked against the code index.
   * @see CodeService.verifyCode
   */
  export interface ElementCodeProps {
    /** iModel from which the code is being inserted/updated. */
    readonly iModel: IModelDb;
    /** Properties of the code */
    readonly props: {
      /** The imodel-specific code properties. */
      readonly code: CodeProps;
      /**
       * The federationGuid of the element being inserted or updated.
       * If federationGuid is defined, it is must match the value in the code index or an error is thrown.
       * If it is undefined, the value from the code index is returned here.
       */
      federationGuid?: GuidString;
    };
  }

  /** a name and a json object. Used for code specs, authors and origins. */
  export interface NameAndJson {
    readonly name: string;
    readonly json?: SettingObject;
  }

  /** A code Scope guid, and code spec name. */
  export interface ScopeAndSpec {
    readonly specName: CodeSpecName;
    readonly scopeGuid: ScopeGuid;
  }

  /** A code Scope guid, code spec, and code value. */
  export interface ScopeSpecAndValue extends ScopeAndSpec {
    readonly value: CodeValue;
  }

  /** The data held in a code index for a single code. */
  export interface CodeEntry {
    /** The name of the code spec for this code. */
    readonly specName: CodeSpecName;
    /** The guid of the entity that provides the scope for this code. */
    readonly scopeGuid: ScopeGuid;
    /** The value of this code. */
    readonly value: CodeValue;
    /** The guid of the entity this code identifies. */
    readonly guid: CodeGuid;
    /** the state of the code. May be undefined. */
    readonly state?: CodeState;
    /** The name of the originating source of this code (usually an iModel Guid). May be undefined. */
    readonly origin: CodeOriginName;
    /** The name of the author of this code. May be undefined. */
    readonly author?: AuthorName;
    /** Option json properties associated with this code. May be undefined. */
    readonly json?: SettingObject;
  }

  /** A filter used to limit and/or sort the values returned by an iteration. */
  export interface ValueFilter {
    /** A value filter. May include wild cards when used with `GLOB` or `LIKE` */
    readonly value?: string;
    /** The comparison operator for `value`. Default is `=` */
    readonly valueCompare?: "GLOB" | "LIKE" | "NOT GLOB" | "NOT LIKE" | "=" | "<" | ">";
    /** Order results ascending or descending. If not supplied, the results are unordered (random). */
    readonly orderBy?: "ASC" | "DESC";
    /** An SQL expression to further filter results. This string is appended to the `WHERE` clause with an `AND` (that should not be part of the sqlExpression) */
    readonly sqlExpression?: string;
  }

  /** A filter to limit and/or sort the values for the [[CodeIndex.forAllCodes]] iteration. */
  export interface CodeFilter extends ValueFilter {
    /** If supplied, limit results to only those with this spec */
    readonly specName?: CodeSpecName;
    /** If supplied, limit results to only those with this scope Guid */
    readonly scopeGuid?: ScopeGuid;
    /** If supplied, limit results to only those with this origin */
    readonly origin?: CodeOriginName;
  }

  /** Author and origin information supplied when codes are reserved. */
  export interface AuthorAndOrigin {
    /** The name of the individual or group for whom the code was reserved. */
    readonly author: Mutable<NameAndJson>;
    /** The identity of the "originator" of the code. This is usually a guid of an iModel, but can be any unique string. */
    readonly origin: Mutable<NameAndJson>;
  }

  /** The Guid, state, and json properties of a code. */
  export interface CodeGuidStateJson {
    /** The Guid of the new code. This must be always be supplied by the application. */
    readonly guid: CodeGuid;
    /** An optional value for the state of the code. */
    readonly state?: CodeState;
    /** An optional json object to be stored with the code. */
    readonly json?: SettingObject;
  }

  /** Properties of a "proposed" new code to be reserved.
   * @note the Guid of the entity identified by this code *must* be supplied, but `value` is optional, since
   * this may be used to reserve codes from a sequence where the value is generated.
   */
  export interface ProposedCodeProps extends CodeGuidStateJson {
    /** The value for the proposed code.
     * @note For code sequence operations, this value is ignored on input and is set with a new value from the sequence on successful return.
     */
    value?: CodeValue;
  }

  /** Properties of a proposed new code that is not from a code sequence (its `value` is required). */
  export type ProposedCode = ProposedCodeProps & ScopeSpecAndValue;

  /** Properties that describe a code sequence and a scope and spec for a proposed code or array of codes from a sequence. */
  export interface SequenceScope extends ScopeAndSpec {
    /** The code sequence. */
    readonly seq: CodeSequence;
    /** A valid current value. If supplied, the returned value will always be later in the sequence than this. */
    readonly start?: CodeValue;
  }

  /** Properties of a code to be updated.
   * @note The `guid` member identifies the code to be updated and is required.
   * All other properties are optional - if `undefined`, its value is not changed.
   */
  export type UpdatedCode = MarkRequired<Partial<ProposedCode>, "guid">;

  /** A proposed code that could not be reserved due to some error. */
  export interface ReserveProblem {
    /** the proposed code that failed. */
    readonly code: ProposedCode;
    /** the reason for the failure */
    readonly errorId: ErrorId;
    /** the error message from the exception for this proposed code. */
    readonly message: string;
  }

  /** A update to a code that failed for some error. */
  export interface UpdateProblem {
    /** The properties of the code that was to be updated */
    readonly prop: UpdatedCode;
    /** the reason for the failure */
    readonly errorId: ErrorId;
    /** the error message from the exception for the update request. */
    readonly message: string;
  }

  /**
   * A sequence of code values following a increasing pattern. Valid code sequences must have a first value, a last value, and
   * a way to get the next valid value from an existing valid value.
   * Code sequences have a `sequenceName` so they can be registered using `CodeService.registerSequence`.
   */
  export interface CodeSequence {
    /** the name of this CodeSequence. */
    get sequenceName(): string;
    /** Get the first valid value for this CodeSequence */
    getFirstValue(): CodeValue;
    /** Get the last valid value for this CodeSequence */
    getLastValue(): CodeValue;
    /** Get the next valid value for this CodeSequence from the supplied value.
     * If the sequence is full (that is, the next value is greater than the last value, this method should throw with errorId="SequenceFull".
     * @return the next valid value according to the rules of this CodeSequence.
     */
    getNextValue(code: CodeValue): CodeValue;
    /** Determine whether this supplied value is valid for this sequence. */
    isValidCode(code: CodeValue): boolean;
  }

  /** @internal */
  export interface FontIndexProps {
    id?: number;
    fontType: FontType;
    fontName: string;
  }
  /** @internal */
  export interface BisCodeSpecIndexProps {
    id?: number;
    name: string;
    props: string;
  }

  /** Exception class thrown by `CodeService` methods. */
  export class Error extends BentleyError {
    /** A string that indicates the type of problem that caused the exception. */
    public readonly errorId: ErrorId;
    /** For [[CodeService.reserveCodes]] and [[CodeService.updateCodes]], a list of the problem details. */
    public readonly problems?: ReserveProblem[] | UpdateProblem[];

    /** @internal */
    constructor(errorId: ErrorId, errNum: number, message: string, problems?: ReserveProblem[] | UpdateProblem[]) {
      super(errNum, message);
      this.errorId = errorId;
      this.problems = problems;
    }
  }

  /** Identifiers for exceptions thrown by `CodeService` methods.
   * @see [[CodeService.Error.errorId]]
   */
  export type ErrorId =
    "BadIndexProps" |
    "CorruptIModel" |
    "CorruptIndex" |
    "DuplicateValue" |
    "GuidIsInUse" |
    "GuidMismatch" |
    "IllegalValue" |
    "InconsistentIModels" |
    "IndexReadonly" |
    "InvalidCodeScope" |
    "InvalidGuid" |
    "InvalidSequence" |
    "MissingCode" |
    "MissingGuid" |
    "MissingInput" |
    "MissingSpec" |
    "NoCodeIndex" |
    "NotAuthorized" |
    "SequenceFull" |
    "ReserveErrors" |
    "SequenceNotFound" |
    "SqlLogicError" |
    "UpdateErrors" |
    "ValueIsInUse" |
    "WrongVersion";

}
