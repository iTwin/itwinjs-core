/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiJestSnapshot from "chai-jest-snapshot";
import sinonChai from "sinon-chai";
import sinon from "sinon";
import sourceMapSupport from "source-map-support";
import path from "path";
import { JSDOM } from "jsdom";

// FIXME: This goes against jsdom best practices. https://github.com/jsdom/jsdom/wiki/Don%27t-stuff-jsdom-globals-onto-the-Node-global
globalThis.window = new JSDOM().window as any;

// see https://github.com/babel/babel/issues/4605
sourceMapSupport.install({
  environment: "node",
});

// setup chai
chai.use(chaiAsPromised);
chai.use(chaiJestSnapshot);
chai.use(sinonChai);

export const mochaHooks = {
  beforeAll() {
    chaiJestSnapshot.resetSnapshotRegistry();
  },
  beforeEach() {
    const currentTest = (this as unknown as Mocha.Context).currentTest!;

    // set up snapshot name
    const sourceFilePath = currentTest.file?.replace(path.join("lib", "cjs", "test"), path.join("src", "test")).replace(/\.(jsx?|tsx?)$/, "");
    const snapPath = `${sourceFilePath}.snap`;
    chaiJestSnapshot.setFilename(snapPath);
    chaiJestSnapshot.setTestName(currentTest.fullTitle());
  },
  afterEach() {
    sinon.restore();
  },
  afterAll() {},
};
