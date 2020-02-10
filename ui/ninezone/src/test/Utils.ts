/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";

// tslint:disable: completed-docs

export const createRect = (left: number, top: number, right: number, bottom: number): ClientRect => ({
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
});

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

export const createSizedRect = (args?: { width?: number }): ClientRect => {
  const left = 0;
  const width = args && args.width !== undefined ? args.width : 0;
  const right = left + width;
  return createRect(left, 0, right, 0);
};

export const createPointerEvent = (props?: Partial<PointerEvent>): PointerEvent => ({
  clientX: 0,
  clientY: 0,
  preventDefault: () => { },
  ...props,
} as PointerEvent);

export const createDOMRect = (args?: { width?: number }): DOMRect => {
  const rect = createSizedRect(args);
  return {
    ...rect,
    x: rect.left,
    y: rect.top,
    toJSON: () => "",
  };
};

// tslint:disable-next-line: variable-name
export interface ResizeObserverMock extends ResizeObserver {
  readonly callback: ResizeObserverCallback;
}

declare module "sinon" {
  interface SinonStubStatic {
    // tslint:disable-next-line: callable-types
    <T extends (...args: any) => any>(): sinon.SinonStub<Parameters<T>, ReturnType<T>>;
  }
}

export type SinonSpy<T extends (...args: any) => any> = sinon.SinonSpy<Parameters<T>, ReturnType<T>>;
export type SinonStub<T extends (...args: any) => any> = sinon.SinonStub<Parameters<T>, ReturnType<T>>;
