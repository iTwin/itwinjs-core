/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as React from "react";
import { Point, Timer } from "@bentley/ui-core";
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
  readonly initialPosition: React.RefObject<Point | undefined>;
  readonly onDrag: () => void;
}

function useDrag(args: UseDragArgs) {
  const handlePointerMove = React.useCallback((e: PointerEvent) => {
    if (!args.initialPosition.current)
      return;
    const newPosition = new Point(e.clientX, e.clientY);
    const dragDistance = getDragDistance(args.initialPosition.current, newPosition, args.direction);
    if (dragDistance < 20)
      return;
    args.onDrag();
  }, [args.onDrag, args.direction]);
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
    if (distance < 2)
      return;
    longPressTimer.current.stop();
  }, []);
  React.useEffect(() => {
    longPressTimer.current.setOnExecute(args.onLongPress);
    return () => {
      longPressTimer.current.setOnExecute(undefined);
    };
  }, [args.onLongPress]);
  return { handlePointerDown, handlePointerMove, handlePointerUp };
}

/** HOC to add open panel action via drag interaction.
 * @beta
 */
export const withDragInteraction = <P extends {}, C>(
  // tslint:disable-next-line:variable-name
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
    const drag = useDrag({
      initialPosition,
      direction,
      onDrag: handleOpenPanel,
    });
    const longPress = useLongPress({
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
      longPress.handlePointerDown();
    }, [longPress.handlePointerDown]);
    const handlePointerMove = React.useCallback((e: PointerEvent) => {
      drag.handlePointerMove(e);
      longPress.handlePointerMove(e);
    }, [drag.handlePointerMove, longPress.handlePointerMove]);
    const handlePointerUp = React.useCallback(() => {
      initialPosition.current = undefined;
      longPress.handlePointerUp();
    }, [longPress.handlePointerUp]);
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
