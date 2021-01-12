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
import { FrameworkAccuDraw } from "./FrameworkAccuDraw";

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
  const [focusField, setFocusField] = React.useState<AccuDrawField | undefined>(undefined);
  const [xFormattedValue, setXFormattedValue] = React.useState("");
  const [yFormattedValue, setYFormattedValue] = React.useState("");
  const [zFormattedValue, setZFormattedValue] = React.useState("");
  const [angleFormattedValue, setAngleFormattedValue] = React.useState("");
  const [distanceFormattedValue, setDistanceFormattedValue] = React.useState("");
  const [xLock, setXLock] = React.useState(false);
  const [yLock, setYLock] = React.useState(false);
  const [zLock, setZLock] = React.useState(false);
  const [angleLock, setAngleLock] = React.useState(false);
  const [distanceLock, setDistanceLock] = React.useState(false);

  React.useEffect(() => {
    setXFormattedValue(FrameworkAccuDraw.getFieldDisplayValue(ItemField.X_Item));
    setYFormattedValue(FrameworkAccuDraw.getFieldDisplayValue(ItemField.Y_Item));
    setZFormattedValue(FrameworkAccuDraw.getFieldDisplayValue(ItemField.Z_Item));
    setAngleFormattedValue(FrameworkAccuDraw.getFieldDisplayValue(ItemField.ANGLE_Item));
    setDistanceFormattedValue(FrameworkAccuDraw.getFieldDisplayValue(ItemField.DIST_Item));

    const handleSetFieldValueToUi = (args: AccuDrawSetFieldValueToUiEventArgs) => {
      switch (args.field) {
        case AccuDrawField.X:
          setXFormattedValue(args.formattedValue);
          break;
        case AccuDrawField.Y:
          setYFormattedValue(args.formattedValue);
          break;
        case AccuDrawField.Z:
          setZFormattedValue(args.formattedValue);
          break;
        case AccuDrawField.Angle:
          setAngleFormattedValue(args.formattedValue);
          break;
        case AccuDrawField.Distance:
          setDistanceFormattedValue(args.formattedValue);
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
      setFocusField(args.field);
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

  const handleValueChanged = React.useCallback((field: AccuDrawField, stringValue: string) => {
    IModelApp.uiAdmin.accuDrawUi.setFieldValueFromUi(field, stringValue);
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
          <AccuDrawInputField initialValue={xFormattedValue} lock={xLock} className="uifw-accudraw-x-value" valueChangedDelay={delay}
            id="uifw-accudraw-x" label="X"
            setFocus={focusField === AccuDrawField.X}
            onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.X, stringValue)}
            onEscPressed={handleEscPressed} />
          <AccuDrawInputField initialValue={yFormattedValue} lock={yLock} className="uifw-accudraw-y-value" valueChangedDelay={delay}
            id="uifw-accudraw-y" label="Y"
            setFocus={focusField === AccuDrawField.Y}
            onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.Y, stringValue)}
            onEscPressed={handleEscPressed} />
          <AccuDrawInputField initialValue={zFormattedValue} lock={zLock} className="uifw-accudraw-z-value" valueChangedDelay={delay}
            id="uifw-accudraw-z" label="Z"
            setFocus={focusField === AccuDrawField.Z}
            onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.Z, stringValue)}
            onEscPressed={handleEscPressed} />
        </>
      }
      {mode === AccuDrawMode.Polar &&
        <>
          <AccuDrawInputField initialValue={angleFormattedValue} lock={angleLock} className="uifw-accudraw-angle-value" valueChangedDelay={delay}
            id="uifw-accudraw-angle" iconSpec={IconSpecUtilities.createSvgIconSpec(angleIcon)}
            setFocus={focusField === AccuDrawField.Angle}
            onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.Angle, stringValue)}
            onEscPressed={handleEscPressed} />
          <AccuDrawInputField initialValue={distanceFormattedValue} lock={distanceLock} className="uifw-accudraw-distance-value" valueChangedDelay={delay}
            id="uifw-accudraw-distance" iconSpec={IconSpecUtilities.createSvgIconSpec(distanceIcon)}
            setFocus={focusField === AccuDrawField.Distance}
            onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.Distance, stringValue)}
            onEscPressed={handleEscPressed} />
        </>
      }
    </div>
  );
}
