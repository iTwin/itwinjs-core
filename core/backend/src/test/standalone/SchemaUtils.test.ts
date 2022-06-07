/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "chai";
import { Schema } from "../../Schema";
import { IModelHost } from "../../IModelHost";
import * as Semver from "semver";
import { KnownTestLocations } from "../KnownTestLocations";

describe("Schema Utilities Test", () => {
  let assetsDir: string;

  before(async () => {
    IModelHost.startup();
    assetsDir = path.join(KnownTestLocations.assetsDir, "ECSchemaOps");
  });

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

  it("computeChecksum", async () => {
    const schemaPath = path.join(assetsDir, "SchemaA.ecschema.xml");
    const refPath = path.dirname(schemaPath);
    const sha1 = Schema.getSchemaSha1Hash(schemaPath, [refPath]);
    assert.isDefined(sha1);
    assert.equal(sha1, "3ac6578060902aa0b8426b61d62045fdf7fa0b2b", "Expected sha1 hash values to match");
  });

  it("computeChecksumWithExactRefMatch", async () => {
    const schemaPath = path.join(assetsDir, "SchemaA.ecschema.xml");
    let refPath = path.dirname(schemaPath);
    refPath = path.join(refPath, "exact-match");
    const sha1 = Schema.getSchemaSha1Hash(schemaPath, [refPath], true);
    assert.isDefined(sha1);
    assert.equal(sha1, "2a618664fbba1df7c05f27d7c0e8f58de250003b", "Expected sha1 hash values to match");
  });

});
