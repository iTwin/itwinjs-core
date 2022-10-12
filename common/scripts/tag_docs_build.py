# import subprocess

# # Get local version from @itwin/core-backend
# cmd = ["node", "-p", "require('./core/backend/package.json').version"]
# process = subprocess.run(cmd, shell=True, capture_output=True)
# package_version = process.stdout.decode().strip()

# # Check npm to see if local version of @itwin/core-backend has been published
# cmd = ["npm", "view", "@itwin/core-backend@" + package_version]
# process = subprocess.run(cmd, shell=True, capture_output=True)

# if process.returncode == 0:
#   print("Version " + package_version + " already exists")
# else:
#   err = process.stderr.decode()
#   if err.find("code E404"):
#     print("Releasing version " + package_version)

#     f = open($(parameters.outputDir) + "/version.txt", "w")
#     f.write(package_version)
#     f.close()

#     print("##vso[build.addbuildtag]iTwinJsDocsRelease")
#   else:
#     print(err)

import os, subprocess, sys

## Validate arguments
if len(sys.argv) != 2:
  sys.exit("Invalid number of arguments to script provided.\nExpected: 1\nReceived: {0}".format(len(sys.argv) - 1))
outputDir = os.path.realpath(sys.argv[1])

# Get local version from @itwin/core-backend
cmd = ["node", "-p", "require('./core/backend/package.json').version"]
process = subprocess.run(cmd, shell=True, capture_output=True)
package_version = process.stdout.decode().strip()
print("Releasing version " + package_version)

f = open(os.path.join(outputDir, "version.txt"), "w")
f.write(package_version)
f.close()
