/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CurrentImdlVersion } from "@itwin/core-common";
import type { TileTestCase, TileTestData } from "./TileIO.data";

type TestCaseName = "rectangle" | "triangles" | "lineString" | "lineStrings" | "cylinder";

function changeVersionInPlace(bytes: Uint8Array, versionMajor?: number, versionMinor?: number): void {
  if (undefined !== versionMinor) {
    bytes[4] = (versionMinor & 0x00ff);
    bytes[5] = (versionMinor & 0xff00) >> 8;
  }

  if (undefined !== versionMajor) {
    bytes[6] = (versionMajor & 0x00ff);
    bytes[7] = (versionMajor & 0xff00) >> 8;
  }
}

function changeTestCaseVersion(src: TileTestCase, majorVersion?: number, minorVersion?: number): TileTestCase {
  const bytes = new Uint8Array(src.bytes);
  changeVersionInPlace(bytes, majorVersion, minorVersion);
  return {
    flags: src.flags,
    bytes,
  };
}

function changeVersion(src: TileTestData, versionMajor?: number, versionMinor?: number): TileTestData {
  let dst: TileTestData = {
    versionMajor: undefined !== versionMajor ? versionMajor : src.versionMajor,
    versionMinor: undefined !== versionMinor ? versionMinor : src.versionMinor,
    headerLength: src.headerLength,
    rectangle: changeTestCaseVersion(src.rectangle, versionMajor, versionMinor),
    lineString: changeTestCaseVersion(src.lineString, versionMajor, versionMinor),
    lineStrings: changeTestCaseVersion(src.lineStrings, versionMajor, versionMinor),
    triangles: changeTestCaseVersion(src.triangles, versionMajor, versionMinor),
    cylinder: changeTestCaseVersion(src.cylinder, versionMajor, versionMinor),
  };

  dst.unreadable = (dst.versionMajor > CurrentImdlVersion.Major) ? true : undefined;

  if (undefined !== versionMajor && versionMajor > 1 && 1 === src.versionMajor) {
    // Added 4 bytes in v02.00 for empty sub-range bitmask
    dst = changeHeaderLength(dst, dst.versionMinor, 4);
  }

  return dst;
}

// Make a copy of the input test data that differs only in the minor version number.
export function changeMinorVersion(src: TileTestData, versionMinor: number): TileTestData {
  return changeVersion(src, undefined, versionMinor);
}

// Make a copy of the input test data that differs only in the major version number.
export function changeMajorVersion(src: TileTestData, versionMajor: number): TileTestData {
  return changeVersion(src, versionMajor);
}

function changeHeaderLengthInPlace(bytes: Uint8Array, data: TileTestData, numPaddingBytes: number): void {
  // header length is 32-bit little-endian integer beginning at index 8.
  const headerLength = data.headerLength + numPaddingBytes;
  bytes[8] = (headerLength & 0xff);
  bytes[9] = (headerLength & 0xff00) >>> 8;
  bytes[10] = (headerLength & 0xff0000) >>> 0x10;
  bytes[11] = (headerLength & 0xff000000) >>> 0x18;

  // tile length is 32-bit little-endian integer beginning at index 80
  const tileLength = ((bytes[80] | (bytes[81] << 8) | (bytes[82] << 0x10) | (bytes[83] << 0x18)) >>> 0) + numPaddingBytes;
  bytes[80] = (tileLength & 0xff);
  bytes[81] = (tileLength & 0xff00) >>> 8;
  bytes[82] = (tileLength & 0xff0000) >>> 0x10;
  bytes[83] = (tileLength & 0xff000000) >>> 0x18;
}

function padTestCaseHeader(data: TileTestData, testCase: TestCaseName, minorVersion: number, numPaddingBytes: number): TileTestCase {
  const src = data[testCase];
  const bytes = new Uint8Array(src.bytes.length + numPaddingBytes);
  for (let i = 0; i < data.headerLength; i++)
    bytes[i] = src.bytes[i];

  for (let i = 0; i < numPaddingBytes; i++)
    bytes[data.headerLength + i] = Math.floor(Math.random() * 0xff);

  for (let i = data.headerLength; i < src.bytes.length; i++)
    bytes[i + numPaddingBytes] = src.bytes[i];

  changeVersionInPlace(bytes, undefined, minorVersion);
  changeHeaderLengthInPlace(bytes, data, numPaddingBytes);

  return {
    flags: src.flags,
    bytes,
  };
}

// Make a copy of the input test data that differs only in the minor version number and in the header length (appends extra bytes to header)
export function changeHeaderLength(src: TileTestData, versionMinor: number, numPaddingBytes: number): TileTestData {
  return {
    versionMajor: src.versionMajor,
    versionMinor,
    headerLength: src.headerLength + numPaddingBytes,
    unreadable: src.unreadable,
    rectangle: padTestCaseHeader(src, "rectangle", versionMinor, numPaddingBytes),
    triangles: padTestCaseHeader(src, "triangles", versionMinor, numPaddingBytes),
    lineString: padTestCaseHeader(src, "lineString", versionMinor, numPaddingBytes),
    lineStrings: padTestCaseHeader(src, "lineStrings", versionMinor, numPaddingBytes),
    cylinder: padTestCaseHeader(src, "cylinder", versionMinor, numPaddingBytes),
  };
}
