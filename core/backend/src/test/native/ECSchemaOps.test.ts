/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { assert } from "chai";
import { getSchemaSha1Hash } from "../../ECSchemaOps";
import { KnownTestLocations } from "../KnownTestLocations";

describe("ECSchemaOps", () => {
  let assetsDir: string;

  before(async () => {
    assetsDir = path.join(KnownTestLocations.assetsDir, "ECSchemaOps");
  });

  after(async () => {
  });

  it("computeChecksum", async () => {
    const schemaPath = path.join(assetsDir, "SchemaA.ecschema.xml");
    const refPath = path.dirname(schemaPath);
    const sha1 = getSchemaSha1Hash(schemaPath, [refPath]);
    assert.isDefined(sha1);
    assert.equal(sha1, "3ac6578060902aa0b8426b61d62045fdf7fa0b2b", "Expected sha1 hash values to match");
  });

  it("computeChecksumWithExactRefMatch", async () => {
    const schemaPath = path.join(assetsDir, "SchemaA.ecschema.xml");
    let refPath = path.dirname(schemaPath);
    refPath = path.join(refPath, "exact-match");
    const sha1 = getSchemaSha1Hash(schemaPath, [refPath], true);
    assert.isDefined(sha1);
    assert.equal(sha1, "2a618664fbba1df7c05f27d7c0e8f58de250003b", "Expected sha1 hash values to match");
  });
});