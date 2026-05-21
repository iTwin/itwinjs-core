import { expect } from "chai";
import { CachedElement, ElementLRUCache, InstanceKeyLRUCache } from "../internal/ElementLRUCache";
import { IModelJsNative } from "../core-backend";
import { Id64 } from "@itwin/core-bentley";
import { Code } from "@itwin/core-common";

describe('ElementLruCache', () => {
  const testElem1: CachedElement = {
    loadOptions: {},
    elProps: {
      id: "testId",
      model: "testModel",
      code: {
        spec: "testSpec",
        scope: "testScope"
      },
      classFullName: "testName"
    },
  }

  const testElem2: CachedElement = {
    loadOptions: {},
    elProps: {
      id: "testId2",
      model: "testModel2",
      code: {
        spec: "testSpec2",
        scope: "testScope2",
        value: "testValue2"
      },
      classFullName: "testName2"
    },
  }

  const testElem3: CachedElement = {
    loadOptions: {},
    elProps: {
      id: "testId3",
      model: "testModel3",
      code: {
        spec: "testSpec3",
        scope: "testScope3"
      },
      classFullName: "testName3"
    },
  }

  const testElemFedGuid: CachedElement = {
    loadOptions: {},
    elProps: {
      id: "testIdFed",
      model: "testModel",
      code: {
        spec: "testSpec",
        scope: "testScope"
      },
      classFullName: "testName",
      federationGuid: "testFedGuid"
    },
  }

  const testElemCode: CachedElement = {
    loadOptions: {},
    elProps: {
      id: "testId5",
      model: "testModel5",
      code: {
        spec: "testSpec2:testValue2",
        scope: "testScope2"
      },
      classFullName: "testName5",
      federationGuid: "testFedGuid5"
    },
  }

  const testElemNoId: CachedElement = {
    loadOptions: {},
    elProps: {
      id: undefined,
      model: "testModel5",
      code: {
        spec: "testSpec2",
        scope: "testScope2"
      },
      classFullName: "testName5",
      federationGuid: "testFedGuid5"
    },
  }

  it('should store and retrieve a valid element', () => {
    const cache = new ElementLRUCache(3);
    cache.set(testElem1);
    const retrievedElem = cache.get({ id: testElem1.elProps.id });
    expect(retrievedElem).to.not.be.undefined;
    expect(retrievedElem).to.equal(testElem1);
  });

  it('should overwrite existing valid element', () => {
    const cache = new ElementLRUCache(3);
    const testElemModel = testElem1;
    cache.set(testElemModel);
    const retrievedElem = cache.get({ id: testElemModel.elProps.id });
    expect(retrievedElem).to.not.be.undefined;
    expect(retrievedElem).to.equal(testElemModel);

    testElemModel.elProps.model = "newModel";
    cache.set(testElemModel);
    const retrievedElem2 = cache.get({ id: testElemModel.elProps.id });
    expect(retrievedElem2).to.not.be.undefined;
    expect(retrievedElem2).to.equal(testElemModel);
  });

  it('should store and retrieve a valid element by fedGuid', () => {
    const cache = new ElementLRUCache(3);
    cache.set(testElemFedGuid);
    const retrievedElem = cache.get({ federationGuid: testElemFedGuid.elProps.federationGuid });
    expect(retrievedElem).to.not.be.undefined;
    expect(retrievedElem).to.equal(testElemFedGuid);
  });

  it('should store and retrieve a valid element by code', () => {
    const cache = new ElementLRUCache(3);
    cache.set(testElem1);
    const retrievedElem = cache.get({ code: testElem1.elProps.code });
    expect(retrievedElem).to.not.be.undefined;
    expect(retrievedElem).to.equal(testElem1);

    cache.set(testElem2);
    const retrievedElem2 = cache.get({ code: testElem2.elProps.code });
    expect(retrievedElem2).to.not.be.undefined;
    expect(retrievedElem2).to.equal(testElem2);
  });

  it('should fail to store an element without id', () => {
    const cache = new ElementLRUCache(3);
    expect(() => cache.set(testElemNoId)).to.throw(Error, "Element must have an id");
  });

  it('should delete least used element', () => {
    const cache = new ElementLRUCache(3);
    cache.set(testElem1);
    cache.set(testElem2);
    cache.set(testElem3);
    cache.set(testElemFedGuid);
    expect(cache.size).to.equal(3);

    const retrievedElem = cache.get({ id: testElem2.elProps.id });
    expect(retrievedElem).to.not.be.undefined;
    expect(retrievedElem).to.equal(testElem2);

    const retrievedElem2 = cache.get({ id: testElem1.elProps.id });
    expect(retrievedElem2).to.be.undefined;

    const retrievedElem3 = cache.get({ id: testElem3.elProps.id });
    expect(retrievedElem3).to.not.be.undefined;
    expect(retrievedElem3).to.equal(testElem3);
  });

  it('should delete with id', () => {
    const cache = new ElementLRUCache(3);
    cache.set(testElem1);
    cache.set(testElem2);
    cache.set(testElem3);
    expect(cache.size).to.equal(3);
    cache.delete({ id: testElem2.elProps.id });
    expect(cache.size).to.equal(2);

    const retrievedElem = cache.get({ id: testElem2.elProps.id });
    expect(retrievedElem).to.be.undefined;

    const retrievedElem2 = cache.get({ id: testElem1.elProps.id });
    expect(retrievedElem2).to.not.be.undefined;
    expect(retrievedElem2).to.equal(testElem1);
  });

  it('should delete with federation guid', () => {
    const cache = new ElementLRUCache(3);
    cache.set(testElem1);
    cache.set(testElem2);
    cache.set(testElemFedGuid);
    expect(cache.size).to.equal(3);
    cache.delete({ federationGuid: testElemFedGuid.elProps.federationGuid });
    expect(cache.size).to.equal(2);

    const retrievedElem = cache.get({ id: testElemFedGuid.elProps.id });
    expect(retrievedElem).to.be.undefined;

    const retrievedElem2 = cache.get({ id: testElem1.elProps.id });
    expect(retrievedElem2).to.not.be.undefined;
    expect(retrievedElem2).to.equal(testElem1);
  });

  it('should delete with code', () => {
    const cache = new ElementLRUCache(3);
    cache.set(testElem1);
    cache.set(testElem2);
    cache.set(testElem3);
    expect(cache.size).to.equal(3);
    cache.delete({ code: testElem2.elProps.code });
    expect(cache.size).to.equal(2);

    const retrievedElem = cache.get({ id: testElem2.elProps.id });
    expect(retrievedElem).to.be.undefined;

    const retrievedElem2 = cache.get({ id: testElem1.elProps.id });
    expect(retrievedElem2).to.not.be.undefined;
    expect(retrievedElem2).to.equal(testElem1);
  });

  it('should delete with model id', () => {
    const cache = new ElementLRUCache(3);
    cache.set(testElem1);
    cache.set(testElem2);
    cache.set(testElem3);
    expect(cache.size).to.equal(3);
    cache.deleteWithModel(testElem2.elProps.model);
    expect(cache.size).to.equal(2);

    const retrievedElem = cache.get({ id: testElem2.elProps.id });
    expect(retrievedElem).to.be.undefined;

    const retrievedElem2 = cache.get({ id: testElem1.elProps.id });
    expect(retrievedElem2).to.not.be.undefined;
    expect(retrievedElem2).to.equal(testElem1);
  });

  it('should clear the cache', () => {
    const cache = new ElementLRUCache(3);
    cache.set(testElem1);
    cache.set(testElem2);
    cache.set(testElem3);
    expect(cache.size).to.equal(3);

    cache.clear();
    expect(cache.size).to.equal(0);

    const retrievedElem = cache.get({ id: testElem1.elProps.id });
    expect(retrievedElem).to.be.undefined;
  });

  it('should not return wrong element when passed a manipulated code value', () => {
    const cache = new ElementLRUCache(3);
    cache.set(testElem2);
    expect(cache.size).to.equal(1);

    const retrievedElem = cache.get({ code: testElemCode.elProps.code });
    expect(retrievedElem).to.be.undefined;
  });


  it('looking up by an empty code should not return any element', () => {
    const cache = new ElementLRUCache(10);
    cache.set({
      loadOptions: {},
      elProps: {
        id: "0x10",
        model: "0x20",
        code: Code.createEmpty(),
        classFullName: "BisCore:Element",
      },
    });

    const retrieved = cache.get({ code: Code.createEmpty() });
    expect(retrieved, "empty-code lookup should return undefined").to.be.undefined;
  });

  it('simulate inserting a second element with an empty code should not evict the first from the cache', () => {
    const elementWithEmptyCode: CachedElement = {
      loadOptions: {},
      elProps: {
        id: "0x10",
        model: "0x20",
        code: Code.createEmpty(),
        classFullName: "BisCore:Element",
      },
    };

    // Insert an element with an empty Code
    const cache = new ElementLRUCache(10);
    cache.set(elementWithEmptyCode);
    expect(cache.size).to.equal(1);

    const anotherElementWithEmptyCode: CachedElement = {
      loadOptions: {},
      elProps: {
        id: "0x11",
        model: "0x20",
        code: Code.createEmpty(),
        classFullName: "BisCore:Element",
      },
    };

    // Simulate the pre-insert cache invalidation for elemWithEmptyCode2 (id not yet assigned).
    cache.delete({ id: undefined, federationGuid: undefined, code: anotherElementWithEmptyCode.elProps.code });

    // elemWithEmptyCode1 must NOT have been evicted — the delete should have been a no-op.
    const firstElement = cache.get({ id: elementWithEmptyCode.elProps.id });
    expect(firstElement, "first element should still be in cache after pre-insert delete of second empty-code element").to.equal(elementWithEmptyCode);
  });
});

