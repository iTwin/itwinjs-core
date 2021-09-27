/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import "./AccuDrawFieldContainer.scss";
import classnames from "classnames";
import * as React from "react";
import { ColorDef } from "@itwin/core-common";
import { CompassMode, IModelApp, ItemField, ScreenViewport, SelectedViewportChangedArgs } from "@itwin/core-frontend";
import { IconSpecUtilities } from "@itwin/appui-abstract";
import { CommonProps, IconSpec, Orientation, UiSettingsStorage } from "@itwin/core-react";
import { getCSSColorFromDef } from "@itwin/imodel-components-react";

import { AccuDrawInputField } from "./AccuDrawInputField";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";
import { AccuDrawSetCompassModeEventArgs, AccuDrawSetFieldFocusEventArgs, AccuDrawSetFieldLockEventArgs, FrameworkAccuDraw } from "./FrameworkAccuDraw";
import { AccuDrawUiSettings } from "./AccuDrawUiSettings";

import angleIconSvg from "./angle.svg?sprite";
import distanceIconSvg from "./distance.svg?sprite";

/** Properties for [[AccuDrawFieldContainer]] component
 * @beta */
export interface AccuDrawFieldContainerProps extends CommonProps {
  /** Orientation of the fields */
  orientation: Orientation;
  /** Optional parameter for persistent UI settings. Defaults to LocalSettingsStorage. */
  uiSettingsStorage?: UiSettingsStorage;
  /** @internal */
  showZOverride?: boolean;
}

let AccuDrawContainerIndex = 0;

function determineShowZ(vp?: ScreenViewport): boolean {
  const showZ = (vp !== undefined) ? /* istanbul ignore next */ vp.view.is3d() : false;
  return showZ;
}

const defaultXLabel = "X";
const defaultYLabel = "Y";
const defaultZLabel = "Z";
const defaultAngleIcon = IconSpecUtilities.createSvgIconSpec(angleIconSvg);
const defaultDistanceIcon = IconSpecUtilities.createSvgIconSpec(distanceIconSvg);

/** AccuDraw Ui Field Container displays [[AccuDrawInputField]] for each field
 * @beta */
