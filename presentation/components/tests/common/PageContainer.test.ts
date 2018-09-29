/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import PageContainer from "../../lib/common/PageContainer";

describe("PageContainer", () => {

  const createFakeData = (size: number) => {
    const data = new Array<number>();
    while (size--)
      data.push(faker.random.number());
    return data;
  };

  describe("pageSize", () => {

    it("sets different page size and invalidates pages", () => {
      const container = new PageContainer<number>(1, 5);
      const page = container.reservePage(0);
      expect(container.getPage(page.position.index)).to.not.be.undefined;
      container.pageSize = 2;
      expect(container.getPage(page.position.index)).to.be.undefined;
    });

    it("doesn't invalidate pages when setting to the same size", () => {
      const container = new PageContainer<number>(1, 5);
      const page = container.reservePage(0);
      expect(container.getPage(page.position.index)).to.not.be.undefined;
      container.pageSize = 1;
      expect(container.getPage(page.position.index)).to.not.be.undefined;
    });

  });

  describe("getPage", () => {

    it("returns undefined when there are no pages", () => {
      const container = new PageContainer<number>(1, 5);
      expect(container.getPage(0)).to.be.undefined;
    });

    it("returns undefined when requesting non-existing page", () => {
      const container = new PageContainer<number>(1, 5);
      container.reservePage(0);
      expect(container.getPage(1)).to.be.undefined;
    });

    it("returns page at front boundary", () => {
      const container = new PageContainer<number>(3, 5);
      container.reservePage(0);
      container.reservePage(3);
      container.reservePage(6);
      const result = container.getPage(3);
      expect(result!.position.index).to.eq(1);
    });

    it("returns page at back boundary", () => {
      const container = new PageContainer<number>(3, 5);
      container.reservePage(0);
      container.reservePage(3);
      container.reservePage(6);
      const result = container.getPage(5);
      expect(result!.position.index).to.eq(1);
    });

    it("returns page when selecting middle item", () => {
      const container = new PageContainer<number>(3, 5);
      container.reservePage(0);
      container.reservePage(3);
      container.reservePage(6);
      const result = container.getPage(4);
      expect(result!.position.index).to.eq(1);
    });

  });

  describe("getItem", () => {

    it("returns undefined when there are no pages", () => {
      const container = new PageContainer<number>(1, 5);
      expect(container.getItem(0)).to.be.undefined;
    });

    it("returns undefined when requesting non-existing item", () => {
      const container = new PageContainer<number>(1, 5);
      container.reservePage(0).items = createFakeData(1);
      expect(container.getItem(1)).to.be.undefined;
    });

    it("returns item at front page boundary", () => {
      const container = new PageContainer<number>(3, 5);
      container.reservePage(0).items = [111, 223, 333];
      container.reservePage(3).items = [444, 555, 666];
      container.reservePage(6).items = [777, 888, 999];
      expect(container.getItem(3)).to.eq(444);
    });

    it("returns item at back page boundary", () => {
      const container = new PageContainer<number>(3, 5);
      container.reservePage(0).items = [111, 223, 333];
      container.reservePage(3).items = [444, 555, 666];
      container.reservePage(6).items = [777, 888, 999];
      expect(container.getItem(5)).to.eq(666);
    });

    it("returns item from middle of a page", () => {
      const container = new PageContainer<number>(3, 5);
      container.reservePage(0).items = [111, 223, 333];
      container.reservePage(3).items = [444, 555, 666];
      container.reservePage(6).items = [777, 888, 999];
      expect(container.getItem(4)).to.eq(555);
    });

  });

  describe("getIndex", () => {

    it("returns -1 when there are no pages", () => {
      const container = new PageContainer<number>(1, 5);
      expect(container.getIndex(123)).to.eq(-1);
    });

    it("returns -1 when there is a page but no items", () => {
      const container = new PageContainer<number>(1, 5);
      container.reservePage(0);
      expect(container.getIndex(0)).to.eq(-1);
    });

    it("returns -1 when looking for non-existing item", () => {
      const container = new PageContainer<number>(1, 5);
      container.reservePage(0).items = [123];
      expect(container.getIndex(1)).to.eq(-1);
    });

    it("returns valid index when item is found at page front", () => {
      const container = new PageContainer<number>(3, 5);
      container.reservePage(0).items = [111, 223, 333];
      container.reservePage(3).items = [444, 555, 666];
      container.reservePage(6).items = [777, 888, 999];
      expect(container.getIndex(444)).to.eq(3);
    });

    it("returns valid index when item is found at page back", () => {
      const container = new PageContainer<number>(3, 5);
      container.reservePage(0).items = [111, 223, 333];
      container.reservePage(3).items = [444, 555, 666];
      container.reservePage(6).items = [777, 888, 999];
      expect(container.getIndex(666)).to.eq(5);
    });

    it("returns valid index when item is found in the middle of a page", () => {
      const container = new PageContainer<number>(3, 5);
      container.reservePage(0).items = [111, 223, 333];
      container.reservePage(3).items = [444, 555, 666];
      container.reservePage(6).items = [777, 888, 999];
      expect(container.getIndex(555)).to.eq(4);
    });

  });

  describe("reservePage", () => {

    let container: PageContainer<number>;
    beforeEach(() => {
      container = new PageContainer<number>(3, 10);
    });

    it("reserves a page at the front of an empty container", () => {
      const page = container.reservePage(0);
      expect(page.position).to.deep.eq({
        index: 0,
        start: 0,
        end: 2,
      });
    });

    it("reserves a page in the middle of an empty container", () => {
      const page = container.reservePage(5);
      expect(page.position).to.deep.eq({
        index: 0,
        start: 5,
        end: 7,
      });
    });

    it("reserves a page immediately after another page", () => {
      container.reservePage(0);
      const page = container.reservePage(3);
      expect(page.position).to.deep.eq({
        index: 1,
        start: 3,
        end: 5,
      });
    });

    it("reserves a page immediately before another page", () => {
      const page1 = container.reservePage(3);
      const page2 = container.reservePage(0);
      expect(page2.position).to.deep.eq({
        index: 0,
        start: 0,
        end: 2,
      });
      expect(page1.position.index).to.eq(1, "pages should be re-indexed");
    });

    it("reserves a page between other pages when there's enough space", () => {
      container.reservePage(0);
      const page3 = container.reservePage(6);
      const page2 = container.reservePage(3);
      expect(page2.position).to.deep.eq({
        index: 1,
        start: 3,
        end: 5,
      });
      expect(page3.position.index).to.eq(2, "pages should be re-indexed");
    });

    it("moves page start position when it intersects with page before", () => {
      container.reservePage(0);
      const page = container.reservePage(1);
      expect(page.position).to.deep.eq({
        index: 1,
        start: 3,
        end: 5,
      });
    });

    it("moves page start position when it intersects with page after", () => {
      const page2 = container.reservePage(2);
      const page = container.reservePage(1);
      expect(page.position).to.deep.eq({
        index: 0,
        start: 0,
        end: 1,
      });
      expect(page2.position.index).to.eq(1, "pages should be re-indexed");
    });

    it("reserves a page between other pages when there's too little space", () => {
      container.reservePage(0);
      const page3 = container.reservePage(4);
      const page2 = container.reservePage(3);
      expect(page2.position).to.deep.eq({
        index: 1,
        start: 3,
        end: 3,
      });
      expect(page3.position.index).to.eq(2, "pages should be re-indexed");
    });

    it("throws when trying to reserve a page with no space", () => {
      container.reservePage(0);
      expect(() => container.reservePage(0)).to.throw();
    });

  });

  describe("disposeFarthestPages", () => {

    let container: PageContainer<number>;
    beforeEach(() => {
      container = new PageContainer<number>(1, 3);
    });

    it("disposes farthest page in front after reaching max pages", () => {
      container.reservePage(0);
      container.reservePage(1);
      container.reservePage(3);
      expect(container.getPage(0)).to.not.be.undefined;
      container.reservePage(2);
      expect(container.getPage(0)).to.be.undefined;
    });

    it("disposes farthest page in back after reaching max pages", () => {
      container.reservePage(0);
      container.reservePage(2);
      container.reservePage(3);
      expect(container.getPage(3)).to.not.be.undefined;
      container.reservePage(1);
      expect(container.getPage(3)).to.be.undefined;
    });

  });

});
