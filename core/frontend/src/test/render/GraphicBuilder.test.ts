/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  Cone, Point3d, PolyfaceBuilder, Range3d, Sphere, StrokeOptions, Transform,
} from "@itwin/core-geometry";
import { ColorByName, ColorIndex, EmptyLocalization, FeatureIndex, FillFlags, QParams3d, QPoint3dList, RenderMode } from "@itwin/core-common";
import { GraphicBuilder, ViewportGraphicBuilderOptions } from "../../render/GraphicBuilder";
import { IModelApp, IModelAppOptions } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { createBlankConnection } from "../createBlankConnection";
import { RenderSystem } from "../../render/RenderSystem";
import { ScreenViewport } from "../../Viewport";
import { MeshParams } from "../../common/internal/render/MeshParams";
import { SurfaceType } from "../../common/internal/render/SurfaceParams";
import { MeshArgs } from "../../common/internal/render/MeshPrimitives";
import { MeshGraphic } from "../../render/webgl/Mesh";
import { InstancedGraphicParams } from "../../common";
import { openBlankViewport } from "../openBlankViewport";
import { GraphicType } from "../../common/render/GraphicType";

describe("GraphicBuilder", () => {
  let imodel: IModelConnection;
  let viewport: ScreenViewport;

  before(async () => {
    const opts: IModelAppOptions = {
      // One test wants to confirm number of segment and silhouette edges produced - disable indexed edges.
      tileAdmin: { enableIndexedEdges: false },
      localization: new EmptyLocalization(),
    };
    await IModelApp.startup(opts);
    imodel = createBlankConnection();
  });

  beforeEach(() => {
    viewport = openBlankViewport();
  });

  afterEach(() => viewport.dispose());

  after(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  type BuilderOpts = Omit<ViewportGraphicBuilderOptions, "viewport" | "type">;

  function makeBuilder(type: GraphicType, options: BuilderOpts): GraphicBuilder {
    return IModelApp.renderSystem.createGraphic({ type, viewport, ...options });
  }

  const graphicTypes = [GraphicType.ViewBackground, GraphicType.Scene, GraphicType.WorldDecoration, GraphicType.WorldOverlay, GraphicType.ViewOverlay];

  describe("generates normals", () => {
    function expectNormals(type: GraphicType, options: BuilderOpts, expected: boolean): void {
      const builder = makeBuilder(type, options);
      expect(builder.wantNormals).to.equal(expected);
    }

    it("for scene graphics only by default", () => {
      for (const type of graphicTypes)
        expectNormals(type, {}, type === GraphicType.Scene);
    });

    it("always if generating edges", () => {
      expect(viewport.viewFlags.edgesRequired()).to.be.true;
      for (const type of graphicTypes) {
        expectNormals(type, { generateEdges: true }, true);
        expectNormals(type, { generateEdges: false }, type === GraphicType.Scene);
        expectNormals(type, { generateEdges: true, wantNormals: false }, false);
      }
    });

    it("always if explicitly requested", () => {
      for (const type of graphicTypes)
        expectNormals(type, { wantNormals: true }, true);
    });

    it("never if explicitly specified", () => {
      for (const type of graphicTypes)
        expectNormals(type, { wantNormals: false }, false);
    });
  });

  describe("generates edges", () => {
    function expectEdges(type: GraphicType, options: BuilderOpts, expected: boolean): void {
      const builder = makeBuilder(type, options);
      expect(builder.wantEdges).to.equal(expected);
    }

    it("by default only for scene graphics, if view flags require them", () => {
      expect(viewport.viewFlags.edgesRequired()).to.be.true;
      for (const type of graphicTypes)
        expectEdges(type, {}, type === GraphicType.Scene);
    });

    it("never, if view flags do not require them", () => {
      const vf = viewport.viewFlags.copy({ renderMode: RenderMode.SmoothShade, visibleEdges: false });
      viewport.viewFlags = vf;
      expect(viewport.viewFlags.edgesRequired()).to.be.false;

      for (const type of graphicTypes)
        expectEdges(type, {}, false);
    });

    it("always if explicitly requested", () => {
      for (const type of graphicTypes)
        expectEdges(type, { generateEdges: true }, true);
    });

    it("never if explicitly specified", () => {
      for (const type of graphicTypes)
        expectEdges(type, { generateEdges: false }, false);
    });
  });

  describe("createTriMesh", () => {
    it("should create a simple mesh graphic", () => {
      const points = [new Point3d(0, 0, 0), new Point3d(10, 0, 0), new Point3d(0, 10, 0)];
      const qpoints = new QPoint3dList(QParams3d.fromRange(Range3d.createArray(points)));
      for (const point of points)
        qpoints.add(point);

      const colors = new ColorIndex();
      colors.initUniform(ColorByName.tan);

      const args: MeshArgs = {
        points: qpoints,
        vertIndices: [0, 1, 2],
        colors,
        fillFlags: FillFlags.None,
        features: new FeatureIndex(),
      };

      const graphic = IModelApp.renderSystem.createTriMesh(args);
      expect(graphic).not.to.be.undefined;
    });
  });

  describe("createMesh", () => {
    let renderSystemCreateMesh: typeof RenderSystem.prototype.createMesh;
    let createMeshInvoked = false;

    afterEach(() => {
      if (renderSystemCreateMesh)
        IModelApp.renderSystem.createMesh = renderSystemCreateMesh; // eslint-disable-line @typescript-eslint/unbound-method
    });

    function overrideCreateMesh(verifyParams?: (params: MeshParams) => void, verifyGraphic?: (graphic: MeshGraphic) => void): void {
      if (!renderSystemCreateMesh)
        renderSystemCreateMesh = IModelApp.renderSystem.createMesh; // eslint-disable-line @typescript-eslint/unbound-method

      createMeshInvoked = false;

      // eslint-disable-next-line @typescript-eslint/unbound-method
      IModelApp.renderSystem.createMesh = (params: MeshParams, instances?: InstancedGraphicParams) => {
        createMeshInvoked = true;
        if (verifyParams)
          verifyParams(params);

        const graphic = renderSystemCreateMesh.apply(IModelApp.renderSystem, [params, instances]) as MeshGraphic;
        expect(graphic).instanceof(MeshGraphic);
        if (verifyGraphic)
          verifyGraphic(graphic);

        return graphic;
      };
    }

    function injectNormalsCheck(expectNormals: boolean): void {
      const verifyParams = (params: MeshParams) => {
        expect(params.vertices.numRgbaPerVertex).to.equal(5);
      };
      const verifyGraphic = (graphic: MeshGraphic) => {
        expect(graphic.meshData.type).to.equal(expectNormals ? SurfaceType.Lit : SurfaceType.Unlit);
      };

      overrideCreateMesh(verifyParams, verifyGraphic);
    }

    function createTriangle(): Point3d[] {
      return [ new Point3d(0, 0, 0), new Point3d(100, 0, 0), new Point3d(0, 100, 0) ];
    }

    it("should preserve polyface normals", () => {
      const test = (wantNormals: boolean, requestNormals: boolean) => {
        // If normals are present and wanted, use them.
        // If present and unwanted, ignore them.
        // If wanted but not present, generate them.
        injectNormalsCheck(requestNormals);
        expect(createMeshInvoked).to.be.false;

        const options = StrokeOptions.createForFacets();
        options.needNormals = wantNormals;
        const pfBuilder = PolyfaceBuilder.create(options);
        pfBuilder.addTriangleFacet(createTriangle());

        const gfBuilder = IModelApp.renderSystem.createGraphic({ placement: Transform.createIdentity(), type: GraphicType.WorldDecoration, viewport, wantNormals: requestNormals });
        gfBuilder.addPolyface(pfBuilder.claimPolyface(), false);
        const gf = gfBuilder.finish();
        gf.dispose();
        expect(createMeshInvoked).to.be.true;
      };

      test(false, false);
      test(true, true);
      test(false, true);
      test(true, false);
    });

    it("should generate normals for shapes if requested", () => {
      const test = (wantNormals: boolean) => {
        injectNormalsCheck(wantNormals);
        expect(createMeshInvoked).to.be.false;

        const builder = IModelApp.renderSystem.createGraphic({ placement: Transform.createIdentity(), type: GraphicType.WorldDecoration, viewport, wantNormals });
        builder.addShape(createTriangle());
        const gf = builder.finish();
        gf.dispose();
        expect(createMeshInvoked).to.be.true;
      };

      test(false);
      test(true);
    });

    it("should produce edges", () => {
      function expectEdges(expected: "silhouette" | "segment" | "both" | "none", addToGraphic: (builder: GraphicBuilder) => void, generateEdges?: boolean): void {
        let expectSilhouettes = false;
        let expectSegments = false;
        switch (expected) {
          case "both":
            expectSilhouettes = expectSegments = true;
            break;
          case "silhouette":
            expectSilhouettes = true;
            break;
          case "segment":
            expectSegments = true;
            break;
        }

        const verifyParams = (params: MeshParams) => {
          expect(undefined === params.edges).to.equal("none" === expected);
          expect(params.edges?.polylines).to.be.undefined;
          if (params.edges) {
            expect(undefined !== params.edges.segments).to.equal(expectSegments);
            expect(undefined !== params.edges.silhouettes).to.equal(expectSilhouettes);
          }
        };

        expect(viewport.viewFlags.edgesRequired()).to.be.true;

        overrideCreateMesh(verifyParams);
        expect(createMeshInvoked).to.be.false;

        const builder = IModelApp.renderSystem.createGraphic({ placement: Transform.createIdentity(), type: GraphicType.Scene, viewport, generateEdges });
        expect(builder.wantEdges).to.equal(generateEdges ?? true);
        addToGraphic(builder);

        const gf = builder.finish();
        gf.dispose();
        expect(createMeshInvoked).to.be.true;
      }

      expectEdges("silhouette", (builder) => {
        builder.addSolidPrimitive(Sphere.createCenterRadius(new Point3d(0, 0, 0), 1));
      });

      expectEdges("segment", (builder) => {
        builder.addShape([new Point3d(0, 0, 0), new Point3d(0, 1, 0), new Point3d(0, 1, 1), new Point3d(0, 0, 0)]);
      });

      expectEdges("both", (builder) => {
        const cone = Cone.createAxisPoints(new Point3d(0, 0, 0), new Point3d(0, 0, 1), 0.5, 0.25, true)!;
        expect(cone).not.to.be.undefined;
        builder.addSolidPrimitive(cone);
      });

      expectEdges("none", (builder) => {
        builder.addSolidPrimitive(Sphere.createCenterRadius(new Point3d(0, 0, 0), 1));
      }, false);
    }).timeout(20000); // macOS is slow.
  });
});
