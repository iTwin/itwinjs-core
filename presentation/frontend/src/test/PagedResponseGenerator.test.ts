import { PagedResponseGenerator, PagedResponseGeneratorProps } from "../presentation-frontend/PagedResponseGenerator";
import { expect } from "chai";
import { eachValueFrom } from "rxjs-for-await";
import sinon from "sinon";

async function collectGenerator<T>(generator: AsyncIterableIterator<T>) {
  const result = [];
  for await (const item of generator) {
    result.push(item);
  }
  return result;
}

async function sleep(millis: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, millis));
}

describe.only("PagedResponseGenerator", () => {
  it("should run requests concurrently", async () => {
    const items = [...new Array(1000).keys()];
    const props: PagedResponseGeneratorProps<number> = {
      pageOptions: { start: 0, size: 2 },
      getPage: async (page) => {
        await sleep(5);
        return {
          total: items.length,
          items: items.slice(page.start, page.start + page.size),
        };
      },
    };

    const generator = new PagedResponseGenerator(props);
    await collectGenerator(generator.iterator);
  }).timeout(100);

  // it("should produce valid and sequential pages", async () => {
  //   const items = [0, 1, 2, 3, 4, 5];
  //   const pageSize = 2;
  //   const props: PagedResponseGeneratorProps<number> = {
  //     pageOptions: { start: 0, size: pageSize },
  //     getPage: async (page) => ({ total: items.length, items: items.slice(page.start, page.start + page.size) }),
  //   };
  //   const generator = new PagedResponseGenerator(props);
  //   let index = 0;
  //   for await (const page of generator.iterator) {
  //     expect(page).to.have.lengthOf(pageSize);
  //     expect(page[0]).to.equal(index * pageSize);
  //     expect(page[1]).to.equal(index * pageSize + 1);
  //     index++;
  //   }
  // });

  // it("should handle a single page", async () => {
  //   const items = [1, 2, 3, 4];
  //   const props: PagedResponseGeneratorProps<number> = {
  //     pageOptions: { start: 0, size: 8 },
  //     getPage: async (page) => ({ total: items.length, items: items.slice(page.start, page.start + page.size) }),
  //   };
  //   const generator = new PagedResponseGenerator(props);
  //   const iterator = generator.iterator;
  //   expect((await iterator.next()).value).to.deep.equal(items);
  // });

  // it("should handle unevenly divided pages", async () => {
  //   const items = [1, 2, 3, 4, 5, 6, 7];
  //   const props: PagedResponseGeneratorProps<number> = {
  //     pageOptions: { start: 0, size: 4 },
  //     getPage: async (page) => ({ total: items.length, items: items.slice(page.start, page.start + page.size) }),
  //   };
  //   const generator = new PagedResponseGenerator(props);
  //   const iterator = generator.iterator;
  //   expect((await iterator.next()).value).to.deep.equal([1, 2, 3, 4]);
  //   expect((await iterator.next()).value).to.deep.equal([5, 6, 7]);
  // });

  it("should respect the provided parallelism", async () => {
    const items = [...new Array(100).keys()];
    const parallelism = 2;
    const fakePageRetriever = sinon.fake(async (page) => ({
      total: items.length,
      items: items.slice(page.start, page.start + page.size),
    }));
    const props: PagedResponseGeneratorProps<number> = {
      pageOptions: { start: 0, size: 2 },
      getPage: fakePageRetriever,
      parallelism,
    };

    const generator = new PagedResponseGenerator(props);
    const iterator = generator.iterator;

    // The call for the first page should happen immediately
    expect(fakePageRetriever).to.be.calledOnce;

    // Then after polling the first page, it should prefetch `2 * parallelism` pages in advance.
    await iterator.next();
    expect(fakePageRetriever.callCount).to.equal(parallelism * 2 + 1);
  });

  it("should reuse the first page", async () => {
    const items = [0, 1, 2, 3, 4, 5, 6];
    const pageSize = 2;
    const fakePageRetriever = sinon.fake(async (page) => ({
      total: items.length,
      items: items.slice(page.start, page.start + page.size),
    }));
    const props: PagedResponseGeneratorProps<number> = {
      pageOptions: { start: 0, size: pageSize },
      getPage: fakePageRetriever,
    };

    const generator = new PagedResponseGenerator(props);
    const iterator = generator.iterator;
    await iterator.next();
    await iterator.next();

    const firstCallArgs = [{ start: 0, size: pageSize }];
    expect(fakePageRetriever.firstCall.args).to.deep.equal(firstCallArgs);
    expect(fakePageRetriever.getCall(1).args).not.to.deep.equal(firstCallArgs);
  });

  it("calls getter once with 0,0 partial page options when given `undefined` page options", async () => {
    const getter = sinon.stub().resolves({ total: 0, items: [] });
    await new PagedResponseGenerator({ getPage: getter }).getAllItems();
    expect(getter).to.be.calledOnceWith({ start: 0, size: 0 });
  });

  it("calls getter once with 0,0 partial page options when given empty page options", async () => {
    const getter = sinon.stub().resolves({ total: 0, items: [] });
    await new PagedResponseGenerator({ pageOptions: {}, getPage: getter }).getAllItems();
    expect(getter).to.be.calledOnceWith({ start: 0, size: 0 });
  });

  it("calls getter once with partial page options equal to given page options", async () => {
    const getter = sinon.stub().resolves({ total: 0, items: [] });
    await new PagedResponseGenerator({ pageOptions: { start: 1, size: 2 }, getPage: getter }).getAllItems();
    expect(getter).to.be.calledOnceWith({ start: 1, size: 2 });
  });

  xit("calls getter multiple times until the whole requested page is received when requesting a page of specified size", async () => {
    const getter = sinon.stub();
    getter.onFirstCall().resolves({ total: 5, items: [2] });
    getter.onSecondCall().resolves({ total: 5, items: [3] });
    getter.onThirdCall().resolves({ total: 5, items: [4] });

    const generator = new PagedResponseGenerator({ pageOptions: { start: 1, size: 3 }, getPage: getter });
    const items = await generator.getAllItems();
    const total = generator.total;

    expect(getter).to.be.calledThrice;
    expect(getter.firstCall).to.be.calledWith({ start: 1, size: 3 });
    expect(getter.secondCall).to.be.calledWith({ start: 2, size: 2 });
    expect(getter.thirdCall).to.be.calledWith({ start: 3, size: 1 });
    expect(items).to.deep.eq([2, 3, 4]);
    expect(total).to.eq(5);
  });

  it("calls getter multiple times until the whole requested page is received when requesting a page of unspecified size", async () => {
    const getter = sinon.stub();
    getter.onFirstCall().resolves({ total: 5, items: [2, 3] });
    getter.onSecondCall().resolves({ total: 5, items: [4, 5] });

    const generator = new PagedResponseGenerator({ pageOptions: { start: 1 }, getPage: getter });
    const items = await generator.getAllItems();
    const total = generator.total;

    expect(getter).to.be.calledTwice;
    expect(getter.firstCall).to.be.calledWith({ start: 1, size: 0 });
    expect(getter.secondCall).to.be.calledWith({ start: 3, size: 2 });
    expect(items).to.deep.eq([2, 3, 4, 5]);
    expect(total).to.eq(5);
  });

  it("throws when page start index is larger than total number of items", async () => {
    const getter = sinon.stub();
    getter.resolves({ total: 5, items: [] });
    const generator = new PagedResponseGenerator({ pageOptions: { start: 9 }, getPage: getter });

    await expect(generator.getAllItems()).to.eventually.be.rejected;
    expect(getter).to.be.calledOnce;
    expect(getter).to.be.calledWith({ start: 9, size: 0 });
  });

  it("throws when partial request returns no items", async () => {
    const getter = sinon.stub();
    getter.resolves({ total: 5, items: [] });
    const generator = new PagedResponseGenerator({ pageOptions: { start: 1 }, getPage: getter });

    await expect(generator.getAllItems()).to.eventually.be.rejected;
    expect(getter).to.be.calledOnce;
    expect(getter).to.be.calledWith({ start: 1, size: 0 });
  });

  it("throws when partial request returns less items than requested", async () => {
    const getter = sinon.stub();
    getter.onFirstCall().resolves({ total: 5, items: [2, 3] });
    getter.onSecondCall().resolves({ total: 5, items: [] });
    const generator = new PagedResponseGenerator({ pageOptions: { start: 1 }, getPage: getter });

    await expect(generator.getAllItems()).to.eventually.be.rejected;
    expect(getter).to.be.called;
  });

  describe("generator and observable", () => {
    it("should have same outputs", async () => {
      const items = [0, 1, 2, 3, 4, 5];
      const pageSize = 2;
      const props: PagedResponseGeneratorProps<number> = {
        pageOptions: { start: 0, size: pageSize },
        getPage: async (page) => ({ total: items.length, items: items.slice(page.start, page.start + page.size) }),
      };

      const pageGenerator = new PagedResponseGenerator(props);
      const iteratorValues = await collectGenerator(pageGenerator.iterator);
      const observableValues = await collectGenerator(eachValueFrom(pageGenerator.observable));

      expect(iteratorValues).to.deep.equal(observableValues);
    });
  });
});
