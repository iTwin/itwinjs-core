/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.pointcloud.format.opc;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { ABuffer } from "../../../system/buffer/ABuffer";
import { LittleEndian } from "../../../system/buffer/LittleEndian";
import { AList } from "../../../system/collection/AList";
import { ABufferInStream } from "../../../system/io/ABufferInStream";
import { InStream } from "../../../system/io/InStream";
import { ALong } from "../../../system/runtime/ALong";
import { ASystem } from "../../../system/runtime/ASystem";
import { Message } from "../../../system/runtime/Message";
import { Strings } from "../../../system/runtime/Strings";
import { FileStorage } from "../../../system/storage/FileStorage";
import { ContainerFilePart } from "./ContainerFilePart";
import { FileAccess } from "./FileAccess";

/**
 * Class ContainerFile defines a single file that contains multiple internal parts.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class ContainerFile {
  /** The name of this module */
  private static readonly MODULE: string = "ContainerFile";

  /** The name of the file */
  private _fileName: string;
  /** The length of the file */
  private _fileLength: ALong;
  /** The format */
  private _format: string;
  /** The parts in the file */
  private _parts: AList<ContainerFilePart>;

  /**
   * Create a new container file.
   * @param fileName the name of the file.
   * @param fileLength the length of the file.
   * @param format the format.
   * @param parts the parts in the file.
   */
  public constructor(
    fileName: string,
    fileLength: ALong,
    format: string,
    parts: AList<ContainerFilePart>
  ) {
    this._fileName = fileName;
    this._fileLength = fileLength;
    this._format = format;
    this._parts = parts;
  }

  /**
   * Close the container file.
   * @param closeFileAccess close all file access?
   */
  public close(closeFileAccess: boolean): void {
    if (closeFileAccess)
      for (let i: number = 0; i < this._parts.size(); i++)
        this._parts.get(i).getFileAccess().close();
    this._parts.clear();
  }

  /**
   * Get the name of the file.
   * @return the name of the file.
   */
  public getFileName(): string {
    return this._fileName;
  }

  /**
   * Get the length of the file.
   * @return the length of the file.
   */
  public getFileLength(): ALong {
    return this._fileLength;
  }

  /**
   * Get the format.
   * @return the format.
   */
  public getFormat(): string {
    return this._format;
  }

  /**
   * Get the number of parts.
   * @return the number of parts.
   */
  public getPartCount(): int32 {
    return this._parts.size();
  }

  /**
   * Get the list of parts.
   * @return the list of parts.
   */
  public getParts(): AList<ContainerFilePart> {
    return this._parts;
  }

  /**
   * Get a part.
   * @param name the name of the part.
   * @return the part (null if not found).
   */
  public getPart(name: string): ContainerFilePart {
    /* Check all parts */
    for (let i: number = 0; i < this._parts.size(); i++) {
      /* Check the next part */
      let part: ContainerFilePart = this._parts.get(i);
      if (Strings.equals(part.getName(), name)) return part;
    }
    /* Not found */
    return null;
  }

  /**
   * Check if the magic marker is found.
   * @param input the input stream.
   * @param format the 4-character identifier of the format.
   * @return true if found, false if not.
   */
  private static checkMarker(input: InStream, format: string): boolean {
    let m0: int32 = LittleEndian.readStreamByte(input);
    let m1: int32 = LittleEndian.readStreamByte(input);
    let m2: int32 = LittleEndian.readStreamByte(input);
    let m3: int32 = LittleEndian.readStreamByte(input);
    if (m0 != Strings.getCharAt(format, 0)) return false;
    if (m1 != Strings.getCharAt(format, 1)) return false;
    if (m2 != Strings.getCharAt(format, 2)) return false;
    if (m3 != Strings.getCharAt(format, 3)) return false;
    return true;
  }

  /**
   * Read the parts of a container file.
   * @param containerFileName the name of the container file.
   * @param format the 4-character identifier of the format.
   * @return the container file.
   */
  public static async read(
    fileStorage: FileStorage,
    containerFileName: string,
    format: string
  ): Promise<ContainerFile> {
    /* Existing file? */
    Message.print(
      ContainerFile.MODULE,
      "Reading container file '" + containerFileName + "'"
    );
    let fileLength: ALong = await fileStorage.getFileLength(containerFileName);
    if (fileLength.isNegative()) {
      /* Abort */
      Message.printWarning(ContainerFile.MODULE, "File not found");
      return null;
    }
    /* Too short? */
    if (fileLength.subInt(16).isNegative()) {
      /* Fail */
      ASystem.assert0(
        false,
        "Invalid container file '" + containerFileName + "' (too short)"
      );
    }
    /* Read the file header */
    let headerSize: int32 = 60 * 1024;
    if (fileLength.subInt(headerSize).isNegative())
      headerSize = fileLength.toInt();
    let header: ABuffer = await fileStorage.readFilePart(
      containerFileName,
      ALong.ZERO,
      headerSize
    );
    let headerInput: ABufferInStream = new ABufferInStream(
      header,
      0,
      header.size()
    );
    /* Check the marker */
    if (ContainerFile.checkMarker(headerInput, format) == false) {
      /* Fail */
      headerInput.close();
      ASystem.assert0(
        false,
        "Invalid container file '" + containerFileName + "' (header marker)"
      );
    }
    /* Check the version */
    let version: int32 = LittleEndian.readStreamByte(headerInput);
    if (version != 2) {
      /* Fail */
      headerInput.close();
      ASystem.assert0(
        false,
        "Invalid container file '" +
          containerFileName +
          "' (version " +
          version +
          ")"
      );
    }
    /* Reserved */
    let r1: int32 = LittleEndian.readStreamByte(headerInput);
    let r2: int32 = LittleEndian.readStreamByte(headerInput);
    let r3: int32 = LittleEndian.readStreamByte(headerInput);
    /* Get the file count */
    let fileCount: int32 = LittleEndian.readStreamInt(headerInput);
    if (fileCount < 0) {
      /* Fail */
      headerInput.close();
      ASystem.assert0(
        false,
        ContainerFile.MODULE +
          " : Invalid container file '" +
          containerFileName +
          "' (file count " +
          fileCount +
          ")"
      );
    }
    /* Define the file access */
    let fileAccess: FileAccess = new FileAccess(
      fileStorage,
      containerFileName,
      fileLength
    );
    /* Read the parts */
    let maxExtent: ALong = ALong.ZERO;
    let parts: AList<ContainerFilePart> = new AList<ContainerFilePart>();
    for (let i: number = 0; i < fileCount; i++) {
      /* Read the next file */
      let partOffset: ALong = LittleEndian.readStreamLong(headerInput);
      let partLength: ALong = LittleEndian.readStreamLong(headerInput);
      let partName: string = LittleEndian.readStreamString(headerInput);
      /* Add the part */
      parts.add(
        new ContainerFilePart(partName, fileAccess, partOffset, partLength)
      );
      Message.print(
        ContainerFile.MODULE,
        "Found part '" +
          partName +
          "' offset " +
          partOffset.toDouble() +
          " size " +
          partLength.toDouble()
      );
      /* Update the maximum extent */
      let partExtent: ALong = partOffset.add(partLength);
      maxExtent = ALong.max(maxExtent, partExtent);
    }
    /* Done */
    headerInput.close();
    /* Return the container */
    Message.print(
      ContainerFile.MODULE,
      "Found " +
        parts.size() +
        " parts, header size " +
        headerInput.getPosition()
    );
    Message.print(
      ContainerFile.MODULE,
      "File size is " +
        fileLength.toDouble() +
        ", max part extent is " +
        maxExtent.toDouble()
    );
    return new ContainerFile(containerFileName, fileLength, format, parts);
  }
}
