/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CloudSqlite } from "@bentley/imodeljs-native";
import { AccessToken, BentleyError, GuidString, MarkRequired } from "@itwin/core-bentley";
import { CodeProps } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";
import { SettingObject } from "./workspace/Settings";

/**
 * A readonly index of all used and reserved Codes for one or more iModels. The CodeIndex may be slightly out-of-date
 * with the master copy in the cloud, but it should be periodically synchronized. Whenever codes are reserved/updated/deleted
 * locally, this copy is always up-to-date as of those changes.
 * @internal */
export interface CodeIndexRead {
  findNextAvailable: (from: CodeService.SequenceScope) => CodeService.CodeValue;
  findHighestUsed: (from: CodeService.SequenceScope) => CodeService.CodeValue | undefined;
  isCodePresent: (guid: CodeService.CodeGuid) => boolean;
  findCode: (code: CodeService.ScopeSpecAndValue) => CodeService.CodeGuid | undefined;
  getCode: (guid: CodeService.CodeGuid) => CodeService.CodeFullEntry | undefined;
  getCodeSpec: (props: CodeService.SpecNameOrId) => CodeService.SpecEntry;
  forAllCodes: (iter: CodeService.CodeIterator, filter?: CodeService.CodeFilter) => void;
  forAllCodeSpecs: (iter: CodeService.EntryIdIterator, filter?: CodeService.ValueFilter) => void;
}

/**
 * Calling any of these methods first obtains the write lock for the code service, performs the operation, and then releases the lock.
 * @internal */
export interface CodeServiceWrite {
  addAllCodeSpecs: (iModel: IModelDb) => void;
  addAllCodes: (iModel: IModelDb) => void;
  reserveCode: (code: CodeService.ProposedCode) => void;
  reserveCodes: (args: { codes: CodeService.ProposedCode[], allOrNothing?: true }) => void;
  reserveNextAvailableCode: (arg: { code: CodeService.ProposedCodeProps, from: CodeService.SequenceScope }) => void;
  reserveNextAvailableCodes: (arg: { codes: CodeService.ProposedCodeProps[], from: CodeService.SequenceScope, asManyAsPossible?: true }) => void;
  updateCode: (props: CodeService.UpdatedCode) => void;
  deleteCodes: (guid: GuidString[]) => void;
  insertCodeSpec: (val: CodeService.NameAndJson, type?: string) => void;
}

/** @internal */
export interface CodeService extends CodeServiceWrite {
  readonly codeIndex: CodeIndexRead;
  readonly lockArgs: CodeService.ObtainLockArgs;
  sasToken: AccessToken;

  synchronizeWithCloud: () => void;
  /**
   * Verify that the Code of a to-be-inserted or to-be-updated Element:
   * 1. has already been reserved,
   * 2. has `federationGuid` matching the reserved value.
   *
   * If not, throw an exception. Elements with no CodeValue are ignored.
   */
  verifyCode: (props: CodeService.ElementCodeProps) => void;
}

/** @internal */
export namespace CodeService {
  const codeSequences = new Map<string, CodeSequence>();
  export function registerSequence(seq: CodeSequence) { codeSequences.set(seq.sequenceName, seq); }
  export function getSequence(name: string): CodeSequence {
    const seq = codeSequences.get(name);
    if (!seq)
      throw new Error("SequenceNotFound", -1, `code sequence ${name} not found`);
    return seq;
  }

  export type CodeSpecName = string;
  export type CodeOriginName = string;
  export type AuthorName = string;
  export type CodeValue = string;
  export type CodeGuid = GuidString;
  export type ScopeGuid = GuidString;
  export type Flags = number;
  export type IteratorReturn = void | "stop";
  export type EntryId = number;
  export type TableName = string;
  export type TableIterator<T> = (id: T) => IteratorReturn;
  export type EntryIdIterator = TableIterator<EntryId>;
  export type CodeIterator = TableIterator<CodeService.CodeGuid>;
  export type AuthorEntry = TableEntry;
  export type SpecEntry = TableEntry;
  export type OriginEntry = TableEntry;

