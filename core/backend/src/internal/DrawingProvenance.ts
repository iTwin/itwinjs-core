/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbResult, GuidString, Id64, Id64String } from "@itwin/core-bentley";
import { VersionedJSON } from "@itwin/core-common";
import { ECVersion } from "@itwin/ecschema-metadata";
import { IModelDb } from "../IModelDb";
import { ModelSelector } from "../ViewDefinition";
import { SectionDrawing } from "../Element";

const symbol = Symbol("SectionDrawingProvenance");

export interface SectionDrawingProvenance {
  /** @internal */
  readonly [symbol]: unknown;
  /** @internal */
  readonly guids: ReadonlyArray<GuidString>;

  readonly equals: (other: SectionDrawingProvenance) => boolean;
}

class Provenance implements SectionDrawingProvenance {
  public readonly [symbol] = undefined;

  public constructor(public readonly guids: ReadonlyArray<GuidString>) {
    //
  }

  public equals(other: SectionDrawingProvenance): boolean {
    return this.guids.length === other.guids.length && this.guids.every((x, i) => x === other.guids[i]);
  }
}

export namespace SectionDrawingProvenance {
  export const jsonKey = "bentley:section-drawing-annotation-provenance";
  export const jsonVersion = new ECVersion(1, 0, 0).toString();

  export function compute(drawing: SectionDrawing): SectionDrawingProvenance {
    const guids: GuidString[] = [];
    if (!drawing.spatialView.id) {
      return new Provenance(guids);
    }

    const modelSelectorId = drawing.iModel.withPreparedStatement(
      `SELECT ModelSelector.Id FROM bis.SpatialViewDefinition WHERE ECInstanceId=${drawing.spatialView.id}`,
      (stmt) => {
        return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValue(0).getId() : undefined;
      },
    );

    const selector = modelSelectorId ? drawing.iModel.elements.tryGetElement<ModelSelector>(modelSelectorId) : undefined;
    if (selector) {
      drawing.iModel.withPreparedStatement(
        `SELECT GeometryGuid FROM bis.GeometricModel WHERE ECInstanceId IN (${selector.models.join()})`,
        (stmt) => {
          while (DbResult.BE_SQLITE_ROW === stmt.step()) {
            guids.push(stmt.getValue(0).getGuid());
          }
        },
      );

      guids.sort();
    }

    return new Provenance(guids);
  }

  export function store(drawing: SectionDrawing, provenance: SectionDrawingProvenance | undefined): void {
    if (provenance) {
      drawing.jsonProperties[jsonKey] = {
        version: jsonVersion.toString(),
        data: provenance,
      };
    } else {
      delete drawing.jsonProperties[jsonKey];
    }
  }

  export function extract(drawing: SectionDrawing): SectionDrawingProvenance | undefined {
    try {
      const json: VersionedJSON<SectionDrawingProvenance> | undefined = drawing.jsonProperties[jsonKey];
      if (!json || typeof json !== "object" || !json.data || json.version !== jsonVersion) {
        // ###TODO in future may need to migrate older version to current, or reject newer version.
        return undefined;
      }

      return new Provenance(json.data.guids);
    } catch (_) {
      // ###TODO malformed JSON - should be logged.
      return undefined;
    }
  }
}

// exported strictly for tests.
export namespace DrawingProvenance {
  export const jsonKey = "bentley:section-drawing-annotation-provenance";
  export const jsonVersion = new ECVersion(1, 0, 0).toString();

  export interface Props {
    guids: GuidString[];
  }

  export function areEqual(a: Props, b: Props): boolean {
    return a.guids.length === b.guids.length && a.guids.every((x, i) => x === b.guids[i]);
  }

  export function isOutdated(sectionDrawingId: Id64String, spatialViewId: Id64String, iModel: IModelDb): boolean {
    const stored = query(sectionDrawingId, iModel);
    if (!stored) {
      return true;
    }

    const computed = compute(spatialViewId, iModel);
    return !areEqual(stored, computed);
  }

  export function compute(spatialViewId: Id64String, iModel: IModelDb): Props {
    // Consider changing this to instead do the whole thing as a single ECSql statement.
    // The only annoying part is the model selector's Ids are stored on the relationship instead of the element.
    const modelSelectorId = iModel.withPreparedStatement(
      `SELECT ModelSelector.Id FROM bis.SpatialViewDefinition WHERE ECInstanceId=${spatialViewId}`,
      (stmt) => {
        return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValue(0).getId() : undefined;
      },
    );

    const guids: GuidString[] = [];
    const selector = modelSelectorId ? iModel.elements.tryGetElement<ModelSelector>(modelSelectorId) : undefined;
    if (selector) {
      iModel.withPreparedStatement(
        `SELECT GeometryGuid FROM bis.GeometricModel WHERE ECInstanceId IN (${selector.models.join()})`,
        (stmt) => {
          while (DbResult.BE_SQLITE_ROW === stmt.step()) {
            guids.push(stmt.getValue(0).getGuid());
          }
        },
      );

      guids.sort();
    }

    return { guids };
  }

  export function query(sectionDrawingId: Id64String, iModel: IModelDb): Props | undefined {
    return iModel.withPreparedStatement(
      `SELECT JsonProperties FROM bis.SectionDrawing WHERE ECInstanceId=${sectionDrawingId}`,
      (stmt) => {
        const props = DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValue(0).getString() : undefined;
        if (!props) {
          return undefined;
        }

        let json: VersionedJSON<Props>;
        try {
          json = JSON.parse(props)[jsonKey];
          if (!json || !json.data || json.version !== jsonVersion) {
            // ###TODO in future may need to migrate older version to current, or reject newer version.
            return undefined;
          }

          return json.data;
        } catch (_) {
          // malformed JSON ###TODO should probably be logged.
          return undefined;
        }
      },
    )
  }

  export function remove(sectionDrawingId: Id64String, iModel: IModelDb): void {
    const elem = iModel.elements.getElement<SectionDrawing>(sectionDrawingId);
    if (elem.jsonProperties && elem.jsonProperties[jsonKey]) {
      delete elem.jsonProperties[jsonKey];
      elem.update();
    }
  }

  export function update(sectionDrawingId: Id64String, iModel: IModelDb): void {
    const elem = iModel.elements.getElement<SectionDrawing>(sectionDrawingId);
    if (!Id64.isValidId64(elem.spatialView.id)) {
      return;
    }

    const props = compute(elem.spatialView.id, iModel);
    elem.jsonProperties[jsonKey] = {
      version: jsonVersion.toString(),
      data: props,
    };

    elem.update();
  }
}
