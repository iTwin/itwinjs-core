/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SchemaKeyProps } from "../Deserialization/JsonProps";
import { SchemaMatchType } from "../ECObjects";
import { ECObjectsError } from "../Exception";
import { ECVersion, SchemaKey } from "../SchemaKey";

describe("SchemaKey", () => {
  let testKey: SchemaKey;
  beforeEach(() => {
    testKey = new SchemaKey("testKey", new ECVersion(1, 0, 12));
  });

  describe("toString", () => {
    it("should call toString successfully", () => {
      expect(testKey.toString()).to.eql("testKey.01.00.12");
    });
  });

  describe("parseString", () => {
    const testName = "SchemaName.01.05.52";
    it("should correctly parse a valid schema full name", () => {
      testKey = SchemaKey.parseString(testName);
      expect(testKey.name).to.eql("SchemaName");
      expect(testKey.readVersion).to.eql(1);
      expect(testKey.writeVersion).to.eql(5);
      expect(testKey.minorVersion).to.eql(52);
    });

    it("should throw for invalid string", () => {
      expect(() => SchemaKey.parseString("invalid")).to.throw(ECObjectsError);
    });
    it("should throw for out of bounds ECVersions", () => {
      expect(() => SchemaKey.parseString("SchemaName.01.05.56700000")).to.throw(ECObjectsError);
      expect(() => SchemaKey.parseString("SchemaName.9999.05.05")).to.throw(ECObjectsError);
      expect(() => SchemaKey.parseString("SchemaName.01.9999.05")).to.throw(ECObjectsError);
    });
  });

  describe("compareByName", () => {

    it("should compare against a string", () => {
      const key = new SchemaKey("SchemaName", 1, 2, 3);
      expect(key.compareByName("SchemaName")).to.be.true;
      expect(key.compareByName("WrongSchemaName")).to.be.false;
    });

    it("should compare case-insensitive successfully", () => {
      expect(testKey.compareByName("TESTKEY")).to.eql(true);
      expect(testKey.compareByName("tEsTkEY")).to.eql(true);
    });

    it("should compare against another SchemaKey", () => {
      const key = new SchemaKey("SchemaName", 1, 2, 3);
      const matchingKey = new SchemaKey("SchemaName", 1, 2, 3);
      const incompatibleKey = new SchemaKey("WrongSchemaName", 1, 2, 3);
      expect(key.compareByName(matchingKey)).to.be.true;
      expect(key.compareByName(incompatibleKey)).to.be.false;
    });
  });

  describe("compareByVersion", () => {
    let testKey2: SchemaKey;
    it("should return true on given the same ECVersion as testKey.", () => {
      testKey2 = new SchemaKey("testKey2", new ECVersion(1, 0, 12));
      expect(testKey.compareByVersion(testKey2)).to.eql(0);
    });

    it("should return true on given a different ECVersion as testKey.", () => {
      testKey2 = new SchemaKey("testKey2", new ECVersion(1, 6, 12));
      expect(testKey.compareByVersion(testKey2)).to.not.eql(0);
    });
  });

  describe("matches", () => {
    let testKey2: SchemaKey;
    it("should return true when not matchType is not supplied aka is Identical", () => {
      testKey2 = new SchemaKey("testKey", new ECVersion(1, 0, 12));
      expect(testKey.matches(testKey2)).to.eql(true);
    });

    it("should return false when matchType is not supplied aka is Identical and different ECVersion.", () => {
      testKey2 = new SchemaKey("testKey", new ECVersion(1, 0, 2));
      expect(testKey.matches(testKey2)).to.eql(false);
    });

    describe("matches", () => {
      it("should correctly handle SchemaMatchType.Identical", () => {
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0))).true;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 0))).false;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 2, 0, 0))).false;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 1))).false;

        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.Identical)).true;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 0), SchemaMatchType.Identical)).false;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 2, 0, 0), SchemaMatchType.Identical)).false;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 1), SchemaMatchType.Identical)).false;
      });

      it("should correctly handle SchemaMatchType.Exact", () => {
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.Exact)).true;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 0), SchemaMatchType.Exact)).false;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 2, 0, 0), SchemaMatchType.Exact)).false;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 1), SchemaMatchType.Exact)).false;
      });

      it("should correctly handle SchemaMatchType.Latest", () => {
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.Latest)).true;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 0), SchemaMatchType.Latest)).false;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 2, 0, 0), SchemaMatchType.Latest)).true;
        expect(new SchemaKey("SchemaTest", 1, 0, 1).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.Latest)).true;
      });

      it("should correctly handle SchemaMatchType.LatestReadCompatible", () => {
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.LatestReadCompatible)).true;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 0), SchemaMatchType.LatestReadCompatible)).false;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 2, 0, 0), SchemaMatchType.LatestReadCompatible)).false;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 1, 0), SchemaMatchType.LatestReadCompatible)).false;
        expect(new SchemaKey("SchemaTest", 1, 0, 1).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.LatestReadCompatible)).true;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 1, 1), SchemaMatchType.LatestReadCompatible)).false;
      });

      it("should correctly handle SchemaMatchType.LatestWriteCompatible", () => {
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.LatestWriteCompatible)).true;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaNotTest", 1, 0, 0), SchemaMatchType.LatestWriteCompatible)).false;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 2, 0, 0), SchemaMatchType.LatestWriteCompatible)).false;
        expect(new SchemaKey("SchemaTest", 1, 0, 1).matches(new SchemaKey("SchemaTest", 1, 0, 0), SchemaMatchType.LatestWriteCompatible)).true;
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 1), SchemaMatchType.LatestWriteCompatible)).false;
      });

      it("should correctly handle invalid SchemaMatchType", () => {
        expect(new SchemaKey("SchemaTest", 1, 0, 0).matches(new SchemaKey("SchemaTest", 1, 0, 0), -1)).false;
      });
    });

  });

  describe("fromJSON", () => {
    let testKey2: SchemaKey;

    it("should return a SchemaKey given a SchemaKeyProp using fromJson", async () => {
      testKey2 = SchemaKey.fromJSON({name: "testKey2", read: 1, write: 0, minor: 12});
      expect(testKey2).to.not.eql(undefined);
      expect(testKey2.name).to.eql("testKey2");
      expect(testKey2.readVersion).to.eql(1);
      expect(testKey2.writeVersion).to.eql(0);
      expect(testKey2.minorVersion).to.eql(12);

    });
  });

  describe("toJson", () => {
    let schemaKeyProps: SchemaKeyProps;
    it("should return a schemaKeyProps given testKey", () => {
      schemaKeyProps = testKey.toJSON();
      expect(schemaKeyProps.name).to.eql("testKey");
      expect(schemaKeyProps.read).to.eql(1);
      expect(schemaKeyProps.write).to.eql(0);
      expect(schemaKeyProps.minor).to.eql(12);
    });

    it("should return a schemaKeyProps given a different test key", () => {
      const testKey2 = new SchemaKey("testKey2", new ECVersion(4,16,25));
      schemaKeyProps = testKey2.toJSON();
      expect(schemaKeyProps.name).to.eql("testKey2");
      expect(schemaKeyProps.read).to.eql(4);
      expect(schemaKeyProps.write).to.eql(16);
      expect(schemaKeyProps.minor).to.eql(25);
    });
  });
});
