/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import DOMPurify, * as DOMPurifyNS from "dompurify";
import { isHTMLElement, isReactMessage, MessageType } from "./MessageType";
import { ClassNameProps } from "../utils/Props";

// cSpell:ignore dompurify

/** Properties for the [[MessageRenderer]] component
 * @public
 */
export interface MessageRendererProps extends ClassNameProps {
  /** Message to render */
  message: MessageType;
  /** Indicates whether to use a `span` or `div` element for rendering */
  useSpan?: boolean;
}

/** React component renders a string, HTMLElement or React node in a `div` or `span`
 * @public
 */
export function MessageRenderer(props: MessageRendererProps) {
  let messageNode = null;
  const OutElement = props.useSpan ? "span" : "div";

  if (typeof props.message === "string") {
    messageNode = <OutElement className={props.className}>{props.message}</OutElement>;
  } else if (isHTMLElement(props.message)) {
    // the esm build of dompurify has a default import but the cjs build does not
    // if there is a default export, use it (likely esm), otherwise use the namespace
    // istanbul ignore next
    const sanitizer = DOMPurify ?? DOMPurifyNS; // `sanitizer` is default function name for "jam3/no-sanitizer-with-danger" ESLint rule

    let validAnchors = false;
    let hasAnchors = false;

    // verify that the tag has proper relationships
    const isAnchorValid = (anchor: HTMLAnchorElement): boolean => {
      return anchor.hasAttribute("rel") && (anchor.rel.includes("noopener") || anchor.rel.includes("noreferrer"));
    };

    // recursively check child elements for valid anchor tags
    const checkChildAnchors = (parent: Element) => {
      const children = Array.from(parent.children);
      for (const child of children){
        if (child.hasAttribute("target") && (child as HTMLAnchorElement).target === "_blank") {
          hasAnchors = true;
          validAnchors = isAnchorValid(child as HTMLAnchorElement);
          if (!validAnchors) {
            return;
          }
        }
        checkChildAnchors(child);
      }
    };

    // check for anchor tags in the message that have target _blank also have a relationship that avoids security holes
    // https://web.dev/external-anchors-use-rel-noopener/
    // first check the message element
    /* istanbul ignore else */
    if (props.message.hasAttribute("target") && (props.message as HTMLAnchorElement).target === "_blank") {
      hasAnchors = true;
      validAnchors = isAnchorValid(props.message as HTMLAnchorElement);
    } else {
      // if the message element is not an anchor, recursively verify it's children
      if (props.message.children) {
        checkChildAnchors(props.message);
      }
    }

    let sanitizedHtml;
    if (hasAnchors && validAnchors) {
      // all anchors are valid. do not remove the target attr
      sanitizedHtml = sanitizer.sanitize(props.message.outerHTML, {ADD_ATTR: ["target"]});
    } else {
      sanitizedHtml = sanitizer.sanitize(props.message.outerHTML);
    }

    // we can safely disable jam3/no-sanitizer-with-danger as we are sanitizing above
    // eslint-disable-next-line @typescript-eslint/naming-convention, jam3/no-sanitizer-with-danger
    messageNode = <OutElement className={props.className} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
  } else {
    /* istanbul ignore else */
    if (isReactMessage(props.message))
      messageNode = <OutElement className={props.className}>{props.message.reactNode}</OutElement>;
  }

  return messageNode;
}
