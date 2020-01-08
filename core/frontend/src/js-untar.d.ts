/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
declare module 'js-untar';

declare function untar(buffer: ArrayBuffer): Promise<Array<ExtractedFile>>;

