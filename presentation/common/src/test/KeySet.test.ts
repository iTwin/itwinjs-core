/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Guid, Id64 } from "@itwin/core-bentley";
import { InstanceKey, Key, KeySet, KeySetJSON, PresentationError } from "../presentation-common.js";
import { createTestECInstanceKey, createTestECInstancesNodeKey } from "./_helpers/index.js";
import { EntityProps } from "@itwin/core-common";

describe("KeySet", () => {
  describe("construction", () => {
    it("creates empty set by default", () => {
      const set = new KeySet();
      expect(set.isEmpty).to.be.true;
    });

    it("initializes from node keys", () => {
      const keys = [
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x111" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x222" })] }),
      ];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      expect(set.has(keys[0])).to.be.true;
      expect(set.has(keys[1])).to.be.true;
    });

    it("initializes from instance keys", () => {
      const keys = [createTestECInstanceKey({ id: "0x123" }), createTestECInstanceKey({ id: "0x456" })];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      expect(set.has(keys[0])).to.be.true;
      expect(set.has(keys[1])).to.be.true;
    });

    it("initializes from entity props", () => {
      const props = [createTestEntityProps({ id: "0x123" }), createTestEntityProps({ id: "0x456" })];
      const set = new KeySet(props);
      expect(set.size).to.eq(2);
      expect(set.has(props[0])).to.be.true;
      expect(set.has(props[1])).to.be.true;
    });

    it("initializes from KeySet", () => {
      const instanceKey11 = createTestECInstanceKey({ id: "0x111" });
      const instanceKey12 = {
        className: instanceKey11.className,
        id: "0x222",
      } as InstanceKey;
      const instanceKey2 = createTestECInstanceKey({ id: "0x333" });
      const nodeKey = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x444" })] });
      const source = new KeySet();
      source.add([instanceKey11, instanceKey12, instanceKey2]);
      source.add(nodeKey);

      const target = new KeySet(source);
      expect(target.size).to.eq(4);
      expect(target.has(instanceKey11)).to.be.true;
      expect(target.has(instanceKey12)).to.be.true;
      expect(target.has(instanceKey2)).to.be.true;
      expect(target.has(nodeKey)).to.be.true;
    });
  });

  describe("[get] guid", () => {
    it("returns a valid GUID", () => {
      const keyset = new KeySet();
      expect(Guid.isGuid(keyset.guid)).to.be.true;
      expect(keyset.guid).to.eq(Guid.empty);
    });
  });

  describe("[get] instanceKeys", () => {
    it("returns empty map when there are no keys", () => {
      const set = new KeySet();
      expect(set.instanceKeys.size).to.eq(0);
    });

    it("returns map with one entry when all keys have same class name", () => {
      const set = new KeySet([
        {
          className: "aaa",
          id: "0x123",
        },
        {
          className: "aaa",
          id: "0x456",
        },
      ]);
      const keys = set.instanceKeys;
      expect(keys).to.matchSnapshot();
    });

    it("returns map with multiple entries for each class name when keys have different class names", () => {
      const set = new KeySet([
        {
          className: "aaa",
          id: "0x123",
        },
        {
          className: "bbb",
          id: "0x123",
        },
      ]);
      const keys = set.instanceKeys;
      expect(keys).to.matchSnapshot();
    });
  });

  describe("[get] instanceKeysCount", () => {
    it("returns 0 when there are no keys", () => {
      const set = new KeySet();
      expect(set.instanceKeysCount).to.eq(0);
    });

    it("returns correct count when all keys are of the same class", () => {
      const set = new KeySet([
        {
          className: "aaa",
          id: "0x123",
        },
        {
          className: "aaa",
          id: "0x456",
        },
      ]);
      expect(set.instanceKeysCount).to.eq(2);
    });

    it("returns correct count when keys are of different classes", () => {
      const set = new KeySet([
        {
          className: "aaa",
          id: "0x123",
        },
        {
          className: "bbb",
          id: "0x123",
        },
      ]);
      expect(set.instanceKeysCount).to.eq(2);
    });
  });

  describe("[get] nodeKeys", () => {
    it("returns empty set when there are no keys", () => {
      const set = new KeySet();
      expect(set.nodeKeys.size).to.eq(0);
    });

    it("returns set with node keys", () => {
      const set = new KeySet([
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x111" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x222" })] }),
      ]);
      const keys = set.nodeKeys;
      expect(keys).to.matchSnapshot();
    });
  });

  describe("[get] nodeKeysCount", () => {
    it("returns 0 when there are no keys", () => {
      const set = new KeySet();
      expect(set.nodeKeysCount).to.eq(0);
    });

    it("returns count of node keys", () => {
      const set = new KeySet([
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x111" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x222" })] }),
      ]);
      expect(set.nodeKeysCount).to.eq(2);
    });
  });

  describe("clear", () => {
    it("clears node keys", () => {
      const keys = [
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x111" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x222" })] }),
      ];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      const guidBefore = set.guid;
      set.clear();
      expect(set.size).to.eq(0);
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("clears instance keys", () => {
      const keys = [createTestECInstanceKey({ id: "0x111" }), createTestECInstanceKey({ id: "0x222" })];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      const guidBefore = set.guid;
      set.clear();
      expect(set.size).to.eq(0);
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("clears entity props", () => {
      const props = [createTestEntityProps({ id: "0x123" }), createTestEntityProps({ id: "0x456" })];
      const set = new KeySet(props);
      expect(set.size).to.eq(2);
      const guidBefore = set.guid;
      set.clear();
      expect(set.size).to.eq(0);
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't change `guid` if set was empty", () => {
      const set = new KeySet();
      const guidBefore = set.guid;
      set.clear();
      expect(set.guid).to.eq(guidBefore);
    });
  });

  describe("add", () => {
    it("adds a node key", () => {
      const set = new KeySet([createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x111" })] })]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      const key = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x222" })] });
      set.add(key);
      expect(set.size).to.eq(2);
      expect(set.nodeKeysCount).to.eq(2);
      expect(set.has(key)).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't add the same node key", () => {
      const key = createTestECInstancesNodeKey();
      const set = new KeySet([key]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.add(key);
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("adds an array of node keys", () => {
      const set = new KeySet([createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x111" })] })]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      const keys = [
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x222" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x333" })] }),
      ];
      set.add(keys);
      expect(set.size).to.eq(3);
      expect(set.nodeKeysCount).to.eq(3);
      expect(set.has(keys[0])).to.be.true;
      expect(set.has(keys[1])).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't add node keys if predicate returns false", () => {
      const set = new KeySet();
      const guidBefore = set.guid;
      const key = createTestECInstancesNodeKey();
      const pred = sinon.fake(() => false);
      set.add([key], pred);
      expect(pred).to.be.calledOnceWith(key);
      expect(set.size).to.eq(0);
      expect(set.guid).to.eq(guidBefore);
    });

    it("doesn't add the same node keys", () => {
      const keys = [
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x111" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x222" })] }),
      ];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      const guidBefore = set.guid;
      set.add(keys);
      expect(set.size).to.eq(2);
      expect(set.guid).to.eq(guidBefore);
    });

    it("adds an instance key", () => {
      const set = new KeySet([createTestECInstanceKey({ id: "0x111" })]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      const key = createTestECInstanceKey({ id: "0x222" });
      set.add(key);
      expect(set.size).to.eq(2);
      expect(set.instanceKeysCount).to.eq(2);
      expect(set.has(key)).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("converts instance key class name into `Schema:Class` format", () => {
      const set = new KeySet([{ className: "Schema.Class", id: "0x1" }]);
      const key = { className: "Schema.Class", id: "0x2" };
      set.add(key);
      expect(set.instanceKeysCount).to.eq(2);
      expect(set.has(key)).to.be.true;
      set.instanceKeys.forEach((_, className) => expect(className).to.eq("Schema:Class"));
    });

    it("doesn't add the same instance key", () => {
      const key = createTestECInstanceKey();
      const set = new KeySet([key]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.add(key);
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("adds an array of instance keys", () => {
      const set = new KeySet([createTestECInstanceKey({ id: "0x111" })]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      const keys = [createTestECInstanceKey({ id: "0x222" }), createTestECInstanceKey({ id: "0x333" })];
      set.add(keys);
      expect(set.size).to.eq(3);
      expect(set.instanceKeysCount).to.eq(3);
      expect(set.has(keys[0])).to.be.true;
      expect(set.has(keys[1])).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't add instance keys if predicate returns false", () => {
      const set = new KeySet();
      const guidBefore = set.guid;
      const key = createTestECInstanceKey();
      const pred = sinon.fake(() => false);
      set.add([key], pred);
      expect(pred).to.be.calledOnceWith(key);
      expect(set.size).to.eq(0);
      expect(set.guid).to.eq(guidBefore);
    });

    it("doesn't add the same instance keys", () => {
      const keys = [createTestECInstanceKey({ id: "0x111" }), createTestECInstanceKey({ id: "0x222" })];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      const guidBefore = set.guid;
      set.add(keys);
      expect(set.size).to.eq(2);
      expect(set.guid).to.eq(guidBefore);
    });

    it("doesn't add the same instance keys when given className is of different capitalization", () => {
      const instanceKey1: InstanceKey = { className: "BisCore", id: Id64.invalid };
      const instanceKey2: InstanceKey = { className: "BISCORE", id: Id64.invalid };
      const set = new KeySet([instanceKey1]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.add(instanceKey2);
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("adds an entity prop", () => {
      const set = new KeySet([createTestEntityProps({ id: "0x123" })]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      const prop = createTestEntityProps({ id: "0x456" });
      set.add(prop);
      expect(set.size).to.eq(2);
      expect(set.instanceKeysCount).to.eq(2);
      expect(set.has(prop)).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't add the same entity prop", () => {
      const prop = createTestEntityProps();
      const set = new KeySet([prop]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.add(prop);
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("adds an array of entity props", () => {
      const set = new KeySet([createTestEntityProps({ id: "0x789" })]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      const props = [createTestEntityProps({ id: "0x123" }), createTestEntityProps({ id: "0x456" })];
      set.add(props);
      expect(set.size).to.eq(3);
      expect(set.instanceKeysCount).to.eq(3);
      expect(set.has(props[0])).to.be.true;
      expect(set.has(props[1])).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't add entity props if predicate returns false", () => {
      const set = new KeySet();
      const guidBefore = set.guid;
      const key = createTestEntityProps();
      const pred = sinon.fake(() => false);
      set.add([key], pred);
      expect(pred).to.be.calledOnceWith(key);
      expect(set.size).to.eq(0);
      expect(set.guid).to.eq(guidBefore);
    });

    it("doesn't add the same entity props", () => {
      const props = [createTestEntityProps({ id: "0x123" }), createTestEntityProps({ id: "0x456" })];
      const set = new KeySet(props);
      expect(set.size).to.eq(2);
      const guidBefore = set.guid;
      set.add(props);
      expect(set.size).to.eq(2);
      expect(set.guid).to.eq(guidBefore);
    });

    it("adds a keyset", () => {
      const instanceKey1 = createTestECInstanceKey({ id: "0x111" });
      const nodeKey1 = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x222" })] });
      const set = new KeySet();
      set.add(instanceKey1).add(nodeKey1);
      expect(set.size).to.eq(2);
      expect(set.has(instanceKey1)).to.be.true;
      expect(set.has(nodeKey1)).to.be.true;
      const guidBefore = set.guid;

      const instanceKey2 = createTestECInstanceKey({ id: "0x222" });
      const instanceKey3 = { className: instanceKey1.className, id: "0x333" };
      const nodeKey2 = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x444" })] });
      const source = new KeySet();
      source.add([instanceKey2, instanceKey3]).add(nodeKey2);

      set.add(source);
      expect(set.size).to.eq(5);
      expect(set.has(instanceKey1)).to.be.true;
      expect(set.has(instanceKey2)).to.be.true;
      expect(set.has(instanceKey3)).to.be.true;
      expect(set.has(nodeKey1)).to.be.true;
      expect(set.has(nodeKey2)).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't add keys from a keyset if predicate returns false", () => {
      const set = new KeySet();
      const guidBefore = set.guid;
      const instanceKey = createTestECInstanceKey();
      const nodeKey = createTestECInstancesNodeKey();
      const keyset = new KeySet().add([instanceKey]).add(nodeKey);
      const pred = sinon.fake(() => false);
      set.add(keyset, pred);
      expect(pred).to.be.calledTwice;
      expect(pred).to.be.calledWith(instanceKey);
      expect(pred).to.be.calledWith(nodeKey);
      expect(set.size).to.eq(0);
      expect(set.guid).to.eq(guidBefore);
    });

    it("doesn't add the same keys from a keyset", () => {
      const instanceKey = createTestECInstanceKey({ id: "0x111" });
      const nodeKey = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x222" })] });
      const set = new KeySet();
      set.add(instanceKey).add(nodeKey);
      expect(set.size).to.eq(2);
      expect(set.has(instanceKey)).to.be.true;
      expect(set.has(nodeKey)).to.be.true;
      const guidBefore = set.guid;

      const source = new KeySet();
      set.add(instanceKey).add(nodeKey);

      set.add(source);
      expect(set.size).to.eq(2);
      expect(set.guid).to.eq(guidBefore);
    });

    it("handles invalid values", () => {
      const set = new KeySet();
      const guidBefore = set.guid;
      expect(() => (set as any).add(undefined)).to.throw(PresentationError);
      expect(set.isEmpty).to.be.true;
      expect(() => (set as any).add(null)).to.throw(PresentationError);
      expect(set.isEmpty).to.be.true;
      expect(() => (set as any).add({})).to.throw(PresentationError);
      expect(set.isEmpty).to.be.true;
      expect(set.guid).to.eq(guidBefore);
    });
  });

  describe("delete", () => {
    it("deletes a node key", () => {
      const keys = [
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x111" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x222" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x333" })] }),
      ];
      const set = new KeySet(keys);
      expect(set.size).to.eq(3);
      const guidBefore = set.guid;
      set.delete(keys[1]);
      expect(set.size).to.eq(2);
      expect(set.nodeKeysCount).to.eq(2);
      expect(set.has(keys[1])).to.be.false;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("deletes an array of node keys", () => {
      const keys = [
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x111" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x222" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x333" })] }),
      ];
      const set = new KeySet(keys);
      expect(set.size).to.eq(3);
      const guidBefore = set.guid;
      set.delete([keys[1], keys[2]]);
      expect(set.size).to.eq(1);
      expect(set.nodeKeysCount).to.eq(1);
      expect(set.has(keys[1])).to.be.false;
      expect(set.has(keys[2])).to.be.false;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("deletes an instance key", () => {
      const keys = [createTestECInstanceKey({ id: "0x111" }), createTestECInstanceKey({ id: "0x222" }), createTestECInstanceKey({ id: "0x333" })];
      const set = new KeySet(keys);
      expect(set.size).to.eq(3);
      const guidBefore = set.guid;
      set.delete(keys[1]);
      expect(set.size).to.eq(2);
      expect(set.instanceKeysCount).to.eq(2);
      expect(set.has(keys[1])).to.be.false;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("deletes an instance key when given className is of different capitalization", () => {
      const instanceKey1: InstanceKey = { className: "BisCore", id: Id64.invalid };
      const instanceKey2: InstanceKey = { className: "BISCORE", id: Id64.invalid };
      const keys = [createTestECInstanceKey({ id: "0x111" }), instanceKey1, createTestECInstanceKey({ id: "0x333" })];
      const set = new KeySet(keys);
      expect(set.size).to.eq(3);
      const guidBefore = set.guid;
      set.delete(instanceKey2);
      expect(set.size).to.eq(2);
      expect(set.instanceKeysCount).to.eq(2);
      expect(set.has(keys[1])).to.be.false;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("deletes an array of instance keys", () => {
      const keys = [createTestECInstanceKey({ id: "0x111" }), createTestECInstanceKey({ id: "0x222" }), createTestECInstanceKey({ id: "0x333" })];
      const set = new KeySet(keys);
      expect(set.size).to.eq(3);
      const guidBefore = set.guid;
      set.delete([keys[1], keys[2]]);
      expect(set.size).to.eq(1);
      expect(set.instanceKeysCount).to.eq(1);
      expect(set.has(keys[1])).to.be.false;
      expect(set.has(keys[2])).to.be.false;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("deletes an entity prop", () => {
      const props = [createTestEntityProps({ id: "0x123" }), createTestEntityProps({ id: "0x456" }), createTestEntityProps({ id: "0x789" })];
      const set = new KeySet(props);
      expect(set.size).to.eq(3);
      const guidBefore = set.guid;
      set.delete(props[1]);
      expect(set.size).to.eq(2);
      expect(set.instanceKeysCount).to.eq(2);
      expect(set.has(props[1])).to.be.false;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("deletes an array of entity props", () => {
      const props = [createTestEntityProps({ id: "0x123" }), createTestEntityProps({ id: "0x456" }), createTestEntityProps({ id: "0x789" })];
      const set = new KeySet(props);
      expect(set.size).to.eq(3);
      const guidBefore = set.guid;
      set.delete([props[1], props[2]]);
      expect(set.size).to.eq(1);
      expect(set.instanceKeysCount).to.eq(1);
      expect(set.has(props[1])).to.be.false;
      expect(set.has(props[2])).to.be.false;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("deletes keys from a keyset", () => {
      const instanceKeys = [createTestECInstanceKey({ id: "0x123" }), createTestECInstanceKey({ id: "0x456" })];
      const nodeKeys = [
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x888" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x999" })] }),
      ];
      const set = new KeySet();
      set.add(instanceKeys).add(nodeKeys);
      expect(set.size).to.eq(4);
      expect(set.has(instanceKeys[0])).to.be.true;
      expect(set.has(instanceKeys[1])).to.be.true;
      expect(set.has(nodeKeys[0])).to.be.true;
      expect(set.has(nodeKeys[1])).to.be.true;
      const guidBefore = set.guid;

      const source = new KeySet();
      source.add(instanceKeys[1]).add(nodeKeys[0]);

      set.delete(source);
      expect(set.size).to.eq(2);
      expect(set.has(instanceKeys[0])).to.be.true;
      expect(set.has(instanceKeys[1])).to.be.false;
      expect(set.has(nodeKeys[0])).to.be.false;
      expect(set.has(nodeKeys[1])).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("does nothing when trying to delete an instance key from empty keyset", () => {
      const set = new KeySet();
      const guidBefore = set.guid;
      set.delete(createTestECInstanceKey());
      expect(set.size).to.eq(0);
      expect(set.guid).to.eq(guidBefore);
    });

    it("does nothing when trying to delete an non-existing instance key", () => {
      const set = new KeySet([createTestECInstanceKey({ id: "0x111" })]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.delete(createTestECInstanceKey({ id: "0x222" }));
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("does nothing when trying to delete a node key from empty keyset", () => {
      const set = new KeySet();
      const guidBefore = set.guid;
      set.delete(createTestECInstancesNodeKey());
      expect(set.size).to.eq(0);
      expect(set.guid).to.eq(guidBefore);
    });

    it("does nothing when trying to delete a non-existing node key", () => {
      const set = new KeySet([createTestECInstancesNodeKey({ pathFromRoot: ["abc"] })]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.delete(createTestECInstancesNodeKey({ pathFromRoot: ["def"] }));
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("does nothing when trying to delete a keyset from empty keyset", () => {
      const set = new KeySet();
      const guidBefore = set.guid;
      set.delete(new KeySet([createTestECInstanceKey()]));
      expect(set.size).to.eq(0);
      expect(set.guid).to.eq(guidBefore);
    });

    it("does nothing when trying to delete a keyset with non-existing keys", () => {
      const set = new KeySet([createTestECInstanceKey({ id: "0x111" })]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.delete(new KeySet([createTestECInstanceKey({ id: "0x222" })]));
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("handles invalid values", () => {
      const set = new KeySet([createTestECInstancesNodeKey()]);
      expect(() => (set as any).delete(undefined)).to.throw(PresentationError);
      expect(set.size).to.eq(1);
      expect(() => (set as any).delete(null)).to.throw(PresentationError);
      expect(set.size).to.eq(1);
      expect(() => (set as any).delete({})).to.throw(PresentationError);
      expect(set.size).to.eq(1);
    });
  });

  describe("has", () => {
    it("handles invalid values", () => {
      const set = new KeySet([createTestECInstancesNodeKey()]);
      expect(() => (set as any).has(undefined)).to.throw(PresentationError);
      expect(() => (set as any).has(null)).to.throw(PresentationError);
      expect(() => (set as any).has({})).to.throw(PresentationError);
    });
  });

  const keyTypes = [
    { name: "KeySet", checkFactory: (keys: Key[]) => new KeySet(keys) },
    { name: "Key[]", checkFactory: (keys: Key[]) => keys },
  ];

  describe("hasAll", () => {
    keyTypes.forEach((keyType) => {
      describe(keyType.name, () => {
        const createKeys = keyType.checkFactory;

        it("returns true when KeySet has all values", () => {
          const instanceKey1 = createTestECInstanceKey({ id: "0x111" });
          const instanceKey2 = createTestECInstanceKey({ id: "0x222" });
          const nodeKey1 = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x123" })] });
          const nodeKey2 = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x456" })] });
          const set = new KeySet([instanceKey1, instanceKey2, nodeKey1, nodeKey2]);
          expect(set.hasAll(createKeys([instanceKey1, nodeKey1]))).to.be.true;
        });

        it("returns true when KeySet has all values with different capitalization", () => {
          const instanceKey1: InstanceKey = { className: "BisCore", id: Id64.invalid };
          const instanceKey2: InstanceKey = { className: "biscore", id: Id64.invalid };
          const instanceKey3: InstanceKey = { className: "BISCORE", id: Id64.invalid };
          const set = new KeySet([instanceKey1]);
          expect(set.hasAll(createKeys([instanceKey2]))).to.be.true;
          expect(set.hasAll(createKeys([instanceKey3]))).to.be.true;
        });

        it("returns false when node keys count is smaller", () => {
          const nodeKey1 = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x123" })] });
          const nodeKey2 = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x456" })] });
          const set = new KeySet([nodeKey1]);
          expect(set.hasAll(createKeys([nodeKey1, nodeKey2]))).to.be.false;
        });

        it("returns false when node keys are different", () => {
          const nodeKey1 = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x123" })] });
          const nodeKey2 = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x456" })] });
          const set = new KeySet([nodeKey1]);
          expect(set.hasAll(createKeys([nodeKey2]))).to.be.false;
        });

        it("returns false when instance keys count is smaller", () => {
          const instanceKey1 = createTestECInstanceKey({ id: "0x111" });
          const instanceKey2 = createTestECInstanceKey({ id: "0x222" });
          const set = new KeySet([instanceKey1]);
          expect(set.hasAll(createKeys([instanceKey1, instanceKey2]))).to.be.false;
        });

        it("returns false when instance key classes are different", () => {
          const instanceKey1 = createTestECInstanceKey();
          const instanceKey2: InstanceKey = {
            className: `${instanceKey1.className}_different`,
            id: instanceKey1.id,
          };
          const set = new KeySet([instanceKey1]);
          expect(set.hasAll(createKeys([instanceKey2]))).to.be.false;
        });

        it("returns false when instance key ids", () => {
          const instanceKey1 = createTestECInstanceKey();
          const instanceKey2: InstanceKey = {
            className: instanceKey1.className,
            id: "0x123",
          };
          const set = new KeySet([instanceKey1]);
          expect(set.hasAll(createKeys([instanceKey2]))).to.be.false;
        });
      });
    });

    it("handles invalid values", () => {
      const set = new KeySet();
      expect(() => (set as any).hasAll(undefined)).to.throw(PresentationError);
      expect(() => (set as any).hasAll(null)).to.throw(PresentationError);
      expect(() => (set as any).hasAll({})).to.throw(PresentationError);
    });
  });

  describe("hasAny", () => {
    keyTypes.forEach((keyType) => {
      describe(keyType.name, () => {
        const createKeys = keyType.checkFactory;

        it("returns true when KeySet has any node key", () => {
          const nodeKey1 = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x123" })] });
          const nodeKey2 = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x456" })] });
          const set = new KeySet([nodeKey1, nodeKey2]);
          expect(set.hasAny(createKeys([nodeKey2]))).to.be.true;
        });

        it("returns true when KeySet has any instance key", () => {
          const instanceKey1 = createTestECInstanceKey();
          const instanceKey2 = createTestECInstanceKey();
          const instanceKey3 = createTestECInstanceKey();
          const set = new KeySet([instanceKey1, instanceKey2]);
          expect(set.hasAny(createKeys([instanceKey2, instanceKey3]))).to.be.true;
        });

        it("returns true when KeySet has any instance key with different capitalization", () => {
          const instanceKey1: InstanceKey = { className: "BisCore", id: Id64.invalid };
          const instanceKey2: InstanceKey = { className: "biscore", id: Id64.invalid };
          const instanceKey3: InstanceKey = { className: "BISCORE", id: Id64.invalid };
          const instanceKey4: InstanceKey = { className: "Testing", id: Id64.invalid };
          const set = new KeySet([instanceKey1, instanceKey4]);
          expect(set.hasAny(createKeys([instanceKey2]))).to.be.true;
          expect(set.hasAny(createKeys([instanceKey3]))).to.be.true;
        });

        it("returns false when KeySet doesn't have any key", () => {
          const set = new KeySet([createTestECInstanceKey({ id: "0x111" }), createTestECInstancesNodeKey({ pathFromRoot: ["abc"] })]);
          expect(set.hasAny(createKeys([createTestECInstanceKey({ id: "0x333" }), createTestECInstancesNodeKey({ pathFromRoot: ["def"] })]))).to.be.false;
        });
      });
    });

    it("handles invalid values", () => {
      const set = new KeySet();
      expect(() => (set as any).hasAny(undefined)).to.throw(PresentationError);
      expect(() => (set as any).hasAny(null)).to.throw(PresentationError);
      expect(() => (set as any).hasAny({})).to.throw(PresentationError);
    });
  });

  describe("some", () => {
    it("returns true if callback returns true for instance key", () => {
      const instanceKey = createTestECInstanceKey();
      const set = new KeySet([instanceKey]);
      const callback = sinon.stub();
      callback.returns(true);
      expect(set.some(callback)).to.be.true;
      expect(callback.callCount).to.eq(1);
      expect(callback).to.be.calledWith(instanceKey);
    });

    it("calls callback with the most recent className if the only difference in classnames is capitalization", () => {
      const instanceKey1: InstanceKey = { className: "BisCore", id: Id64.invalid };
      const instanceKey2: InstanceKey = { className: "BISCORE", id: Id64.invalid };
      const set = new KeySet([instanceKey1, instanceKey2]);
      const callback = sinon.stub();
      callback.returns(true);
      expect(set.some(callback)).to.be.true;
      expect(callback.callCount).to.eq(1);
      expect(callback).to.be.calledWith(instanceKey2);
    });

    it("returns true if callback returns true for node key", () => {
      const nodeKey = createTestECInstancesNodeKey();
      const set = new KeySet([nodeKey]);
      const callback = sinon.stub();
      callback.returns(true);
      expect(set.some(callback)).to.be.true;
      expect(callback.callCount).to.eq(1);
      expect(callback).to.be.calledWith(nodeKey);
    });

    it("returns false if callback returns false", () => {
      const instanceKeys = [createTestECInstanceKey({ id: "0x123" }), createTestECInstanceKey({ id: "0x456" })];
      const nodeKeys = [
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x888" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x999" })] }),
      ];
      const set = new KeySet([...instanceKeys, ...nodeKeys]);
      const callback = sinon.stub();
      callback.returns(false);
      expect(set.some(callback)).to.be.false;
      expect(callback.callCount).to.eq(4);
      expect(callback).to.be.calledWith(instanceKeys[0]);
      expect(callback).to.be.calledWith(instanceKeys[1]);
      expect(callback).to.be.calledWith(nodeKeys[0]);
      expect(callback).to.be.calledWith(nodeKeys[1]);
    });
  });

  describe("forEach", () => {
    it("calls callback for every key in set", () => {
      const instanceKeys = [createTestECInstanceKey({ id: "0x123" }), createTestECInstanceKey({ id: "0x456" })];
      const nodeKeys = [
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x888" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x999" })] }),
      ];
      const set = new KeySet([...instanceKeys, ...nodeKeys]);
      const callback = sinon.spy();
      set.forEach(callback);
      expect(callback.callCount).to.eq(4);
      expect(callback).to.be.calledWith(instanceKeys[0]);
      expect(callback).to.be.calledWith(instanceKeys[1]);
      expect(callback).to.be.calledWith(nodeKeys[0]);
      expect(callback).to.be.calledWith(nodeKeys[1]);
    });

    it("calls callback for every key in set with the most recent className if the only difference in classnames is capitalization", () => {
      const instanceKey1: InstanceKey = { className: "BisCore", id: Id64.invalid };
      const instanceKey2: InstanceKey = { className: "BISCORE", id: Id64.invalid };
      const instanceKeys = [instanceKey1, instanceKey2];
      const set = new KeySet([...instanceKeys]);
      const callback = sinon.spy();
      set.forEach(callback);
      expect(callback.callCount).to.eq(1);
      expect(callback).to.be.calledWith(instanceKeys[1]);
    });
  });

  describe("forEachBatch", () => {
    it("calls callback with itself when batch size smaller than set size", () => {
      const instanceKeys = [createTestECInstanceKey({ id: "0x123" }), createTestECInstanceKey({ id: "0x456" })];
      const nodeKeys = [
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x888" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x999" })] }),
      ];
      const set = new KeySet([...instanceKeys, ...nodeKeys]);
      const callback = sinon.spy();
      set.forEachBatch(5, callback);
      expect(callback.callCount).to.eq(1);
      expect(callback).to.be.calledWith(set);
    });

    it("calls callback in batches", () => {
      const instanceKeys = [createTestECInstanceKey({ id: "0x123" }), createTestECInstanceKey({ id: "0x456" })];
      const nodeKeys = [
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x888" })] }),
        createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x999" })] }),
      ];
      const set = new KeySet([...instanceKeys, ...nodeKeys]);
      const callback = sinon.spy();
      set.forEachBatch(3, callback);
      expect(callback.callCount).to.eq(2);
      expect(callback.firstCall.args[0].size).to.eq(3);
      expect(callback.firstCall.args[1]).to.eq(0);
      expect(callback.secondCall.args[0].size).to.eq(1);
      expect(callback.secondCall.args[1]).to.eq(1);
    });
  });

  describe("serialization", () => {
    it("roundtrip", () => {
      const instanceKey11 = createTestECInstanceKey({ id: "0x123" });
      const instanceKey12 = {
        className: instanceKey11.className,
        id: "0x456",
      } as InstanceKey;
      const instanceKey2 = createTestECInstanceKey({ id: "0x789" });
      const nodeKey = createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey({ id: "0x999" })] });

      const source = new KeySet();
      source.add([instanceKey11, instanceKey12, instanceKey2]).add(nodeKey);

      const serialized = JSON.stringify(source.toJSON());
      const deserialized = JSON.parse(serialized);
      expect(deserialized).to.matchSnapshot();

      const target = KeySet.fromJSON(deserialized);
      expect(target.size).to.eq(4);
      expect(target.has(instanceKey11)).to.be.true;
      expect(target.has(instanceKey12)).to.be.true;
      expect(target.has(instanceKey2)).to.be.true;
      expect(target.has(nodeKey)).to.be.true;
    });

    it("invalid instance key roundtrip", () => {
      const key = createTestECInstanceKey({ id: Id64.invalid });
      const set = new KeySet([key]);
      const json = set.toJSON();
      expect(json.instanceKeys).to.deep.eq([[key.className, Id64.invalid]]);
      const deserialized = KeySet.fromJSON(json);
      expect(deserialized.size).to.eq(1);
      expect(deserialized.has(key)).to.be.true;
    });

    it("deserializes JSON with instance key ids", () => {
      const ids = ["0x5", "0x9"];
      const json: KeySetJSON = {
        instanceKeys: [["class name", ids as any]],
        nodeKeys: [],
      };
      const deserialized = KeySet.fromJSON(json);
      expect(deserialized.size).to.eq(2);
      expect(deserialized.has({ className: "class name", id: ids[0] })).to.be.true;
      expect(deserialized.has({ className: "class name", id: ids[1] })).to.be.true;
    });

    it("doesn't serialize instance classes without ids", () => {
      const key = createTestECInstanceKey();
      const set = new KeySet([key]);
      set.delete(key);
      const json = set.toJSON();
      expect(json.instanceKeys.length).to.eq(0);
    });
  });
});

const createTestEntityProps = (props?: Partial<EntityProps>): EntityProps => ({
  classFullName: "TestSchema:TestClass",
  id: "0x123",
  ...props,
});
