/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbResult, GuidString } from "@itwin/core-bentley";
import { VersionedJSON } from "@itwin/core-common";
import { ECVersion } from "@itwin/ecschema-metadata";
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

