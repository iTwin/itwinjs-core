/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { DbResult, GuidString } from "@itwin/core-bentley";
import { VersionedJSON } from "@itwin/core-common";
import { ECVersion } from "@itwin/ecschema-metadata";
import { ModelSelector } from "./ViewDefinition";
import { SectionDrawing } from "./Element";

const symbol = Symbol("SectionDrawingProvenance");

/** An opaque representation of the state of the iModel at the time at which a SectionDrawing's
 * annotations were most recently generated.
 * The provenance is written to the drawing's `jsonProperties` each time its annotations are updated.
 * [[SectionDrawingMonitor]] uses this to detect drawings that need to regenerate their annotations due
 * to changes to the iModel's contents.
 * @public
 */
export interface SectionDrawingProvenance {
  /** Ensures that no code outside of this file can create an instance of this interface.
   * @internal implementation detail
   */
  readonly [symbol]: unknown;
  /** The geometry guids of all of the models viewed by the drawing's spatial view at the time at which
   * the drawings annotations were most recently generated.
   * @internal implementation detail
   */
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

/** @public */
export namespace SectionDrawingProvenance {
  /** @internal */
  export const jsonKey = "bentley:section-drawing-annotation-provenance";
  /** @internal */
  export const jsonVersion = new ECVersion(1, 0, 0).toString();

  /** Calculate the provenance for the specified drawing based on the iModel's current contents. */
  export function compute(drawing: SectionDrawing): SectionDrawingProvenance {
    const guids: GuidString[] = [];
    if (!drawing.spatialView.id) {
      return new Provenance(guids);
    }

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const modelSelectorId = drawing.iModel.withPreparedStatement(
      `SELECT ModelSelector.Id FROM bis.SpatialViewDefinition WHERE ECInstanceId=${drawing.spatialView.id}`,
      (stmt) => {
        return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValue(0).getId() : undefined;
      },
    );

    const selector = modelSelectorId ? drawing.iModel.elements.tryGetElement<ModelSelector>(modelSelectorId) : undefined;
    if (selector) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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

  /** Write the provenance to the drawing's JSON properties, or delete it if `provenance` is `undefined`. */
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

  /** Decode the drawing's provenance from its JSON properties, if present. */
  export function extract(drawing: SectionDrawing): SectionDrawingProvenance | undefined {
    try {
      const json: VersionedJSON<SectionDrawingProvenance> | undefined = drawing.jsonProperties[jsonKey];
      if (!json || typeof json !== "object" || !json.data || json.version !== jsonVersion) {
        // NOTE: in future may need to migrate older version to current, or reject newer version.
        return undefined;
      }

      return new Provenance(json.data.guids);
    } catch (_err) { // eslint-disable-line @typescript-eslint/no-unused-vars
      // NOTE: malformed JSON - should be logged.
      return undefined;
    }
  }
}

