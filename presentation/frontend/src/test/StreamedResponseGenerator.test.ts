import { StreamedResponseGenerator, StreamedResponseGeneratorProps } from "../presentation-frontend/StreamedResponseGenerator";
import { expect } from "chai";
import { eachValueFrom } from "rxjs-for-await";
import sinon from "sinon";
import { collectAsyncIterable } from "../presentation-frontend/AsyncGenerators";

async function sleep(millis: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, millis));
}

describe("StreamedResponseGenerator", () => {
  it("should provide same outputs for all getters", async () => {
    const items = [0, 1, 2, 3, 4, 5];
    const pageSize = 2;
    const props: StreamedResponseGeneratorProps<number> = {
      batch: { start: 0, size: pageSize },
      getBatch: async (page) => ({ total: items.length, items: items.slice(page.start, page.start + page.size) }),
    };

    const generator = new StreamedResponseGenerator(props);
    const pageArrayVariations = [await collectAsyncIterable(generator.batchesIterator), await collectAsyncIterable(eachValueFrom(generator.batches))];

    for (const pageArray of pageArrayVariations) {
      expect(pageArray).to.deep.eq([
        [0, 1],
        [2, 3],
        [4, 5],
      ]);
    }

    await expect(generator.getItems()).to.eventually.deep.eq(items);
  });

  it("should run requests concurrently", async () => {
    const items = [...new Array(1000).keys()];
    const props: StreamedResponseGeneratorProps<number> = {
      batch: { start: 0, size: 2 },
      getBatch: async (page) => {
        await sleep(5);
        return {
          total: items.length,
          items: items.slice(page.start, page.start + page.size),
        };
      },
    };

    const generator = new StreamedResponseGenerator(props);
    await collectAsyncIterable(generator.batchesIterator);
  }).timeout(100);

  it("should handle a single page", async () => {
    const items = [1, 2, 3, 4];
    const props: StreamedResponseGeneratorProps<number> = {
      batch: { start: 0, size: 8 },
      getBatch: async (page) => ({ total: items.length, items: items.slice(page.start, page.start + page.size) }),
    };
    const generator = new StreamedResponseGenerator(props);
    const iterator = generator.batchesIterator;
    expect((await iterator.next()).value).to.deep.equal(items);
  });

  it("should handle unevenly divided pages", async () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const props: StreamedResponseGeneratorProps<number> = {
      batch: { start: 0, size: 4 },
      getBatch: async (page) => ({ total: items.length, items: items.slice(page.start, page.start + page.size) }),
    };
    const generator = new StreamedResponseGenerator(props);
    const iterator = generator.batchesIterator;
    expect((await iterator.next()).value).to.deep.equal([1, 2, 3, 4]);
    expect((await iterator.next()).value).to.deep.equal([5, 6, 7]);
  });

  it("should respect the provided parallelism", async () => {
    const items = [...new Array(100).keys()];
    const parallelism = 2;
    const fakePageRetriever = sinon.fake(async (page) => ({
      total: items.length,
      items: items.slice(page.start, page.start + page.size),
    }));
    const props: StreamedResponseGeneratorProps<number> = {
      batch: { start: 0, size: 2 },
      getBatch: fakePageRetriever,
      parallelism,
    };

    const generator = new StreamedResponseGenerator(props);
    const iterator = generator.batchesIterator;

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
    const props: StreamedResponseGeneratorProps<number> = {
      batch: { start: 0, size: pageSize },
      getBatch: fakePageRetriever,
    };

    const generator = new StreamedResponseGenerator(props);
    const iterator = generator.batchesIterator;
    await iterator.next();
    await iterator.next();

    expect(fakePageRetriever.firstCall.args).to.deep.equal([{ start: 0, size: pageSize }, 0]);
    expect(fakePageRetriever.secondCall.args).not.to.deep.equal([{ start: 0, size: pageSize }, 1]);
  });

  it("calls getter once with 0,0 partial page options when given `undefined` page options", async () => {
    const getter = sinon.stub().resolves({ total: 0, items: [] });
    await new StreamedResponseGenerator({ getBatch: getter }).getItems();
    expect(getter).to.be.calledOnceWith({ start: 0, size: 0 });
  });

  it("calls getter once with 0,0 partial page options when given empty page options", async () => {
    const getter = sinon.stub().resolves({ total: 0, items: [] });
    await new StreamedResponseGenerator({ batch: {}, getBatch: getter }).getItems();
    expect(getter).to.be.calledOnceWith({ start: 0, size: 0 });
  });

  it("calls getter once with partial page options equal to given page options", async () => {
    const getter = sinon.stub().resolves({ total: 0, items: [] });
    await new StreamedResponseGenerator({ batch: { start: 1, size: 2 }, getBatch: getter }).getItems();
    expect(getter).to.be.calledOnceWith({ start: 1, size: 2 });
  });

  it("calls getter multiple times until the whole requested page is received when requesting a page of specified size", async () => {
    const getter = sinon.stub();
    const total = 4;
    getter.onFirstCall().resolves({ total, items: [2] });
    getter.onSecondCall().resolves({ total, items: [3] });
    getter.onThirdCall().resolves({ total, items: [4] });

    const generator = new StreamedResponseGenerator({ batch: { start: 1, size: 3 }, getBatch: getter });
    const items = await generator.getItems();

    expect(getter).to.be.calledThrice;
    expect(getter.firstCall).to.be.calledWith({ start: 1, size: 3 });
    expect(getter.secondCall).to.be.calledWith({ start: 2, size: 1 });
    expect(getter.thirdCall).to.be.calledWith({ start: 3, size: 1 });
    expect(items).to.deep.eq([2, 3, 4]);
    expect(generator.total).to.eq(total);
  });

  it("calls getter multiple times until the whole requested page is received when requesting a page of unspecified size", async () => {
    const getter = sinon.stub();
    getter.onFirstCall().resolves({ total: 5, items: [2, 3] });
    getter.onSecondCall().resolves({ total: 5, items: [4, 5] });

    const generator = new StreamedResponseGenerator({ batch: { start: 1 }, getBatch: getter });
    const items = await generator.getItems();
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
    const generator = new StreamedResponseGenerator({ batch: { start: 9 }, getBatch: getter });

    await expect(generator.getItems()).to.eventually.be.rejected;
    expect(getter).to.be.calledOnce;
    expect(getter).to.be.calledWith({ start: 9, size: 0 });
  });

  it("throws when partial request returns no items", async () => {
    const getter = sinon.stub();
    getter.resolves({ total: 5, items: [] });
    const generator = new StreamedResponseGenerator({ batch: { start: 1 }, getBatch: getter });

    await expect(generator.getItems()).to.eventually.be.rejected;
    expect(getter).to.be.calledOnce;
    expect(getter).to.be.calledWith({ start: 1, size: 0 });
  });

  it("throws when partial request returns less items than requested", async () => {
    const getter = sinon.stub();
    getter.onFirstCall().resolves({ total: 5, items: [2, 3] });
    getter.onSecondCall().resolves({ total: 5, items: [] });
    const generator = new StreamedResponseGenerator({ batch: { start: 1 }, getBatch: getter });

    await expect(generator.getItems()).to.eventually.be.rejected;
    expect(getter).to.be.called;
  });
});
