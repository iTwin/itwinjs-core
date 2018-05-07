#-------------------------------------------------------------------------------------------
# bsimethod                                     Sam.Wilson
#-------------------------------------------------------------------------------------------
import sys, os, re, string, re

allFdecls = []
allTypes = {}

def reformatSee(line):
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

def processOverview(o):
    foundFirstComment = False
    nCode = 0
    for l in o:
        l = l.strip()
        if l.find("@addtogroup") != -1 or l.find("@{") != -1:
            continue
        if l.startswith("// ") or l.startswith("*/"):
            continue

        l = reformatSee(l)

        if l.startswith("//! "):
            if nCode != 0:
                print "```\n"
            l = l[4:]
            foundFirstComment = True
            nCode = 0
            print l
        else:
            if not foundFirstComment:
                print l
                continue

            decls = l.split()
            if len(decls) > 1 and decls[0] == "struct":     # the name of the struct should be a heading, so that we can link to it
                print "## " + decls[1]
                allTypes[decls[1]] = ""

            nCode = nCode + 1

            if nCode == 1:
                print "```"

            print l

    if nCode != 0:
        print "```\n"

    # print "# Functions"

def processDoc(doc):
    if not doc[0].find("@addtogroup") == -1:
        processOverview(doc)
        return

    # The last line is the function declaration:
    # iModel_bbox iModel_placement_eabb(iModel_placement placement);
    # iModel_angles iModel_angles(double yaw, double pitch, double roll);
    o = re.match(r'(\w+)\s*(\w+)\s*[(]\s*(.*)[)]', doc[len(doc)-1]);
    if o == None:
        return

    # rt = o.group(1)
    fname = o.group(2)
    args = o.group(3)

    doc = doc[0:len(doc)-1] # drop the signature line

    fdecl = fname + "("

    sep = ""
    argPlaceHolderNames = ["X1", "X2", "X3", "X4", "X5"]
    iNextArgPlaceHolderName = 0;
    argAndType = {}
    for a in args.split(','):
        tn = a.strip().split();

        if len(tn) > 1:
            aname = tn[1]
        else:
            aname = argPlaceHolderNames[iNextArgPlaceHolderName]
            iNextArgPlaceHolderName = iNextArgPlaceHolderName + 1

        argAndType[aname] = tn[0]

        fdecl = fdecl + sep + aname

        sep = ", "

    fdecl = fdecl + ")"
    fdecl = fdecl.replace(" ", "")

    allFdecls.append(fname)

    print "# " + fname

    printedFdecl = False

    # The preceding lines document the function, the args, and the return value
    # Construct a iModel_angles from 3 values
    # @param yaw The Yaw angle in degrees
    # @param pitch The Pitch angle in degrees
    # @param roll The Roll angle in degrees
    # @return a iModel_angles object

    nParams = 0
    justPrintedBullet = False
    for l in doc:
        l = l.strip();
        if l.find("/**") != -1 or l.find("*/") != -1 or l.find("<p>") != -1 or l.find("__PUBLISH_INSERT_FILE__") != -1:
            continue

        l = reformatSee(l)

        if l.startswith("@") and not printedFdecl:
            print "\n```\n" + fdecl + "\n```\n"
            printedFdecl = True

        if l.startswith("@param"):
            paramDoc = l.split()
            paramDoc = paramDoc[1:] # drop @param keyword

            if nParams == 0:
                l = "\n"
                l = l + "|Parameter|Type|Description\n"
                l = l + "|---|---|---\n"
            else:
                l = ""

            paramName = paramDoc[0].strip()
            paramType = argAndType[paramName].strip()
            paramDesc = ""
            if len(paramDoc) >= 2:
                paramDesc = " ".join(paramDoc[2:])
            if allTypes.has_key(paramType):
                paramType = "[" + paramType + "](#" + paramType + ")"
            l = l + "|" + paramName + "|" + paramType + "|" + paramDesc
            nParams = nParams + 1
        else:
            if l.startswith("@return"):
                l = l.replace("@return", "Returns")

        if justPrintedBullet and not l.startswith("*") and not l.startswith("|"):
            print ""

        print l

        justPrintedBullet = l.startswith("*") or l.startswith("|")

    print ""

def main(sourceFile):
    with open(sourceFile, 'r') as f:
        lines = f.readlines()

    indoc = False
    doc = [];
    for line in lines:
        if not indoc:
            indoc = line.startswith("// __PUBLISH_SECTION_START__")
        else:
            if line.startswith("// __PUBLISH_SECTION_END__"):
                processDoc(doc)
                doc = []
                indoc = False
            else:
                doc.append(line)

    allFdecls.sort()
    for f in allFdecls:
        print '* [' + f + '](#' + f + ')'

if __name__ == '__main__':
    main(sys.argv[1])