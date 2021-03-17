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
import {
  AccuDrawField, AccuDrawMode,
  AccuDrawSetFieldFocusEventArgs, AccuDrawSetFieldLockEventArgs, AccuDrawSetModeEventArgs,
  AccuDrawUiAdmin, IconSpecUtilities,
} from "@bentley/ui-abstract";
import { CommonProps, IconSpec, Orientation, UiSettings } from "@bentley/ui-core";
import { AccuDrawInputField } from "./AccuDrawInputField";
import { CompassMode, IModelApp, ItemField, ScreenViewport, SelectedViewportChangedArgs } from "@bentley/imodeljs-frontend";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";

import angleIconSvg from "./angle.svg?sprite";
import distanceIconSvg from "./distance.svg?sprite";
import { FrameworkAccuDraw } from "./FrameworkAccuDraw";
import { AccuDrawUiSettings } from "./AccuDrawUiSettings";
import { getCSSColorFromDef } from "@bentley/ui-components";
import { ColorDef } from "@bentley/imodeljs-common";

/** @alpha */
export interface AccuDrawFieldContainerProps extends CommonProps {
  /** Orientation of the fields */
  orientation: Orientation;
  /** Optional parameter for persistent UI settings. Defaults to LocalUiSettings. */
  uiSettings?: UiSettings;
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

/** @alpha */
export function AccuDrawFieldContainer(props: AccuDrawFieldContainerProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { className, style, orientation, uiSettings, showZOverride, ...otherProps } = props;

  const [containerIndex] = React.useState(() => ++AccuDrawContainerIndex);
  const xInputRef = React.useRef<HTMLInputElement>(null);
  const yInputRef = React.useRef<HTMLInputElement>(null);
  const zInputRef = React.useRef<HTMLInputElement>(null);
  const angleInputRef = React.useRef<HTMLInputElement>(null);
  const distanceInputRef = React.useRef<HTMLInputElement>(null);
  const focusField = React.useRef<AccuDrawField | undefined>(undefined);
  const [mode, setMode] = React.useState(AccuDrawMode.Rectangular);
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

  const getInputRef = (field: AccuDrawField): React.RefObject<HTMLInputElement> => {
    let inputRef: React.RefObject<HTMLInputElement>;
    switch (field) {
      case AccuDrawField.X:
        inputRef = xInputRef;
        break;
      case AccuDrawField.Y:
        inputRef = yInputRef;
        break;
      case AccuDrawField.Z:
        inputRef = zInputRef;
        break;
      case AccuDrawField.Angle:
        inputRef = angleInputRef;
        break;
      case AccuDrawField.Distance:
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
        case AccuDrawField.X:
          setXLock(args.lock);
          break;
        case AccuDrawField.Y:
          setYLock(args.lock);
          break;
        case AccuDrawField.Z:
          setZLock(args.lock);
          break;
        case AccuDrawField.Angle:
          setAngleLock(args.lock);
          break;
        case AccuDrawField.Distance:
          setDistanceLock(args.lock);
          break;
      }
    };
    return AccuDrawUiAdmin.onAccuDrawSetFieldLockEvent.addListener(handleSetFieldLock);
  }, []);

  const setFocusToField = React.useCallback((field: AccuDrawField) => {
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
    return AccuDrawUiAdmin.onAccuDrawSetFieldFocusEvent.addListener(handleSetFieldFocus);
  }, [setFocusToField]);

  React.useEffect(() => {
    const handleGrabInputFocus = () => {
      // istanbul ignore else
      if (focusField.current)
        setFocusToField(focusField.current);
    };
    return AccuDrawUiAdmin.onAccuDrawGrabInputFocusEvent.addListener(handleGrabInputFocus);
  }, [setFocusToField]);

  React.useEffect(() => {
    const compassMode = IModelApp.accuDraw.compassMode;
    const accuDrawMode = compassMode === CompassMode.Rectangular ? AccuDrawMode.Rectangular : AccuDrawMode.Polar;
    setMode(accuDrawMode);

    const handleSetMode = (args: AccuDrawSetModeEventArgs) => {
      setMode(args.mode);
    };

    return AccuDrawUiAdmin.onAccuDrawSetModeEvent.addListener(handleSetMode);
  }, []);

  const handleValueChanged = React.useCallback((field: AccuDrawField, stringValue: string) => {
    IModelApp.uiAdmin.accuDrawUi.setFieldValueFromUi(field, stringValue);
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
          fieldStyle = {...fieldStyle, backgroundColor: rgbaString};
        }
        if (foregroundColor) {
          rgbaString = typeof foregroundColor === "string" ? foregroundColor : getCSSColorFromDef(foregroundColor);
          fieldStyle = {...fieldStyle, color: rgbaString};
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
      {mode === AccuDrawMode.Rectangular &&
        <>
          <AccuDrawInputField ref={xInputRef} isLocked={xLock} className="uifw-accudraw-x-value" style={xStyle}
            field={AccuDrawField.X} id={`uifw-accudraw-x-${containerIndex}`} data-testid="uifw-accudraw-x"
            label={xLabel} iconSpec={xIcon} labelCentered={labelCentered}
            valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.X, stringValue)}
            onEscPressed={handleEscPressed} />
          <AccuDrawInputField ref={yInputRef} isLocked={yLock} className="uifw-accudraw-y-value" style={yStyle}
            field={AccuDrawField.Y} id={`uifw-accudraw-y-${containerIndex}`} data-testid="uifw-accudraw-y"
            label={yLabel} iconSpec={yIcon} labelCentered={labelCentered}
            valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.Y, stringValue)}
            onEscPressed={handleEscPressed} />
          {showZ &&
            <AccuDrawInputField ref={zInputRef} isLocked={zLock} className="uifw-accudraw-z-value" style={zStyle}
              field={AccuDrawField.Z} id={`uifw-accudraw-z-${containerIndex}`} data-testid="uifw-accudraw-z"
              label={zLabel} iconSpec={zIcon} labelCentered={labelCentered}
              valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.Z, stringValue)}
              onEscPressed={handleEscPressed} />
          }
        </>
      }
      {mode === AccuDrawMode.Polar &&
        <>
          <AccuDrawInputField ref={angleInputRef} isLocked={angleLock} className="uifw-accudraw-angle-value" style={angleStyle}
            field={AccuDrawField.Angle} id={`uifw-accudraw-angle-${containerIndex}`} data-testid="uifw-accudraw-angle"
            label={angleLabel} iconSpec={angleIcon}
            valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.Angle, stringValue)}
            onEscPressed={handleEscPressed} />
          <AccuDrawInputField ref={distanceInputRef} isLocked={distanceLock} className="uifw-accudraw-distance-value" style={distanceStyle}
            field={AccuDrawField.Distance} id={`uifw-accudraw-distance-${containerIndex}`} data-testid="uifw-accudraw-distance"
            label={distanceLabel} iconSpec={distanceIcon}
            valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.Distance, stringValue)}
            onEscPressed={handleEscPressed} />
        </>
      }
    </div>
  );
}
