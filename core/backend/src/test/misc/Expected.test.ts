/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Expected } from "../../Expected";
import { BentleyError, BentleyStatus, IModelStatus } from "@itwin/core-bentley/lib/cjs/BentleyError";
import { IModelError } from "@itwin/core-common/lib/cjs/IModelError";

describe("Expected", () => {
  it("can represent a successful value", () => {
    const expected: Expected<number> = Expected.fromValue(42);
    assert.isFalse(expected.isError());
    if (expected.isValue()) {
      assert.strictEqual(expected.value, 42);
    } else {
      assert.fail("Expected is not a value");
    }
    assert.strictEqual(expected.valueOrDefault(100), 42);
    assert.strictEqual(expected.valueOrThrow(), 42);
  });

  it("can represent an error", () => {
    const error = new IModelError(IModelStatus.Mismatch2d3d, "Test error");
    const expected: Expected<number> = Expected.fromError(error);
    assert.isFalse(expected.isValue());
    if (expected.isError()) {
      assert.strictEqual(expected.error, error);
    } else {
      assert.fail("Expected is not an error");
    }
    assert.strictEqual(expected.valueOrDefault(100), 100);
    assert.throws(() => expected.valueOrThrow(), IModelError, "Test error");
  });

  describe("fromTry", () => {
    it("returns a value if the function succeeds", () => {
      const expected = Expected.fromTry(() => 42);
      if (expected.isValue()) {
        assert.strictEqual(expected.value, 42);
      } else {
        assert.fail("Expected is not a value");
      }
    });

    it("returns an unwrapped error if the function throws an IModelError", () => {
      const expected = Expected.fromTry(() => {
        throw new IModelError(IModelStatus.Mismatch2d3d, "Test error");
      });
      if (expected.isError()) {
        assert.strictEqual(expected.error.errorNumber, IModelStatus.Mismatch2d3d);
        assert.isUndefined(expected.error.cause);
      } else {
        assert.fail("Expected is not an error");
      }
    });

    it("wraps a non-IModelError exception in an IModelError", () => {
      const cause = new Error("Test error");
      const expected = Expected.fromTry(() => {
        throw cause;
      });

      if (expected.isError()) {
        assert.strictEqual(expected.error.errorNumber, IModelStatus.BadRequest);
        assert.strictEqual(expected.error.message, "Test error");
        assert.strictEqual(expected.error.cause, cause);
      } else {
        assert.fail("Expected is not an error");
      }
    });

    it("wraps a non-IModelError with errorNumber property in an IModelError with the same errorNumber", () => {
      const cause = new BentleyError(IModelStatus.CodeNotReserved, "Test error");
      const expected = Expected.fromTry(() => {
        throw cause;
      });

      if (expected.isError()) {
        assert.strictEqual(expected.error.errorNumber, IModelStatus.CodeNotReserved);
        assert.strictEqual(expected.error.message, "Test error");
        assert.strictEqual(expected.error.cause, cause);
      } else {
        assert.fail("Expected is not an error");
      }
    });

    describe("tolerates wacky thrown objects", () => {
      it("Object that is not derived from Error", () => {
        const cause = { foo: "bar" };
        const expected = Expected.fromTry(() => {
          throw cause;
        });

        if (expected.isError()) {
          assert.strictEqual(expected.error.errorNumber, IModelStatus.BadRequest);
          assert.strictEqual(expected.error.message, "Unknown error");
          assert.strictEqual(expected.error.cause, cause);
        } else {
          assert.fail("Expected is not an error");
        }
      });

      it("null", () => {
        const expected = Expected.fromTry(() => {
          throw null;
        });

        if (expected.isError()) {
          assert.strictEqual(expected.error.errorNumber, IModelStatus.BadRequest);
          assert.strictEqual(expected.error.message, "Unknown error");
          assert.strictEqual(expected.error.cause, null);
        } else {
          assert.fail("Expected is not an error");
        }
      });

      it("undefined", () => {
        const expected = Expected.fromTry(() => {
          throw undefined;
        });

        if (expected.isError()) {
          assert.strictEqual(expected.error.errorNumber, IModelStatus.BadRequest);
          assert.strictEqual(expected.error.message, "Unknown error");
          assert.strictEqual(expected.error.cause, undefined);
        } else {
          assert.fail("Expected is not an error");
        }
      });

      it("number", () => {
        const expected = Expected.fromTry(() => {
          throw 42;
        });

        if (expected.isError()) {
          assert.strictEqual(expected.error.errorNumber, IModelStatus.BadRequest);
          assert.strictEqual(expected.error.message, "Unknown error");
          assert.strictEqual(expected.error.cause, 42);
        } else {
          assert.fail("Expected is not an error");
        }
      });
    });
  });

  describe("map", () => {
    it("maps a value", () => {
      const expected = Expected.fromValue(42).map(x => x + 1);
      assert.strictEqual(expected.valueOrDefault(0), 43);
    });

    it("does not call the mapping function if this is an error", () => {
      let called = false;
      const errorExpected = Expected.fromError<number>(new IModelError(IModelStatus.UpgradeFailed, "Test error"));
      const mappedExpected = errorExpected.map((x) => {
        called = true;
        return x + 1;
      });
      assert.isFalse(called, "Mapping function was called");
      if (mappedExpected.isError()) {
        assert.strictEqual(mappedExpected.error.errorNumber, IModelStatus.UpgradeFailed);
      } else {
        assert.fail("Expected is not an error");
      }
    });

    it("captures exceptions thrown by the mapping function", () => {
      const expected = Expected.fromValue(42).map(() => {
        throw new IModelError(IModelStatus.NotRegistered, "Test error");
      });
      if (expected.isError()) {
        assert.strictEqual(expected.error.errorNumber, IModelStatus.NotRegistered);
        assert.strictEqual(expected.error.message, "Test error");
      } else {
        assert.fail("Expected is not an error");
      }
    });
  });

  describe("andThen", () => {
    it("maps a value to another Expected", () => {
      const expected = Expected.fromValue(42).andThen(x => Expected.fromValue(x + 1));
      assert.strictEqual(expected.valueOrDefault(0), 43);
    });

    it("does not call the mapping function if this is an error", () => {
      let called = false;
      const errorExpected = Expected.fromError<number>(new IModelError(IModelStatus.UpgradeFailed, "Test error"));
      const mappedExpected = errorExpected.andThen((x) => {
        called = true;
        return Expected.fromValue(x + 1);
      });
      assert.isFalse(called, "Mapping function was called");
      if (mappedExpected.isError()) {
        assert.strictEqual(mappedExpected.error.errorNumber, IModelStatus.UpgradeFailed);
      } else {
        assert.fail("Expected is not an error");
      }
    });

    it("captures exceptions thrown by the mapping function", () => {
      const expected = Expected.fromValue(42).andThen(() => {
        throw new IModelError(IModelStatus.NotRegistered, "Test error");
      });
      if (expected.isError()) {
        assert.strictEqual(expected.error.errorNumber, IModelStatus.NotRegistered);
        assert.strictEqual(expected.error.message, "Test error");
      } else {
        assert.fail("Expected is not an error");
      }
    });

    it("captures errors returned by the mapping function", () => {
      const expected = Expected.fromValue(42).andThen(() => Expected.fromError(new IModelError(IModelStatus.NotRegistered, "Test error")));
      if (expected.isError()) {
        assert.strictEqual(expected.error.errorNumber, IModelStatus.NotRegistered);
        assert.strictEqual(expected.error.message, "Test error");
      } else {
        assert.fail("Expected is not an error");
      }
    });
  });
});

