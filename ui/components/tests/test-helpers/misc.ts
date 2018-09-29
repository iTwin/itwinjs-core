/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";

export const waitForSpy = async (component: { update: () => void }, spy: sinon.SinonSpy): Promise<any> => {
  const timeout = 1000;
  const waitTime = 10;
  let totalWaitTime = 0;
  while (!spy.called && totalWaitTime <= timeout) {
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    totalWaitTime += waitTime;
  }
  expect(spy.called, "spy").to.be.true;
  component.update();
};
