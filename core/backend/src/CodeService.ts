/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CloudSqlite } from "@bentley/imodeljs-native";
import { AccessToken, BentleyError, GuidString, MarkRequired, Mutable } from "@itwin/core-bentley";
import { CodeProps } from "@itwin/core-common";
import { BriefcaseDb } from "./IModelDb";
import { SettingObject } from "./workspace/Settings";

/**
 * A readonly index of all used and reserved Codes for one or more iModels. The CodeIndex may be slightly out-of-date
 * with the master copy in the cloud, but it should be periodically synchronized. Whenever codes are reserved/updated/deleted
 * locally, this copy is always up-to-date as of those changes.
 * @alpha
 */
export interface CodeIndex {
  /**
   * Find the next available value for the supplied `SequenceScope`.
   * If the sequence is full (there are no available values), this will throw an exception with `errorId="SequenceFull"`
   * @param from the sequence and scope to search
   * @returns the next available CodeValue in the sequence.
   */
  findNextAvailable: (from: CodeService.SequenceScope) => CodeService.CodeValue;

  /**
   * Find the highest currently used value for the supplied `SequenceScope`
   * @param from the sequence and scope to search
   * @returns the highest used value, or undefined if no values have been used.
   */
  findHighestUsed: (from: CodeService.SequenceScope) => CodeService.CodeValue | undefined;

  /** Determine whether a code is present in this CodeIndex by its Guid. */
  isCodePresent: (guid: CodeService.CodeGuid) => boolean;

  /** Get the data for a code in this CodeIndex by its Guid.
   * @returns the data for the code or undefined if no code is present for the supplied Guid.
   */
  getCode: (guid: CodeService.CodeGuid) => CodeService.CodeEntry | undefined;

  /** Look up a code by its Scope, Spec, and Value.
   * @returns the Guid of the code, or undefined if not present.
   */
  findCode: (code: CodeService.ScopeSpecAndValue) => CodeService.CodeGuid | undefined;

  /** Look up a code spec by its name or Id (in this index)
   * @throws if the spec is not present.
   */
  getCodeSpec: (props: CodeService.CodeSpecName) => CodeService.SpecEntry;

  /** Call a `CodeIterator` function for all codes in this index, optionally filtered by a `CodeFilter ` */
  forAllCodes: (iter: CodeService.CodeIterator, filter?: CodeService.CodeFilter) => void;

  /** Call a `EntryIdIterator` function for all code specs in this index, optionally filtered by a `ValueFilter ` */
  forAllCodeSpecs: (iter: CodeService.EntryIdIterator, filter?: CodeService.ValueFilter) => void;
}

/**
 * The services for querying, reserving, updating, and deleting codes for a BriefcaseDb (available via `BriefcaseDb.codeService`) whenever it is opened for write access.
 * @alpha
 */
export interface CodeService {
  /** @internal */
  close: () => void;

  /** @internal */
  addAllCodeSpecs: () => Promise<void>;

  /** the BriefcaseDb of this CodeService */
  readonly briefcase: BriefcaseDb;

  /** the code index for this CodeService */
  readonly codeIndex: CodeIndex;

  /**
   * Application-supplied parameters for obtaining the write lock on the container and for reserving new codes.
   * Applications should set these parameters by adding a listener for `BriefcaseDb.onCodeServiceCreated`
   * that is called every time a BriefcaseDb that uses code services is opened for write access.
   */
  readonly appParams: CodeService.ObtainLockParams & CodeService.AuthorAndOrigin;

  /**
   * The token that grants access to the cloud container for this CodeService.
   * It should be established in a listener for `BriefcaseDb.onCodeServiceCreated`, and should be refreshed (via a
   * timer) before it expires.
   */
  sasToken: AccessToken;

  /**
   * Synchronize the local index with any changes by made by others.
   * @note This is called automatically whenever any write operation is performed on the code index. It is only necessary to
   * call this if you have not changed the code index recently, but wish to perform a readonly operation and want to
   * ensure it is up-to-date as of now.
   * @note There is no guarantee that a readonly index is up-to-date even immediately after calling this method, since others
   * may be modifying it at any time.
   */
  synchronizeWithCloud: () => void;

