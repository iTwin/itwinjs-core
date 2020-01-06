/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

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
export const createPointerEvent = (props?: Partial<PointerEvent>): PointerEvent => ({
  clientX: 0,
  clientY: 0,
  preventDefault: () => { },
  ...props,
} as PointerEvent);

export type SinonSpy<T extends (...args: any) => any> = sinon.SinonSpy<Parameters<T>, ReturnType<T>>;
export type SinonStub<T extends (...args: any) => any> = sinon.SinonStub<Parameters<T>, ReturnType<T>>;
export type CreateRefStub<T = unknown> = sinon.SinonStub<Parameters<typeof React.createRef>, React.RefObject<T>>;
