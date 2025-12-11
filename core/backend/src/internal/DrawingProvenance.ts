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

// exported strictly for tests.
export namespace DrawingProvenance {
  const jsonKey = "bentley:section-drawing-annotation-provenance";
  const jsonVersion = new ECVersion(1, 0, 0).toString();

  export interface Props {
    guids: GuidString[];
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
        `SELECT GeometryGuid FROM bis.GeometricModel WHERE ECInstanceId IN ${selector.models.join()}`,
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
