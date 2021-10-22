/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
* Source file from https://github.com/arqex/react-dom-instance, updated to work with React 17
* https://www.npmjs.com/package/react-dom-instance
*--------------------------------------------------------------------------------------------*/
const optionsDefault = {
  maxIteration: 4,
};
/** For testing only
 * @internal
*/
export function findInstance(node: any, opts?: any): any {
  const options = Object.assign({}, optionsDefault, opts);

  const fiber = getFiberFromNode(node);
  if (!fiber) return false;

  const instance = getInstanceFromFiber(fiber, options.maxIteration);
  if (!instance) return false;

  const target = getTargetInstance(instance, instance, options.componentName, options.maxIteration);
  return target;
}

function getFiberFromNode(node: any) {
  let key = getFiberKey(node);

  if (!key) {
    node = node.children[0];
    key = node && getFiberKey(node);
  }

  return key ? node[key] : false;
}

function getFiberKey(node: any) {
  return Object.keys(node).find((key) => (
    key.startsWith("__reactFiber$")
  ));
}

function getInstanceFromFiber(fiber: any, i: number) {
  let f = fiber;

  // return isInstanceFiber(f) ? f.stateNode : false;

  while (!isInstanceFiber(f) && i-- > 0) {
    f = f && f.return;
  }

  return isInstanceFiber(f) ? f.stateNode : false;
}

function isInstanceFiber(fiber: any) {
  return fiber && fiber.type && typeof fiber.type !== "string" && fiber.stateNode;
}
function getTargetInstance(childInstance: any, parentInstance: any, componentName: any, i: number): any {
  // console.log('getting instance from fiber', childInstance, parentInstance);
  if (!childInstance && !parentInstance) return false;

  if (childInstance && isTarget(childInstance, componentName)) {
    return childInstance;
  }
  if (parentInstance && childInstance !== parentInstance && isTarget(parentInstance, componentName)) {
    return parentInstance;
  }

  if (i <= 0) {
    warn("maxIteration exceeded and not"  + componentName + " instance found."); // eslint-disable-line prefer-template
    return false;
  }

  const childFiber = childInstance && childInstance._reactInternalFiber.child;
  const parentFiber = parentInstance && parentInstance._reactInternalFiber.return;

  return getTargetInstance(
    isInstanceFiber(childFiber) && childFiber.stateNode,
    isInstanceFiber(parentFiber) && parentFiber.stateNode,
    componentName,
    i - 1
  );
}

function isTarget(instance: any, componentName: any) {
  if (!componentName) return true;

  return instance.constructor.name === componentName;
}

function warn(msg: string) {
  typeof console !== undefined && console.warn("ReactInstance:"  + msg); // eslint-disable-line prefer-template, no-console
}
