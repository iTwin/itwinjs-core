/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Timer } from "@bentley/ui-core";
import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import Rectangle from "../../utilities/Rectangle";
import Css from "../../utilities/Css";
import Activity from "./Activity";
import "./Toast.scss";

/** Properties of [[Toast]] component. */
export interface ToastProps extends CommonProps, NoChildrenProps {
  /** Element to which the toast will animate out to. */
  animateOutTo?: React.ReactInstance;
  /** Message content. */
  content?: React.ReactNode;
  /** Function called when stage of the toast changes. */
  onStageChange?: (state: Stage) => void;
  /** Function called when toast finishes to animate out. */
  onAnimatedOut?: () => void;
  /** Describes current toast stage. */
  stage: Stage;
  /** Describes timeout after which the toast starts to animate out (in ms). */
  timeout?: number;
}

/** Default properties of [[ToastProps]] used in [[Toast]] component. */
export interface ToastDefaultProps extends Partial<ToastProps> {
  /** Defaults to 2000. */
  timeout: number;
}

/** Footer message that animates out to specified element after some timeout. Used in [[Footer]] component. */
export default class Toast extends React.Component<ToastProps> {
  public static readonly defaultProps: ToastDefaultProps = {
    timeout: 2000,
  };

  private _timer = new Timer(Toast.defaultProps.timeout);
  private _toast = React.createRef<HTMLDivElement>();

  private isWithDefaultProps(): this is { props: ToastDefaultProps } {
    if (this.props.timeout === undefined)
      return false;
    return true;
  }

  public componentDidMount(): void {
    if (!this.isWithDefaultProps())
      return;

    this._timer.setOnExecute(() => this.setStage(Stage.AnimatingOut));

    this._timer.delay = this.props.timeout;
    this._timer.start();
  }

  public componentWillUnmount(): void {
    this._timer.stop();
  }

  public componentWillReceiveProps(nextProps: Readonly<ToastProps>): void {
    if (!this.isWithDefaultProps())
      return;

    if (nextProps.stage === Stage.AnimatingOut && this.props.stage !== Stage.AnimatingOut)
      this.animateOut();
    else if (nextProps.stage === Stage.Visible && this.props.stage !== Stage.Visible) {
      this._timer.delay = this.props.timeout;
      this._timer.start();
      this.resetCss();
    }
  }

  public render() {
    const className = classnames(
      "nz-footer-message-toast",
      StageHelpers.getCssClassName(this.props.stage),
      this.props.className);

    return (
      <Activity
        className={className}
        style={this.props.style}
      >
        <div
          className="nz-toast"
          ref={this._toast}
          onTransitionEnd={this.handleTransitionEnd}
        >
          {this.props.content}
        </div>
      </Activity>
    );
  }

  private handleTransitionEnd = () => {
    this.setStage(Stage.AnimatedOut);
  }

  private setStage(stage: Stage) {
    if (this.props.stage === stage)
      return;

    this.props.onStageChange && this.props.onStageChange(stage);
  }

  private resetCss() {
    if (!this._toast.current)
      return;
    this._toast.current.style.transform = null;
    this._toast.current.style.width = null;
    this._toast.current.style.height = null;
  }

  private animateOut() {
    if (!this._toast.current)
      return;
    if (!this.props.animateOutTo)
      return;

    const animateToElement = ReactDOM.findDOMNode(this.props.animateOutTo);
    if (!(animateToElement instanceof HTMLElement))
      return;

    const animateTo = this.getBounds(animateToElement);
    const toast = this.getBounds(this._toast.current);
    const offset = toast.center().getOffsetTo(animateTo.center()).offsetY(-toast.getHeight() / 2);

    this._toast.current.style.transform = `translate(${offset.x}px, ${offset.y}px)`;

    requestAnimationFrame(() => {
      if (!this._toast.current)
        return;

      this._toast.current.style.width = Css.toPx(toast.getWidth());
      this._toast.current.style.height = Css.toPx(toast.getHeight());

      requestAnimationFrame(() => {
        if (!this._toast.current)
          return;

        this._toast.current.style.width = Css.toPx(0);
        this._toast.current.style.height = Css.toPx(0);
      });
    });
  }

  private getBounds(el: HTMLElement) {
    const bounds = el.getBoundingClientRect();
    return new Rectangle(bounds.left, bounds.top, bounds.right, bounds.bottom);
  }
}

export enum Stage {
  Visible,
  AnimatingOut,
  AnimatedOut,
}

export class StageHelpers {
  public static readonly VISIBLE_CLASS_NAME = "nz-stage-visible";
  public static readonly ANIMATING_OUT_CLASS_NAME = "nz-stage-animating";
  public static readonly ANIMATED_OUT_CLASS_NAME = "nz-stage-animated";

  public static getCssClassName(state: Stage): string {
    switch (state) {
      case Stage.Visible:
        return StageHelpers.VISIBLE_CLASS_NAME;
      case Stage.AnimatingOut:
        return StageHelpers.ANIMATING_OUT_CLASS_NAME;
      case Stage.AnimatedOut:
        return StageHelpers.ANIMATED_OUT_CLASS_NAME;
    }
  }
}
