/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

interface ClientRequestContext {
  enter(): void;
}

class Good {
  async goodMethod(reqCtx: ClientRequestContext) {
    reqCtx.enter();
    await Promise.resolve(5);
    reqCtx.enter();
  }

  async badMethod(reqCtx: ClientRequestContext) {
    reqCtx.enter();
    await Promise.resolve(5);
    const badStatement = 10;
  }
}

async function asyncFunc() {
  return Promise.resolve();
}

function promiseReturningFunc(): Promise<number> {
  return Promise.resolve(5);
}

const asyncArrowFunc = async () => {
  return Promise.resolve();
};

const promiseReturningArrowFunc = (): Promise<number> => {
  return Promise.resolve(2);
};


class Class {
  async asyncMethod() {
    await Promise.resolve(5);
  }

  promiseReturningMethod(ctx: ClientRequestContext) {
    return Promise.resolve(5);
  }
}