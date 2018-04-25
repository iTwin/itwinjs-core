/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

export interface GLDisposable {
  dispose(gl: WebGLRenderingContext): void;
}

export function usingGL<TResult>(gl: WebGLRenderingContext, disposable: GLDisposable, func: () => TResult): TResult {
  try {
    return func();
  } finally {
    disposable.dispose(gl);
  }
}
