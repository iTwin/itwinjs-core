#-------------------------------------------------------------------------------------------
# bsimethod                                     Sam.Wilson
#-------------------------------------------------------------------------------------------
import sys, os, re, string, re

allFdecls = []
allTypes = {}

exampleCode = {
    'iModel_bbox_areaxy':           'EcsqlGeometryFunctions.iModel_bbox_areaxy',
    'iModel_bbox':                  'EcsqlGeometryFunctions.iModel_bbox_areaxy',
    'iModel_spatial_overlap_aabb':  'ECSqlStatement.spatialQuery',
    'iModel_bbox_union':            'EcsqlGeometryFunctions.iModel_bbox_union',
    'iModel_placement':             'EcsqlGeometryFunctions.iModel_bbox_union',
    'iModel_point':                 'EcsqlGeometryFunctions.iModel_bbox_union',
    'iModel_angles':                'EcsqlGeometryFunctions.iModel_bbox_union',
    'iModel_bbox':                  'EcsqlGeometryFunctions.iModel_bbox_union',
}

def reformatDoxygenMarkup(line):
    # Formatting markup -- TODO
    line = line.replace("\\a", "")
    line = line.replace("\\em", "")

    # @see -> links
    i = line.find("@see")
    if i == -1:
        return line
    line = line.replace("@see", "")
    seelist = line[i:].split(",")
    repl = "@see "
    sep = ""
    for s in seelist:
        s = s.strip()
        repl = repl + sep + "["+s+"](#"+s+")"
        sep = ", "
    line = line[0:i]
    line = line + repl
    return line

def formatLinkToType(t):
    if t == "iModel_aabb":
        t = "iModel_bbox"

    if not allTypes.has_key(t):
        return t

    return "[" + t + "](#" + t + ")"

def getParamsTableHeader():
    return "\n|Parameter|Type|Description\n|---|---|---\n"

def getReturnTableHeader():
    return "\n|Return Type|Description\n|---|---\n"

def processTypes(o):
    docTypes = ""
    typeDesc = ""
    wasEmittingDecl = False
    inPreamble = True

    for l in o:
        l = l.strip()

        if l.startswith("// "):
            continue

        if inPreamble:
            if l.startswith("*/"):
                inPreamble = False
            continue

        l = reformatDoxygenMarkup(l)

        if l.startswith("//! "):
            # All comments are type comments
            typeDesc = typeDesc + l[4:] + "\n"
        else:
            decls = l.split()
            if len(decls) > 1 and decls[0] == "struct":
                # Found definition of a type
                typeName = decls[1]
                if wasEmittingDecl:
                    docTypes = docTypes + "```\n"
                docTypes = docTypes + "\n-------------\n"
                docTypes = docTypes + "## " + typeName + "\n"
                docTypes = docTypes + typeDesc
                docTypes = docTypes + "```\n"
                docTypes = docTypes + "\n"
                typeDesc = ""
                allTypes[decls[1]] = ""
                wasEmittingDecl = True

            # Everything between comments is a type definition
            l = l.replace("//!<", "//")
            docTypes = docTypes + l + "\n"

    if wasEmittingDecl:
        docTypes = docTypes + "```\n"

    return docTypes

