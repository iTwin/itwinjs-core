/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import * as React from "react";
import classnames from "classnames";
import { Pane } from "./Pane";
import { Resizer } from "./Resizer";

/**
 * Props for [[SplitPane]] component
 * @public
 */
export interface SplitPaneProps {
  /** Pass false to disable resizing */
  allowResize?: boolean;
  /** The array of two react nodes, one for each pane. */
  children: React.ReactNode[];
  /** Determines which pane maintains its size when browser window is resized.*/
  primary?: "first" | "second";

  minSize?: string | number;
  /** You can limit the maximal size of the 'fixed' pane using the maxSize parameter with a positive value
   * (measured in pixels but state just a number). If you wrap the SplitPane into a container component
   * (yes you can, just remember the container has to have the relative or absolute positioning), then you'll need to limit
   *  the movement of the splitter (resizer) at the end of the SplitPane (otherwise it can be dragged outside the SplitPane
   * and you don't catch it never more). For this purpose use the maxSize parameter with value 0. When dragged the splitter/resizer
   * will stop at the border of the SplitPane component and think this you'll be able to pick it again and drag it back then.
   *  And more: if you set the maxSize to negative value (e.g. -200), then the splitter stops 200px before the border
   * (in other words it sets the minimal size of the 'resizable' pane in this case). This can be useful also in the
   * full-screen case of use. */
  maxSize?: string | number;
  /** Default initial size of primary pane */
  defaultSize?: string | number;
  /** Size of primary pane */
  size?: string | number;
  /** You can use the step prop to only allow resizing in fixed increments. */
  step?: number;
  split?: "vertical" | "horizontal";
  /** This callback is invoked when a drag start. */
  onDragStarted?: () => void;
  /** This callback is invoked when a drag ends. */
  onDragFinished?: (newSize: number) => void;
  /** Callback is invoked with the current drag during a drag event.*/
  onChange?: (newSize: number) => void;
  /** Callback is invoked if user clicks on Resizer. */
  onResizerClick?: (event: MouseEvent) => void;
  /** Callback is invoked if user double clicks on Resizer. */
  onResizerDoubleClick?: (event: MouseEvent) => void;
  /** Styling to be applied to the main container */
  style?: React.CSSProperties;
  /** Styling to be applied to both panes */
  paneStyle?: React.CSSProperties;
  /** Styling to be applied to the first pane, with precedence over paneStyle */
  pane1Style?: React.CSSProperties;
  /** Styling to be applied to the second pane, with precedence over paneStyle */
  pane2Style?: React.CSSProperties;
  /** Styling to be applied to the resizer bar */
  resizerStyle?: React.CSSProperties;
  /** Class name to be added to the SplitPane div */
  className?: string;
  /** Class name to be added to each Pane's div */
  paneClassName?: string;
  /** Class name to be added to Pane1's div */
  pane1ClassName?: string;
  /** Class name to be added to Pane2's div */
  pane2ClassName?: string;
}

function unFocus(ownerDoc: Document | undefined) {
  // istanbul ignore next
  if (!ownerDoc)
    return;

  const docSelection = ownerDoc.getSelection();
  // istanbul ignore else
  if (docSelection) {
    docSelection.empty();
  } else {
    // istanbul ignore next
    try {
      const winSelection = ownerDoc.defaultView?.getSelection();
      winSelection?.removeAllRanges();
    } catch (_e) { }
  }
}

function getDefaultSize(defaultSize?: number | string, minSize?: string | number, maxSize?: string | number, draggedSize?: number) {
  // istanbul ignore next
  if (typeof draggedSize === "number") {
    const min = typeof minSize === "number" ? minSize : 0;
    const max =
      typeof maxSize === "number" && maxSize >= 0 ? maxSize : Infinity;
    return Math.max(min, Math.min(max, draggedSize));
  }
  if (defaultSize !== undefined) {
    return defaultSize;
  }
  return minSize;
}

function removeNullChildren(children: React.ReactNode[]) {
  return React.Children.toArray(children).filter((c) => c);
}

/**
 * Local TypeScript implementation of `SplitPane` from `react-split-pane` package since that
 * package is not regularly maintained.
 * See https://github.com/tomkp/react-split-pane/blob/master/LICENSE.
 * @public
 */
