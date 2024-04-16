/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import * as chai from "chai";
import { GeoJSONGeometryReader } from "../../GeoJSON/GeoJSONGeometryReader";
import { MockGeometryRenderer } from "./Mocks";
import { CoordinatesUtils } from "@itwin/core-frontend";
describe("GeoJSONGeometryReader", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should read point geometry", async () => {
    const renderer = new MockGeometryRenderer();
    const reader = new GeoJSONGeometryReader(renderer);

    const renderPathSpy = sandbox.spy(renderer, "renderPath");
    const renderPointSpy = sandbox.spy(renderer, "renderPoint");
    const coordinates = [10, -10];
    await reader.readGeometry({type: "Point", coordinates});

    const getPointCalls = renderPointSpy.getCalls();
    chai.expect(getPointCalls.length).to.be.equals(1);
    chai.expect(getPointCalls[0].args[0]).to.eql([1]);
    chai.expect(getPointCalls[0].args[1]).to.eql(coordinates);
    chai.expect(renderPathSpy.called).to.be.false;
  });

  it("should read MultiPoint geometry", async () => {
    const renderer = new MockGeometryRenderer();
    const reader = new GeoJSONGeometryReader(renderer);

    const renderPathSpy = sandbox.spy(renderer, "renderPath");
    const renderPointSpy = sandbox.spy(renderer, "renderPoint");
    const coordinates = [[10, -10], [11,-11]];
    await reader.readGeometry({type: "MultiPoint", coordinates});

    const getPointCalls = renderPointSpy.getCalls();
    chai.expect(getPointCalls.length).to.be.equals(1);
    chai.expect(getPointCalls[0].args[0]).to.eql([1,1]);
    const flatCoords: number[] = [];
    CoordinatesUtils.deflateCoordinates(coordinates, flatCoords, 2, 0);

    chai.expect(getPointCalls[0].args[1]).to.eql(flatCoords );
    chai.expect(renderPathSpy.called).to.be.false;
  });

  it("should read LineString geometry", async () => {
    const renderer = new MockGeometryRenderer();
    const reader = new GeoJSONGeometryReader(renderer);

    const renderPathSpy = sandbox.spy(renderer, "renderPath");
    const renderPointSpy = sandbox.spy(renderer, "renderPoint");
    const coordinates = [
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, -10]];

    await reader.readGeometry({type: "LineString", coordinates});

    const getPathsCalls = renderPathSpy.getCalls();
    chai.expect(getPathsCalls.length).to.be.equals(1);
    chai.expect(getPathsCalls[0].args[0]).to.eql([4]);
    chai.expect(getPathsCalls[0].args[1]).to.eql([-10.0, -10.0, 10.0, -10.0, 10.0, 10.0, -10.0, -10.0]);
    chai.expect(getPathsCalls[0].args[2]).to.eql(false);
    chai.expect(getPathsCalls[0].args[3]).to.eql(2);
    chai.expect(renderPointSpy.called).to.be.false;
  });

  it("should read MultiLineString geometry", async () => {
    const renderer = new MockGeometryRenderer();
    const reader = new GeoJSONGeometryReader(renderer);

    const renderPathSpy = sandbox.spy(renderer, "renderPath");
    const renderPointSpy = sandbox.spy(renderer, "renderPoint");
    const coordinates = [
      [
        [-10, -10],
        [10, -10],
        [10, 10],
        [-10, -10],
      ],
      [
        [-5, -5],
        [5, -5],
        [5, 5],
        [-5, -5],
      ],
    ];

    await reader.readGeometry({type: "MultiLineString", coordinates});

    const getPathsCalls = renderPathSpy.getCalls();
    chai.expect(getPathsCalls.length).to.be.equals(1);
    chai.expect(getPathsCalls[0].args[0]).to.eql([4, 4]);
    chai.expect(getPathsCalls[0].args[1]).to.eql([-10.0, -10.0, 10.0, -10.0, 10.0, 10.0, -10.0, -10.0, -5, -5, 5, -5, 5, 5, -5, -5]);
    chai.expect(getPathsCalls[0].args[2]).to.eql(false);
    chai.expect(getPathsCalls[0].args[3]).to.eql(2);
    chai.expect(renderPointSpy.called).to.be.false;
  });

  it("should read polygon geometry", async () => {
    const renderer = new MockGeometryRenderer();
    const reader = new GeoJSONGeometryReader(renderer);

    const renderPathSpy = sandbox.spy(renderer, "renderPath");
    const renderPointSpy = sandbox.spy(renderer, "renderPoint");
    await reader.readGeometry({
      type: "Polygon",
      coordinates: [
        [ /* Ring 1 */
          [-10, -10],
          [10, -10],
          [10, 10],
          [-10, -10],
        ],
        [ /* Ring 2 */
          [-5, -5],
          [5, -5],
          [5, 5],
          [-5, -5],
        ],
      ],
    });

    const getPathsCalls = renderPathSpy.getCalls();
    chai.expect(getPathsCalls.length).to.be.equals(1);
    chai.expect(getPathsCalls[0].args[0]).to.eql([4, 4]);
    chai.expect(getPathsCalls[0].args[1]).to.eql([-10.0, -10.0, 10.0, -10.0, 10.0, 10.0, -10.0, -10.0, -5, -5, 5, -5, 5, 5, -5, -5]);
    chai.expect(renderPointSpy.called).to.be.false;
  });

  it("should read multipolygon geometry", async () => {
    const renderer = new MockGeometryRenderer();
    const reader = new GeoJSONGeometryReader(renderer);

    const renderPathSpy = sandbox.spy(renderer, "renderPath");
    const renderPointSpy = sandbox.spy(renderer, "renderPoint");
    await reader.readGeometry({
      type: "MultiPolygon",
      coordinates: [
        [ /* Polygon 1 */
          [
            [-10.0, -10.0],
            [10.0, -10.0],
            [10.0, 10.0],
            [-10.0, -10.0],
          ],
        ],
        [ /* Polygon 2 */
          [
            [-10.0, -10.0],
            [10.0, -10.0],
            [10.0, 10.0],
            [-10.0, -10.0],
          ],
        ],
      ],
    });

    const getPathsCalls = renderPathSpy.getCalls();
    chai.expect(getPathsCalls.length).to.be.equals(2);
    chai.expect(getPathsCalls[0].args[0]).to.eql([4]);
    chai.expect(getPathsCalls[0].args[1]).to.eql([-10.0, -10.0, 10.0, -10.0, 10.0, 10.0, -10.0, -10.0]);
    chai.expect(getPathsCalls[1].args[0]).to.eql([4]);
    chai.expect(getPathsCalls[1].args[1]).to.eql([-10.0, -10.0, 10.0, -10.0, 10.0, 10.0, -10.0, -10.0]);
    chai.expect(renderPointSpy.called).to.be.false;
  });
});
