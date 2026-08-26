/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { DbResult } from "@itwin/core-bentley";
import { ECDb, ECSqlStatement } from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";

const testSchema = `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
  <ECStructClass typeName="Details">
    <ECProperty propertyName="Nickname" typeName="string"/>
  </ECStructClass>
  <ECEntityClass typeName="Person" modifier="Sealed">
    <ECProperty propertyName="Name" typeName="string"/>
    <ECProperty propertyName="Age" typeName="int"/>
    <ECProperty propertyName="Salary" typeName="double"/>
    <ECStructProperty propertyName="Details" typeName="Details"/>
  </ECEntityClass>
</ECSchema>`;

const mapping = [
  { columnIndex: 0, propertyName: "Name" },
  { columnIndex: 1, propertyName: "Age" },
  { columnIndex: 2, propertyName: "Salary" },
  { columnIndex: 3, propertyName: "Details.Nickname" },
];

function readPeople(ecdb: ECDb): Array<{ name: string, age: number, salary: number, nickname?: string }> {
  const rows: Array<{ name: string, age: number, salary: number, nickname?: string }> = [];
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  ecdb.withPreparedStatement("SELECT Name, Age, Salary, Details.Nickname FROM test.Person ORDER BY Name", (stmt: ECSqlStatement) => {
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const nickname = stmt.getValue(3);
      rows.push({
        name: stmt.getValue(0).getString(),
        age: stmt.getValue(1).getInteger(),
        salary: stmt.getValue(2).getDouble(),
        nickname: nickname.isNull ? undefined : nickname.getString(),
      });
    }
  });
  return rows;
}

describe("ECDb CSV import", () => {
  const outDir = KnownTestLocations.outputDir;

  it("imports in-memory CSV data atomically", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "csv-import-data.ecdb", testSchema);
    expect(ecdb.importCSVData([
      ["Alice", "42", "1234.5", "Résumé"],
      ["用户", "31", "2500.25", "昵称"],
    ], { className: "Test.Person", mapping })).to.equal(2);

    expect(() => ecdb.importCSVData([
      ["Valid", "20", "1000", "valid"],
      ["Invalid", "not-an-integer", "1001", "invalid"],
    ], { className: "Test.Person", mapping })).to.throw(/CSV data row 2 column 1/);

    expect(readPeople(ecdb)).to.deep.equal([
      { name: "Alice", age: 42, salary: 1234.5, nickname: "Résumé" },
      { name: "用户", age: 31, salary: 2500.25, nickname: "昵称" },
    ]);
  });

  it("streams a CSV file and rolls back malformed input", () => {
    const csvPath = path.join(outDir, "csv-import.csv");
    fs.writeFileSync(csvPath, [
      "Ignored,Age,Name,Salary,Nickname",
      'skip,42,"Doe, Jane",1234.5,"said ""hello""\nnext"',
      String.raw`skip,31,用户,2500.25,\N`,
    ].join("\r\n"));

    using ecdb = ECDbTestHelper.createECDb(outDir, "csv-import-file.ecdb", testSchema);
    const fileMapping = [
      { columnIndex: 1, propertyName: "Age" },
      { columnIndex: 2, propertyName: "Name" },
      { columnIndex: 3, propertyName: "Salary" },
      { columnIndex: 4, propertyName: "Details.Nickname" },
    ];
    expect(ecdb.importCSVFile(csvPath, {
      className: "Test.Person",
      mapping: fileMapping,
      hasHeader: true,
      nullValue: String.raw`\N`,
    })).to.equal(2);

    fs.writeFileSync(csvPath, [
      "skip,20,Valid,1000,valid",
      'skip,21,"unterminated,1001,invalid',
    ].join("\n"));
    expect(() => ecdb.importCSVFile(csvPath, { className: "Test.Person", mapping: fileMapping }))
      .to.throw(/unterminated quoted field/);

    expect(readPeople(ecdb)).to.deep.equal([
      { name: "Doe, Jane", age: 42, salary: 1234.5, nickname: 'said "hello"\nnext' },
      { name: "用户", age: 31, salary: 2500.25, nickname: undefined },
    ]);
  });

  it("rejects invalid column mappings before calling native code", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "csv-import-mapping.ecdb", testSchema);
    expect(() => ecdb.importCSVData([], { className: "Test.Person", mapping: [] })).to.throw(/must not be empty/);
    expect(() => ecdb.importCSVData([], {
      className: "Test.Person",
      mapping: [
        { columnIndex: 0, propertyName: "Name" },
        { columnIndex: 0, propertyName: "Age" },
      ],
    })).to.throw(/duplicate columnIndex/);
  });
});
