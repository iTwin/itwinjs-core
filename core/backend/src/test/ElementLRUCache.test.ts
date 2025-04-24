import { expect } from "chai";
import { CachedElement, ElementLRUCache } from "../internal/ElementLRUCache";

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
});