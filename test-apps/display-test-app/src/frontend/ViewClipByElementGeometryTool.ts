/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  ClipPrimitive, ClipVector, ConvexClipPlaneSet, IndexedPolyface, Point3d, PolyfaceBuilder, UnionOfConvexClipPlaneSets,
} from "@itwin/core-geometry";
import {
  ElementMeshOptions, readElementMeshes,
} from "@itwin/core-common";
import {
  BeButtonEvent, CoordinateLockOverrides, EventHandled, IModelApp, LocateResponse, ViewClipTool, Viewport,
} from "@itwin/core-frontend";
import {
  ConvexMeshDecomposition, Options as DecompositionOptions,
} from "vhacd-js";

interface Settings extends ElementMeshOptions {
  computeConvexHulls: boolean;
  decomposition: DecompositionOptions;
  offset?: number;
}

class ConvexDecomposer {
  private readonly _impl: ConvexMeshDecomposition;
  private readonly _opts: DecompositionOptions;

  private constructor(impl: ConvexMeshDecomposition, options: DecompositionOptions) {
    this._impl = impl;
    this._opts = options;
  }

  public static async create(options: DecompositionOptions): Promise<ConvexDecomposer> {
    const impl = await ConvexMeshDecomposition.create();
    return new ConvexDecomposer(impl, options);
  }

  public decompose(polyfaces: IndexedPolyface[]): IndexedPolyface[] {
    const decomposedPolyfaces: IndexedPolyface[] = [];
    const polygon = [new Point3d(), new Point3d(), new Point3d()];

    for (const polyface of polyfaces) {
      const points = polyface.data.point;
      const positions = new Float64Array(points.float64Data().buffer, 0, points.float64Length);
      const indices = new Uint32Array(polyface.data.pointIndex);
      if (indices.length === 0 || positions.length === 0)
        continue;

      const meshes = this._impl.computeConvexHulls({ positions, indices }, this._opts);
      for (const mesh of meshes) {
        const builder = PolyfaceBuilder.create();
        for (let i = 0; i < mesh.indices.length; i += 3) {
          for (let j = 0; j < 3; j++)
            this.getPoint(mesh.indices[i + j], mesh.positions, polygon[j]);

          builder.addPolygon(polygon);
        }

        decomposedPolyfaces.push(builder.claimPolyface());
      }
    }

    return decomposedPolyfaces;
  }

  private getPoint(index: number, positions: Float64Array, output: Point3d): void {
    index *= 3;
    output.set(positions[index + 0], positions[index + 1], positions[index + 2]);
  }
}

// Out of laziness, settings are global.
const settings: Settings = {
  computeConvexHulls: true,
  chordTolerance: 0.1,
  decomposition: {
    maxHulls: 10,
    maxVerticesPerHull: 16,
  },
};

export class ViewClipByElementGeometryTool extends ViewClipTool {
  public static override toolId = "DtaClipByElementGeometry";
  public static override iconSpec = "icon-section-element";

  public override async onPostInstall() {
    await super.onPostInstall();
    if (this.targetView && this.targetView.iModel.selectionSet.isActive) {
      await this.doClipToSelectedElements(this.targetView);
      return;
    }

    this.initLocateElements(true, false, "default", CoordinateLockOverrides.All);
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!this.targetView)
      return EventHandled.No;

    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (!hit || !hit.isElementHit)
      return EventHandled.No;

    return await this.doClipToElements(this.targetView, new Set<string>([hit.sourceId])) ? EventHandled.Yes : EventHandled.No;
  }

  private async doClipToSelectedElements(viewport: Viewport): Promise<boolean> {
    if (await this.doClipToElements(viewport, viewport.iModel.selectionSet.elements))
      return true;

    await this.exitTool();
    return false;
  }

  private async doClipToElements(viewport: Viewport, ids: Set<string>): Promise<boolean> {
    try {
      const union = UnionOfConvexClipPlaneSets.createEmpty();
      const decomposer = settings.computeConvexHulls ? await ConvexDecomposer.create(settings.decomposition) : undefined;

      for (const source of ids) {
        const meshData = await viewport.iModel.generateElementMeshes({ ...settings, source });
        let polyfaces = readElementMeshes(meshData);
        if (decomposer)
          polyfaces = decomposer.decompose(polyfaces);

        for (const polyface of polyfaces)
          union.addConvexSet(ConvexClipPlaneSet.createConvexPolyface(polyface).clipper);
      }

      ViewClipTool.enableClipVolume(viewport);
      const primitive = ClipPrimitive.createCapture(union);
      const clip = ClipVector.createCapture([primitive]);
      ViewClipTool.setViewClip(viewport, clip);

      this._clipEventHandler?.onNewClip(viewport);

      await this.onReinitialize();
      return true;
    } catch {
      return false;
    }
  }
}
