/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

import * as fs from "fs";
import { ABuffer } from "../buffer/ABuffer";
import { AList } from "../collection/AList";
import { ALong } from "../runtime/ALong";
import { ASystem } from "../runtime/ASystem";
import { FileContent } from "./FileContent";
import { FileRange } from "./FileRange";
import { FileStorage } from "./FileStorage";

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

/**
 * Class NodeFS provides access to files using the Node platform.
 */
/** @internal */
export class NodeFS extends FileStorage {
    /**
     * Create new storage.
     */
    public constructor() {
        super();
    }

    /**
     * FileStorage method.
     */
    public close(): void {
    }

    /**
     * FileStorage method.
     */
    public async getFileLength(fileName: string): Promise<ALong> {
        let fileStats: fs.Stats = fs.statSync(fileName);
        return ALong.fromDouble(fileStats.size);
    }

    /**
     * FileStorage method.
     */
    public async readFilePart(fileName: string, offset: ALong, size: int32): Promise<ABuffer> {
        let rawBuffer: ArrayBuffer = new ArrayBuffer(size);
        let buffer: Uint8Array = new Uint8Array(rawBuffer);
        let fd: number = fs.openSync(fileName, "r");
        let bytesRead: number = fs.readSync(fd, buffer, 0, size, offset.toDouble());
        fs.closeSync(fd);
        ASystem.assert0(bytesRead == size, "Expected " + size + " bytes read, not " + bytesRead + " from file '" + fileName + "' offset " + offset.toDouble());
        return ABuffer.wrap(rawBuffer);
    }

    /**
     * FileStorage method.
     */
    public async readFileParts(fileName: string, ranges: AList<FileRange>): Promise<AList<FileContent>> {
        let buffers: AList<FileContent> = new AList<FileContent>();
        let fd: number = fs.openSync(fileName, "r");
        for (let i: number = 0; i < ranges.size(); i++) {
            let range: FileRange = ranges.get(i);
            let rawBuffer: ArrayBuffer = new ArrayBuffer(range.size);
            let buffer: Uint8Array = new Uint8Array(rawBuffer);
            let bytesRead: number = fs.readSync(fd, buffer, 0, range.size, range.offset.toDouble());
            ASystem.assert0(bytesRead == range.size, "Expected " + range.size + " bytes read, not " + bytesRead + " from file '" + fileName + "' offset " + range.offset.toDouble());
            buffers.add(new FileContent(range.offset, ABuffer.wrap(rawBuffer)));
        }
        fs.closeSync(fd);
        return buffers;
    }

    /**
     * FileStorage method.
     */
    public async writeFile(fileName: string, fileContent: ABuffer): Promise<void> {
        let fd: number = fs.openSync(fileName, "w");
        fs.writeSync(fd, new Uint8Array(fileContent.toNativeBuffer()));
        fs.closeSync(fd);
    }
}
