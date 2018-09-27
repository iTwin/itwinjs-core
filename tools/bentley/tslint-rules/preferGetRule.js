"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
/** A list of file names (with extensions) that this rule should not be applied to. */
const FILENAME_EXCEPTIONS = [
    "imodeljs-native-platform-api.ts",
];
class Rule extends Lint.Rules.AbstractRule {
    // override
    apply(sourceFile) {
        if (this.shouldSkipFile(sourceFile))
            return [];
        return this.applyWithWalker(new PreferGetWalker(sourceFile, this.getOptions()));
    }
    shouldSkipFile(sourceFile) {
        const filePath = sourceFile.fileName; // sourceFile.fileName contains the full path to the file on this computer
        for (const nameException of FILENAME_EXCEPTIONS) {
            if (filePath.length < nameException.length)
                continue;
            if (nameException === filePath.slice(filePath.length - nameException.length))
                return true;
        }
        return false;
    }
}
Rule.FAILURE_STRING = "Consider replacing this method with a property or add the 'get' modifier. If the value is expensive to compute, consider renaming the method instead.";
exports.Rule = Rule;
class PreferGetWalker extends Lint.RuleWalker {
    // override
    visitMethodDeclaration(node) {
        if (node.parameters.length !== 0)
            return;
        if (!this.isPublic(node) || this.returnsTypeGuard(node))
            return;
        const name = node.name.getText();
        if (this.hasGetterName(name)) {
            this.addFailureAtNode(node, Rule.FAILURE_STRING);
        }
    }
    isPublic(node) {
        if (node.modifiers === undefined)
            return true; // assume no modifiers means public by default
        for (const modifier of node.modifiers) {
            const modText = modifier.getText();
            if (modText === "public")
                return true;
        }
        return false;
    }
    returnsTypeGuard(node) {
        if (node.type === undefined)
            return false;
        const returnText = node.type.getText();
        if (returnText.slice(0, 8) === "this is ")
            return true;
        return false;
    }
    hasGetterName(name) {
        if ((name.length > 2 && name.slice(0, 2) === "is" && name.charAt(2) === name.charAt(2).toUpperCase()) ||
            (name.length > 3 && name.slice(0, 3) === "has" && name.charAt(3) === name.charAt(3).toUpperCase()) ||
            (name.length > 4 && name.slice(0, 4) === "want" && name.charAt(4) === name.charAt(4).toUpperCase())) {
            return true;
        }
        return false;
    }
}
