/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Feature, GeometryClass } from "@itwin/core-common";
import {
  GraphicDescription, GraphicDescriptionBuilder, GraphicType,
} from "../../common";
import { registerWorker } from "../../workers/RegisterWorker";
import { Point2d, Point3d } from "@itwin/core-geometry";
import { GraphicDescriptionContextProps, WorkerGraphicDescriptionContext, WorkerGraphicDescriptionContextProps } from "../../common/render/GraphicDescriptionContext";

export interface WorkerGraphic {
  description: GraphicDescription;
  context: GraphicDescriptionContextProps;
}

export interface TestWorker {
  zero(): "zero";
  one(s: string): string;
  two(a: number, b: number): number;
  throwError(): never;
  throwString(): never;
  setTransfer(wantTransfer: boolean): undefined;
  createGraphic(context: WorkerGraphicDescriptionContextProps): WorkerGraphic;
  someVeryLongRunningAsyncOperation(): Promise<number>;
  someLongRunningAsyncOperation(): Promise<number>;
  someFastSynchronousOperation(): number;
}

let doTransfer = false;

function maybeTransfer<T>(result: T): T | { result: T, transfer: Transferable[] } {
  if (!doTransfer)
    return result;

  return { result, transfer: [] };
}

let globalTickCounter = 0;

async function waitNTicks(nTicks: number): Promise<void> {
  let counter = 0;
  while (++counter < nTicks) {
    await new Promise<void>((resolve: any) => setTimeout(resolve, 1));
  }
}

registerWorker<TestWorker>({
  zero: () => maybeTransfer("zero"),
  one: (arg: string) => maybeTransfer(arg),
  two: (args: [a: number, b: number]) => maybeTransfer(args[0] + args[1]),
  throwError: () => {
    throw new Error("ruh-roh");
  },
  throwString: () => {
    throw "not an error"; // eslint-disable-line no-throw-literal
  },
  setTransfer: (wantTransfer: boolean) => {
    doTransfer = wantTransfer;
    return undefined;
  },
  createGraphic: (contextProps: WorkerGraphicDescriptionContextProps) => {
    const context = WorkerGraphicDescriptionContext.fromProps(contextProps);

    const builder = GraphicDescriptionBuilder.create({
      type: GraphicType.Scene,
      context,
      computeChordTolerance: () => 0,
      viewIndependentOrigin: new Point3d(0, 1, 2),
      pickable: {
        id: context.transientIds.getNext(),
        geometryClass: GeometryClass.Construction,
        modelId: context.transientIds.getNext(),
        subCategoryId: context.transientIds.getNext(),
      },
    });

    builder.addPointString([new Point3d(1, 1, 1)]);

    builder.activateFeature(new Feature(context.transientIds.getNext(), "0x123", GeometryClass.Primary));
    builder.addShape2d([
      new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5),
    ], 2);

    builder.activateFeature(new Feature("0x456", context.transientIds.getNext()));
    builder.addLineString2d([new Point2d(0, 0), new Point2d(1, 20)], -4);

    const description = builder.finish();
    const transferables = new Set<Transferable>();
    return {
      result: {
        description,
        context: context.toProps(transferables),
      },
      transfer: Array.from(transferables),
    };
  },

  someVeryLongRunningAsyncOperation: async () => {
    await waitNTicks(10);
    return ++globalTickCounter;
  },
  someLongRunningAsyncOperation: async () => {
    await waitNTicks(5);
    return ++globalTickCounter;
  },
  someFastSynchronousOperation: () => {
    return ++globalTickCounter;
  },
});
