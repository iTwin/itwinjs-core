/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyStatus } from "@itwin/core-bentley";
import { IModelHost } from "../IModelHost";
import { IModelJsFs } from "../IModelJsFs";

export interface LzmaParams {
  dictSize?: number;
  level?: number;
  lc?: number;
  lp?: number;
  pb?: number;
  fb?: number;
  numHashBytes?: number;
  mc?: number;
  writeEndMark?: number;
  btMode?: number;
  numThreads?: number;
  blockSize?: number;
  numBlockThreads?: number;
  numTotalThreads?: number;
  algo?: number;
}

export interface ChangesetSizeInfo {
  compressSize?: number;
  uncompressSize?: number;
  prefixSize?: number;
}

export class RevisionUtility {
  public static readonly DEFAULT: LzmaParams = {
    algo: 1,
    blockSize: 67108864,
    btMode: 1,
    dictSize: 16777216,
    fb: 64,
    lc: 3,
    level: 7,
    lp: 0,
    mc: 48,
    numBlockThreads: 4,
    numHashBytes: 4,
    numThreads: 2,
    numTotalThreads: 8,
    pb: 2,
    writeEndMark: 0,
  };

  public static recompressRevision(sourceFile: string, targetFile: string, lzmaProps?: LzmaParams): BentleyStatus {
    if (!IModelJsFs.existsSync(sourceFile))
      throw new Error("SourceFile does not exists");
    return IModelHost.platform.RevisionUtility.recompressRevision(sourceFile, targetFile, lzmaProps ? JSON.stringify(lzmaProps) : undefined);
  }
  public static disassembleRevision(sourceFile: string, targetDir: string): BentleyStatus {
    if (!IModelJsFs.existsSync(sourceFile))
      throw new Error("SourceFile does not exists");
    return IModelHost.platform.RevisionUtility.disassembleRevision(sourceFile, targetDir);
  }
  public static assembleRevision(targetFile: string, rawChangesetFile: string, prefixFile?: string, lzmaProps?: LzmaParams): BentleyStatus {
    if (!IModelJsFs.existsSync(rawChangesetFile))
      throw new Error("RawChangesetFile does not exists");
    if (prefixFile && !IModelJsFs.existsSync(prefixFile))
      throw new Error("prefixFile does not exists");
    return IModelHost.platform.RevisionUtility.assembleRevision(targetFile, rawChangesetFile, prefixFile, lzmaProps ? JSON.stringify(lzmaProps) : undefined);
  }
  public static normalizeLzmaParams(lzmaProps?: LzmaParams): LzmaParams {
    return JSON.parse(IModelHost.platform.RevisionUtility.normalizeLzmaParams(lzmaProps ? JSON.stringify(lzmaProps) : undefined)) as LzmaParams;
  }
  public static computeStatistics(sourceFile: string, addPrefix: boolean = true): any {
    if (!IModelJsFs.existsSync(sourceFile))
      throw new Error("SourceFile does not exists");
    return JSON.parse(IModelHost.platform.RevisionUtility.computeStatistics(sourceFile, addPrefix));
  }
  public static getUncompressSize(sourceFile: string): ChangesetSizeInfo {
    if (!IModelJsFs.existsSync(sourceFile))
      throw new Error("SourceFile does not exists");
    return JSON.parse(IModelHost.platform.RevisionUtility.getUncompressSize(sourceFile)) as ChangesetSizeInfo;
  }
}
