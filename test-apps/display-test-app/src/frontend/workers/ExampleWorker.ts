/* eslint-disable no-console */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";
import { GraphicDescription, GraphicDescriptionBuilder, GraphicDescriptionContextProps, GraphicType, registerWorker, WorkerGraphicDescriptionContext, WorkerGraphicDescriptionContextProps } from "@itwin/core-frontend";
import { Arc3d, Point3d } from "@itwin/core-geometry";

// __PUBLISH_EXTRACT_START__ Worker_CalculatorInterface
export interface Calculator {
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

export interface CreateCirclesArgs {
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
export interface GraphicCreatorResult {
  context: GraphicDescriptionContextProps;
  description: GraphicDescription;
  modelId: string;
}

export interface GraphicCreator {
  createCircles(args: CreateCirclesArgs): GraphicCreatorResult;
}

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
      pickable: {
        id: modelId,
        modelId,
      },
      context,
    });

    // Add each circle to the builder.
    for (let i = 0; i < numCircles; i++) {
      // Set the next circle's color.
      const color = ColorDef.fromJSON(args.color[i]);
      builder.setSymbology(color, color, 1);

      // Assign a unique Id to the circle so it can be interacted with by the user.
      const circleId = context.transientIds.getNext();
      builder.activatePickableId(circleId);

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
      modelId,
    };

    // Return the graphic description and context, transferring any transferable objects to the main thread.
    return {
      result,
      transfer: Array.from(transferables),
    };
  },
});

// __PUBLISH_EXTRACT_END__
