/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { ColorDef } from "@itwin/core-common";
import { createWorkerProxy, GraphicDescription, GraphicDescriptionBuilder, GraphicDescriptionContextProps, GraphicType, IModelApp, IModelConnection, registerWorker, RenderGraphic, WorkerGraphicDescriptionContext, WorkerGraphicDescriptionContextProps } from "@itwin/core-frontend";
import { Arc3d, Point3d } from "@itwin/core-geometry";

// __PUBLISH_EXTRACT_START__ Worker_CalculatorInterface
interface Calculator {
  /** Returns the constant PI. */
  pi(): number;
  /** Returns the square root of `num`. Throws an error if `num` is less than zero. */
  squareRoot(num: number): number;
  /** Returns the sum of `a` and `b`. */
  add(a: number, b: number): number;
  /** Divides each of the `numbers` by the specified `divisor`. */
  divideAll(numbers: Float64Array, divisor: number): Float64Array;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Worker_CalculatorImplementation

registerWorker<Calculator>({
  pi: () => Math.PI,
  squareRoot: (num) => {
    if (num < 0) {
      throw new Error("squareRoot requires a non-negative input");
    }

    return Math.sqrt(num);
  },
  add: (args: [a: number, b: number]) => {
    return args[0] + args[1];
  },
  divideAll: (args: [numbers: Float64Array, divisor: number]) => {
    const result = args[0];
    const divisor = args[1];
    for (let i = 0; i < result.length; i++) {
      result[i] = result[i] / divisor;
    }

    const transfer = [result.buffer];
    return { result, transfer };
  },
});
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Worker_CalculatorProxy
interface CalculatorProxy {
  pi(transfer?: Transferable[]): Promise<number>;
  squareRoot(num: number, transfer?: Transferable[]): Promise<number>;
  add(args: [a: number, b: number], transfer?: Transferable[]): Promise<number>;
  divideAll(args: [numbers: Float64Array, divisor: number], transfer?: Transferable[]): Promise<Float64Array>;
  /** From WorkerProxy, terminates the Worker. */
  terminate(): void;
  /** From WorkerProxy, true if `terminate` has been called. */
  readonly isTerminated: boolean;
}
// __PUBLISH_EXTRACT_END__

async function testCalculator() {
  const calculator2: CalculatorProxy = createWorkerProxy<Calculator>("./calculator.js");
  assert(!calculator2.isTerminated);
  // __PUBLISH_EXTRACT_START__ Worker_CreateCalculatorProxy
  const calculator = createWorkerProxy<Calculator>("./calculator.js");
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ Worker_UseCalculator
  const pi = await calculator.pi();
  assert(pi === Math.PI);

  const three = await calculator.squareRoot(9);
  assert(three === 3);

  const five = await calculator.add([2, 3]);
  assert(five === 5);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ Worker_CalculatorTransfer
  const numbers = new Float64Array([1, 2, 3, 4, 5, 6, 7]);
  const result = await calculator.divideAll([numbers, 2], [numbers.buffer]);
  assert(result.length === 7);
  assert(result[0] === 0.5);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ Worker_TerminateCalculatorProxy
  calculator.terminate();
  assert(calculator.isTerminated);
// __PUBLISH_EXTRACT_END__
}

// __PUBLISH_EXTRACT_START__ Worker_GraphicCreatorInterface
/** Arguments supplied to GraphicCreator.createCircles. */
interface CreateCirclesArgs {
  /** The center coordinates and radius of each circle, arranged as quadruplets of 64-bit floats. */
  xyzRadius: Float64Array;
  /** The color of each circle described by `xyzRadius`, as a 32-bit integer a la `ColorDefProps`. */
  color: Uint32Array;
  /** The level of detail in meters at which to tesselate the circles. */
  chordTolerance: number;
  /** Context obtained from the main thread. */
  context: WorkerGraphicDescriptionContextProps;
}

/** The return type of a GraphicCreator method, returning a description of the graphic and the context for its creation. */
interface GraphicCreatorResult {
  context: GraphicDescriptionContextProps;
  description: GraphicDescription;
}

/** Defines the operations of a Worker that creates GraphicDescriptions. */
interface GraphicCreator {
  createCircles(args: CreateCirclesArgs): GraphicCreatorResult;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Worker_GraphicCreatorRegister
registerWorker<GraphicCreator>({
  // Validate the inputs.
  createCircles: (args: CreateCirclesArgs) => {
    const circles = args.xyzRadius;
    const numCircles = circles.length / 4;
    if (numCircles !== Math.round(numCircles)) {
      throw new Error("Four floats per circle are required");
    } else if (numCircles !== args.color.length) {
      throw new Error("The same number of colors and circles are required");
    }

    // Instantiate the context.
    const context = WorkerGraphicDescriptionContext.fromProps(args.context);

    // Allocate a transient Id to serve as the Id of the model (container) for our circles.
    const modelId = context.transientIds.getNext();

    // Create a builder.
    const builder = GraphicDescriptionBuilder.create({
      type: GraphicType.Scene,
      computeChordTolerance: () => args.chordTolerance,
      constraints: context.constraints,
      pickable: {
        id: modelId,
        modelId,
      },
    });

    // Add each circle to the builder.
    for (let i = 0; i < numCircles; i++) {
      // Set the next circle's color.
      const color = ColorDef.fromJSON(args.color[i]);
      builder.setSymbology(color, color, 1);

      // Assign a unique Id to the circle so it can be interacted with by the user.
      builder.activatePickableId(context.transientIds.getNext());

      // Add the circle to the builder.
      const offset = i * 4;
      const center = new Point3d(circles[offset], circles[offset + 1], circles[offset + 2]);
      const radius = circles[offset + 3];
      const circle = Arc3d.createXY(center, radius);

      builder.addArc(circle, true, true);
    }

    // Extract the finished GraphicDescription.
    const description = builder.finish();

    // Collect any transferable objects - primarily, ArrayBuffers - from the GraphicDescription.
    const transferables = new Set<Transferable>();
    GraphicDescription.collectTransferables(transferables, description);

    // Package up the context to send back to the main thread, including any transferable objects it contains.
    const contextProps = context.toProps(transferables);

    const result: GraphicCreatorResult = {
      description,
      context: contextProps,
    };

    // Return the graphic description and context, transferring any transferable objects to the main thread.
    return {
      result,
      transfer: Array.from(transferables),
    };
  },
});
// __PUBLISH_EXTRACT_END__

async function testGraphicCreator() {
  // __PUBLISH_EXTRACT_START__ Worker_GraphicCreatorInvoke
  // Instantiate a reusable WorkerProxy for use by the createCircleGraphic function.
  const worker = createWorkerProxy<GraphicCreator>("./graphic-creator.js");

  // Create a render graphic from a description of a large number of circles, using a WorkerProxy.
  async function createCircleGraphic(xyzRadius: Float64Array, color: Uint32Array, chordTolerance: number, iModel: IModelConnection): Promise<RenderGraphic | undefined> {
    // Package up the RenderSystem's context to be sent to the Worker.
    const workerContext = IModelApp.renderSystem.createWorkerGraphicDescriptionContextProps(iModel);

    // Transfer the ArrayBuffers to the Worker, instead of making copies.
    const transfer: Transferable[] = [xyzRadius.buffer, color.buffer];

    // Obtain a GraphicDescription from the Worker.
    const args: CreateCirclesArgs = {
      xyzRadius,
      color,
      chordTolerance,
      context: workerContext,
    };
    const result = await worker.createCircles(args, transfer);

    // Unpackage the context from the Worker.
    const context = await IModelApp.renderSystem.resolveGraphicDescriptionContext(result.context, iModel);

    // Convert the GraphicDescription into a RenderGraphic.
    return IModelApp.renderSystem.createGraphicFromDescription({
      description: result.description,
      context,
    });
  }
  // __PUBLISH_EXTRACT_END__
  await createCircleGraphic(new Float64Array(), new Uint32Array(), 1, {} as any);
}

testCalculator(); // eslint-disable-line @typescript-eslint/no-floating-promises
testGraphicCreator(); // eslint-disable-line @typescript-eslint/no-floating-promises