  /**
   * Verify that the Code of a to-be-inserted or to-be-updated Element:
   * 1. has already been reserved,
   * 2. if the element has a `federationGuid`, it must match the reserved value. If the federationGuid is undefined,
   * the value from the code index is returned.
   *
   * If not, throw an exception. Elements with no CodeValue are ignored.
   * @note this method is automatically called whenever elements are added or updated by a BriefcaseDb with a CodeService.
   */
  verifyCode: (props: CodeService.ElementCodeProps) => void;

  /** Add a new code spec to this code service.
   * @note This will automatically obtain and release the write lock.
   */
  addCodeSpec: (val: CodeService.NameAndJson) => Promise<void>;

  /**
   * Add all of the codes and code specs from this CodeService's BriefcaseDb into the code index.
   * @note It is not necessary to call this method unless the BriefcaseDb somehow becomes out of sync with its CodeService,
   * for example when migrating iModels to a new code service. It is safe (but relatively expensive) to call this method multiple times, since
   * any codes or code specs that are already in the index are ignored.
   * @note This will automatically obtain and release the write lock.
   * @returns the number of codes actually added.
   */
  addAllCodes: () => Promise<number>;

  /**
   * Attempt to reserve a single proposed code.
   * @note This will automatically attempt to obtain, perform the operation, and then release the write lock.
   */
  reserveCode: (code: CodeService.ProposedCode) => Promise<void>;

  /**
   * Attempt to reserve an array of proposed codes.
   * @see the `problems` member of the `CodeService.Error` exception
   * @note This will automatically attempt to obtain, perform the operation, and then release the write lock.
   * @note If you have a set of codes to reserve, it is considerably more efficient to do them as an array rather than one at a time.
   */
  reserveCodes: (arg: CodeService.ReserveCodesArgs) => Promise<void>;

  /**
   * Attempt to reserve the next available code for a code sequence and scope.
   * @note This will automatically attempt to obtain, perform the operation, and then release the write lock.
   */
  reserveNextAvailableCode: (arg: CodeService.ReserveNextArgs) => Promise<void>;

  /**
   * Attempt to reserve an array of the next available codes for a code sequence and scope.
   * The length of the array determines the number of codes requested. The values for the new codes are returned
   * in the array, so they can be associated with the supplied GUIDs.
   * @returns number of codes actually reserved.
   * @note This will automatically attempt to obtain, perform the operation, and then release the write lock.
   */
  reserveNextAvailableCodes: (arg: CodeService.ReserveNextArrayArgs) => Promise<number>;

  /**
   * Update the properties of a single code.
   * @note This will automatically attempt to obtain, perform the operation, and then release the write lock.
   */
  updateCode: (props: CodeService.UpdatedCode) => Promise<void>;

  /**
   * Update the properties of an array codes.
   * @note This will automatically attempt to obtain, perform the operation, and then release the write lock.
   * @note If you have a set of codes to update, it is considerably more efficient to do them as an array rather than one at a time.
   */
  updateCodes: (arg: CodeService.UpdateCodesArgs) => Promise<void>;

  /** Delete an array of codes by their guids.
   * @note This will automatically attempt to obtain, perform the operation, and then release the write lock.
   */
  deleteCodes: (guid: CodeService.CodeGuid[]) => Promise<void>;

  /**
   * Turn a `CodePops` for the briefcase of this CodeService into a `ScopeAndSpec` object for use in the code index.
   * This is necessary because the `spec` member of `CodeProps` refers to the id of a code spec in the iModel, and
   * the `scope` member refers to the `ElementId` of the scope element in the iModel. This helper function
   * converts the specId to the spec name and looks up the `FederationGuid` of the scope element.
   */
  makeScopeAndSpec: (props: CodeProps) => CodeService.ScopeAndSpec;

