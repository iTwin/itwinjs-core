/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  createRandomECInstanceNodeKey,
  createRandomECInstanceKey, createRandomECInstanceId,
  createRandomEntityProps,
} from "./_helpers/random";
import KeySet, { KeySetJSON } from "../lib/KeySet";
import { InstanceKey } from "../lib/EC";
import { PresentationError } from "../lib/Error";

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
          [instanceKey11.className, [instanceKey11.id.value, instanceKey12.id.value]],
          [instanceKey2.className, [instanceKey2.id.value]],
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

  describe("clear", () => {

    it("clears node keys", () => {
      const keys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      set.clear();
      expect(set.size).to.eq(0);
    });

    it("clears instance keys", () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const set = new KeySet(keys);
      expect(set.size).to.eq(2);
      set.clear();
      expect(set.size).to.eq(0);
    });

    it("clears entity props", () => {
      const props = [createRandomEntityProps(), createRandomEntityProps()];
      const set = new KeySet(props);
      expect(set.size).to.eq(2);
      set.clear();
      expect(set.size).to.eq(0);
    });

  });

  describe("add", () => {

    it("adds a node key", () => {
      const set = new KeySet([createRandomECInstanceNodeKey()]);
      expect(set.size).to.eq(1);
      const key = createRandomECInstanceNodeKey();
      set.add(key);
      expect(set.size).to.eq(2);
      expect(set.has(key)).to.be.true;
    });

    it("adds an array of node keys", () => {
      const set = new KeySet([createRandomECInstanceNodeKey()]);
      expect(set.size).to.eq(1);
      const keys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
      set.add(keys);
      expect(set.size).to.eq(3);
      expect(set.has(keys[0])).to.be.true;
      expect(set.has(keys[1])).to.be.true;
    });

    it("adds an instance key", () => {
      const set = new KeySet([createRandomECInstanceKey()]);
      expect(set.size).to.eq(1);
      const key = createRandomECInstanceKey();
      set.add(key);
      expect(set.size).to.eq(2);
      expect(set.has(key)).to.be.true;
    });

    it("adds an array of instance keys", () => {
      const set = new KeySet([createRandomECInstanceKey()]);
      expect(set.size).to.eq(1);
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      set.add(keys);
      expect(set.size).to.eq(3);
      expect(set.has(keys[0])).to.be.true;
      expect(set.has(keys[1])).to.be.true;
    });

    it("adds an entity prop", () => {
      const set = new KeySet([createRandomEntityProps()]);
      expect(set.size).to.eq(1);
      const prop = createRandomEntityProps();
      set.add(prop);
      expect(set.size).to.eq(2);
      expect(set.has(prop)).to.be.true;
    });

    it("adds an array of entity props", () => {
      const set = new KeySet([createRandomEntityProps()]);
      expect(set.size).to.eq(1);
      const props = [createRandomEntityProps(), createRandomEntityProps()];
      set.add(props);
      expect(set.size).to.eq(3);
      expect(set.has(props[0])).to.be.true;
      expect(set.has(props[1])).to.be.true;
    });

    it("adds a keyset", () => {
      const instanceKey1 = createRandomECInstanceKey();
      const nodeKey1 = createRandomECInstanceNodeKey();
      const set = new KeySet();
      set.add(instanceKey1).add(nodeKey1);
      expect(set.size).to.eq(2);
      expect(set.has(instanceKey1)).to.be.true;
      expect(set.has(nodeKey1)).to.be.true;

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
    });

    it("adds a serialized keyset", () => {
      const instanceKey1 = createRandomECInstanceKey();
      const nodeKey1 = createRandomECInstanceNodeKey();
      const set = new KeySet();
      set.add(instanceKey1).add(nodeKey1);
      expect(set.size).to.eq(2);
      expect(set.has(instanceKey1)).to.be.true;
      expect(set.has(nodeKey1)).to.be.true;

      const instanceKey2 = createRandomECInstanceKey();
      const nodeKey2 = createRandomECInstanceNodeKey();
      const serialized = {
        instanceKeys: [
          [instanceKey2.className, [instanceKey2.id.value]],
        ],
        nodeKeys: [nodeKey2],
      } as KeySetJSON;

      set.add(serialized);
      expect(set.size).to.eq(4);
      expect(set.has(instanceKey1)).to.be.true;
      expect(set.has(instanceKey2)).to.be.true;
      expect(set.has(nodeKey1)).to.be.true;
      expect(set.has(nodeKey2)).to.be.true;
    });

    it("handles invalid values", () => {
      const set = new KeySet();
      expect(() => (set as any).add(undefined)).to.throw(PresentationError);
      expect(set.isEmpty).to.be.true;
      expect(() => (set as any).add(null)).to.throw(PresentationError);
      expect(set.isEmpty).to.be.true;
      expect(() => (set as any).add({})).to.throw(PresentationError);
      expect(set.isEmpty).to.be.true;
    });

  });

  describe("delete", () => {

    it("deletes a node key", () => {
      const keys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
      const set = new KeySet(keys);
      expect(set.size).to.eq(3);
      set.delete(keys[1]);
      expect(set.size).to.eq(2);
      expect(set.has(keys[1])).to.be.false;
    });

    it("deletes an array of node keys", () => {
      const keys = [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()];
      const set = new KeySet(keys);
      expect(set.size).to.eq(3);
      set.delete([keys[1], keys[2]]);
      expect(set.size).to.eq(1);
      expect(set.has(keys[1])).to.be.false;
      expect(set.has(keys[2])).to.be.false;
    });

    it("deletes an instance key", () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey(), createRandomECInstanceKey()];
      const set = new KeySet(keys);
      expect(set.size).to.eq(3);
      set.delete(keys[1]);
      expect(set.size).to.eq(2);
      expect(set.has(keys[1])).to.be.false;
    });

    it("deletes an array of instance keys", () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey(), createRandomECInstanceKey()];
      const set = new KeySet(keys);
      expect(set.size).to.eq(3);
      set.delete([keys[1], keys[2]]);
      expect(set.size).to.eq(1);
      expect(set.has(keys[1])).to.be.false;
      expect(set.has(keys[2])).to.be.false;
    });

    it("deletes an entity prop", () => {
      const props = [createRandomEntityProps(), createRandomEntityProps(), createRandomEntityProps()];
      const set = new KeySet(props);
      expect(set.size).to.eq(3);
      set.delete(props[1]);
      expect(set.size).to.eq(2);
      expect(set.has(props[1])).to.be.false;
    });

    it("deletes an array of entity props", () => {
      const props = [createRandomEntityProps(), createRandomEntityProps(), createRandomEntityProps()];
      const set = new KeySet(props);
      expect(set.size).to.eq(3);
      set.delete([props[1], props[2]]);
      expect(set.size).to.eq(1);
      expect(set.has(props[1])).to.be.false;
      expect(set.has(props[2])).to.be.false;
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

      const source = new KeySet();
      source.add(instanceKeys[1]).add(nodeKeys[0]);

      set.delete(source);
      expect(set.size).to.eq(2);
      expect(set.has(instanceKeys[0])).to.be.true;
      expect(set.has(instanceKeys[1])).to.be.false;
      expect(set.has(nodeKeys[0])).to.be.false;
      expect(set.has(nodeKeys[1])).to.be.true;
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

      const serialized = {
        instanceKeys: [
          [instanceKeys[1].className, [instanceKeys[1].id.value]],
        ],
        nodeKeys: [nodeKeys[0]],
      } as KeySetJSON;

      set.delete(serialized);
      expect(set.size).to.eq(2);
      expect(set.has(instanceKeys[0])).to.be.true;
      expect(set.has(instanceKeys[1])).to.be.false;
      expect(set.has(nodeKeys[0])).to.be.false;
      expect(set.has(nodeKeys[1])).to.be.true;
    });

    it("does nothing when trying to delete an instance key from empty keyset", () => {
      const set = new KeySet();
      set.delete(createRandomECInstanceKey());
      expect(set.size).to.eq(0);
    });

    it("does nothing when trying to delete a node key from empty keyset", () => {
      const set = new KeySet();
      set.delete(createRandomECInstanceNodeKey());
      expect(set.size).to.eq(0);
    });

    it("does nothing when trying to delete a keyset from empty keyset", () => {
      const set = new KeySet();
      set.delete(new KeySet([createRandomECInstanceKey()]));
      expect(set.size).to.eq(0);
    });

    it("does nothing when trying to delete a serialized keyset from empty keyset", () => {
      const set = new KeySet();
      set.delete(new KeySet([createRandomECInstanceKey()]).toJSON());
      expect(set.size).to.eq(0);
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