describe('InstanceKeyLRUCache', () => {
  const testArgs1: IModelJsNative.ResolveInstanceKeyArgs = {
    partialKey: {
      id: Id64.fromJSON("0x123"),
      baseClassName: "baseName",
    },
  }

  const testArgs2: IModelJsNative.ResolveInstanceKeyArgs = {
    federationGuid: "testFedGuid",
  }

  const testArgs3: IModelJsNative.ResolveInstanceKeyArgs = {
    code: {
      spec: "testSpec",
      scope: "testScope",
      value: "testValue"
    }
  }

  const testArgs4: IModelJsNative.ResolveInstanceKeyArgs = {
    code: {
      spec: "testSpec",
      scope: "testScope"
    }
  }

  const testResults: IModelJsNative.ResolveInstanceKeyResult[] = [
    {
      id: Id64.fromJSON("0x123"),
      classFullName: "testName1",
    },
    {
      id: Id64.fromJSON("0x122"),
      classFullName: "testName2",
    },
    {
      id: Id64.fromJSON("0x133"),
      classFullName: "testName3",
    },
    {
      id: Id64.fromJSON("0x144"),
      classFullName: "testName4",
    }
  ];

  it('should store and retrieve a valid InstanceKey', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set(testArgs1, testResults[0]);
    const retrievedResult = cache.get({ partialKey: testArgs1.partialKey });
    expect(retrievedResult).to.not.be.undefined;
    expect(retrievedResult).to.equal(testResults[0]);
  });

  it('should overwrite existing valid InstanceKey', () => {
    const cache = new InstanceKeyLRUCache(3);
    const testResult = testResults[0];
    cache.set(testArgs1, testResult);
    const retrievedResult = cache.get({ partialKey: testArgs1.partialKey });
    expect(retrievedResult).to.not.be.undefined;
    expect(retrievedResult).to.equal(testResult);

    const newTestResult = { id: testResult.id, classFullName: "newModel" };
    cache.set(testArgs1, newTestResult);
    const retrievedResult2 = cache.get({ partialKey: testArgs1.partialKey });
    expect(retrievedResult2).to.not.be.undefined;
    expect(retrievedResult2).to.equal(newTestResult);
  });

  it('should store and retrieve a valid InstanceKey by fedGuid', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set(testArgs2, testResults[0]);
    const retrievedResult = cache.get({ federationGuid: testArgs2.federationGuid });
    expect(retrievedResult).to.not.be.undefined;
    expect(retrievedResult).to.equal(testResults[0]);
  });

  it('should store and retrieve a valid InstanceKey by code', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set(testArgs3, testResults[0]);
    const retrievedResult = cache.get({ code: testArgs3.code });
    expect(retrievedResult).to.not.be.undefined;
    expect(retrievedResult).to.equal(testResults[0]);

    cache.set(testArgs4, testResults[1]);
    const retrievedResult2 = cache.get({ code: testArgs4.code });
    expect(retrievedResult2).to.not.be.undefined;
    expect(retrievedResult2).to.equal(testResults[1]);
  });

  it('should find the same InstanceKey with either code, fedGuid, or Id', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set({ ...testArgs1, ...testArgs2, ...testArgs3 }, testResults[0]);

    const retrievedResultById = cache.get({ partialKey: testArgs1.partialKey });
    expect(retrievedResultById).to.not.be.undefined;
    expect(retrievedResultById).to.equal(testResults[0]);

    const retrievedResultByFedGuid = cache.get({ federationGuid: testArgs2.federationGuid });
    expect(retrievedResultByFedGuid).to.not.be.undefined;
    expect(retrievedResultByFedGuid).to.equal(testResults[0]);

    const retrievedResultByCode = cache.get({ code: testArgs3.code });
    expect(retrievedResultByCode).to.not.be.undefined;
    expect(retrievedResultByCode).to.equal(testResults[0]);
  });

  it('should update an existing InstanceKey with either code, fedGuid, or Id', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set(testArgs1, testResults[0]);
    cache.set(testArgs2, testResults[0]);
    cache.set(testArgs3, testResults[0]);

    const retrievedResultById = cache.get({ partialKey: testArgs1.partialKey });
    expect(retrievedResultById).to.not.be.undefined;
    expect(retrievedResultById).to.equal(testResults[0]);

    const retrievedResultByFedGuid = cache.get({ federationGuid: testArgs2.federationGuid });
    expect(retrievedResultByFedGuid).to.not.be.undefined;
    expect(retrievedResultByFedGuid).to.equal(testResults[0]);

    const retrievedResultByCode = cache.get({ code: testArgs3.code });
    expect(retrievedResultByCode).to.not.be.undefined;
    expect(retrievedResultByCode).to.equal(testResults[0]);
  });

  it('should not store a bad id as result in the cache', () => {
    const cache = new InstanceKeyLRUCache(3);
    const badResult: IModelJsNative.ResolveInstanceKeyResult = { id: Id64.invalid, classFullName: "badName" };
    expect(() => cache.set(testArgs1, badResult)).to.throw(Error, "Invalid InstanceKey result");
    expect(cache.size).to.equal(0);
  });

  it('should delete least used element', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set(testArgs1, testResults[0]);
    cache.set(testArgs2, testResults[1]);
    cache.set(testArgs3, testResults[2]);
    cache.set(testArgs4, testResults[3]);
    expect(cache.size).to.equal(3);

    const retrievedResult = cache.get(testArgs2);
    expect(retrievedResult).to.not.be.undefined;
    expect(retrievedResult).to.equal(testResults[1]);

    const retrievedResult2 = cache.get(testArgs1);
    expect(retrievedResult2).to.be.undefined;

    const retrievedResult3 = cache.get(testArgs3);
    expect(retrievedResult3).to.not.be.undefined;
    expect(retrievedResult3).to.equal(testResults[2]);
  });

  it('should delete with partialKey', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set(testArgs1, testResults[0]);
    cache.set(testArgs2, testResults[1]);
    cache.set(testArgs3, testResults[2]);
    expect(cache.size).to.equal(3);
    cache.delete({ partialKey: testArgs1.partialKey });
    expect(cache.size).to.equal(2);

    const retrievedResult = cache.get({ partialKey: testArgs1.partialKey });
    expect(retrievedResult).to.be.undefined;

    const retrievedResult2 = cache.get(testArgs2);
    expect(retrievedResult2).to.not.be.undefined;
    expect(retrievedResult2).to.equal(testResults[1]);
  });

  it('should delete with id', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set(testArgs1, testResults[0]);
    cache.set(testArgs2, testResults[1]);
    cache.set(testArgs3, testResults[2]);
    expect(cache.size).to.equal(3);
    cache.deleteById(testArgs1.partialKey!.id);
    expect(cache.size).to.equal(2);

    const retrievedResult = cache.get({ partialKey: testArgs1.partialKey });
    expect(retrievedResult).to.be.undefined;

    const retrievedResult2 = cache.get(testArgs2);
    expect(retrievedResult2).to.not.be.undefined;
    expect(retrievedResult2).to.equal(testResults[1]);
  });

  it('should throw when deleting with a bad id', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set(testArgs1, testResults[0]);
    cache.set(testArgs2, testResults[1]);
    cache.set(testArgs3, testResults[2]);
    expect(cache.size).to.equal(3);
    expect(() => cache.deleteById("badid")).to.throw(Error, "Invalid id provided");
    expect(cache.size).to.equal(3);
  });

  it('should delete with federation guid', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set(testArgs1, testResults[0]);
    cache.set(testArgs2, testResults[1]);
    cache.set(testArgs3, testResults[2]);
    expect(cache.size).to.equal(3);
    cache.delete({ federationGuid: testArgs2.federationGuid });
    expect(cache.size).to.equal(2);

    const retrievedResult = cache.get({ federationGuid: testArgs2.federationGuid });
    expect(retrievedResult).to.be.undefined;

    const retrievedResult2 = cache.get(testArgs3);
    expect(retrievedResult2).to.not.be.undefined;
    expect(retrievedResult2).to.equal(testResults[2]);
  });

  it('should delete with code', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set(testArgs1, testResults[0]);
    cache.set(testArgs2, testResults[1]);
    cache.set(testArgs3, testResults[2]);
    expect(cache.size).to.equal(3);
    cache.delete({ code: testArgs3.code });
    expect(cache.size).to.equal(2);

    const retrievedResult = cache.get({ code: testArgs3.code });
    expect(retrievedResult).to.be.undefined;

    const retrievedResult2 = cache.get(testArgs1);
    expect(retrievedResult2).to.not.be.undefined;
    expect(retrievedResult2).to.equal(testResults[0]);
  });

  it('should delete with any applicable arg', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set(testArgs1, testResults[0]);
    cache.set(testArgs2, testResults[0]);
    cache.set(testArgs3, testResults[0]);
    expect(cache.size).to.equal(1);
    cache.delete(testArgs3);
    expect(cache.size).to.equal(0);
    const retrievedResult = cache.get(testArgs1);
    expect(retrievedResult).to.be.undefined;

    cache.set(testArgs1, testResults[0]);
    cache.set(testArgs2, testResults[1]);
    cache.set(testArgs3, testResults[2]);
    expect(cache.size).to.equal(3);
    cache.set(testArgs4, testResults[0]);
    expect(cache.size).to.equal(3);

    cache.delete(testArgs4);
    expect(cache.size).to.equal(2);
    const retrievedResult2 = cache.get(testArgs1);
    expect(retrievedResult2).to.be.undefined;
  });

  it('should throw when trying to delete with all undefined keys', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set(testArgs1, testResults[0]);
    cache.set(testArgs2, testResults[1]);
    cache.set(testArgs3, testResults[2]);
    expect(cache.size).to.equal(3);

    expect(() => cache.delete({
      partialKey: undefined,
      federationGuid: undefined,
      code: undefined
    })).to.throw(Error, "ResolveInstanceKeyArgs must have a partialKey, code, or federationGuid");

    expect(cache.size).to.equal(3);
  });

  it('should clear the cache', () => {
    const cache = new InstanceKeyLRUCache(3);
    cache.set(testArgs1, testResults[0]);
    cache.set(testArgs2, testResults[1]);
    cache.set(testArgs3, testResults[2]);
    expect(cache.size).to.equal(3);

    cache.clear();
    expect(cache.size).to.equal(0);

    const retrievedElem = cache.get(testArgs1);
    expect(retrievedElem).to.be.undefined;
  });

  it('two entries with empty codes should not collide in the instance key cache', () => {
    const emptyCodeArgs: IModelJsNative.ResolveInstanceKeyArgs = {
      federationGuid: "testFedGuid",
      code: Code.createEmpty()
    };

    const emptyCodeResult1: IModelJsNative.ResolveInstanceKeyResult = { id: Id64.fromJSON("0x200"), classFullName: "BisCore:Element" };
    const emptyCodeResult2: IModelJsNative.ResolveInstanceKeyResult = { id: Id64.fromJSON("0x201"), classFullName: "BisCore:Element" };

    const cache = new InstanceKeyLRUCache(10);
    cache.set(emptyCodeArgs, emptyCodeResult1);
    expect(cache.size).to.equal(1);

    cache.set(emptyCodeArgs, emptyCodeResult2);
    const byCode = cache.get({ code: emptyCodeArgs.code });
    expect(byCode, "empty-code lookup should return undefined even after two stores").to.be.undefined;

    expect(cache.get({ partialKey: { id: emptyCodeResult1.id, baseClassName: "" } })).to.equal(emptyCodeResult1);
    expect(cache.get({ partialKey: { id: emptyCodeResult2.id, baseClassName: "" } })).to.equal(emptyCodeResult2);
  });
});
