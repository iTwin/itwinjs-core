/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Readable, Writable } from "stream"; // Must be "import type" to avoid webpack polyfill errors
import type { Buffer } from "buffer"; // Must be "import type" to avoid webpack polyfill errors

/*
IMPORTANT:
This is a temporary source file for backwards compatibility only.
Do not add any new types to this file.
All types here will be removed in 4.0
*/

/** @public @deprecated */
export type BackendReadable = Readable;

/** @public @deprecated */
export type BackendWritable = Writable;

/** @internal @deprecated */
export type BackendBuffer = Buffer;

