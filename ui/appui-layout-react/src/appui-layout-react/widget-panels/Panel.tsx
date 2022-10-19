/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./Panel.scss";
import classnames from "classnames";
import * as React from "react";
import produce from "immer";
import { RectangleProps, SizeProps } from "@itwin/core-react";
import { assert } from "@itwin/core-bentley";
import { DraggedPanelSideContext } from "../base/DragManager";
import { NineZoneDispatchContext, PanelsStateContext, WidgetsStateContext } from "../base/NineZone";
import { WidgetState } from "../state/WidgetState";
import { PanelWidget, PanelWidgetProps } from "../widget/PanelWidget";
import { WidgetPanelGrip } from "./Grip";
import { WidgetComponent } from "../widget/Widget";
import { PanelTargets } from "../target/PanelTargets";
import { SectionOutline } from "../outline/SectionOutline";
import { PanelOutline } from "../outline/PanelOutline";
import { WidgetTarget } from "../widget/WidgetTarget";
import { PanelTarget } from "./PanelTarget";
import { SectionTargets } from "../target/SectionTargets";
import { isHorizontalPanelState, PanelState } from "../state/PanelState";

/** @internal */
export type TopPanelSide = "top";

/** @internal */
export type BottomPanelSide = "bottom";

/** @internal */
export type LeftPanelSide = "left";

/** @internal */
export type RightPanelSide = "right";

/** @internal */
export type HorizontalPanelSide = TopPanelSide | BottomPanelSide;

/** @internal */
export type VerticalPanelSide = LeftPanelSide | RightPanelSide;

/** @internal */
export type PanelSide = VerticalPanelSide | HorizontalPanelSide;

// istanbul ignore next
function PanelSplitter({ isHorizontal }: { isHorizontal: boolean }) {
  const dispatch = React.useContext(NineZoneDispatchContext);
  const panel = React.useContext(PanelStateContext);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const splitterProcessingActiveRef = React.useRef<boolean>(false);

  const getPercentage = React.useCallback((min: number, max: number, current: number) => {
    const range = max - min;
    const adjusted = Math.max(min, Math.min(max, current));
    if (adjusted === min)
      return 0;
    if (adjusted === max)
      return 100;
    const percent = ((adjusted - min) * 100) / (range);
    return percent;
  }, []);

  const updatePanelSize = React.useCallback(
    (event: PointerEvent) => {
      if (containerRef.current && panel?.side) {
        const parentPanel = containerRef.current.closest(".nz-widgetPanels-panel");
        const sectionToResize = containerRef.current.parentElement as HTMLElement;
        if (parentPanel && sectionToResize) {
          const rect = parentPanel.getBoundingClientRect();
          const percent = getPercentage(
            isHorizontal ? rect.left : rect.top,
            isHorizontal ? rect.right : rect.bottom,
            isHorizontal ? event.clientX : event.clientY,
          );

          dispatch({
            type: "PANEL_SET_SPLITTER_VALUE",
            side: panel.side,
            percent,
          });
        }
      }
    }, [getPercentage, isHorizontal, panel, dispatch]);

  const handlePointerMove = React.useCallback((event: Event): void => {
    if (splitterProcessingActiveRef.current) {
      event.preventDefault();
      event.stopPropagation();
      updatePanelSize(event as PointerEvent);
    }
  }, [updatePanelSize]);

  const handlePointerUp = React.useCallback((event: Event) => {
    updatePanelSize(event as PointerEvent);
    event.preventDefault();
    event.stopPropagation();
    containerRef.current?.ownerDocument.removeEventListener("pointermove", handlePointerMove);
    containerRef.current?.ownerDocument.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove, updatePanelSize]);

  const handlePointerDownOnSplitter = React.useCallback(
    (event: React.PointerEvent) => {
      if (containerRef.current) {
        containerRef.current?.ownerDocument.addEventListener("pointermove", handlePointerMove);
        containerRef.current?.ownerDocument.addEventListener("pointerup", handlePointerUp);
        splitterProcessingActiveRef.current = true;
        event.preventDefault();
        event.stopPropagation();
      }
    }, [handlePointerMove, handlePointerUp]);

  const className = isHorizontal ? "nz-horizontal-panel-splitter" : "nz-vertical-panel-splitter";
  return (
    <div ref={containerRef} className={className} onPointerDown={handlePointerDownOnSplitter} />
  );
}

/** Properties of [[WidgetPanelProvider]] component.
 * @internal
 */
export interface WidgetPanelProviderProps {
  side: PanelSide;
}