  export type IndexProps = CloudSqlite.AccountAccessProps & CloudSqlite.ContainerProps & CloudSqlite.DbNameProp;

  export interface TableData extends CodeService.NameAndJson {
    readonly type: string;
  }
  export interface TableEntry extends TableData {
    readonly id: CodeService.EntryId;
  }

  export let createForIModel: undefined | ((iModelDb: IModelDb) => CodeService);

  export interface ObtainLockArgs {
    user?: string;
    nRetries: number;
    retryDelayMs: number;
    onFailure?: CloudSqlite.WriteLockBusyHandler;
  }

  export interface ReserveNextArgs extends ObtainLockArgs {
    readonly from: CodeService.SequenceScope;
  }
  export interface ElementCodeProps {
    readonly iModel: IModelDb;
    readonly props: {
      readonly code: CodeProps;
      federationGuid?: GuidString;
    };
  }

  export interface SpecNameAndId { readonly idxId: EntryId, readonly name: string }

  export type SpecNameOrId = SpecNameAndId |
  { readonly name: CodeService.CodeSpecName, idxId?: never, type?: string } |
  { readonly idxId: EntryId, name?: never, type?: string };

  export interface ScopeAndSpec {
    readonly spec: SpecNameOrId;
    readonly scope: CodeService.ScopeGuid;
  }

  export interface ScopeSpecAndValue extends ScopeAndSpec {
    readonly value: CodeService.CodeValue;
  }

  export interface CodeEntry {
    readonly spec: SpecNameOrId;
    readonly scope: CodeService.ScopeGuid;
    readonly value: CodeService.CodeValue;
    readonly guid: CodeService.CodeGuid;
    readonly originId: EntryId;
    readonly flags?: Flags;
    readonly authorId?: EntryId;
    readonly json?: SettingObject;
  }
  export type CodeFullEntry = CodeEntry & { readonly spec: SpecNameAndId };

  export interface ValueFilter {
    readonly value?: string;
    readonly type?: string;
    readonly valueCompare?: "GLOB" | "LIKE" | "=";
    readonly orderBy?: "ASC" | "DESC";
    readonly sqlExpression?: string;
  }

  export interface CodeFilter extends ValueFilter {
    readonly spec?: SpecNameOrId;
    readonly scope?: CodeService.ScopeGuid;
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
    "ReserveErrors" |
    "SequenceNotFound" |
    "SqlLogicError" |
    "ValueIsInUse";

  export class Error extends BentleyError {
    constructor(public errorId: ErrorId, errNum: number, message: string, public problems?: ReserveProblem[]) {
      super(errNum, message);
    }
  }
  export interface NameAndJson {
    readonly name: string;
    readonly json?: SettingObject;
    readonly type?: string;
  }

  export interface ScopeAndSpec {
    readonly spec: SpecNameOrId;
    readonly scope: ScopeGuid;
  }

  export interface ScopeSpecAndValue extends ScopeAndSpec {
    readonly value: CodeValue;
  }

  export interface ProposedCodeProps {
    value?: CodeValue;
    readonly guid: CodeGuid;
    readonly flags?: Flags;
    readonly json?: SettingObject;
    readonly origin: NameAndJson;
    readonly author: NameAndJson;
  }

  export interface SequenceScope extends ScopeAndSpec {
    readonly seq: CodeSequence;
    readonly start?: CodeValue;
  }

  export type ProposedCode = ProposedCodeProps & ScopeSpecAndValue;

  export interface ReserveProblem {
    readonly code: ProposedCode;
    readonly errorId: ErrorId;
    readonly message: string;
  }

  export type UpdatedCode = MarkRequired<Partial<ProposedCode>, "guid">;

  export interface CodeSequence {
    get sequenceName(): string;
    get sequenceType(): string;
    isValidCode(code: CodeValue): boolean;
    getFirstValue(): CodeValue;
    getLastValue(): CodeValue;
    getNextValue(code: CodeValue): CodeValue;
  }
}
