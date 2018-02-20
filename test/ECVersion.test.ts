/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { ECVersion } from "../source/ECObjects";
import { ECObjectsError } from "../source/Exception";

describe("ECVersion", () => {
  describe("fromString", () => {
    it("should succeed with properly formed version string", () => {
      const testVersion = new ECVersion();
      testVersion.fromString("1.2.3");
      expect(testVersion.read).equals(1);
      expect(testVersion.write).equals(2);
      expect(testVersion.minor).equals(3);
    });

    it("should fail with a non-number as the read version in the string", () => {
      const testVersion = new ECVersion();
      testVersion.fromString("NotNumber.2.44");
      expect(testVersion).does.not.haveOwnProperty("read");
      expect(testVersion.write).equals(2);
      expect(testVersion.minor).equals(44);
    });

    it("should fail with a non-number as the write version in the string", () => {
      const testVersion = new ECVersion();
      testVersion.fromString("10.NotNumber.44");
      expect(testVersion).does.not.haveOwnProperty("write");
      expect(testVersion.read).equals(10);
      expect(testVersion.minor).equals(44);
    });

    it("should fail with a non-number as the minor version in the string", () => {
      const testVersion = new ECVersion();
      testVersion.fromString("10.2.NotNumber");
      expect(testVersion).does.not.haveOwnProperty("minor");
      expect(testVersion.read).equals(10);
      expect(testVersion.write).equals(2);
    });

    it("should throw for an incomplete version string", () => {
      const testVersion = new ECVersion();
      expect(() => testVersion.fromString("")).to.throw(ECObjectsError, "The read version is missing from version string, ") ;
      expect(() => testVersion.fromString("10")).to.throw(ECObjectsError, "The write version is missing from version string, 10") ;
      expect(() => testVersion.fromString("10.0")).to.throw(ECObjectsError, "The minor version is missing from version string, 10.0") ;
    });
  });

  describe("toString", () => {
    it("fully defined version string", () => {
      const testVersion = new ECVersion(1, 0, 14);
      assert.equal("1.0.14", testVersion.toString());
    });
  });
});
