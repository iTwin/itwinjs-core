/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { electronHostTestSuite } from "./ElectronHostTests";

export enum TestResult {
  Success = 0,
  Failure = 1,
  InvalidArguments = 2,
}

export interface TestSuite {
  title: string,
  tests: {
    title: string,
    func: () => Promise<void>,
  }[]
}

export const testSuites = [electronHostTestSuite];
