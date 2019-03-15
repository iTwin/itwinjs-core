/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  createRandomECInstanceNodeKey,
  createRandomECInstanceKey, createRandomECInstanceId,
  createRandomEntityProps,
  createRandomId,
} from "./_helpers/random";
import { Guid } from "@bentley/bentleyjs-core";
import KeySet, { KeySetJSON, Key } from "../KeySet";
import { InstanceKey } from "../EC";
import { PresentationError } from "../Error";

describe("KeySet", () => {

  describe("construction", () => {

    it("creates empty set by default", () => {
      const set = new KeySet();
      expect(set.isEmpty).to.be.true;
    });

    it("initializes from node keys", () => {
      const keys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      expect(set.has(keys[0])).to.be.true;
      expect(set.has(keys[1])).to.be.true;
    });

    it("initializes from instance keys", () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      expect(set.has(keys[0])).to.be.true;
      expect(set.has(keys[1])).to.be.true;
    });

    it("initializes from entity props", () => {
      const props = [createRandomEntityProps(), createRandomEntityProps()];
      const set = new KeySet(props);
      expect(set.size).to.eq(2);
      expect(set.has(props[0])).to.be.true;
      expect(set.has(props[1])).to.be.true;
    });

    it("initializes from KeySetJSON", () => {
      const instanceKey11 = createRandomECInstanceKey();
      const instanceKey12 = {
        className: instanceKey11.className,
        id: createRandomECInstanceId(),
      } as InstanceKey;
      const instanceKey2 = createRandomECInstanceKey();
      const nodeKey = createRandomECInstanceNodeKey();
      const serialized = {
        instanceKeys: [
          [instanceKey11.className, [instanceKey11.id, instanceKey12.id]],
          [instanceKey2.className, [instanceKey2.id]],
        ],
        nodeKeys: [nodeKey],
      } as KeySetJSON;

      const set = new KeySet(serialized);
      expect(set.size).to.eq(4);
      expect(set.has(instanceKey11)).to.be.true;
      expect(set.has(instanceKey12)).to.be.true;
      expect(set.has(instanceKey2)).to.be.true;
      expect(set.has(nodeKey)).to.be.true;
    });

    it("initializes from KeySet", () => {
      const instanceKey11 = createRandomECInstanceKey();
      const instanceKey12 = {
        className: instanceKey11.className,
        id: createRandomECInstanceId(),
      } as InstanceKey;
      const instanceKey2 = createRandomECInstanceKey();
      const nodeKey = createRandomECInstanceNodeKey();
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
    });

  });

  describe("[get] instanceKeys", () => {

    it("returns empty map when there are no keys", () => {
      const set = new KeySet();
      expect(set.instanceKeys.size).to.eq(0);
    });

    it("returns map with one entry when all keys have same class name", () => {
      const set = new KeySet([{
        className: "aaa",
        id: createRandomECInstanceId(),
      }, {
        className: "aaa",
        id: createRandomECInstanceId(),
      }]);
      const keys = set.instanceKeys;
      expect(keys).to.matchSnapshot();
    });

    it("returns map with multiple entries for each class name when keys have different class names", () => {
      const set = new KeySet([{
        className: "aaa",
        id: createRandomECInstanceId(),
      }, {
        className: "bbb",
        id: createRandomECInstanceId(),
      }]);
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
      const set = new KeySet([{
        className: "aaa",
        id: createRandomECInstanceId(),
      }, {
        className: "aaa",
        id: createRandomECInstanceId(),
      }]);
      expect(set.instanceKeysCount).to.eq(2);
    });

    it("returns correct count when keys are of different classes", () => {
      const set = new KeySet([{
        className: "aaa",
        id: createRandomECInstanceId(),
      }, {
        className: "bbb",
        id: createRandomECInstanceId(),
      }]);
      expect(set.instanceKeysCount).to.eq(2);
    });

  });

  describe("[get] nodeKeys", () => {

    it("returns empty set when there are no keys", () => {
      const set = new KeySet();
      expect(set.nodeKeys.size).to.eq(0);
    });

    it("returns set with node keys", () => {
      const set = new KeySet([createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()]);
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
      const set = new KeySet([createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()]);
      expect(set.nodeKeysCount).to.eq(2);
    });

  });

  describe("clear", () => {

    it("clears node keys", () => {
      const keys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      const guidBefore = set.guid;
      set.clear();
      expect(set.size).to.eq(0);
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("clears instance keys", () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      const guidBefore = set.guid;
      set.clear();
      expect(set.size).to.eq(0);
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("clears entity props", () => {
      const props = [createRandomEntityProps(), createRandomEntityProps()];
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
      const set = new KeySet([createRandomECInstanceNodeKey()]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      const key = createRandomECInstanceNodeKey();
      set.add(key);
      expect(set.size).to.eq(2);
      expect(set.nodeKeysCount).to.eq(2);
      expect(set.has(key)).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't add the same node key", () => {
      const key = createRandomECInstanceNodeKey();
      const set = new KeySet([key]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.add(key);
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("adds an array of node keys", () => {
      const set = new KeySet([createRandomECInstanceNodeKey()]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      const keys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
      set.add(keys);
      expect(set.size).to.eq(3);
      expect(set.nodeKeysCount).to.eq(3);
      expect(set.has(keys[0])).to.be.true;
      expect(set.has(keys[1])).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't add the same node keys", () => {
      const keys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      const guidBefore = set.guid;
      set.add(keys);
      expect(set.size).to.eq(2);
      expect(set.guid).to.eq(guidBefore);
    });

    it("adds an instance key", () => {
      const set = new KeySet([createRandomECInstanceKey()]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      const key = createRandomECInstanceKey();
      set.add(key);
      expect(set.size).to.eq(2);
      expect(set.instanceKeysCount).to.eq(2);
      expect(set.has(key)).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't add the same instance key", () => {
      const key = createRandomECInstanceKey();
      const set = new KeySet([key]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.add(key);
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("adds an array of instance keys", () => {
      const set = new KeySet([createRandomECInstanceKey()]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      set.add(keys);
      expect(set.size).to.eq(3);
      expect(set.instanceKeysCount).to.eq(3);
      expect(set.has(keys[0])).to.be.true;
      expect(set.has(keys[1])).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't add the same instance keys", () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      const guidBefore = set.guid;
      set.add(keys);
      expect(set.size).to.eq(2);
      expect(set.guid).to.eq(guidBefore);
    });

    it("adds an entity prop", () => {
      const set = new KeySet([createRandomEntityProps()]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      const prop = createRandomEntityProps();
      set.add(prop);
      expect(set.size).to.eq(2);
      expect(set.instanceKeysCount).to.eq(2);
      expect(set.has(prop)).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't add the same entity prop", () => {
      const prop = createRandomEntityProps();
      const set = new KeySet([prop]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.add(prop);
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("adds an array of entity props", () => {
      const set = new KeySet([createRandomEntityProps()]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      const props = [createRandomEntityProps(), createRandomEntityProps()];
      set.add(props);
      expect(set.size).to.eq(3);
      expect(set.instanceKeysCount).to.eq(3);
      expect(set.has(props[0])).to.be.true;
      expect(set.has(props[1])).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't add the same entity props", () => {
      const props = [createRandomEntityProps(), createRandomEntityProps()];
      const set = new KeySet(props);
      expect(set.size).to.eq(2);
      const guidBefore = set.guid;
      set.add(props);
      expect(set.size).to.eq(2);
      expect(set.guid).to.eq(guidBefore);
    });

    it("adds a keyset", () => {
      const instanceKey1 = createRandomECInstanceKey();
      const nodeKey1 = createRandomECInstanceNodeKey();
      const set = new KeySet();
      set.add(instanceKey1).add(nodeKey1);
      expect(set.size).to.eq(2);
      expect(set.has(instanceKey1)).to.be.true;
      expect(set.has(nodeKey1)).to.be.true;
      const guidBefore = set.guid;

      const instanceKey2 = createRandomECInstanceKey();
      const instanceKey3 = { className: instanceKey1.className, id: createRandomECInstanceId() };
      const nodeKey2 = createRandomECInstanceNodeKey();
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

    it("doesn't add the same keys from a keyset", () => {
      const instanceKey = createRandomECInstanceKey();
      const nodeKey = createRandomECInstanceNodeKey();
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

    it("adds a serialized keyset", () => {
      const instanceKey1 = createRandomECInstanceKey();
      const nodeKey1 = createRandomECInstanceNodeKey();
      const set = new KeySet();
      set.add(instanceKey1).add(nodeKey1);
      expect(set.size).to.eq(2);
      expect(set.has(instanceKey1)).to.be.true;
      expect(set.has(nodeKey1)).to.be.true;
      const guidBefore = set.guid;

      const instanceKey2 = createRandomECInstanceKey();
      const nodeKey2 = createRandomECInstanceNodeKey();
      const serialized: KeySetJSON = {
        instanceKeys: [
          [instanceKey2.className, [instanceKey2.id]],
        ],
        nodeKeys: [nodeKey2],
      };

      set.add(serialized);
      expect(set.size).to.eq(4);
      expect(set.has(instanceKey1)).to.be.true;
      expect(set.has(instanceKey2)).to.be.true;
      expect(set.has(nodeKey1)).to.be.true;
      expect(set.has(nodeKey2)).to.be.true;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("doesn't add the same keys from a serialized keyset", () => {
      const instanceKey = createRandomECInstanceKey();
      const nodeKey = createRandomECInstanceNodeKey();
      const set = new KeySet();
      set.add(instanceKey).add(nodeKey);
      expect(set.size).to.eq(2);
      expect(set.has(instanceKey)).to.be.true;
      expect(set.has(nodeKey)).to.be.true;
      const guidBefore = set.guid;

      const serialized: KeySetJSON = {
        instanceKeys: [
          [instanceKey.className, [instanceKey.id]],
        ],
        nodeKeys: [nodeKey],
      };

      set.add(serialized);
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
      const keys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
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
      const keys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
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
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey(), createRandomECInstanceKey()];
      const set = new KeySet(keys);
      expect(set.size).to.eq(3);
      const guidBefore = set.guid;
      set.delete(keys[1]);
      expect(set.size).to.eq(2);
      expect(set.instanceKeysCount).to.eq(2);
      expect(set.has(keys[1])).to.be.false;
      expect(set.guid).to.not.eq(guidBefore);
    });

    it("deletes an array of instance keys", () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey(), createRandomECInstanceKey()];
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
      const props = [createRandomEntityProps(), createRandomEntityProps(), createRandomEntityProps()];
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
      const props = [createRandomEntityProps(), createRandomEntityProps(), createRandomEntityProps()];
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
      const instanceKeys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const nodeKeys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
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

    it("deletes keys from a serialized keyset", () => {
      const instanceKeys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const nodeKeys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
      const set = new KeySet();
      set.add(instanceKeys).add(nodeKeys);
      expect(set.size).to.eq(4);
      expect(set.has(instanceKeys[0])).to.be.true;
      expect(set.has(instanceKeys[1])).to.be.true;
      expect(set.has(nodeKeys[0])).to.be.true;
      expect(set.has(nodeKeys[1])).to.be.true;
      const guidBefore = set.guid;

      const serialized: KeySetJSON = {
        instanceKeys: [
          [instanceKeys[1].className, [instanceKeys[1].id]],
        ],
        nodeKeys: [nodeKeys[0]],
      };

      set.delete(serialized);
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
      set.delete(createRandomECInstanceKey());
      expect(set.size).to.eq(0);
      expect(set.guid).to.eq(guidBefore);
    });

    it("does nothing when trying to delete an non-existing instance key", () => {
      const set = new KeySet([createRandomECInstanceKey()]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.delete(createRandomECInstanceKey());
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("does nothing when trying to delete a node key from empty keyset", () => {
      const set = new KeySet();
      const guidBefore = set.guid;
      set.delete(createRandomECInstanceNodeKey());
      expect(set.size).to.eq(0);
      expect(set.guid).to.eq(guidBefore);
    });

    it("does nothing when trying to delete a non-existing node key", () => {
      const set = new KeySet([createRandomECInstanceNodeKey()]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.delete(createRandomECInstanceNodeKey());
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("does nothing when trying to delete a keyset from empty keyset", () => {
      const set = new KeySet();
      const guidBefore = set.guid;
      set.delete(new KeySet([createRandomECInstanceKey()]));
      expect(set.size).to.eq(0);
      expect(set.guid).to.eq(guidBefore);
    });

    it("does nothing when trying to delete a keyset with non-existing keys", () => {
      const set = new KeySet([createRandomECInstanceKey()]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.delete(new KeySet([createRandomECInstanceKey()]));
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("does nothing when trying to delete a serialized keyset from empty keyset", () => {
      const set = new KeySet();
      const guidBefore = set.guid;
      set.delete(new KeySet([createRandomECInstanceKey()]).toJSON());
      expect(set.size).to.eq(0);
      expect(set.guid).to.eq(guidBefore);
    });

    it("does nothing when trying to delete non-existing keys from a serialized keyset", () => {
      const set = new KeySet([createRandomECInstanceKey()]);
      expect(set.size).to.eq(1);
      const guidBefore = set.guid;
      set.delete(new KeySet([createRandomECInstanceKey()]).toJSON());
      expect(set.size).to.eq(1);
      expect(set.guid).to.eq(guidBefore);
    });

    it("handles invalid values", () => {
      const set = new KeySet([createRandomECInstanceNodeKey()]);
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
      const set = new KeySet([createRandomECInstanceNodeKey()]);
      expect(() => (set as any).has(undefined)).to.throw(PresentationError);
      expect(() => (set as any).has(null)).to.throw(PresentationError);
      expect(() => (set as any).has({})).to.throw(PresentationError);
    });

  });

  const keyTypes = [
    { name: "KeySet", checkFactory: (keys: Key[]) => new KeySet(keys) },
    { name: "KeySetJSON", checkFactory: (keys: Key[]) => new KeySet(keys).toJSON() },
    { name: "Key[]", checkFactory: (keys: Key[]) => keys },
  ];

  describe("hasAll", () => {

    keyTypes.forEach((keyType) => {

      describe(keyType.name, () => {

        const createKeys = keyType.checkFactory;

        it("returns true when KeySet has all values", () => {
          const instanceKey1 = createRandomECInstanceKey();
          const instanceKey2 = createRandomECInstanceKey();
          const nodeKey1 = createRandomECInstanceNodeKey();
          const nodeKey2 = createRandomECInstanceNodeKey();
          const set = new KeySet([instanceKey1, instanceKey2, nodeKey1, nodeKey2]);
          expect(set.hasAll(createKeys([instanceKey1, nodeKey1]))).to.be.true;
        });

        it("returns false when node keys count is smaller", () => {
          const nodeKey1 = createRandomECInstanceNodeKey();
          const nodeKey2 = createRandomECInstanceNodeKey();
          const set = new KeySet([nodeKey1]);
          expect(set.hasAll(createKeys([nodeKey1, nodeKey2]))).to.be.false;
        });

        it("returns false when node keys are different", () => {
          const nodeKey1 = createRandomECInstanceNodeKey();
          const nodeKey2 = createRandomECInstanceNodeKey();
          const set = new KeySet([nodeKey1]);
          expect(set.hasAll(createKeys([nodeKey2]))).to.be.false;
        });

        it("returns false when instance keys count is smaller", () => {
          const instanceKey1 = createRandomECInstanceKey();
          const instanceKey2 = createRandomECInstanceKey();
          const set = new KeySet([instanceKey1]);
          expect(set.hasAll(createKeys([instanceKey1, instanceKey2]))).to.be.false;
        });

        it("returns false when instance key classes are different", () => {
          const instanceKey1 = createRandomECInstanceKey();
          const instanceKey2: InstanceKey = {
            className: instanceKey1.className + "_different",
            id: instanceKey1.id,
          };
          const set = new KeySet([instanceKey1]);
          expect(set.hasAll(createKeys([instanceKey2]))).to.be.false;
        });

        it("returns false when instance key ids", () => {
          const instanceKey1 = createRandomECInstanceKey();
          const instanceKey2: InstanceKey = {
            className: instanceKey1.className,
            id: createRandomId(),
          };
          const set = new KeySet([instanceKey1]);
          expect(set.hasAll(createKeys([instanceKey2]))).to.be.false;
        });

      });

    });

    /*
    it("returns true when KeySet has all values in serialized KeySet", () => {
      const instanceKey = createRandomECInstanceKey();
      const nodeKey = createRandomECInstanceNodeKey();
      const set = new KeySet().add(instanceKey).add(nodeKey);
      const check = new KeySet(set);
      expect(set.hasAll(check.toJSON())).to.be.true;
    });

    it("returns true when KeySet has all values in serialized KeySet and more", () => {
      const instanceKey1 = createRandomECInstanceKey();
      const instanceKey2 = createRandomECInstanceKey();
      const nodeKey = createRandomECInstanceNodeKey();
      const set = new KeySet().add([instanceKey1, instanceKey2]).add(nodeKey);
      const check = new KeySet().add(instanceKey1).add(nodeKey);
      expect(set.hasAll(check.toJSON())).to.be.true;
    });

    it("returns false when KeySet doesn't have all values from serialized KeySet", () => {
      const instanceKey = createRandomECInstanceKey();
      const nodeKey = createRandomECInstanceNodeKey();
      const set = new KeySet([nodeKey]);
      const check = new KeySet().add(instanceKey).add(nodeKey);
      expect(set.hasAll(check.toJSON())).to.be.false;
    });

    it("returns true when KeySet has all values in keys array", () => {
      const instanceKey = createRandomECInstanceKey();
      const set = new KeySet().add(instanceKey);
      expect(set.hasAll([instanceKey])).to.be.true;
    });

    it("returns true when KeySet has all values in keys array and more", () => {
      const instanceKey1 = createRandomECInstanceKey();
      const instanceKey2 = createRandomECInstanceKey();
      const set = new KeySet().add([instanceKey1, instanceKey2]);
      expect(set.hasAll([instanceKey1])).to.be.true;
    });

    it("returns false when KeySet doesn't have all values from keys array", () => {
      const instanceKey1 = createRandomECInstanceKey();
      const instanceKey2 = createRandomECInstanceKey();
      const set = new KeySet([instanceKey1]);
      expect(set.hasAll([instanceKey1, instanceKey2])).to.be.false;
    });*/

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
          const nodeKey1 = createRandomECInstanceNodeKey();
          const nodeKey2 = createRandomECInstanceNodeKey();
          const set = new KeySet([nodeKey1, nodeKey2]);
          expect(set.hasAny(createKeys([nodeKey2]))).to.be.true;
        });

        it("returns true when KeySet has any instance key", () => {
          const instanceKey1 = createRandomECInstanceKey();
          const instanceKey2 = createRandomECInstanceKey();
          const instanceKey3 = createRandomECInstanceKey();
          const set = new KeySet([instanceKey1, instanceKey2]);
          expect(set.hasAny(createKeys([instanceKey2, instanceKey3]))).to.be.true;
        });

        it("returns false when KeySet doesn't have any key", () => {
          const set = new KeySet([createRandomECInstanceKey(), createRandomECInstanceNodeKey()]);
          expect(set.hasAny(createKeys([createRandomECInstanceKey(), createRandomECInstanceNodeKey()]))).to.be.false;
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

  describe("serialization", () => {

    it("roundtrip", () => {
      const instanceKey11 = createRandomECInstanceKey();
      const instanceKey12 = {
        className: instanceKey11.className,
        id: createRandomECInstanceId(),
      } as InstanceKey;
      const instanceKey2 = createRandomECInstanceKey();
      const nodeKey = createRandomECInstanceNodeKey();

      const source = new KeySet();
      source.add([instanceKey11, instanceKey12, instanceKey2]).add(nodeKey);

      const serialized = JSON.stringify(source);
      const deserialized = JSON.parse(serialized);
      expect(deserialized).to.matchSnapshot();

      const target = new KeySet(deserialized);
      expect(target.size).to.eq(4);
      expect(target.has(instanceKey11)).to.be.true;
      expect(target.has(instanceKey12)).to.be.true;
      expect(target.has(instanceKey2)).to.be.true;
      expect(target.has(nodeKey)).to.be.true;
    });

  });

});
