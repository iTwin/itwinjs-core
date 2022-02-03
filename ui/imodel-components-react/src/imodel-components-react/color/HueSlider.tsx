/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Color
 */

import "./HueSlider.scss";
import classnames from "classnames";
import * as React from "react";
import type { HSVColor } from "@itwin/core-common";
import { SpecialKey } from "@itwin/appui-abstract";
import type { CommonProps } from "@itwin/core-react";
import { UiIModelComponents } from "../UiIModelComponents";

// hue is a value from 0 to 360
function calculateHue(currentPos: number, high: number, isVertical: boolean) {
  // istanbul ignore next
  if (currentPos <= 0) {
    return isVertical ? 359 : 0;
  } else if (currentPos >= high) {
    return isVertical ? 0 : 359;
  } else {
    let percent = ((currentPos * 100) / high);
    if (isVertical)
      percent = 100 - percent;
    return Math.round(((359 * percent) / 100));
  }
}

function calculateChange(currentHue: number, e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, isHorizontal: boolean, container: HTMLDivElement) {
  const { width: containerWidth, height: containerHeight, top: containerTop, left: containerLeft } = container.getBoundingClientRect();

  let x: number | undefined;
  if ("pageX" in e) {
    x = e.pageX;
  } else {
    // istanbul ignore if
    if (undefined === e.touches || 0 === e.touches.length)
      return currentHue;
    x = e.touches[0].pageX;
  }
  // istanbul ignore if
  if (undefined === x)
    return currentHue;

  let y: number | undefined;
  if ("pageY" in e) {
    y = e.pageY;
  } else {
    // istanbul ignore if
    if (undefined === e.touches || 0 === e.touches.length)
      return currentHue;
    y = e.touches[0].pageY;
  }
  // istanbul ignore if
  if (undefined === y)
    return currentHue;

  const pointerX = x - (containerLeft + window.scrollX);
  const pointerY = y - (containerTop + window.scrollY);

  if (!isHorizontal) { // vertical
    return calculateHue(pointerY, containerHeight, true);
  } else {  // horizontal
    return calculateHue(pointerX, containerWidth, false);
  }
}

/** Properties for the [[HueSlider]] React component
 * @beta
 */
export interface HueSliderProps extends React.HTMLAttributes<HTMLDivElement>, CommonProps {
  /** true if slider is oriented horizontal, else vertical orientation is assumed */
  isHorizontal?: boolean;
  /** function to run when user hue is changed */
  onHueChange?: ((hue: HSVColor) => void) | undefined;
  /** HSV Color Value */
  hsv: HSVColor;
}

/** HueSlider component used to set the hue value.
 * @beta
 */
export function HueSlider({ isHorizontal, onHueChange, hsv, className, style }: HueSliderProps) {
  const container = React.useRef<HTMLDivElement>(null);
  const [hueLabel] = React.useState(() => UiIModelComponents.translate("color.hue"));
  const isDragging = React.useRef(false);

  const onChange = React.useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    // istanbul ignore else
    if (container.current) {
      const newHue = calculateChange(hsv.h, e, !!isHorizontal, container.current);
      // istanbul ignore else
      const newColor = hsv.clone(newHue);
      // istanbul ignore else
      if (onHueChange)
        onHueChange(newColor);
    }
  }, [isHorizontal, hsv, onHueChange]);

  const onDragging = React.useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    // istanbul ignore else
    if (isDragging.current) {
      onChange(e);
    }
  }, [onChange]);

  const onMouseUp = React.useCallback(() => {
    // istanbul ignore else
    if (isDragging.current) {
      isDragging.current = false;
    }
  }, []);

  const onTouchEnd = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault();

    // istanbul ignore else
    if (isDragging.current) {
      onChange(event);
      isDragging.current = false;
    }
  }, [onChange]);

  const onMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();

    // istanbul ignore else
    if (e.target !== e.currentTarget) {
      // istanbul ignore else
      if (!isDragging.current) {
        document.addEventListener("mouseup", onMouseUp, { capture: true, once: true });
        isDragging.current = true;
      }
    }

    onChange(e);

    // istanbul ignore else
    if (container.current)
      container.current.focus();
  }, [onChange, onMouseUp]);

  const onTouchStart = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // istanbul ignore else
    if (e.target !== e.currentTarget)
      isDragging.current = true;

    onChange(e);

    // istanbul ignore else
    if (container.current)
      container.current.focus();
  }, [onChange]);

  const onKeyDown = React.useCallback((evt: React.KeyboardEvent<HTMLDivElement>) => {
    let newHue: number | undefined;
    const hueValue = hsv.h;
    if (evt.key === SpecialKey.ArrowLeft || evt.key === SpecialKey.ArrowDown) {
      newHue = hueValue - (evt.ctrlKey ? 10 : 1);
    } else if (evt.key === SpecialKey.ArrowRight || evt.key === SpecialKey.ArrowUp) {
      newHue = hueValue + (evt.ctrlKey ? 10 : 1);
    } else if (evt.key === SpecialKey.PageDown) {
      newHue = hueValue - (evt.ctrlKey ? 180 : 60);
    } else if (evt.key === SpecialKey.PageUp) {
      newHue = hueValue + (evt.ctrlKey ? 180 : 60);
    } else if (evt.key === SpecialKey.Home) {
      newHue = 0;
    } else {
      // istanbul ignore else
      if (evt.key === SpecialKey.End) {
        newHue = 359;
      }
    }

    // istanbul ignore else
    if (undefined !== newHue) {
      // istanbul ignore if
      if (newHue > 359) newHue = 359; // 360 is same as zero
      // istanbul ignore if
      if (newHue < 0) newHue = 0;

      const newColor = hsv.clone(newHue);
      // istanbul ignore else
      if (onHueChange)
        onHueChange(newColor);
      evt.preventDefault();
    }
  }, [hsv, onHueChange]);

  const containerClasses = classnames(
    isHorizontal ? "components-hue-container-horizontal" : "components-hue-container-vertical",
    className,
  );

  const pointerStyle: React.CSSProperties = isHorizontal ? { left: `${(hsv.h * 100) / 360}%`, backgroundColor: `hsl(${hsv.h} ,100%, 50%)` } :
    { left: `0px`, top: `${-((hsv.h * 100) / 360) + 100}%`, backgroundColor: `hsl(${hsv.h} ,100%, 50%)` };

  return (
    <div className={containerClasses} style={style} data-testid="hue-container" >
      <div
        data-testid="hue-slider"
        role="slider" aria-label={hueLabel}
        aria-valuemin={0} aria-valuemax={360} aria-valuenow={hsv.h}
        className="components-hue-slider"
        ref={container}
        onMouseDown={onMouseDown}
        onMouseMove={onDragging}
        onTouchMove={onDragging}
        onMouseUp={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <div style={pointerStyle} className="components-hue-pointer" data-testid="hue-pointer" />
      </div>
    </div >
  );
}
