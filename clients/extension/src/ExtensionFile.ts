/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Stores a file name (relative path) and its content
 * @beta
 */
export interface ExtensionFile {
  fileName: string;
  content: ArrayBuffer;
}
