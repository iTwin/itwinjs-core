/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import * as React from "react";
import { Point, Timer } from "@itwin/core-react";
import { Direction } from "../../../utilities/Direction";

/** Properties of [[withDragInteraction]] HOC.
 * @beta
 */
export interface WithDragInteractionProps {
  /** Drag direction to open the panel. */
  direction: Direction;
  /** Function called when the item is clicked. */
  onClick?: () => void;
  /** Function called when item is dragged or long pressed to open panel. */
  onOpenPanel?: () => void;
}

const style = { touchAction: "none" };

interface UseDragArgs extends Readonly<Pick<WithDragInteractionProps, "direction">> {
  readonly initialPosition: React.MutableRefObject<Point | undefined>;
  readonly onDrag: () => void;
}

function useDrag(args: UseDragArgs) {
  const { direction, initialPosition, onDrag } = args;
  const handlePointerMove = React.useCallback((e: PointerEvent) => {
    if (!initialPosition.current)
      return;
    const newPosition = new Point(e.clientX, e.clientY);
    const dragDistance = getDragDistance(initialPosition.current, newPosition, direction);
    if (dragDistance < 20)
      return;
    onDrag();
  }, [direction, initialPosition, onDrag]);
  return { handlePointerMove };
}

interface UseLongPressArgs {
  readonly initialPosition: React.RefObject<Point | undefined>;
  readonly onLongPress: () => void;
}

function useLongPress(args: UseLongPressArgs) {
  const longPressTimer = React.useRef(new Timer(750));
  const handlePointerDown = React.useCallback(() => {
    longPressTimer.current.start();
  }, []);
  const handlePointerUp = React.useCallback(() => {
    longPressTimer.current.stop();
  }, []);

  const handlePointerMove = React.useCallback((e: PointerEvent) => {
    if (!args.initialPosition.current)
      return;
    const newPosition = new Point(e.clientX, e.clientY);
    const distance = args.initialPosition.current.getDistanceTo(newPosition);
    distance >= 2 && longPressTimer.current.stop();
  }, [args.initialPosition]);
  React.useEffect(() => {
    longPressTimer.current.setOnExecute(args.onLongPress);
    return () => {
      longPressTimer.current.setOnExecute(undefined); // eslint-disable-line react-hooks/exhaustive-deps
    };
  }, [args.onLongPress]);
  return { handlePointerDown, handlePointerMove, handlePointerUp };
}

/** HOC to add open panel action via drag interaction.
 * @beta
 */
export const withDragInteraction = <P extends {}, C>(
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Component: React.JSXElementConstructor<P> & C,
) => {
  type Props = JSX.LibraryManagedAttributes<C, P & WithDragInteractionProps>;
  return function WithDragInteraction(props: Props) {
    const { direction, onClick, onOpenPanel, ...otherProps } = props;
    const initialPosition = React.useRef<Point | undefined>(undefined);
    const skipClick = React.useRef<boolean>(false);
    const handleOpenPanel = React.useCallback(() => {
      initialPosition.current = undefined;
      skipClick.current = true;
      onOpenPanel && onOpenPanel();
    }, [onOpenPanel]);
    const {
      handlePointerMove: dragPointerMove,
    } = useDrag({
      initialPosition,
      direction,
      onDrag: handleOpenPanel,
    });
    const {
      handlePointerDown: longPressPointerDown,
      handlePointerMove: longPressPointerMove,
      handlePointerUp: longPressPointerUp,
    } = useLongPress({
      initialPosition,
      onLongPress: handleOpenPanel,
    });
    const handleClick = React.useCallback(() => {
      if (skipClick.current)
        return;
      onClick && onClick();
    }, [onClick]);
    const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
      (e.target instanceof Element) && e.target.releasePointerCapture(e.pointerId);
      initialPosition.current = new Point(e.clientX, e.clientY);
      skipClick.current = false;
      longPressPointerDown();
    }, [longPressPointerDown]);
    const handlePointerMove = React.useCallback((e: PointerEvent) => {
      dragPointerMove(e);
      longPressPointerMove(e);
    }, [dragPointerMove, longPressPointerMove]);
    const handlePointerUp = React.useCallback(() => {
      initialPosition.current = undefined;
      longPressPointerUp();
    }, [longPressPointerUp]);
    React.useEffect(() => {
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      return () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };
    }, [handlePointerMove, handlePointerUp]);
    return (
      <div
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        style={style}
        role="presentation"
      >
        <Component
          {...otherProps as any}
        />
      </div>
    );
  };
};

/** @internal */
export const getDragDistance = (from: Point, to: Point, direction: Direction) => {
  switch (direction) {
    case Direction.Left: {
      return from.x - to.x;
    }
    case Direction.Right: {
      return to.x - from.x;
    }
    case Direction.Top: {
      return from.y - to.y;
    }
    case Direction.Bottom: {
      return to.y - from.y;
    }
  }
};
