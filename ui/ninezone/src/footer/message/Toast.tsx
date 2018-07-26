/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Timer } from "@bentley/ui-core";

import CommonProps from "../../utilities/Props";
import Activity from "./Activity";
import "./Toast.scss";
import Css from "../../utilities/Css";
import Rectangle from "../../utilities/Rectangle";

export interface ToastProps extends CommonProps {
  animateOutTo?: React.ReactInstance;
  onStageChange?: (state: Stage) => void;
  onAnimatedOut?: () => void;
  stage: Stage;
  timeout?: number;
}

export default class Toast extends React.Component<ToastProps> {
  private static readonly DEFAULT_TIMEOUT = 2000;

  private _timer: Timer = new Timer(Toast.DEFAULT_TIMEOUT);
  private _toast: React.RefObject<HTMLDivElement>;

  public constructor(props: ToastProps) {
    super(props);

    this._toast = React.createRef();
  }

  public componentDidMount(): void {
    this._timer.setOnExecute(() => this.setStage(Stage.AnimatingOut));

    this._timer.delay = this.props.timeout || Toast.DEFAULT_TIMEOUT;
    this._timer.start();
  }

  public componentWillUnmount(): void {
    this._timer.stop();
  }

  public componentWillReceiveProps(nextProps: Readonly<ToastProps>): void {
    if (nextProps.stage === Stage.AnimatingOut && this.props.stage !== Stage.AnimatingOut)
      this.animateOut();
    else if (nextProps.stage === Stage.Visible && this.props.stage !== Stage.Visible) {
      this._timer.delay = this.props.timeout || Toast.DEFAULT_TIMEOUT;
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
          {this.props.children}
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
