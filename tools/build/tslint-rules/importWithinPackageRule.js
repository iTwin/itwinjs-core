"use strict";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rule = void 0;
/**
 * This rule prevents the use of import statements that refer to other packages in the monorepo through path manipulation.
 */
const Lint = require("tslint");
const path = require("path");
const fs = require("fs");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithWalker(new NoImportsBeyondPackageWalker(sourceFile, this.getOptions()));
    }
}
exports.Rule = Rule;
Rule.FAILURE_STRING = "Imports beyond package boundary are not allowed";
class NoImportsBeyondPackageWalker extends Lint.RuleWalker {
    constructor(sourceFile, options) {
        super(sourceFile, options);
    }
    visitImportDeclaration(node) {
        const from = node.moduleSpecifier.getText().slice(1, -1);
        const pathComponents = from.split("/");
        const parPaths = getParentCount(pathComponents);
        if (pathComponents[0] === "..") {
            const packageJsonPath = findPackageJson(path.resolve(path.dirname(this.getSourceFile().fileName)));
            if (packageJsonPath) {
                const packageDir = path.dirname(packageJsonPath);
                const rem = this.getSourceFile().fileName.substring(packageDir.length + 1);
                const remComponents = rem.split("/");
                const allowed = remComponents.length - 1;
                if (parPaths > allowed) {
                    this.addFailureAtNode(node, Rule.FAILURE_STRING);
                }
            }
        }
        // call the base version of this visitor to actually parse this node
        super.visitImportDeclaration(node);
    }
}
function findPackageJson(current) {
    let prev;
    do {
        const fileName = path.join(current, "package.json");
        if (fs.existsSync(fileName)) {
            return fileName;
        }
        prev = current;
        current = path.dirname(current);
    } while (prev !== current);
    return undefined;
}
function getParentCount(frompath) {
    let ps = 0;
    for (const p of frompath) {
        if (p === "..") {
            ps = ps + 1;
        }
    }
    return ps;
}
