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
  AccuDrawField, AccuDrawMode, AccuDrawSetFieldFocusEventArgs,
  AccuDrawSetFieldLockEventArgs, AccuDrawSetFieldValueToUiEventArgs, AccuDrawSetModeEventArgs,
  AccuDrawUiAdmin,
  IconSpecUtilities,
} from "@bentley/ui-abstract";
import { CommonProps, Orientation, UiSettings } from "@bentley/ui-core";
import { AccuDrawInputField } from "./AccuDrawInputField";
import { CompassMode, IModelApp, ItemField } from "@bentley/imodeljs-frontend";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";
import angleIcon from "./angle.svg?sprite";
import distanceIcon from "./distance.svg?sprite";

/** @alpha */
export interface AccuDrawFieldContainerProps extends CommonProps {
  /** Orientation of the fields */
  orientation: Orientation;
  /** Optional parameter for persistent UI settings. Defaults to LocalUiSettings. */
  uiSettings?: UiSettings;
}

/** @alpha */
export function AccuDrawFieldContainer(props: AccuDrawFieldContainerProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { className, style, uiSettings, ...otherProps } = props;

  const [mode, setMode] = React.useState(AccuDrawMode.Rectangular);
  const [lockField, setLockField] = React.useState<AccuDrawField | undefined>(undefined);
  const [xValue, setXValue] = React.useState(0);
  const [yValue, setYValue] = React.useState(0);
  const [zValue, setZValue] = React.useState(0);
  const [angleValue, setAngleValue] = React.useState(0);
  const [distanceValue, setDistanceValue] = React.useState(0);
  const [xLock, setXLock] = React.useState(false);
  const [yLock, setYLock] = React.useState(false);
  const [zLock, setZLock] = React.useState(false);
  const [angleLock, setAngleLock] = React.useState(false);
  const [distanceLock, setDistanceLock] = React.useState(false);

  React.useEffect(() => {
    setXValue(IModelApp.accuDraw.getValueByIndex(ItemField.X_Item));
    setYValue(IModelApp.accuDraw.getValueByIndex(ItemField.Y_Item));
    setZValue(IModelApp.accuDraw.getValueByIndex(ItemField.Z_Item));
    setAngleValue(IModelApp.accuDraw.getValueByIndex(ItemField.ANGLE_Item));
    setDistanceValue(IModelApp.accuDraw.getValueByIndex(ItemField.DIST_Item));

    const handleSetFieldValueToUi = (args: AccuDrawSetFieldValueToUiEventArgs) => {
      switch (args.field) {
        case AccuDrawField.X:
          setXValue(args.value);
          break;
        case AccuDrawField.Y:
          setYValue(args.value);
          break;
        case AccuDrawField.Z:
          setZValue(args.value);
          break;
        case AccuDrawField.Angle:
          setAngleValue(args.value);
          break;
        case AccuDrawField.Distance:
          setDistanceValue(args.value);
          break;
      }
    };
    return AccuDrawUiAdmin.onAccuDrawSetFieldValueToUiEvent.addListener(handleSetFieldValueToUi);
  }, []);

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

  React.useEffect(() => {
    const handleSetFieldFocus = (args: AccuDrawSetFieldFocusEventArgs) => {
      setLockField(args.field);
    };
    return AccuDrawUiAdmin.onAccuDrawSetFieldFocusEvent.addListener(handleSetFieldFocus);
  }, []);

  React.useEffect(() => {
    const compassMode = IModelApp.accuDraw.compassMode;
    const accuDrawMode = compassMode === CompassMode.Rectangular ? AccuDrawMode.Rectangular : AccuDrawMode.Polar;
    setMode(accuDrawMode);

    const handleSetMode = (args: AccuDrawSetModeEventArgs) => {
      setMode(args.mode);
    };

    return AccuDrawUiAdmin.onAccuDrawSetModeEvent.addListener(handleSetMode);
  }, []);

  const handleValueChanged = React.useCallback((field: AccuDrawField, value: number, stringValue: string) => {
    IModelApp.uiAdmin.accuDrawUi.setFieldValueFromUi(field, value, stringValue);
  }, []);

  const handleEscPressed = React.useCallback(() => {
    KeyboardShortcutManager.setFocusToHome();
  }, []);

  const classNames = classnames(
    "uifw-accudraw-field-container",
    className,
  );

  const delay = 0;

  return (
    <div className={classNames} style={style} {...otherProps}>
      {mode === AccuDrawMode.Rectangular &&
        <>
          <AccuDrawInputField initialValue={xValue} lock={xLock} className="uifw-accudraw-x-value" valueChangedDelay={delay}
            id="uifw-accudraw-x" label="X"
            setFocus={lockField === AccuDrawField.X}
            onValueChanged={(value, stringValue) => handleValueChanged(AccuDrawField.X, value, stringValue)}
            onEscPressed={handleEscPressed} />
          <AccuDrawInputField initialValue={yValue} lock={yLock} className="uifw-accudraw-y-value" valueChangedDelay={delay}
            id="uifw-accudraw-y" label="Y"
            setFocus={lockField === AccuDrawField.Y}
            onValueChanged={(value, stringValue) => handleValueChanged(AccuDrawField.Y, value, stringValue)}
            onEscPressed={handleEscPressed} />
          <AccuDrawInputField initialValue={zValue} lock={zLock} className="uifw-accudraw-z-value" valueChangedDelay={delay}
            id="uifw-accudraw-z" label="Z"
            setFocus={lockField === AccuDrawField.Z}
            onValueChanged={(value, stringValue) => handleValueChanged(AccuDrawField.Z, value, stringValue)}
            onEscPressed={handleEscPressed} />
        </>
      }
      {mode === AccuDrawMode.Polar &&
        <>
          <AccuDrawInputField initialValue={angleValue} lock={angleLock} className="uifw-accudraw-angle-value" valueChangedDelay={delay}
            id="uifw-accudraw-angle" iconSpec={IconSpecUtilities.createSvgIconSpec(angleIcon)}
            setFocus={lockField === AccuDrawField.Angle}
            onValueChanged={(value, stringValue) => handleValueChanged(AccuDrawField.Angle, value, stringValue)}
            onEscPressed={handleEscPressed} />
          <AccuDrawInputField initialValue={distanceValue} lock={distanceLock} className="uifw-accudraw-distance-value" valueChangedDelay={delay}
            id="uifw-accudraw-distance" iconSpec={IconSpecUtilities.createSvgIconSpec(distanceIcon)}
            setFocus={lockField === AccuDrawField.Distance}
            onValueChanged={(value, stringValue) => handleValueChanged(AccuDrawField.Distance, value, stringValue)}
            onEscPressed={handleEscPressed} />
        </>
      }
    </div>
  );
}