  /** Turn a `CodeProps` and  `ProposedCodeProps` into a `ProposedCode` for use in the code index.
   * @see [[makeScopeAndSpec]] for explanation of why this is necessary.
   */
  makeProposedCode: (arg: CodeService.MakeProposedCodeArgs) => CodeService.ProposedCode;
}

/** @alpha */
export namespace CodeService {
  /** @internal */
  const codeSequences = new Map<string, CodeSequence>();

  /** @internal */
  export let createForBriefcase: undefined | ((db: BriefcaseDb) => CodeService);

  /** Register an instance of a`CodeSequence` so it can be looked up by name. */
  export function registerSequence(seq: CodeSequence) { codeSequences.set(seq.sequenceName, seq); }

  /** Get a previously registered `CodeSequence` by its name.
   * @throws if no sequence by that name was registered.
  */
  export function getSequence(name: string): CodeSequence {
    const seq = codeSequences.get(name);
    if (!seq)
      throw new Error("SequenceNotFound", -1, `code sequence ${name} not found`);
    return seq;
  }

  /** The name of a code spec */
  export type CodeSpecName = string;

  /** The name that identifies the "originator" of a code. Usually this is the Guid of the iModel from which a code was added,
   * but can also be used to identify a system or type from an external code service. */
  export type CodeOriginName = string;

  /** The name that identifies the "author" of a code. Generally, this is intended to be the name of a person or group. */
  export type AuthorName = string;

  /** The value for a code. */
  export type CodeValue = string;

  /** The guid for a code. This identifies the real-world entity associated with the code. */
  export type CodeGuid = GuidString;

  /** The guid of the scope for a code. This identifies the real-world entity provides the uniqueness scope for code values. */
  export type ScopeGuid = GuidString;

  /** An optional number associated with a code that may be used for "status" information. Values must be defined by applications. */
  export type CodeState = number;

  /** An integer id  */
  export type EntryId = number;

  /** The return status of an iterator function. The value "stop" causes the iteration to terminate. */
  export type IteratorReturn = void | "stop";

  export type TableIterator<T> = (id: T) => IteratorReturn;
  export type EntryIdIterator = TableIterator<EntryId>;

  /** An iterator function over codes in a code index. It is called with the Guid of a each code. */
  export type CodeIterator = TableIterator<CodeGuid>;

  export type TableData = CodeService.NameAndJson
    ;
  export interface TableEntry extends TableData {
    readonly id: CodeService.EntryId;
  }
  /** The data stored in the code index for code specs. */
  export type SpecEntry = TableEntry;

  /** Parameters used to obtain the write lock on a cloud container */
  export interface ObtainLockParams {
    /** The name of the user attempting to acquire the write lock. This name will be shown to other users while the lock is held. */
    user?: string;
    /** number of times to retry in the event the lock currently held by someone else.
     * After this number of attempts, `onFailure` is called. Default is 20.
     */
    nRetries: number;
    /** Delay between retries, in milliseconds. Default is 100. */
    retryDelayMs: number;
    /** function called if lock cannot be obtained after retries. It is called with the name of the user currently holding the lock and
     * generally is expected that the user will be consulted whether to wait further.
     * If this function returns "stop", an exception will be thrown. Otherwise the retry cycle is restarted. */
    onFailure?: CloudSqlite.WriteLockBusyHandler;
  }

  /** Argument for reserving an array of new codes. */
  export interface ReserveCodesArgs {
    /** an array of proposed codes to reserve */
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
     * return as many as possible. Otherwise no codes are reserved.
     * @note if `asManyAsPossible` is true, no error is thrown if the sequence becomes full. You must check the return value to see how many
     * were actually available.
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
    readonly code: Required<CodeProps>;
    readonly props: CodeService.CodeGuidStateJson;
  }

  /** The properties of an Element to be checked against the code index.
   * @see CodeService.verifyCode
   */
  export interface ElementCodeProps {
    /** The imodel-specific code properties. */
    readonly code: CodeProps;
    /**
     * The federationGuid of the element being inserted or updated.
     * If federationGuid is defined, it is must match the value in the code index or an error is thrown.
     * If it is undefined, the value from the code index is returned here.
     */
    federationGuid?: GuidString;
  }