/** Widget panel component is a side panel with multiple widgets.
 * @internal
 */
export const WidgetPanelProvider = React.memo<WidgetPanelProviderProps>(function WidgetPanelProvider({ side }) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const panels = React.useContext(PanelsStateContext);
  const panel = panels[side];
  return (
    <PanelStateContext.Provider value={panel}>
      <PanelSideContext.Provider value={side}>
        {panel.widgets.length > 0 && <WidgetPanel
          spanTop={panels.top.span}
          spanBottom={panels.bottom.span}
        />}
        {panel.widgets.length === 0 && <PanelTarget />}
        <PanelTargets />
        <PanelOutline />
      </PanelSideContext.Provider>
    </PanelStateContext.Provider>
  );
});

/** @internal */
export interface WidgetPanelProps {
  spanBottom?: boolean;
  spanTop?: boolean;
}

/** @internal */
export const WidgetPanel = React.memo<WidgetPanelProps>(function WidgetPanelComponent({
  spanBottom,
  spanTop,
}) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const panel = React.useContext(PanelStateContext);
  assert(!!panel);
  const { handleBeforeTransition, handlePrepareTransition, handleTransitionEnd, getRef, sizes, ...animatePanelWidgets } = useAnimatePanelWidgets();
  const draggedPanelSide = React.useContext(DraggedPanelSideContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const captured = draggedPanelSide === panel.side;
  const horizontalPanel = isHorizontalPanelState(panel) ? panel : undefined;
  const [contentSize, setContentSize] = React.useState<number | undefined>();
  const [prepareTransition, setPrepareTransition] = React.useState(false);
  const [transition, setTransition] = React.useState<"init" | "transition" | undefined>();
  const [panelSize, setPanelSize] = React.useState<number | undefined>();
  const [initializing, setInitializing] = React.useState(false);

  const horizontal = isHorizontalPanelSide(panel.side);
  const style = React.useMemo(() => {
    let size = panel.collapsed ? 0 : panel.size ?? panel.minSize;
    if (panelSize !== undefined)
      size = panelSize;

    if (isHorizontalPanelSide(panel.side))
      return {
        height: `${size}px`,
      };
    return {
      width: `${size}px`,
    };
  }, [panel.side, panel.size, panel.collapsed, panel.minSize, panelSize]);
  const contentStyle = React.useMemo(() => {
    if (contentSize === undefined)
      return undefined;
    if (isHorizontalPanelSide(panel.side))
      return {
        minHeight: `${contentSize}px`,
      };
    return {
      minWidth: `${contentSize}px`,
    };
  }, [contentSize, panel.side]);
  const animateFrom = React.useRef<number | undefined>();
  const animateTo = React.useRef(0);
  const maxPanelSize = React.useRef<number | undefined>();
  const collapsing = React.useRef<"collapsing" | "expanding" | undefined>();
  const ref = React.useRef<HTMLDivElement>(null);

  const [prevCollapsed, setPrevCollapsed] = React.useState(panel.collapsed);
  if (prevCollapsed !== panel.collapsed) {
    setPrevCollapsed(panel.collapsed);
    let from = animateFrom.current;
    // istanbul ignore else
    if (from === undefined && ref.current) {
      const bounds = ref.current.getBoundingClientRect();
      from = getPanelSize(horizontal, bounds);
    }

    animateFrom.current = from;
    setPanelSize(undefined);
    setContentSize(undefined);
    setTransition(undefined);
    setPrepareTransition(true);
    if (panel.collapsed) {
      collapsing.current = "collapsing";
      maxPanelSize.current = from;
    } else {
      collapsing.current = "expanding";
    }
  }

  const [prevSize, setPrevSize] = React.useState(panel.size);
  if (prevSize !== panel.size) {
    setPrevSize(panel.size);

    if (initializing) {
      // Panel is initializing (via dispatched PANEL_INITIALIZE), need to re-measure animateTo.
      maxPanelSize.current = undefined;
      setPanelSize(undefined);
      setContentSize(undefined);
      setTransition(undefined);
      setPrepareTransition(true);
    } else if (collapsing.current === "collapsing") {
      // Panel is collapsing, ignore size changes.
    } else if (!captured && ref.current && prevSize !== undefined) {
      // Panel is expanding
      animateFrom.current = getPanelSize(horizontal, ref.current.getBoundingClientRect());
      setPanelSize(undefined);
      setContentSize(undefined);
      setTransition(undefined);
      setPrepareTransition(true);
    } else {
      // Panel is resizing, do not transition.
      setPanelSize(undefined);
      setContentSize(undefined);
      setTransition(undefined);
      animateFrom.current = undefined;
      collapsing.current = undefined;
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    if (panel.size !== undefined || panel.collapsed)
      return;
    assert(!!ref.current);
    const bounds = ref.current.getBoundingClientRect();
    const newSize = getPanelSize(horizontal, bounds);
    dispatch({
      type: "PANEL_INITIALIZE",
      side: panel.side,
      size: newSize,
    });
    setInitializing(true);
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    if (!prepareTransition)
      return;
    setPrepareTransition(false);
    assert(!!ref.current);
    animateTo.current = getPanelSize(horizontal, ref.current.getBoundingClientRect());
    if (animateFrom.current === animateTo.current) {
      maxPanelSize.current = undefined;
      animateFrom.current = undefined;
      collapsing.current = undefined;
      setPanelSize(undefined);
      setContentSize(undefined);
      setTransition(undefined);
      return;
    }
    if (collapsing.current === "expanding" && maxPanelSize.current === undefined) {
      maxPanelSize.current = animateTo.current;
    }
    setPanelSize(animateFrom.current);
    setContentSize(maxPanelSize.current);
    setTransition("init");
  });
  React.useLayoutEffect(() => {
    if (transition !== "init")
      return;
    const handle = window.requestAnimationFrame(() => {
      animateFrom.current = undefined;
      setPanelSize(animateTo.current);
      setTransition("transition");
    });
    return () => {
      window.cancelAnimationFrame(handle);
    };
  });
  React.useEffect(() => {
    setInitializing(false);
  }, [initializing]);
  const getBounds = React.useCallback(() => {
    assert(!!ref.current);
    return ref.current.getBoundingClientRect();
  }, []);
  const widgetPanel = React.useMemo<WidgetPanelContextArgs>(() => {
    return {
      getBounds,
    };
  }, [getBounds]);
  const showTargets = panel.widgets.length < panel.maxWidgetCount;
  const className = classnames(
    "nz-widgetPanels-panel",
    `nz-${panel.side}`,
    panel.collapsed && "nz-collapsed",
    captured && "nz-captured",
    horizontalPanel?.span && "nz-span",
    spanTop && "nz-span-top",
    spanBottom && "nz-span-bottom",
    transition && `nz-${transition}`,
  );

  const splitterControlledPanelStyle = React.useMemo(() => {
    // istanbul ignore next
    const splitterPercent = panel.splitterPercent ?? 50;
    const styleToApply: React.CSSProperties = {};
    // istanbul ignore else
    if (splitterPercent) {
      if (horizontal)
        styleToApply.width = `${splitterPercent}%`;
      else
        styleToApply.height = `${splitterPercent}%`;
    }
    return styleToApply;
  }, [horizontal, panel.splitterPercent]);

  const singleSection = panel.widgets.length === 1;
  const showSectionTargets = singleSection && !panel.collapsed;
  /* istanbul ignore next */
  return (
    <WidgetPanelContext.Provider value={widgetPanel}>
      <div
        className={className}
        ref={ref}
        style={style}
        onTransitionEnd={() => {
          maxPanelSize.current = undefined;
          collapsing.current = undefined;
          animateFrom.current = undefined;
          setPanelSize(undefined);
          setContentSize(undefined);
          setTransition(undefined);
        }}
      >
        <div
          className="nz-content"
          style={contentStyle}
        >
          {singleSection && <SectionOutline sectionIndex={0} />}
          {panel.widgets.map((widgetId, index, array) => {
            const last = index === array.length - 1;

            const panelClassName = classnames(`nz-panel-section-${index}`,
              horizontal ? "nz-widgetPanels-horizontal" : "nz-widgetPanels-vertical",
              (last && 0 === index) && "nz-panel-section-full-size"
            );

            const panelStyle = index === 0 && array.length > 1 ? splitterControlledPanelStyle : undefined;
            return (
              <React.Fragment key={widgetId}>
                <div className={panelClassName} style={panelStyle}>
                  {index === 0 && showTargets && <WidgetTarget
                    position="first"
                    widgetIndex={0}
                  />}
                  <PanelWidget
                    onBeforeTransition={handleBeforeTransition}
                    onPrepareTransition={handlePrepareTransition}
                    onTransitionEnd={handleTransitionEnd}
                    size={sizes[widgetId]}
                    transition={animatePanelWidgets.transition}
                    widgetId={widgetId}
                    ref={getRef(widgetId)}
                  />
                  {showTargets && <WidgetTarget
                    position={last ? "last" : undefined}
                    widgetIndex={index + 1}
                  />}
                  {(!last && 0 === index) && <PanelSplitter isHorizontal={horizontal} />}
                </div>
              </React.Fragment>
            );
          })}
          {singleSection && <SectionOutline sectionIndex={1} />}
        </div>
        {showSectionTargets && <SectionTargets widgetId={panel.widgets[0]} />}
        {panel.resizable &&
          <div className="nz-grip-container">
            <WidgetPanelGrip className="nz-grip" />
          </div>
        }
      </div>
    </WidgetPanelContext.Provider>
  );
});

