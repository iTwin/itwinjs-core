"use strict";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
* This code has been adapted from
* [tslint-react-set-state-usage](https://github.com/sutrkiller/tslint-react-set-state-usage).
*--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rule = void 0;
const ts = require("typescript");
const Lint = require("tslint");
const tsutils_1 = require("tsutils");
const tslintReactSetStateUsageOptions_1 = require("./tslintReactSetStateUsageOptions");
const syntaxWalkerUtils_1 = require("../utils/syntaxWalkerUtils");
const FAILURE_STRING = "Do not pass an object into setState. Use functional setState updater instead.";
const FAILURE_STRING_UPDATER_ONLY = `Do not use callback parameter in setState. Use componentDidUpdate method instead (\"${tslintReactSetStateUsageOptions_1.OPTION_UPDATER_ONLY}\" switch).`;
const getFailureStringForAccessedMember = (accessedMember) => `Do not access 'this.${accessedMember}' in setState. Use arguments from callback function instead.`;
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        const options = tslintReactSetStateUsageOptions_1.parseOptions(this.ruleArguments);
        return this.applyWithFunction(sourceFile, walk, options);
    }
}
exports.Rule = Rule;
Rule.metadata = {
    description: "Requires the setState function to be called with function as the first argument and without 'this.props' nor 'this.state' access within the function.",
    optionExamples: [true],
    options: {
        items: [
            {
                enum: [tslintReactSetStateUsageOptions_1.OPTION_UPDATER_ONLY, tslintReactSetStateUsageOptions_1.OPTION_ALLOW_OBJECT],
                type: "string",
            },
        ],
        maxLength: 1,
        minLength: 0,
        type: "array",
    },
    optionsDescription: "Not configurable.",
    ruleName: "tslint-react-set-state-usage",
    type: "functionality",
    typescriptOnly: false,
};
function walk(ctx) {
    const { sourceFile, options: { updaterOnly, allowObject } } = ctx;
    function cb(node) {
        if (syntaxWalkerUtils_1.isThisSetState(node)) {
            inspectSetStateCall(node, ctx, updaterOnly, allowObject);
        }
        return ts.forEachChild(node, cb);
    }
    return ts.forEachChild(sourceFile, cb);
}
function walkUpdater(updaterArgument, ctx) {
    function cb(node) {
        if (isThisState(node) || isThisProps(node)) {
            inspectThisPropsOrStateContext(node, ctx);
        }
        return ts.forEachChild(node, cb);
    }
    return cb(updaterArgument);
}
function inspectSetStateCall(node, ctx, updaterOnly, allowObject) {
    const { 0: updaterArgument, 1: callbackArgument, length: argumentsCount } = node.arguments;
    // Forbid object literal
    const bareUpdaterArgument = syntaxWalkerUtils_1.removeParentheses(updaterArgument);
    if (!allowObject && tsutils_1.isObjectLiteralExpression(bareUpdaterArgument)) {
        ctx.addFailureAtNode(updaterArgument, FAILURE_STRING);
    }
    else {
        walkUpdater(bareUpdaterArgument, ctx);
    }
    // Forbid second argument if updaterOnly flag set
    if (updaterOnly && argumentsCount > 1) {
        ctx.addFailureAtNode(callbackArgument, FAILURE_STRING_UPDATER_ONLY);
    }
}
function inspectThisPropsOrStateContext(node, ctx) {
    const setStateCall = syntaxWalkerUtils_1.getFirstSetStateAncestor(node.parent);
    if (setStateCall) {
        ctx.addFailureAtNode(node, getFailureStringForAccessedMember(node.name.text));
    }
}
const isThisState = (node) => syntaxWalkerUtils_1.isThisPropertyAccess(node) && node.name.text === "state";
const isThisProps = (node) => syntaxWalkerUtils_1.isThisPropertyAccess(node) && node.name.text === "props";
