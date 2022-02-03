/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type * as sinon from "sinon";
import type * as enzyme from "enzyme";

before(() => {
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    return window.setTimeout(cb, 1);
  };
  window.cancelAnimationFrame = (handle: number) => {
    window.clearTimeout(handle);
  };
});

/** @internal */
export const createRect = (left: number, top: number, right: number, bottom: number): DOMRect => DOMRect.fromRect({
  x: left,
  y: top,
  width: right - left,
  height: bottom - top,
});

/** @internal */
export class ResizeObserverMock implements ResizeObserver {
  public constructor(public readonly callback: ResizeObserverCallback) {
  }

  public observe(_: Element): void {
  }

  public unobserve(_: Element): void {
  }

  public disconnect(): void {
  }
}

declare module "sinon" {
  interface SinonStubStatic {
    // eslint-disable-next-line @typescript-eslint/prefer-function-type
    <T extends (...args: any) => any>(): sinon.SinonStub<Parameters<T>, ReturnType<T>>;
  }
}

/** @internal */
export type SinonSpy<T extends (...args: any) => any> = sinon.SinonSpy<Parameters<T>, ReturnType<T>>;
/** @internal */
export type SinonStub<T extends (...args: any) => any> = sinon.SinonStub<Parameters<T>, ReturnType<T>>;

/** Enzyme mount with automatic unmount after the test. */
export const mount: typeof enzyme.mount = (global as any).enzymeMount;

/** Waits until all async operations finish */
export async function flushAsyncOperations() {
  return new Promise((resolve) => setTimeout(resolve, 300));
}
