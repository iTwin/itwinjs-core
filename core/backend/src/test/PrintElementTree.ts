/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64String, Logger } from "@itwin/core-bentley";
import { IModelDb } from "../IModelDb";
import { Model } from "../Model";
import { Element } from "../Element";

export function fmtElement(iModel: IModelDb, elementId: Id64String): string {
  const el = iModel.elements.getElement(elementId);
  return `${el.id} ${el.classFullName} ${el.getDisplayLabel()}`;
}

export function fmtModel(model: Model): string {
  return `${model.id} ${model.classFullName} ${model.name}`;
}

export function printElementTree(loggerCategory: string, seen: Set<Id64String>, iModel: IModelDb, elementId: Id64String, indent: number) {
  if (seen.has(elementId)) {
    Logger.logTrace(loggerCategory, `${"\t".repeat(indent)}${fmtElement(iModel, elementId)} (SEEN)`);
    return;
  }

  seen.add(elementId);

  Logger.logTrace(loggerCategory, `${"\t".repeat(indent)}${fmtElement(iModel, elementId)}`);

  for (const child of iModel.elements.queryChildren(elementId)) {
    printElementTree(loggerCategory, seen, iModel, child, indent + 1);
  }

  const subModel = iModel.models.tryGetModel<Model>(elementId);
  if (subModel !== undefined) {
    Logger.logTrace(loggerCategory, `${"\t".repeat(indent)} subModel ${fmtModel(subModel)}:`);

    iModel.withPreparedStatement(`select ecinstanceid from ${Element.classFullName} where Model.Id = ?`, (stmt) => {
      stmt.bindId(1, subModel.id);
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        printElementTree(loggerCategory, seen, iModel, stmt.getValue(0).getId(), indent + 1);
      }
    });
  }
}
