/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import * as enzyme from "enzyme";

before(() => {
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    return window.setTimeout(cb, 1);
  };
  window.cancelAnimationFrame = (handle: number) => {
    window.clearTimeout(handle);
  };
});

/** @internal */
export const createRect = (left: number, top: number, right: number, bottom: number): ClientRect => ({
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
});

/** @internal */
export const createBoundingClientRect = (left: number, top: number, right: number, bottom: number): DOMRect => ({
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
  x: left,
  y: top,
  toJSON: () => "",
});

/** @internal */
export const createSizedRect = (args?: { width?: number, height?: number }): ClientRect => {
  const left = 0;
  const width = args && args.width ? args.width : 0;
  const right = left + width;
  const top = 0;
  const height = args && args.height ? args.height : 0;
  const bottom = top + height;
  return createRect(left, top, right, bottom);
};

/** @internal */
export const createPointerEvent = (props?: Partial<PointerEvent>): PointerEvent => ({
  clientX: 0,
  clientY: 0,
  preventDefault: () => { },
  ...props,
} as PointerEvent);

/** @internal */
export const createDOMRect = (args?: { width?: number, height?: number }): DOMRect => {
  const rect = createSizedRect(args);
  return {
    ...rect,
    x: rect.left,
    y: rect.top,
    toJSON: () => "",
  };
};

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
