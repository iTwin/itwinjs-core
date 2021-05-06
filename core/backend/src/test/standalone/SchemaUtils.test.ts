/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Schema } from "../../Schema";
import * as Semver from "semver";

describe("Schema Utilities Test", () => {

  it("paddedVersionToSemver", async () => {
    assert.equal(Schema.paddedVersionToSemver("1.00.00"), "1.0.0");
    assert.isNotNull(Semver.valid(Schema.paddedVersionToSemver("1.00.00")));

    assert.equal(Schema.paddedVersionToSemver("01.0.0"), "1.0.0");
    assert.isNotNull(Semver.valid(Schema.paddedVersionToSemver("01.0.0")));

    // bad inputs with undefined behavior

    assert.equal(Schema.paddedVersionToSemver("bad.input"), "NaN.NaN");
    assert.isNull(Semver.valid(Schema.paddedVersionToSemver("bad.input")));

    assert.equal(Schema.paddedVersionToSemver("012.0013"), "12.13");
    assert.isNull(Semver.valid(Schema.paddedVersionToSemver("012.0013")));
  });
});
