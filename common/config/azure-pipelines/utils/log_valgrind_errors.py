"""
Read a valgrind log file and output issues to stdout for a running azure-pipelines agent
to detect.
"""

import sys, re

# ==6451== ERROR SUMMARY: 667 errors from 26 contexts (suppressed: 451 from 451)
pattern = re.compile (r"==\d+== ERROR SUMMARY: (\d+) errors from (\d+) contexts \(suppressed: (\d+) from (\d+)\)")

if len(sys.argv) < 2:
    print ('Syntax: ' + sys.argv[0] + ' logFilePath)')
    exit(1)

logFilePath = sys.argv[1]
numberOfErrors = 0
numberOfSuppressions = 0
with open(logFilePath, 'r') as f:
    lines=f.readlines()
    for line in lines:
        match = pattern.match(line)
        if not match:
            continue
        numberOfErrors += int(match.group(1))
        numberOfSuppressions += int(match.group(3))

msg = 'Found {} errors and {} suppression'.format(numberOfErrors, numberOfSuppressions)

if numberOfErrors >= 1:
    print('##vso[task.logissue type=error]' + msg)
    sys.exit(1)
else:
    print(msg)
