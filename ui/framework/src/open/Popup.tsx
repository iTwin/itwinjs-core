// import * as classnames from "classnames";
import * as React from "react";
import * as classnames from "classnames";
import { Div, withOnOutsideClick } from "@bentley/ui-core";
import "./Popup.scss";

// tslint:disable-next-line:variable-name
const DivWithOnOutsideClick = withOnOutsideClick(Div);

/**
 * Common props used by all components.
 */
interface CommonProps extends ClassNameProps {
  style?: React.CSSProperties;
  showShadow?: boolean;
  showOverlay?: boolean;
}

/** Props used by components that expect class name to be passed in. */
interface ClassNameProps {
  className?: string;
}

/** Properties of [[Popover]] component. */
export interface PopoverProps extends CommonProps {
  /** Popover content. */
  children?: React.ReactNode;
  onClose?: () => void;
}

/** Popover component. */
// tslint:disable-next-line:variable-name
export const Popup: React.StatelessComponent<PopoverProps> = (props) => {
  const className = classnames(props.className, props.showShadow && "popup-shadow");
  const overlayClassName = classnames("popup-overlay", props.showOverlay && "show");
  return (
    <div>
      <DivWithOnOutsideClick className={className} onOutsideClick={() => { props.onClose && props.onClose(); }}>
        {props.children}
      </DivWithOnOutsideClick>
      <div className={overlayClassName}/>
    </div>
  );
};

export default Popup;
