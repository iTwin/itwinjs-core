/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { RenderMemory } from "../../../render/RenderMemory";

function expectMemory(consumer: RenderMemory.Consumers, total: number, max: number, count: number) {
  expect(consumer.totalBytes).to.equal(total);
  expect(consumer.maxBytes).to.equal(max);
  expect(consumer.count).to.equal(count);
}

describe("RenderMemory", () => {
  it("should accumulate correctly", () => {
    const stats = new RenderMemory.Statistics();

    stats.addTexture(20);
    stats.addTexture(10);
    expect(stats.totalBytes).to.equal(30);
    expectMemory(stats.textures, 30, 20, 2);

    stats.addVertexTable(10);
    stats.addVertexTable(20);
    expect(stats.totalBytes).to.equal(60);
    expectMemory(stats.vertexTables, 30, 20, 2);

    expectMemory(stats.buffers, 0, 0, 0);

    stats.addSurface(20);
    stats.addPolyline(30);
    stats.addPolyline(10);
    expect(stats.totalBytes).to.equal(120);
    expectMemory(stats.buffers, 60, 30, 3);
    expectMemory(stats.buffers.surfaces, 20, 20, 1);
    expectMemory(stats.buffers.polylines, 40, 30, 2);
    expectMemory(stats.buffers.pointStrings, 0, 0, 0);

    stats.clear();
    expect(stats.totalBytes).to.equal(0);
    expectMemory(stats.textures, 0, 0, 0);
    expectMemory(stats.vertexTables, 0, 0, 0);
    expectMemory(stats.buffers, 0, 0, 0);
    expectMemory(stats.buffers.surfaces, 0, 0, 0);
    expectMemory(stats.buffers.polylines, 0, 0, 0);
    expectMemory(stats.buffers.pointStrings, 0, 0, 0);
  });
});
