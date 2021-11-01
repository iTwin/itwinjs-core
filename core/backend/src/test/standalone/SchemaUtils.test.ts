/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Schema } from "../../Schema";
import * as Semver from "semver";

describe("Schema Utilities Test", () => {

  it("paddedVersionToSemver", async () => {
    assert.equal(Schema.toSemverString("1.00.00"), "1.0.0");
    assert.isNotNull(Semver.valid(Schema.toSemverString("1.00.00")));

    assert.equal(Schema.toSemverString("01.0.0"), "1.0.0");
    assert.isNotNull(Semver.valid(Schema.toSemverString("01.0.0")));

    assert.equal(Schema.toSemverString("1.2.3"), "1.2.3");
    assert.isNotNull(Semver.valid(Schema.toSemverString("1.2.3")));

    assert.equal(Schema.toSemverString("012.0013"), "12.0.13");
    assert.isNotNull(Semver.valid(Schema.toSemverString("012.0013")));

    // bad inputs with undefined behavior

    assert.equal(Schema.toSemverString("bad.input"), "NaN.0.NaN");
    assert.isNull(Semver.valid(Schema.toSemverString("bad.input")));

    assert.equal(Schema.toSemverString("1..2"), "1.0.2");
    assert.isNotNull(Semver.valid(Schema.toSemverString("1..2")));
  });
});
