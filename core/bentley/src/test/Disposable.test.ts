/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { using, IDisposable, DisposableList } from "../bentleyjs-core";

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
      await using(disposable, () => {
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
      const result = using(disposable, () => {
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
      const result = using([disposable1, disposable2], (resource1: CallbackDisposable, resource2: CallbackDisposable) => {
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
