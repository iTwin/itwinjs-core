/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { ObservableMap } from "../core-bentley";

class Listener {
  private _changedCount = 0;

  public constructor(map: ObservableMap<string, any>) {
    map.onChanged.addListener(() => { this._changedCount++; });
  }

  private clear() { this._changedCount = 0; }

  public expectNone(func: () => void) { this.clear(); func(); expect(this._changedCount).to.equal(0); }
  public expectCount(count: number, func: () => void) { this.clear(); func(); expect(this._changedCount).to.equal(count); }
}

describe("ObservableMap", () => {
  it("should raise events only when contents change", () => {
    const map = new ObservableMap<string, string>();
    const listener = new Listener(map);

    listener.expectNone(() => {
      map.clear();
      map.delete("abc");
    });

    listener.expectCount(1, () => map.set("abc", "1"));
    listener.expectCount(1, () => map.set("def", "2"));
    listener.expectCount(1, () => map.set("abc", "3")); // updating an existing key
    listener.expectCount(1, () => map.set("abc", "3")); // no suppression for setting same value
    listener.expectCount(1, () => map.delete("def"));
    listener.expectCount(1, () => map.clear());
  });

  it("should construct from iterable", () => {
    // Map constructor invokes set(), which ObservableMap overrides to raise an event.
    // The event is undefined until Map constructor finishes, producing an exception.
    // Solution: suppress events during construction - no listeners can be registered yet anyway.
    const elems: Array<readonly [string, string]> = [["a", "1"], ["b", "2"], ["c", "3"]];
    const observable = new ObservableMap<string, string>(elems);
    const map = new Map<string, string>(elems);
    expect(Array.from(observable.entries())).to.deep.equal(Array.from(map.entries()));
  });

  it("setAll should raise onChanged only once", () => {
    const map = new ObservableMap<string, string>();
    const listener = new Listener(map);

    listener.expectCount(1, () => {
      map.setAll([["a", "1"], ["b", "2"], ["c", "3"]]);
      expect(map.size).to.equal(3);
    });
    expect(map.size).to.equal(3);
  });

  it("setAll should not raise any event for empty iterable", () => {
    const map = new ObservableMap<string, string>();
    const listener = new Listener(map);

    listener.expectNone(() => {
      map.setAll([]);
      expect(map.size).to.equal(0);
    });
  });

  it("setAll should raise event when updating existing keys' values", () => {
    const map = new ObservableMap<string, string>([["a", "1"], ["b", "2"]]);
    const listener = new Listener(map);

    listener.expectCount(1, () => {
      map.setAll([["a", "1"], ["b", "2"]]);
      expect(map.size).to.equal(2);
    });
    expect(map.size).to.equal(2);
  });

  it("deleteAll should raise onChanged only once", () => {
    const map = new ObservableMap<string, string>([["a", "1"], ["b", "2"], ["c", "3"]]);
    const listener = new Listener(map);

    listener.expectCount(1, () => {
      const count = map.deleteAll(["a", "b", "c"]);
      expect(count).to.equal(3);
    });
    expect(map.size).to.equal(0);
  });

  it("deleteAll should not raise any event for empty iterable", () => {
    const map = new ObservableMap<string, string>([["a", "1"]]);
    const listener = new Listener(map);

    listener.expectNone(() => {
      const count = map.deleteAll([]);
      expect(count).to.equal(0);
    });
    expect(map.size).to.equal(1);
  });

  it("deleteAll should not raise event when no keys exist in map", () => {
    const map = new ObservableMap<string, string>([["a", "1"]]);
    const listener = new Listener(map);

    listener.expectNone(() => {
      const count = map.deleteAll(["x", "y"]);
      expect(count).to.equal(0);
    });
    expect(map.size).to.equal(1);
  });

  it("deleteAll should count only actually deleted items", () => {
    const map = new ObservableMap<string, string>([["a", "1"], ["b", "2"]]);
    const listener = new Listener(map);

    listener.expectCount(1, () => {
      const count = map.deleteAll(["a", "x"]);
      expect(count).to.equal(1);
    });
    expect(map.size).to.equal(1);
    expect(map.has("b")).to.be.true;
  });

  it("clear should only raise an event if the map is not empty", () => {
    const map = new ObservableMap<string, string>();
    const listener = new Listener(map);

    listener.expectCount(0, () => map.clear());
    listener.expectCount(1, () => map.set("a", "1"));
    listener.expectCount(1, () => map.clear());
    listener.expectCount(0, () => map.clear());
  });
});
