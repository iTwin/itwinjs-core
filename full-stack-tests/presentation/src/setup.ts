/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// eslint-disable-next-line no-console
console.log(`Backend PID: ${process.pid}`);

// see https://github.com/babel/babel/issues/4605
import sourceMapSupport from "source-map-support";
sourceMapSupport.install({
  environment: "node",
});

// setup chai
import * as chai from "chai";
import chaiJestSnapshot from "chai-jest-snapshot";
import chaiAsPromised from "chai-as-promised";
import chaiSubset from "chai-subset";
import sinonChai from "sinon-chai";
chai.use(chaiJestSnapshot);
chai.use(chaiAsPromised);
chai.use(sinonChai);
chai.use(chaiSubset);

// get rid of various xhr errors in the console
import globalJsdom from "global-jsdom";
import * as jsdom from "jsdom";
globalJsdom(undefined, {
  virtualConsole: new jsdom.VirtualConsole().sendTo(console, { omitJSDOMErrors: true }),
});

// supply mocha hooks
export const mochaHooks = {
  beforeAll() {
    chaiJestSnapshot.resetSnapshotRegistry();
  },
  beforeEach() {
    const currentTest = (this as unknown as Mocha.Context).currentTest!;

    // set up snapshot name
    const sourceFilePath = currentTest.file!.replace("lib", "src").replace(/\.(jsx?|tsx?)$/, "");
    const snapPath = `${sourceFilePath}.snap`;
    chaiJestSnapshot.setFilename(snapPath);
    chaiJestSnapshot.setTestName(currentTest.fullTitle());
  },
  afterEach() {},
  afterAll() {},
};
