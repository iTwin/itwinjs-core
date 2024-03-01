/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import * as chai from "chai";
import { GeoJSONGeometryReader } from "../../OgcFeatures/GeoJSONGeometryReader";
import { ArcGisAttributeDrivenSymbology, ArcGisGeometryRenderer } from "@itwin/core-frontend";
import { Transform } from "@itwin/core-geometry";

class MockGeometryRenderer implements ArcGisGeometryRenderer {
  public transform: Transform | undefined;
  public attributeSymbology?: ArcGisAttributeDrivenSymbology;
  public async renderPath(_geometryLengths: number[], _geometryCoords: number[], _fill: boolean, _stride: number, _relativeCoords: boolean) {

  }
  public async renderPoint(_geometryLengths: number[], _geometryCoords: number[], _stride: number, _relativeCoords: boolean) {

  }
}

describe("GeoJSONGeometryReader", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
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
