/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { IDisposable } from "@bentley/bentleyjs-core";

export function dispose(disposable?: IDisposable) {
  if (undefined !== disposable) {
    disposable.dispose();
  }

  return undefined;
}
