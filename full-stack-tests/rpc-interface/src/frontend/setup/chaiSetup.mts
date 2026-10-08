/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";

// Certa ran every test file in one bundle, so one file's chai.use() applied to all. Vitest isolates files.
chai.use(chaiAsPromised);