def processFunction(doc):

    # The last line is the function declaration:
    # iModel_bbox iModel_placement_eabb(iModel_placement placement)
    # iModel_angles iModel_angles(double yaw, double pitch, double roll)
    o = re.match(r'(\w+)\s*(\w+)\s*[(]\s*(.*)[)]', doc[len(doc)-1])
    if o == None:
        return ""

    returnType = o.group(1)
    fname = o.group(2)
    args = o.group(3)

    doc = doc[0:len(doc)-1] # drop the signature line

    fdecl = fname + "("

    sep = ""
    argPlaceHolderNames = ["X1", "X2", "X3", "X4", "X5"]
    iNextArgPlaceHolderName = 0
    argsAndTypes = {}
    for a in args.split(','):
        tn = a.strip().split()

        if len(tn) > 1:
            aname = tn[1]
        else:
            aname = argPlaceHolderNames[iNextArgPlaceHolderName]
            iNextArgPlaceHolderName = iNextArgPlaceHolderName + 1

        argsAndTypes[aname] = tn[0]

        fdecl = fdecl + sep + aname

        sep = ", "

    fdecl = fdecl + ")"
    fdecl = fdecl.replace(" ", "")

    allFdecls.append(fname)

    # The rest of the lines are the function comment, the args, and the return value. For example:
    # Construct a iModel_angles from 3 values
    # @param yaw The Yaw angle in degrees
    # @param pitch The Pitch angle in degrees
    # @param roll The Roll angle in degrees
    # @return a iModel_angles object
    docParams = ""
    returnDesc = ""
    docRefs = ""
    functionComment = ""
    for l in doc:
        l = l.strip()
        if l.find("/**") != -1 or l.find("*/") != -1 or l.find("<p>") != -1 or l.find("__PUBLISH_INSERT_FILE__") != -1:
            continue

        l = reformatDoxygenMarkup(l)

        if l.startswith("@param"):
            paramDoc = l.split()
            paramDoc = paramDoc[1:] # drop @param keyword

            if len(docParams) == 0:
                docParams = getParamsTableHeader()

            paramName = paramDoc[0].strip()
            paramType = formatLinkToType(argsAndTypes[paramName].strip())
            paramDesc = ""
            if len(paramDoc) >= 2:
                paramDesc = " ".join(paramDoc[2:])

            docParams = docParams + "|" + paramName + "|" + paramType + "|" + paramDesc + "\n"

        else:
            if l.startswith("@return"):
                returnDesc = l[7:]
                continue
            else:
                if l.startswith("@see"):
                    docRefs = docRefs + l
                    continue
                else:
                    # This is part of the function comment
                    functionComment = functionComment + l

    if len(docParams) == 0 and len(argsAndTypes) != 0:
        # Missing parameter docs.
        docParams = getParamsTableHeader()
        for argName in argsAndTypes:
            docParams = docParams + "|" + argName + "|" + formatLinkToType(argsAndTypes[argName])

    docReturn = ""
    if returnType != "" and returnType != "void":
        docReturn = getReturnTableHeader() + "|" + formatLinkToType(returnType) + "|"
        if returnDesc != "":
            docReturn = docReturn + returnDesc

    if len(docRefs) != 0:
        docRefs = docRefs.replace("@see", ", ")   # hack to get rid of @see in the middle of the list
        docRefs = "@see " + docRefs[2:]

    exampleDoc = ""
    if exampleCode.has_key(fname):
        exampleDoc = "\n*Example:*\n``` ts\n[[include:" + exampleCode[fname] + "]]\n```\n"

    fdoc = "\n-------------------\n"
    fdoc = fdoc + "## " + fname + "\n"
    fdoc = fdoc + "\n```\n" + fdecl + "\n```\n"
    fdoc = fdoc + functionComment + "\n"
    fdoc = fdoc + docParams + "\n"
    fdoc = fdoc + docReturn  + "\n"
    fdoc = fdoc + docRefs + "\n"
    fdoc = fdoc + exampleDoc + "\n"
    fdoc = fdoc + "\n"

    return fdoc

def main(sourceFile):
    with open(sourceFile, 'r') as f:
        lines = f.readlines()

    tdocs = ""
    fdocs = ""
    indoc = False
    doc = []
    for line in lines:
        if not indoc:
            indoc = line.startswith("// __PUBLISH_SECTION_START__")
        else:
            if line.startswith("// __PUBLISH_SECTION_END__"):
                if not doc[0].find("@addtogroup") == -1:
                    tdocs = processTypes(doc)
                else:
                    fdocs = fdocs + processFunction(doc)
                doc = []
                indoc = False
            else:
                doc.append(line)

    flinks = ""
    allFdecls.sort()
    sep = ""
    for f in allFdecls:
        flinks = flinks + sep + '[' + f + '](#' + f + ')'
        sep = ", "

    tlinks = ""
    allFdecls.sort()
    sep = ""
    for t in allTypes:
        tlinks = tlinks + sep + '[' + t + '](#' + f + ')'
        sep = ", "

    print "# ECSQL Built-in Geometry Functions"
    print "Types: "
    print tlinks
    print ""
    print "Functions: "
    print flinks
    print "# Types"
    print tdocs
    print "# Functions"
    print fdocs

if __name__ == '__main__':
    main(sys.argv[1])