export function AccuDrawFieldContainer(props: AccuDrawFieldContainerProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { className, style, orientation, uiSettingsStorage, showZOverride, ...otherProps } = props;

  const [containerIndex] = React.useState(() => ++AccuDrawContainerIndex);
  const xInputRef = React.useRef<HTMLInputElement>(null);
  const yInputRef = React.useRef<HTMLInputElement>(null);
  const zInputRef = React.useRef<HTMLInputElement>(null);
  const angleInputRef = React.useRef<HTMLInputElement>(null);
  const distanceInputRef = React.useRef<HTMLInputElement>(null);
  const focusField = React.useRef<ItemField | undefined>(undefined);
  const [mode, setMode] = React.useState(CompassMode.Rectangular);
  const [xLock, setXLock] = React.useState(false);
  const [yLock, setYLock] = React.useState(false);
  const [zLock, setZLock] = React.useState(false);
  const [angleLock, setAngleLock] = React.useState(false);
  const [distanceLock, setDistanceLock] = React.useState(false);
  const [showZ, setShowZ] = React.useState(true);
  const [xLabel, setXLabel] = React.useState<string | undefined>(defaultXLabel);
  const [yLabel, setYLabel] = React.useState<string | undefined>(defaultYLabel);
  const [zLabel, setZLabel] = React.useState<string | undefined>(defaultZLabel);
  const [angleLabel, setAngleLabel] = React.useState<string | undefined>(undefined);
  const [distanceLabel, setDistanceLabel] = React.useState<string | undefined>(undefined);
  const [xIcon, setXIcon] = React.useState<IconSpec | undefined>(undefined);
  const [yIcon, setYIcon] = React.useState<IconSpec | undefined>(undefined);
  const [zIcon, setZIcon] = React.useState<IconSpec | undefined>(undefined);
  const [angleIcon, setAngleIcon] = React.useState<IconSpec | undefined>(defaultAngleIcon);
  const [distanceIcon, setDistanceIcon] = React.useState<IconSpec | undefined>(defaultDistanceIcon);
  const [xStyle, setXStyle] = React.useState<React.CSSProperties | undefined>(undefined);
  const [yStyle, setYStyle] = React.useState<React.CSSProperties | undefined>(undefined);
  const [zStyle, setZStyle] = React.useState<React.CSSProperties | undefined>(undefined);
  const [angleStyle, setAngleStyle] = React.useState<React.CSSProperties | undefined>(undefined);
  const [distanceStyle, setDistanceStyle] = React.useState<React.CSSProperties | undefined>(undefined);

  const getInputRef = (field: ItemField): React.RefObject<HTMLInputElement> => {
    let inputRef: React.RefObject<HTMLInputElement>;
    switch (field) {
      case ItemField.X_Item:
        inputRef = xInputRef;
        break;
      case ItemField.Y_Item:
        inputRef = yInputRef;
        break;
      case ItemField.Z_Item:
        inputRef = zInputRef;
        break;
      case ItemField.ANGLE_Item:
        inputRef = angleInputRef;
        break;
      case ItemField.DIST_Item:
        inputRef = distanceInputRef;
        break;
    }
    return inputRef;
  };

  React.useEffect(() => {
    setXLock(IModelApp.accuDraw.getFieldLock(ItemField.X_Item));
    setYLock(IModelApp.accuDraw.getFieldLock(ItemField.Y_Item));
    setZLock(IModelApp.accuDraw.getFieldLock(ItemField.Z_Item));
    setAngleLock(IModelApp.accuDraw.getFieldLock(ItemField.ANGLE_Item));
    setDistanceLock(IModelApp.accuDraw.getFieldLock(ItemField.DIST_Item));

    const handleSetFieldLock = (args: AccuDrawSetFieldLockEventArgs) => {
      switch (args.field) {
        case ItemField.X_Item:
          setXLock(args.lock);
          break;
        case ItemField.Y_Item:
          setYLock(args.lock);
          break;
        case ItemField.Z_Item:
          setZLock(args.lock);
          break;
        case ItemField.ANGLE_Item:
          setAngleLock(args.lock);
          break;
        case ItemField.DIST_Item:
          setDistanceLock(args.lock);
          break;
      }
    };
    return FrameworkAccuDraw.onAccuDrawSetFieldLockEvent.addListener(handleSetFieldLock);
  }, []);

  const setFocusToField = React.useCallback((field: ItemField) => {
    const inputRef = getInputRef(field);

    // istanbul ignore else
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  React.useEffect(() => {
    const handleSetFieldFocus = (args: AccuDrawSetFieldFocusEventArgs) => {
      focusField.current = args.field;
      setFocusToField(focusField.current);
    };
    return FrameworkAccuDraw.onAccuDrawSetFieldFocusEvent.addListener(handleSetFieldFocus);
  }, [setFocusToField]);

  React.useEffect(() => {
    const handleGrabInputFocus = () => {
      // istanbul ignore else
      if (focusField.current)
        setFocusToField(focusField.current);
    };
    return FrameworkAccuDraw.onAccuDrawGrabInputFocusEvent.addListener(handleGrabInputFocus);
  }, [setFocusToField]);

  React.useEffect(() => {
    setMode(IModelApp.accuDraw.compassMode);

    const handleSetMode = (args: AccuDrawSetCompassModeEventArgs) => {
      setMode(args.mode);
    };

    return FrameworkAccuDraw.onAccuDrawSetCompassModeEvent.addListener(handleSetMode);
  }, []);

  const handleValueChanged = React.useCallback((field: ItemField, stringValue: string) => {
    FrameworkAccuDraw.setFieldValueFromUi(field, stringValue);
  }, []);

  const handleEscPressed = React.useCallback(() => {
    KeyboardShortcutManager.setFocusToHome();
  }, []);

  React.useEffect(() => {
    setShowZ(showZOverride || determineShowZ(IModelApp.viewManager.selectedView));

    // istanbul ignore next
    const handleSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
      setShowZ(determineShowZ(args.current));
    };

    return IModelApp.viewManager.onSelectedViewportChanged.addListener(handleSelectedViewportChanged);
  }, [showZOverride]);

  React.useEffect(() => {

    const createFieldStyle = (inStyle: React.CSSProperties | undefined,
      backgroundColor: ColorDef | string | undefined,
      foregroundColor: ColorDef | string | undefined): React.CSSProperties | undefined => {
      let fieldStyle: React.CSSProperties | undefined;
      let rgbaString = "";
      if (inStyle || backgroundColor || foregroundColor) {
        fieldStyle = inStyle ? inStyle : {};
        if (backgroundColor) {
          rgbaString = typeof backgroundColor === "string" ? backgroundColor : getCSSColorFromDef(backgroundColor);
          fieldStyle = { ...fieldStyle, backgroundColor: rgbaString };
        }
        if (foregroundColor) {
          rgbaString = typeof foregroundColor === "string" ? foregroundColor : getCSSColorFromDef(foregroundColor);
          fieldStyle = { ...fieldStyle, color: rgbaString };
        }
      }
      return fieldStyle;
    };

    const processAccuDrawUiSettings = (settings?: AccuDrawUiSettings) => {
      setXStyle(settings ? createFieldStyle(settings.xStyle, settings.xBackgroundColor, settings.xForegroundColor) : undefined);
      setYStyle(settings ? createFieldStyle(settings.yStyle, settings.yBackgroundColor, settings.yForegroundColor) : undefined);
      setZStyle(settings ? createFieldStyle(settings.zStyle, settings.zBackgroundColor, settings.zForegroundColor) : undefined);
      setAngleStyle(settings ? createFieldStyle(settings.angleStyle, settings.angleBackgroundColor, settings.angleForegroundColor) : undefined);
      setDistanceStyle(settings ? createFieldStyle(settings.distanceStyle, settings.distanceBackgroundColor, settings.distanceForegroundColor) : undefined);

      setXLabel(settings && settings.xLabel !== undefined ? settings.xLabel : defaultXLabel);
      setYLabel(settings && settings.yLabel !== undefined ? settings.yLabel : defaultYLabel);
      setZLabel(settings && settings.zLabel !== undefined ? settings.zLabel : defaultZLabel);
      setAngleLabel(settings && settings.angleLabel !== undefined ? settings.angleLabel : undefined);
      setDistanceLabel(settings && settings.distanceLabel !== undefined ? settings.distanceLabel : undefined);

      setXIcon(settings && settings.xIcon !== undefined ? settings.xIcon : undefined);
      setYIcon(settings && settings.yIcon !== undefined ? settings.yIcon : undefined);
      setZIcon(settings && settings.zIcon !== undefined ? settings.zIcon : undefined);
      setAngleIcon(settings && settings.angleIcon !== undefined ? settings.angleIcon : defaultAngleIcon);
      setDistanceIcon(settings && settings.distanceIcon !== undefined ? settings.distanceIcon : defaultDistanceIcon);
    };

    if (FrameworkAccuDraw.uiSettings)
      processAccuDrawUiSettings(FrameworkAccuDraw.uiSettings);

    // istanbul ignore next
    const handleAccuDrawUiSettingsChanged = () => {
      processAccuDrawUiSettings(FrameworkAccuDraw.uiSettings);
    };

    return FrameworkAccuDraw.onAccuDrawUiSettingsChangedEvent.addListener(handleAccuDrawUiSettingsChanged);
  }, []);

  const classNames = classnames(
    "uifw-accudraw-field-container",
    (orientation === Orientation.Vertical) ? "uifw-accudraw-field-container-vertical" : "uifw-accudraw-field-container-horizontal",
    className,
  );

  const delay = 250;
  const labelCentered = (xLabel !== undefined && xLabel.length === 1 && yLabel !== undefined && yLabel.length === 1 && zLabel !== undefined && zLabel.length === 1);

  return (
    <div className={classNames} style={style} {...otherProps}>
      {mode === CompassMode.Rectangular &&
        <>
          <AccuDrawInputField ref={xInputRef} isLocked={xLock} className="uifw-accudraw-x-value" style={xStyle}
            field={ItemField.X_Item} id={`uifw-accudraw-x-${containerIndex}`} data-testid="uifw-accudraw-x"
            label={xLabel} iconSpec={xIcon} labelCentered={labelCentered}
            valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(ItemField.X_Item, stringValue)}
            onEscPressed={handleEscPressed} />
          <AccuDrawInputField ref={yInputRef} isLocked={yLock} className="uifw-accudraw-y-value" style={yStyle}
            field={ItemField.Y_Item} id={`uifw-accudraw-y-${containerIndex}`} data-testid="uifw-accudraw-y"
            label={yLabel} iconSpec={yIcon} labelCentered={labelCentered}
            valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(ItemField.Y_Item, stringValue)}
            onEscPressed={handleEscPressed} />
          {showZ &&
            <AccuDrawInputField ref={zInputRef} isLocked={zLock} className="uifw-accudraw-z-value" style={zStyle}
              field={ItemField.Z_Item} id={`uifw-accudraw-z-${containerIndex}`} data-testid="uifw-accudraw-z"
              label={zLabel} iconSpec={zIcon} labelCentered={labelCentered}
              valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(ItemField.Z_Item, stringValue)}
              onEscPressed={handleEscPressed} />
          }
        </>
      }
      {mode === CompassMode.Polar &&
        <>
          <AccuDrawInputField ref={angleInputRef} isLocked={angleLock} className="uifw-accudraw-angle-value" style={angleStyle}
            field={ItemField.ANGLE_Item} id={`uifw-accudraw-angle-${containerIndex}`} data-testid="uifw-accudraw-angle"
            label={angleLabel} iconSpec={angleIcon}
            valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(ItemField.ANGLE_Item, stringValue)}
            onEscPressed={handleEscPressed} />
          <AccuDrawInputField ref={distanceInputRef} isLocked={distanceLock} className="uifw-accudraw-distance-value" style={distanceStyle}
            field={ItemField.DIST_Item} id={`uifw-accudraw-distance-${containerIndex}`} data-testid="uifw-accudraw-distance"
            label={distanceLabel} iconSpec={distanceIcon}
            valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(ItemField.DIST_Item, stringValue)}
            onEscPressed={handleEscPressed} />
        </>
      }
    </div>
  );
}
