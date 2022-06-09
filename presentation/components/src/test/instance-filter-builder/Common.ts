/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Stubs global 'requestAnimationFrame' and 'cancelAnimationFrame' functions.
 * This is needed for tests using 'react-select' component.
 */
export function stubRaf() {
  const raf = global.requestAnimationFrame;
  const caf = global.cancelAnimationFrame;

  before(() => {
    Object.defineProperty(global, "requestAnimationFrame", {
      writable: true,
      value: (cb: FrameRequestCallback) => {
        return setTimeout(cb, 0);
      },
    });
    Object.defineProperty(global, "cancelAnimationFrame", {
      writable: true,
      value: (handle: number) => {
        clearTimeout(handle);
      },
    });
  });

  after(() => {
    Object.defineProperty(global, "requestAnimationFrame", {
      writable: true,
      value: raf,
    });
    Object.defineProperty(global, "cancelAnimationFrame", {
      writable: true,
      value: caf,
    });
  });
}
