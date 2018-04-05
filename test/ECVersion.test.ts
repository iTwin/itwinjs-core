/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { ECVersion } from "../source/ECObjects";
import { ECObjectsError } from "../source/Exception";

describe("ECVersion", () => {
  describe("fromString", () => {
    it("should succeed with properly formed version string", () => {
      const testVersion = ECVersion.fromString("1.2.3");
      expect(testVersion.read).equals(1);
      expect(testVersion.write).equals(2);
      expect(testVersion.minor).equals(3);
    });

    it("should fail with a non-number as the read version in the string", () => {
      const testVersion = ECVersion.fromString("NotNumber.2.44");
      expect(testVersion).does.not.haveOwnProperty("read");
      expect(testVersion.write).equals(2);
      expect(testVersion.minor).equals(44);
    });

    it("should fail with a non-number as the write version in the string", () => {
      const testVersion = ECVersion.fromString("10.NotNumber.44");
      expect(testVersion).does.not.haveOwnProperty("write");
      expect(testVersion.read).equals(10);
      expect(testVersion.minor).equals(44);
    });

    it("should fail with a non-number as the minor version in the string", () => {
      const testVersion = ECVersion.fromString("10.2.NotNumber");
      expect(testVersion).does.not.haveOwnProperty("minor");
      expect(testVersion.read).equals(10);
      expect(testVersion.write).equals(2);
    });

    it("should throw for an incomplete version string", () => {
      expect(() => ECVersion.fromString("")).to.throw(ECObjectsError, "The read version is missing from version string, ") ;
      expect(() => ECVersion.fromString("10")).to.throw(ECObjectsError, "The write version is missing from version string, 10") ;
      expect(() => ECVersion.fromString("10.0")).to.throw(ECObjectsError, "The minor version is missing from version string, 10.0") ;
    });
  });

  describe("toString", () => {
    it("fully defined version string", () => {
      const testVersion = new ECVersion(1, 0, 14);
      assert.equal("1.0.14", testVersion.toString());
    });
    it("fully defined version string with leading zero", () => {
      const testVersion = new ECVersion(1, 0, 14);
      assert.equal("01.00.14", testVersion.toString(true));
    });
  });

  describe("compareByVersion", () => {
    it("right-hand read version is less, returns positive", async () => {
      const leftVersion = new ECVersion(2, 2, 3);
      const rightVersion = new ECVersion(1, 2, 3);
      const result = leftVersion.compare(rightVersion);
      assert.isTrue(result > 0);
    });

    it("right-hand write version is less, returns positive", async () => {
      const leftVersion = new ECVersion(1, 2, 3);
      const rightVersion = new ECVersion(1, 1, 3);
      const result = leftVersion.compare(rightVersion);
      assert.isTrue(result > 0);
    });

    it("right-hand minor version is less, returns positive", async () => {
      const leftVersion = new ECVersion(1, 2, 3);
      const rightVersion = new ECVersion(1, 2, 2);
      const result = leftVersion.compare(rightVersion);
      assert.isTrue(result > 0);
    });

    it("right-hand read version is greater, returns negative", async () => {
      const leftVersion = new ECVersion(1, 2, 3);
      const rightVersion = new ECVersion(2, 2, 3);
      const result = leftVersion.compare(rightVersion);
      assert.isTrue(result < 0);
    });

    it("right-hand write version is greater, returns negative", async () => {
      const leftVersion = new ECVersion(1, 1, 3);
      const rightVersion = new ECVersion(1, 2, 3);
      const result = leftVersion.compare(rightVersion);
      assert.isTrue(result < 0);
    });

    it("right-hand minor version is greater, returns negative", async () => {
      const leftVersion = new ECVersion(1, 2, 2);
      const rightVersion = new ECVersion(1, 2, 3);
      const result = leftVersion.compare(rightVersion);
      assert.isTrue(result < 0);
    });

    it("exact match, returns zero", async () => {
      const leftVersion = new ECVersion(1, 2, 3);
      const rightVersion = new ECVersion(1, 2, 3);
      const result = leftVersion.compare(rightVersion);
      assert.equal(result, 0);
    });
  });
});
