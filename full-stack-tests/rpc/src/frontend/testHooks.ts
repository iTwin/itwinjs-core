/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

type Hook = (callback: () => unknown) => void;

type HookGlobals = typeof globalThis & {
  before?: Hook;
  after?: Hook;
  beforeAll?: Hook;
  afterAll?: Hook;
};

const hooks = globalThis as HookGlobals;

export const before: Hook = hooks.beforeAll ?? hooks.before ?? (() => {
  throw new Error("No before hook implementation is available.");
});

export const after: Hook = hooks.afterAll ?? hooks.after ?? (() => {
  throw new Error("No after hook implementation is available.");
});
