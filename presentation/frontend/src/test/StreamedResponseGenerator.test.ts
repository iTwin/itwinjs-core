import { StreamedResponseGenerator, StreamedResponseGeneratorProps } from "../presentation-frontend/StreamedResponseGenerator";
import { expect } from "chai";
import sinon from "sinon";
import { PageOptions } from "@itwin/presentation-common";

async function sleep(millis: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, millis));
}

describe("StreamedResponseGenerator", () => {
  it("should run requests concurrently", async () => {
    const items = [...new Array(1000).keys()];
    const props: StreamedResponseGeneratorProps<number> = {
      getBatch: async (page) => {
        await sleep(5);
        return {
          total: items.length,
          items: items.slice(page.start, page.start + 10),
        };
      },
    };

    const generator = new StreamedResponseGenerator(props);
    await generator.getItems();
  }).timeout(100);

  it("should handle a page larger than the item count", async () => {
    const items = [1, 2, 3, 4];
    const props: StreamedResponseGeneratorProps<number> = {
      paging: { start: 0, size: 8 },
      getBatch: async (page) => ({ total: items.length, items: items.slice(page.start, page.start + page.size) }),
    };
    const generator = new StreamedResponseGenerator(props);
    const receivedValues = await generator.getItems();
    expect(receivedValues).to.deep.equal(items);
  });

  it("should respect the provided parallelism", async () => {
    const items = [...new Array(100).keys()];
    const parallelism = 2;
    const fakePageRetriever = sinon.fake(async (page) => ({
      total: items.length,
      items: items.slice(page.start, page.start + 10),
    }));
    const props: StreamedResponseGeneratorProps<number> = {
      getBatch: fakePageRetriever,
      parallelism,
    };

    const generator = new StreamedResponseGenerator(props);
    const iterator = generator.itemsIterator;

    // The call for the first page should happen immediately
    expect(fakePageRetriever).to.be.calledOnce;

    // Then after polling the first page, it should prefetch `2 * parallelism` pages in advance.
    await iterator.next();
    expect(fakePageRetriever.callCount).to.equal(parallelism * 2 + 1);
  });

  it("should fetch items up to requested page size", async () => {
    const items = [...new Array(100).keys()];
    const fakePageRetriever = sinon.fake(async (page) => ({
      total: items.length,
      items: items.slice(page.start, page.start + 2),
    }));
    const props: StreamedResponseGeneratorProps<number> = {
      paging: { size: 6 },
      getBatch: fakePageRetriever,
    };

    const generator = new StreamedResponseGenerator(props);
    const generatedItems = await generator.getItems();

    expect(generatedItems).to.deep.eq([0, 1, 2, 3, 4, 5]);
    expect(fakePageRetriever).to.be.calledThrice;
  });

  it("should fetch each batch once", async () => {
    const items = [0, 1, 2, 3, 4, 5, 6];
    const requestedBatches = new Set<Required<PageOptions>>();
    const fakePageRetriever = sinon.fake(async (page) => {
      if (requestedBatches.has(page)) {
        throw new Error(`Page requested multiple times: ${JSON.stringify(page)}`);
      }

      requestedBatches.add(page);
      return {
        total: items.length,
        items: items.slice(page.start, page.start + 2),
      };
    });

    const props: StreamedResponseGeneratorProps<number> = {
      getBatch: fakePageRetriever,
    };

    const generator = new StreamedResponseGenerator(props);
    await generator.getItems();
  });

  it("calls getter once with 0,0 partial page options when given `undefined` page options", async () => {
    const getter = sinon.stub().resolves({ total: 0, items: [] });
    await new StreamedResponseGenerator({ getBatch: getter }).getItems();
    expect(getter).to.be.calledOnceWith({ start: 0, size: 0 });
  });

  it("calls getter once with 0,0 partial page options when given empty page options", async () => {
    const getter = sinon.stub().resolves({ total: 0, items: [] });
    await new StreamedResponseGenerator({ paging: {}, getBatch: getter }).getItems();
    expect(getter).to.be.calledOnceWith({ start: 0, size: 0 });
  });

  it("calls getter once with partial page options equal to given page options", async () => {
    const getter = sinon.stub().resolves({ total: 0, items: [] });
    await new StreamedResponseGenerator({ paging: { start: 1, size: 2 }, getBatch: getter }).getItems();
    expect(getter).to.be.calledOnceWith({ start: 1, size: 2 });
  });

  it("calls getter multiple times until the whole requested page is received when requesting a page of specified size", async () => {
    const getter = sinon.stub();
    const total = 5;
    getter.onFirstCall().resolves({ total, items: [2] });
    getter.onSecondCall().resolves({ total, items: [3] });
    getter.onThirdCall().resolves({ total, items: [4] });

    const generator = new StreamedResponseGenerator({ paging: { start: 1, size: 3 }, getBatch: getter });
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

    const generator = new StreamedResponseGenerator({ paging: { start: 1 }, getBatch: getter });
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
    const generator = new StreamedResponseGenerator({ paging: { start: 9 }, getBatch: getter });

    await expect(generator.getItems()).to.eventually.be.rejected;
    expect(getter).to.be.calledOnce;
    expect(getter).to.be.calledWith({ start: 9, size: 0 });
  });

  it("throws when partial request returns no items", async () => {
    const getter = sinon.stub();
    getter.resolves({ total: 5, items: [] });
    const generator = new StreamedResponseGenerator({ paging: { start: 1 }, getBatch: getter });

    await expect(generator.getItems()).to.eventually.be.rejected;
    expect(getter).to.be.calledOnce;
    expect(getter).to.be.calledWith({ start: 1, size: 0 });
  });

  it("throws when partial request returns less items than requested", async () => {
    const getter = sinon.stub();
    getter.onFirstCall().resolves({ total: 5, items: [2, 3] });
    getter.onSecondCall().resolves({ total: 5, items: [] });
    const generator = new StreamedResponseGenerator({ paging: { start: 1 }, getBatch: getter });

    await expect(generator.getItems()).to.eventually.be.rejected;
    expect(getter).to.be.called;
  });
});
