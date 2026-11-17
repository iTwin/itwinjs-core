/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { QueryRowFormat, QueryRowProxy } from "@itwin/core-common";
import { ECDb } from "../../ECDb";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";

/* eslint-disable @typescript-eslint/naming-convention */

describe("QueryRowProxy", () => {
  let ecdb: ECDb;
  const ecsql = "SELECT ToRow, ToArray, GetMetaData FROM ts.Thing";

  before(() => {
    ecdb = ECDbTestHelper.createECDb(KnownTestLocations.outputDir, "QueryRowProxy.ecdb",
      `<ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Thing">
          <ECProperty propertyName="ToRow" typeName="string"/>
          <ECProperty propertyName="ToArray" typeName="string"/>
          <ECProperty propertyName="GetMetaData" typeName="string"/>
        </ECEntityClass>
      </ECSchema>`);
    ecdb.withCachedWriteStatement("INSERT INTO ts.Thing(ToRow, ToArray, GetMetaData) VALUES('r', 'a', 'm')", (stmt) => stmt.stepForInsert());
    ecdb.saveChanges();
  });

  after(() => ecdb[Symbol.dispose]());

  function checkRow(row: QueryRowProxy) {
    expect(row.toRow()).to.deep.equal({ ToRow: "r", ToArray: "a", GetMetaData: "m" });
    expect(row.toArray()).to.deep.equal(["r", "a", "m"]);
    expect(row.getMetaData().map((property) => property.name)).to.deep.equal(["ToRow", "ToArray", "GetMetaData"]);
    expect(row[0]).to.equal("r");
    expect(row.TOARRAY).to.equal("a");
    expect("getmetadata" in row).to.be.true;
    expect("toRow" in row).to.be.true;
    expect(2 in row).to.be.true;
    expect(3 in row).to.be.false;
    expect("Missing" in row).to.be.false;
  }

  it("keeps its methods when columns share their names", async () => {
    ecdb.withQueryReader(ecsql, (syncReader) => {
      expect(syncReader.step()).to.be.true;
      checkRow(syncReader.current);
    }, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });

    const asyncReader = ecdb.createQueryReader(ecsql, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
    expect(await asyncReader.step()).to.be.true;
    checkRow(asyncReader.current);
  });
});