export function SplitPane(props: SplitPaneProps) {
  const { style, size, defaultSize, maxSize, children,
    paneStyle, pane1Style, pane2Style, className,
    paneClassName, pane1ClassName, pane2ClassName,
    onDragStarted, onDragFinished, step, onChange,
    onResizerClick, onResizerDoubleClick,
  } = props;

  // honor same defaults as react-split-pane
  const allowResize = React.useMemo(() => undefined !== props.allowResize ? props.allowResize : true, [props.allowResize]);
  const minSize = React.useMemo(() => undefined !== props.minSize ? props.minSize : 50, [props.minSize]);
  const primary = React.useMemo(() => undefined !== props.primary ? props.primary : "first", [props.primary]);
  const split = React.useMemo(() => undefined !== props.split ? props.split : "vertical", [props.split]);
  const initialSize = size !== undefined ? size : getDefaultSize(defaultSize, minSize, maxSize);

  const [position, setPosition] = React.useState(0);
  const [draggedSize, setDraggedSize] = React.useState<number | undefined>();
  const [active, setActive] = React.useState(false);
  const [pane1Size, setPane1Size] = React.useState(() => primary === "first" ? initialSize : undefined);
  const [pane2Size, setPane2Size] = React.useState(() => primary === "second" ? initialSize : undefined);
  const splitPane = React.useRef<HTMLDivElement>(null);
  const pane1 = React.useRef<HTMLDivElement>(null);
  const pane2 = React.useRef<HTMLDivElement>(null);
  const notNullChildren = React.useMemo(() => removeNullChildren(children), [children]);

  React.useEffect(() => {
    primary === "first" ? setPane1Size(initialSize) : setPane2Size(initialSize);
    primary === "first" ? setPane2Size(undefined) : setPane1Size(undefined);
  }, [initialSize, primary]);

  const splitPaneStyle = React.useMemo(() => {
    const directionSpecificParts = (split === "vertical") ? {
      flexDirection: "row",
      left: 0,
      right: 0,
    } : {
      bottom: 0,
      flexDirection: "column",
      minHeight: "100%",
      top: 0,
      width: "100%",
    };

    return {
      display: "flex",
      flex: 1,
      height: "100%",
      position: "absolute",
      outline: "none",
      overflow: "hidden",
      MozUserSelect: "text",
      WebkitUserSelect: "text",
      msUserSelect: "text",
      userSelect: "text",
      ...style,
      ...directionSpecificParts,
    } as React.CSSProperties;
  }, [split, style]);

  const pane1DivStyle = { ...paneStyle, ...pane1Style };
  const pane2DivStyle = { ...paneStyle, ...pane2Style };
  const resizerStyle = React.useMemo(() => props.resizerStyle ?? {}, [props.resizerStyle]);
  const resizerClasses = React.useMemo(() => classnames("Resizer", !allowResize && "disabled"), [allowResize]);
  const splitPaneClasses = React.useMemo(() => classnames("SplitPane", className, split, !allowResize && "disabled"), [className, split, allowResize]);
  const pane1Classes = React.useMemo(() => classnames("Pane1", paneClassName, pane1ClassName), [paneClassName, pane1ClassName]);
  const pane2Classes = React.useMemo(() => classnames("Pane2", paneClassName, pane2ClassName), [paneClassName, pane2ClassName]);

  const initializeDrag = React.useCallback((x: number, y: number) => {
    // istanbul ignore next
    unFocus(splitPane.current?.ownerDocument);
    const newPosition = split === "vertical" ? x : y;
    onDragStarted && onDragStarted();
    setActive(true);
    setPosition(newPosition);
  }, [onDragStarted, split]);

  const onTouchStart = React.useCallback((event: TouchEvent) => {
    // istanbul ignore else
    if (allowResize) {
      initializeDrag(event.touches[0].clientX, event.touches[0].clientY);
    }
  }, [allowResize, initializeDrag]);

  const processMove = React.useCallback((x: number, y: number) => {
    // istanbul ignore next
    unFocus(splitPane.current?.ownerDocument);
    const isPrimaryFirst = primary === "first";
    const ref = isPrimaryFirst ? pane1.current : pane2.current;
    const ref2 = isPrimaryFirst ? pane2.current : pane1.current;
    const splitPaneDiv = splitPane.current;

    // istanbul ignore else
    if (ref && ref2 && splitPaneDiv) {
      const node = ref;
      const node2 = ref2;
      // istanbul ignore else
      if (node.getBoundingClientRect) {
        const width = node.getBoundingClientRect().width;
        const height = node.getBoundingClientRect().height;
        // istanbul ignore next
        const current = split === "vertical" ? x : y;
        // istanbul ignore next
        const oldSize = split === "vertical" ? width : height;
        let positionDelta = position - current;
        if (step) {
          // istanbul ignore next
          if (Math.abs(positionDelta) < step) {
            return;
          }
          // Integer division
          // eslint-disable-next-line no-bitwise
          positionDelta = ~~(positionDelta / step) * step;
        }
        let sizeDelta = isPrimaryFirst ? positionDelta : -positionDelta;

        // istanbul ignore next
        const pane1Order = parseInt(node.ownerDocument?.defaultView?.getComputedStyle(node).order ?? "0", 10);
        // istanbul ignore next
        const pane2Order = parseInt(node2.ownerDocument?.defaultView?.getComputedStyle(node2).order ?? "0", 10);
        // istanbul ignore next
        if (pane1Order > pane2Order) {
          sizeDelta = -sizeDelta;
        }

        let newMaxSize = maxSize;
        // istanbul ignore next
        if (typeof maxSize === "number" && maxSize !== undefined && maxSize <= 0) {
          if (split === "vertical") {
            newMaxSize = splitPaneDiv.getBoundingClientRect().width + maxSize;
          } else {
            newMaxSize = splitPaneDiv.getBoundingClientRect().height + maxSize;
          }
        }

        let newSize = oldSize - sizeDelta;
        const newPosition = position - positionDelta;

        // istanbul ignore next
        if (typeof minSize === "number" && newSize < minSize) {
          newSize = minSize;
        } else if (typeof newMaxSize === "number" && newMaxSize !== undefined && newSize > newMaxSize) {
          newSize = newMaxSize;
        } else {
          setPosition(newPosition);
        }

        onChange && onChange(newSize);
        setDraggedSize(newSize);
        isPrimaryFirst ? setPane1Size(newSize) : setPane2Size(newSize);
      }
    }
  }, [maxSize, minSize, onChange, position, primary, split, step]);

  const onTouchMove = React.useCallback((event: TouchEvent) => {
    // istanbul ignore next
    if (!allowResize || !active)
      return;
    processMove(event.touches[0].clientX, event.touches[0].clientY);
  }, [active, allowResize, processMove]);

  const onMouseMove = React.useCallback((event: MouseEvent) => {
    if (!allowResize || !active)
      return;
    processMove(event.clientX, event.clientY);
  }, [active, allowResize, processMove]);

  const onMouseDown = React.useCallback((event: MouseEvent) => {
    // istanbul ignore else
    if (allowResize) {
      event.preventDefault();
      initializeDrag(event.clientX, event.clientY);
    }
  }, [allowResize, initializeDrag]);

  const processResizeFinished = React.useCallback(() => {
    // istanbul ignore else
    if (undefined !== draggedSize && allowResize && active) {
      onDragFinished && onDragFinished(draggedSize);
    }
    setActive(false);
  }, [draggedSize, allowResize, active, onDragFinished]);

  const onMouseUp = React.useCallback((event: MouseEvent) => {
    event.preventDefault();
    processResizeFinished();
  }, [processResizeFinished]);

  React.useEffect(() => {
    // istanbul ignore next
    const ownerDoc = splitPane.current?.ownerDocument;
    // istanbul ignore next
    if (!ownerDoc)
      return;

    ownerDoc.addEventListener("mouseup", onMouseUp);
    ownerDoc.addEventListener("mousemove", onMouseMove);
    ownerDoc.addEventListener("touchmove", onTouchMove);
    return () => {
      ownerDoc.removeEventListener("mouseup", onMouseUp);
      ownerDoc.removeEventListener("mousemove", onMouseMove);
      ownerDoc.removeEventListener("touchmove", onTouchMove);
    };
  }, [onMouseMove, onMouseUp, onTouchMove]);

  return (
    <div
      className={splitPaneClasses}
      ref={splitPane}
      style={splitPaneStyle}
    >
      <Pane
        className={pane1Classes}
        key="pane1"
        eleRef={pane1}
        size={pane1Size}
        split={split}
        style={pane1DivStyle}
      >
        {notNullChildren[0]}
      </Pane>
      <Resizer
        className={resizerClasses}
        onClick={onResizerClick}
        onDoubleClick={onResizerDoubleClick}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchEnd={processResizeFinished}
        key="resizer"
        split={split}
        style={resizerStyle}
      />
      <Pane
        className={pane2Classes}
        key="pane2"
        eleRef={pane2}
        size={pane2Size}
        split={split}
        style={pane2DivStyle}
      >
        {notNullChildren[1]}
      </Pane>
    </div>
  );
}
