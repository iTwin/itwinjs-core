/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
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
});
