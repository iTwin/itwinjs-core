/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

const FS = require('fs-extra');
const validTags = ["see", "throws", "note", "param", "deprecated", "module"];

function validateTags(path) {
    let tags = parseFile(path);
    return tags;
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

        let invalidTagObjects = [];
        for (tag in allTags) {
            if (!validTags.includes(tag)) {
                invalidTagObjects.push(tag, findSource(jsonContents, 'tag', tag));
            }
        }
        return invalidTagObjects;
    }
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

function findSource(obj, key, value) {
    return findSourceHelper(obj, key, value, []);
}

function findSourceHelper(obj, key, value, list) {
    if (!obj) return list;
    if (obj instanceof Array) {
        for (var i in obj) {
            list = list.concat(findSourceHelper(obj[i], key, value, []));
        }
        return list;
    }

    //Look for tag in signature or in comment
    if (obj['signatures']) {
        if (obj['signatures'][0] && obj['signatures'][0]['comment'] && obj['signatures'][0]['comment']['tags']) {
            for (let tag in obj['signatures'][0]['comment']['tags']) {
                if (obj['signatures'][0]['comment']['tags'][tag].tag === value && obj['sources'] && obj['sources'][0])
                    list.push(obj['sources'][0]);

            }
        }
    }
    if (obj['comment'] && obj['comment']['tags']) {
        for (let tag in obj['comment']['tags']) {
            if (obj['comment']['tags'][tag].tag === value && obj['sources'] && obj['sources'][0])
                list.push(obj['sources'][0]);
        }
    }

    if ((typeof obj == "object") && (obj !== null)) {
        var children = Object.keys(obj);
        if (children.length > 0) {
            for (i = 0; i < children.length; i++) {
                list = list.concat(findSourceHelper(obj[children[i]], key, value, []));
            }
        }
    }
    return list;
}

module.exports = {
    validateTags: validateTags,
};