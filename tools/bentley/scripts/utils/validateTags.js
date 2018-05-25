/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

const FS = require('fs-extra');
const Path = require('path');
const objTraverse = require('obj-traverse');

const validTags = ["see", "note", "throws", "param", "deprecated"];

function validateTags(path) {
    let tags = parseFile(path);
    let invalidTags = [];

    for (tag in tags) {
        if (!validTags.includes(tag)) {
            invalidTags.push(tag);
        }
    }
    return invalidTags;
}

function parseFile(path) {
    let allTags = {};

    if (FS.existsSync(path) && FS.statSync(path).isFile()) {
        const contents = FS.readFileSync(path, 'utf-8');
        let jsonContents = JSON.parse(contents);

        let tags = findValues(jsonContents, 'tags');

        for (let j = 0; j < tags.length; j++) {
            for (let i = 0; i < tags[j].length; i++) {
                allTags[tags[j][i]['tag']] = allTags[tags[j][i]['tag']] ? allTags[tags[j][i]['tag']] + 1 : 1;
            }
        }
    }
    return allTags;
}

function findValues(obj, key) {
    return findValuesHelper(obj, key, []);
}

function findValuesHelper(obj, key, list) {
    if (!obj) return list;
    if (obj instanceof Array) {
        for (var i in obj) {
            list = list.concat(findValuesHelper(obj[i], key, []));
        }
        return list;
    }
    if (obj[key]) list.push(obj[key]);

    if ((typeof obj == "object") && (obj !== null)) {
        var children = Object.keys(obj);
        if (children.length > 0) {
            for (i = 0; i < children.length; i++) {
                list = list.concat(findValuesHelper(obj[children[i]], key, []));
            }
        }
    }
    return list;
}

module.exports = {
    validateTags: validateTags,
};