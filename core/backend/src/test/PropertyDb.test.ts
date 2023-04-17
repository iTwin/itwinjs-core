/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { existsSync } from "fs";
import { Suite } from "mocha";
import { join } from "path";
import { OpenMode } from "@itwin/core-bentley";
import { IModelHost } from "../IModelHost";
import { PropertyStore } from "../PropertyStore";

describe("PropertyDb", function (this: Suite) {
  this.timeout(0);

  const outputDir = join(__dirname, "output");

  before(async () => IModelHost.startup());

  it("save and load properties", async () => {
    const dbName = join(outputDir, "properties.db");
    PropertyStore.PropertyDb.createNewDb(dbName);
    expect(existsSync(dbName)).true;
    const propertyDb = new PropertyStore.PropertyDb();
    propertyDb.openDb(dbName, OpenMode.ReadWrite);

    const countProperties = (filter?: PropertyStore.PropertyFilter) => {
      let count = 0;
      propertyDb.forAllProperties(() => {
        ++count;
      }, filter);
      return count;
    };
    const testJson = {
      a: "test string",
      num: 20,
      b: true,
    };

    const string1 = "this is a test";
    const string2 = "this is another test";
    const blob1 = new Uint8Array([2, 33, 23, 0, 202]);
    propertyDb.saveProperty("test-string", string1);
    propertyDb.saveProperty("test-string2", string2);
    propertyDb.saveProperty("test-obj", testJson);
    propertyDb.saveProperty("is-false", false);
    propertyDb.saveProperty("is-true", true);
    propertyDb.saveProperty("is-100", 100);
    propertyDb.saveProperty("is-2.3", 2.3);
    propertyDb.saveProperty("is-blob", blob1);
    propertyDb.saveChanges();
    expect(countProperties()).equal(8);

    expect(propertyDb.getString("test-string")).equals(string1);
    expect(propertyDb.getString("test-string2")).equals(string2);
    expect(propertyDb.getObject("test-obj")).deep.equal(testJson);
    expect(propertyDb.getBoolean("is-false")).false;
    expect(propertyDb.getBoolean("is-true")).true;
    expect(propertyDb.getNumber("is-100")).equal(100);
    expect(propertyDb.getNumber("is-2.3")).equal(2.3);
    expect(propertyDb.getBlob("is-blob")).deep.equal(blob1);

    const updated = "this is a different string";
    propertyDb.saveProperty("test-string", updated);
    expect(propertyDb.getString("test-string")).equals(updated);

    expect(propertyDb.getNumber("test-string")).undefined;
    expect(propertyDb.getString("not there")).undefined;
    expect(propertyDb.getBlob("not there")).undefined;
    expect(propertyDb.getNumber("not there")).undefined;
    expect(propertyDb.getBlob("not there")).undefined;
    expect(propertyDb.getNumber("not there", 50)).equal(50);

    expect(countProperties({ value: "test%", valueCompare: "LIKE" })).equal(3);
    propertyDb.deleteProperty("test-string");
    expect(countProperties()).equal(7);
    expect(countProperties({ value: "test%", valueCompare: "LIKE" })).equal(2);

    propertyDb.closeDb(true);
  });
});