/** @internal */
export const PanelSideContext = React.createContext<PanelSide | undefined>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
PanelSideContext.displayName = "nz:PanelSideContext";

/** @internal */
export const PanelStateContext = React.createContext<PanelState | undefined>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
PanelStateContext.displayName = "nz:PanelStateContext";

/** @internal */
export interface WidgetPanelContextArgs {
  getBounds(): RectangleProps;
}

/** @internal */
export const WidgetPanelContext = React.createContext<WidgetPanelContextArgs | undefined>(undefined);
WidgetPanelContext.displayName = "nz:WidgetPanelContext";

/** @internal */
export const isHorizontalPanelSide = (side: PanelSide): side is HorizontalPanelSide => {
  return side === "top" || side === "bottom";
};

/** @internal */
export const panelSides: [LeftPanelSide, RightPanelSide, TopPanelSide, BottomPanelSide] = [
  "left",
  "right",
  "top",
  "bottom",
];

/** @internal */
export function useAnimatePanelWidgets(): {
  handleBeforeTransition: PanelWidgetProps["onBeforeTransition"];
  handlePrepareTransition: PanelWidgetProps["onPrepareTransition"];
  handleTransitionEnd: PanelWidgetProps["onTransitionEnd"];
  getRef(widgetId: WidgetState["id"]): React.Ref<WidgetComponent>;
  transition: PanelWidgetProps["transition"];
  sizes: { [id: string]: PanelWidgetProps["size"] };
} {
  const panel = React.useContext(PanelStateContext);
  const widgets = React.useContext(WidgetsStateContext);
  assert(!!panel);
  const [prepareTransition, setPrepareTransition] = React.useState(false);
  const [transition, setTransition] = React.useState<PanelWidgetProps["transition"] | undefined>();
  const [prevPanelWidgets, setPrevPanelWidgets] = React.useState(panel.widgets);
  const [prevWidgets, setPrevWidgets] = React.useState(widgets);
  const [sizes, setSizes] = React.useState<{ [id: string]: number | undefined }>({});
  const refs = React.useRef(new Map<WidgetState["id"], React.RefObject<WidgetComponent>>());
  const widgetTransitions = React.useRef(new Map<WidgetState["id"], {
    from: number;
    to: number | undefined;
  }>());
  const measured = React.useRef(false);
  const horizontal = React.useRef(false);
  horizontal.current = isHorizontalPanelSide(panel.side);
  if (prevPanelWidgets !== panel.widgets) {
    const widgetsToMeasure = panel.widgets.length > prevPanelWidgets.length ? panel.widgets : prevPanelWidgets;
    for (const widgetId of widgetsToMeasure) {
      const ref = refs.current.get(widgetId);

      if (!ref || !ref.current) {
        widgetTransitions.current.set(widgetId, { from: 0, to: undefined });
        continue;
      }
      const bounds = ref.current.measure();
      widgetTransitions.current.set(widgetId, { from: getSize(horizontal.current, bounds.getSize()), to: undefined });
    }
    if (panel.widgets.length < prevPanelWidgets.length) {
      // Widget removed.
      let removedWidgetIndex = 0;
      for (let i = 0; i < prevPanelWidgets.length; i++) {
        const newWidget = panel.widgets[i];
        const lastWidget = prevPanelWidgets[i];
        if (newWidget !== lastWidget) {
          removedWidgetIndex = i;
          break;
        }
      }

      const removedWidget = prevPanelWidgets[removedWidgetIndex];
      let fillWidget: string | undefined;
      if (removedWidgetIndex === 0) {
        for (let i = removedWidgetIndex + 1; i < prevPanelWidgets.length; i++) {
          const widgetId = prevPanelWidgets[i];
          const widget = prevWidgets[widgetId];
          if (widget.minimized)
            continue;
          fillWidget = widgetId;
          break;
        }
      } else {
        for (let i = removedWidgetIndex - 1; i >= 0; i--) {
          const widgetId = prevPanelWidgets[i];
          const widget = prevWidgets[widgetId];
          if (widget.minimized)
            continue;
          fillWidget = widgetId;
          break;
        }
      }

      if (fillWidget) {
        const removedWidgetTransition = widgetTransitions.current.get(removedWidget);
        const fillWidgetTransition = widgetTransitions.current.get(fillWidget);
        assert(!!removedWidgetTransition);
        assert(!!fillWidgetTransition);
        const removedWidgetSize = removedWidgetTransition.from;
        const fillWidgetSize = fillWidgetTransition.from;

        widgetTransitions.current.delete(removedWidget);
        fillWidgetTransition.from = removedWidgetSize + fillWidgetSize;
      }
    }
    measured.current = true;
    setPrepareTransition(true);
    // Reset before measuring in case we were already in a transition.
    setTransition(undefined);
    setSizes({});
    setPrevPanelWidgets(panel.widgets);
  }
  React.useEffect(() => {
    setPrevWidgets(widgets);
  }, [widgets]);
  React.useEffect(() => {
    measured.current = false;
  });
  const handleTransitionEnd = React.useCallback(() => {
    widgetTransitions.current.clear();
    setSizes({});
    setTransition(undefined);
  }, []);
  React.useLayoutEffect(() => {
    if (!prepareTransition)
      return;
    let initTransition = false;
    for (const [widgetId, widgetTransition] of widgetTransitions.current) {
      const ref = refs.current.get(widgetId);
      if (!ref || !ref.current) {
        initTransition = false;
        widgetTransitions.current.clear();
        break;
      }
      const bounds = ref.current.measure();
      widgetTransition.to = getSize(horizontal.current, bounds.getSize());

      if (widgetTransition.from !== widgetTransition.to) {
        initTransition = true;
      }
    }
    setPrepareTransition(false);
    if (initTransition) {
      // Transition needs to be started.
      setSizes((prev) => produce(prev, (draft) => {
        for (const [widgetId, widgetTransition] of widgetTransitions.current) {
          draft[widgetId] = widgetTransition.from;
        }
      }));
      setTransition("init");
    }
  }, [prepareTransition]);
  React.useEffect(() => {
    if (transition !== "init")
      return;
    const handle = window.requestAnimationFrame(() => {
      setSizes((prev) => produce(prev, (draft) => {
        for (const [widgetId, widgetTransition] of widgetTransitions.current) {
          draft[widgetId] = widgetTransition.to;
        }
      }));
      setTransition("transition");
    });
    return () => {
      window.cancelAnimationFrame(handle);
    };
  }, [transition]);
  const getRef = React.useCallback((widgetId: WidgetState["id"]) => {
    let ref = refs.current.get(widgetId);
    if (!ref) {
      ref = React.createRef();
      refs.current.set(widgetId, ref);
    }
    return ref;
  }, []);
  React.useEffect(() => {
    // Clean-up ref objects.
    const newRefs: typeof refs.current = new Map();
    for (const widgetId of panel.widgets) {
      const ref = refs.current.get(widgetId);
      if (ref)
        newRefs.set(widgetId, ref);
    }
    refs.current = newRefs;
  }, [panel.widgets]);
  const handleBeforeTransition = React.useCallback(() => {
    // PanelWidget reports mode changes on same render pass, but we want to keep our initial measurements if panel.widgets have changed.
    if (measured.current)
      return;
    for (const wId of panel.widgets) {
      const ref = refs.current.get(wId);
      if (!ref || !ref.current) {
        widgetTransitions.current.clear();
        return;
      }
      const bounds = ref.current.measure();
      const from = getSize(horizontal.current, bounds.getSize());
      widgetTransitions.current.set(wId, { from, to: undefined });
    }
  }, [panel.widgets]);
  const handlePrepareTransition = React.useCallback(() => {
    if (widgetTransitions.current.size === 0)
      return;
    setPrepareTransition(true);
    // Reset before measuring in case we were already in a transition.
    setTransition(undefined);
    setSizes({});
  }, []);
  return {
    handleBeforeTransition,
    handlePrepareTransition,
    handleTransitionEnd,
    getRef,
    transition,
    sizes,
  };
}

function getSize(horizontal: boolean, size: SizeProps) {
  return horizontal ? size.width : size.height;
}

function getPanelSize(horizontal: boolean, size: SizeProps) {
  return horizontal ? size.height : size.width;
}
