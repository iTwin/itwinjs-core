/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DOMParser, XMLSerializer } from "xmldom";

export function createEmptyXmlDocument(): Document {
  return new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`);
}

export function getElementChildren(xmlElement: Element): Element[] {
  // NodeListOf<T> does not define [Symbol.iterator]
  const children = Array.from(xmlElement.childNodes).filter((child) => {
    // (node.nodeType === 1) implies instanceof Element
    // https://developer.mozilla.org/en-US/docs/Web/API/ParentNode/children#Polyfill
    return child.nodeType === 1;
  });
  return children as Element[];
}

export function getElementChildrenByTagName(xmlElement: Element, tagName: string | RegExp): Element[] {
  const children = getElementChildren(xmlElement);
  if ("*" === tagName)
    return children;
  let result = new Array<Element>();
  if (typeof tagName === "string") {
    result = children.filter((child) => {
      return tagName.toLowerCase() === child.nodeName.toLowerCase();
    });
  } else {
    result = children.filter((child) => {
      return tagName.test(child.nodeName);
    });
  }
  return result;
}

export function xmlToString(value: Document | Element) {
  return new XMLSerializer().serializeToString(value);
}
