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
import { CommonProps, Orientation, UiSettings } from "@bentley/ui-core";
import { AccuDrawInputField } from "./AccuDrawInputField";
import { CompassMode, IModelApp, ItemField, ScreenViewport, SelectedViewportChangedArgs } from "@bentley/imodeljs-frontend";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";

import angleIcon from "./angle.svg?sprite";
import distanceIcon from "./distance.svg?sprite";

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

  const classNames = classnames(
    "uifw-accudraw-field-container",
    (orientation === Orientation.Vertical) ? "uifw-accudraw-field-container-vertical" : "uifw-accudraw-field-container-horizontal",
    className,
  );

  React.useEffect(() => {
    setShowZ(showZOverride || determineShowZ(IModelApp.viewManager.selectedView));

    // istanbul ignore next
    const handleSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
      setShowZ(determineShowZ(args.current));
    };

    return IModelApp.viewManager.onSelectedViewportChanged.addListener(handleSelectedViewportChanged);
  }, [showZOverride]);

  const delay = 250;

  return (
    <div className={classNames} style={style} {...otherProps}>
      {mode === AccuDrawMode.Rectangular &&
        <>
          <AccuDrawInputField ref={xInputRef} isLocked={xLock} className="uifw-accudraw-x-value"
            field={AccuDrawField.X} id={`uifw-accudraw-x-${containerIndex}`} label="X" data-testid="uifw-accudraw-x"
            valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.X, stringValue)}
            onEscPressed={handleEscPressed} />
          <AccuDrawInputField ref={yInputRef} isLocked={yLock} className="uifw-accudraw-y-value"
            field={AccuDrawField.Y} id={`uifw-accudraw-y-${containerIndex}`} label="Y" data-testid="uifw-accudraw-y"
            valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.Y, stringValue)}
            onEscPressed={handleEscPressed} />
          {showZ &&
            <AccuDrawInputField ref={zInputRef} isLocked={zLock} className="uifw-accudraw-z-value"
              field={AccuDrawField.Z} id={`uifw-accudraw-z-${containerIndex}`} label="Z" data-testid="uifw-accudraw-z"
              valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.Z, stringValue)}
              onEscPressed={handleEscPressed} />
          }
        </>
      }
      {mode === AccuDrawMode.Polar &&
        <>
          <AccuDrawInputField ref={angleInputRef} isLocked={angleLock} className="uifw-accudraw-angle-value"
            field={AccuDrawField.Angle} id={`uifw-accudraw-angle-${containerIndex}`} data-testid="uifw-accudraw-angle"
            iconSpec={IconSpecUtilities.createSvgIconSpec(angleIcon)}
            valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.Angle, stringValue)}
            onEscPressed={handleEscPressed} />
          <AccuDrawInputField ref={distanceInputRef} isLocked={distanceLock} className="uifw-accudraw-distance-value"
            field={AccuDrawField.Distance} id={`uifw-accudraw-distance-${containerIndex}`} data-testid="uifw-accudraw-distance"
            iconSpec={IconSpecUtilities.createSvgIconSpec(distanceIcon)}
            valueChangedDelay={delay} onValueChanged={(stringValue) => handleValueChanged(AccuDrawField.Distance, stringValue)}
            onEscPressed={handleEscPressed} />
        </>
      }
    </div>
  );
}
