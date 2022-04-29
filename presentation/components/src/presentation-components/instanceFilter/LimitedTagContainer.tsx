/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { useResizeObserver } from "@itwin/core-react";
import { SvgMore } from "@itwin/itwinui-icons-react";
import { DropdownMenu, IconButton } from "@itwin/itwinui-react";
import { useMergedRefs } from "@itwin/itwinui-react/cjs/core/utils";

export interface LimitedTagContainerProps {
  children: JSX.Element[];
  rowCount: number;
}

export function LimitedTagContainer(props: LimitedTagContainerProps) {
  const {children, rowCount} = props;

  const items = React.useMemo(() => React.Children.map(children, (child) => child), [children]);

  const {overflowRef, visibleCount} = useVisibleOverflow(items, rowCount);
  const containerOverflow = visibleCount < items.length;

  return (
    <div className="iui-tag-container" ref={overflowRef}>
      {containerOverflow ? (
        <>
          {items.slice(0, visibleCount - 1)}

          <div className="iui-tag" style={{display: "inline-block"}}>
            <DropdownMenu
              menuItems={() => items.slice(visibleCount - 1)}
            >
              <IconButton styleType="borderless" size="small" style={{height: "33px"}}>
                <SvgMore />
              </IconButton>
            </DropdownMenu>
          </div>
        </>
      ) : items}
    </div>
  );
}

interface Size {
  width: number;
  height: number;
}

function useVisibleOverflow(items: React.ReactNode[], rowCount: number) {
  const containerRef = React.useRef<HTMLElement>(null);
  const [size, setSize] = React.useState<Size>({width: 0, height: 0});

  const [visibleCount, setVisibleCount] = React.useState(items.length);

  const updateSize = React.useCallback((width: number, height: number) => {
    setSize({width, height});
  }, []);

  const resizeRef = useResizeObserver(updateSize);
  const renderAllItems = React.useRef(true);

  React.useLayoutEffect(() => {
    setVisibleCount(items.length);
    renderAllItems.current = true;
  }, [items]);

  React.useLayoutEffect(() => {
    if (!containerRef.current)
      return;

    if (!renderAllItems.current) {
      let highestItem = 0;

      for (let i = 0; i < containerRef.current.children.length; i++) {
        const child = containerRef.current.children[i] as HTMLElement;
        const childTopOffset = child.offsetTop - (containerRef.current?.offsetTop ?? 0);
        if (child.offsetHeight > highestItem) {
          highestItem = child.offsetHeight;
        }

        if (childTopOffset >= highestItem * rowCount) {
          setVisibleCount(i);
          break;
        }
      }
    }

    renderAllItems.current = false;
  }, [size, visibleCount, items, rowCount]);

  return {overflowRef: useMergedRefs(containerRef, resizeRef), visibleCount};
}