  export type SpecNameOrId = CodeSpecName | EntryId;

  export interface ScopeAndSpec {
    readonly spec: CodeSpecName;
    readonly scope: ScopeGuid;
  }

  export interface ScopeSpecAndValue extends ScopeAndSpec {
    readonly value: CodeValue;
  }

  export interface CodeEntry {
    readonly spec: CodeSpecName;
    readonly scope: ScopeGuid;
    readonly value: CodeValue;
    readonly guid: CodeGuid;
    readonly origin: CodeOriginName;
    readonly state?: CodeState;
    readonly author?: AuthorName;
    readonly json?: SettingObject;
  }

  export interface ValueFilter {
    readonly value?: string;
    readonly valueCompare?: "GLOB" | "LIKE" | "NOT GLOB" | "NOT LIKE" | "=" | "<" | ">";
    readonly orderBy?: "ASC" | "DESC";
    readonly sqlExpression?: string;
  }

  export interface CodeFilter extends ValueFilter {
    readonly spec?: CodeSpecName;
    readonly scope?: ScopeGuid;
  }

  export type ErrorId =
    "BadIndexProps" |
    "CorruptIModel" |
    "CorruptIndex" |
    "DuplicateValue" |
    "GuidIsInUse" |
    "GuidMismatch" |
    "IllegalValue" |
    "IndexReadonly" |
    "InvalidCodeScope" |
    "InvalidGuid" |
    "InvalidSequence" |
    "MissingCode" |
    "MissingGuid" |
    "MissingInput" |
    "MissingSpec" |
    "NoCodeIndex" |
    "SequenceFull" |
    "ReserveErrors" |
    "SequenceNotFound" |
    "SqlLogicError" |
    "UpdateErrors" |
    "ValueIsInUse" |
    "WrongVersion";

  export class Error extends BentleyError {
    constructor(public errorId: ErrorId, errNum: number, message: string, public problems?: ReserveProblem[] | UpdateProblem[]) {
      super(errNum, message);
    }
  }
  export interface NameAndJson {
    readonly name: string;
    readonly json?: SettingObject;
  }

  export interface ScopeAndSpec {
    readonly spec: CodeSpecName;
    readonly scope: ScopeGuid;
  }

  export interface ScopeSpecAndValue extends ScopeAndSpec {
    readonly value: CodeValue;
  }

  export interface AuthorAndOrigin {
    readonly origin: Mutable<NameAndJson>;
    readonly author: Mutable<NameAndJson>;
  }

  export interface CodeGuidStateJson {
    /** The Guid of the new code. This must be always be supplied by the application. */
    readonly guid: CodeGuid;
    /** An optional value for the state of the code. */
    readonly state?: CodeState;
    /** An optional json object to be stored with the code. */
    readonly json?: SettingObject;
  }

  /** Properties of a proposed new code. */
  export interface ProposedCodeProps extends CodeGuidStateJson {
    /** The value for the proposed code.
     * @note For code sequence operations, this value is ignored on input and is set with a new value from the sequence on successful return.
     */
    value?: CodeValue;
  }

  /** Properties that describe a code sequence and a scope and spec for a proposed code or array of codes. */
  export interface SequenceScope extends ScopeAndSpec {
    readonly seq: CodeSequence;
    /** @internal */
    readonly start?: CodeValue;
  }

  export type ProposedCode = ProposedCodeProps & ScopeSpecAndValue;
  export type UpdatedCode = MarkRequired<Partial<ProposedCode>, "guid">;

  export interface ReserveProblem {
    readonly code: ProposedCode;
    readonly errorId: ErrorId;
    readonly message: string;
  }

  export interface UpdateProblem {
    readonly prop: UpdatedCode;
    readonly errorId: ErrorId;
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
    /** the type of this CodeSequence. Usually this is the class name of the sequence. */
    get sequenceType(): string;
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
}
