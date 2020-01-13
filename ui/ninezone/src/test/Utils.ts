/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
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

// tslint:disable: completed-docs
export const createSizedRect = (args?: { width?: number }): ClientRect => {
  const left = 0;
  const width = args && args.width !== undefined ? args.width : 0;
  const right = left + width;
  return createRect(left, 0, right, 0);
};

// tslint:disable: completed-docs
export const createPointerEvent = (props?: Partial<PointerEvent>): PointerEvent => ({
  clientX: 0,
  clientY: 0,
  preventDefault: () => { },
  ...props,
} as PointerEvent);

// tslint:disable: completed-docs
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

export type SinonSpy<T extends (...args: any) => any> = sinon.SinonSpy<Parameters<T>, ReturnType<T>>;
export type SinonStub<T extends (...args: any) => any> = sinon.SinonStub<Parameters<T>, ReturnType<T>>;
export type CreateRefStub<T = unknown> = sinon.SinonStub<Parameters<typeof React.createRef>, React.RefObject<T>>;
