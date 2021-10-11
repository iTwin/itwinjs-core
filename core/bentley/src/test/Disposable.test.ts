/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DisposableList, IDisposable, using } from "../core-bentley";
import { isIDisposable } from "../Disposable";

class CallbackDisposable implements IDisposable {
  private _callback: () => void;
  constructor(callback: () => void) {
    this._callback = callback;
  }
  public dispose() {
    this._callback();
  }
}

describe("Disposable", () => {

  describe("isIDisposable", () => {

    it("returns true when given an object with `dispose` function", () => {
      assert.isTrue(isIDisposable({ dispose: () => { } }));
    });

    it("returns false when given an object without `dispose` function", () => {
      assert.isFalse(isIDisposable({}));
    });

    it("returns false when given an object with `dispose` attribute which is not a function", () => {
      assert.isFalse(isIDisposable({ dispose: true }));
    });

    it("returns false when given a non-object argument", () => {
      assert.isFalse(isIDisposable(null));
      assert.isFalse(isIDisposable(undefined));
      assert.isFalse(isIDisposable(123));
      assert.isFalse(isIDisposable("123"));
      assert.isFalse(isIDisposable([]));
    });

  });

  describe("using IDisposable", () => {

    it("Calls dispose on success and returns result", () => {
      let disposed = false;
      const disposable = new CallbackDisposable(() => {
        disposed = true;
      });
      const result = using(disposable, (resource) => {
        assert.equal(resource, disposable);
        return 123;
      });
      assert.equal(result, 123);
      assert.isTrue(disposed);
    });

    it("Calls dispose on throw and rethrows", () => {
      let disposed = false;
      const disposable = new CallbackDisposable(() => {
        disposed = true;
      });
      assert.throws(() => {
        using(disposable, (resource) => {
          assert.equal(resource, disposable);
          throw new Error("doesn't matter");
        });
      });
      assert.isTrue(disposed);
    });

    it("Calls dispose after async callback function resolves", async () => {
      let disposed = false;
      const disposable = new CallbackDisposable(() => {
        disposed = true;
      });
      await using(disposable, async (_r) => {
        return new Promise<void>((resolve: () => void, _reject: () => void) => {
          setTimeout(() => {
            resolve();
            assert.isFalse(disposed);
          }, 0);
        });
      });
      assert.isTrue(disposed);
    });

    it("Calls dispose after async callback function rejects and rethrows", async () => {
      let disposed = false;
      const disposable = new CallbackDisposable(() => {
        disposed = true;
      });
      const result = using(disposable, async (_r) => {
        return new Promise<void>((_resolve: () => void, reject: () => void) => {
          setTimeout(() => {
            reject();
            assert.isFalse(disposed);
          }, 0);
        });
      });
      await result.then(() => {
        assert.fail(undefined, undefined, "Expected result to be rejected");
      }, () => { });
      assert.isTrue(disposed);
    });

    it("Calls dispose on all disposables", () => {
      let disposed1 = false;
      const disposable1 = new CallbackDisposable(() => {
        disposed1 = true;
      });
      let disposed2 = false;
      const disposable2 = new CallbackDisposable(() => {
        disposed2 = true;
      });
      const result = using([disposable1, disposable2], (resource1, resource2) => {
        assert.equal(resource1, disposable1);
        assert.equal(resource2, disposable2);
        return 123;
      });
      assert.equal(result, 123);
      assert.isTrue(disposed1);
      assert.isTrue(disposed2);
    });

  });

  describe("DisposableList", () => {

    it("Calls dispose on registered IDisposable", () => {
      let disposed = false;
      const disposableList = new DisposableList();
      disposableList.add(new CallbackDisposable(() => {
        disposed = true;
      }));
      disposableList.dispose();
      assert.isTrue(disposed);
    });

    it("Doesn't call dispose on unregistered IDisposable", () => {
      let disposed = false;
      const disposable = new CallbackDisposable(() => {
        disposed = true;
      });
      const disposableList = new DisposableList();
      disposableList.add(disposable);
      disposableList.remove(disposable);
      disposableList.dispose();
      assert.isFalse(disposed);
    });

    it("Calls dispose on registered disposal function", () => {
      let disposed = false;
      const disposableList = new DisposableList();
      disposableList.add(() => {
        disposed = true;
      });
      disposableList.dispose();
      assert.isTrue(disposed);
    });

  });

});
