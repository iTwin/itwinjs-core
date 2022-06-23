import os, re, subprocess, sys

def getSHAFromTag(tag):
  cmd = ['git', 'rev-list', '-n', '1', tag]
  proc = subprocess.Popen(" ".join(cmd), stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  sha = proc.communicate()[0].decode("utf-8").strip()
  if len(sha) == 0:
    sys.exit("Could not find commit for tag '{0}'".format(tag))
  return sha

def getCommitMessage(sha):
  cmd = ['git', 'log', '-1', '--format=%s', sha]
  proc = subprocess.Popen(" ".join(cmd), stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  commitMessage = proc.communicate()[0].decode("utf-8").strip()
  if len(commitMessage) == 0:
    sys.exit("Could not find info for commit " + sha)

  # If commit message contains multiple PR links (in case of backports), remove the earlier one
  pattern = " \(#\d+\)"
  if len(re.findall(pattern, commitMessage)) > 1:
    commitMessage = re.sub(pattern, "", commitMessage, 1)
  return commitMessage

# Tag assumed to be of format release/x.x.x
def createRelease(tag):
  # Parse versions from tags
  currentVer = tag.split("/")[1]
  parsedVer = [int(i) for i in currentVer.split(".")]

  # Write release to file to preview
  fileName = currentVer + ".md"
  if os.path.exists(fileName):
    os.remove(fileName)

  f = open(fileName, "w")
  f.write("# Release notes\n\n")

  # Determine release type
  if parsedVer[2] > 0:
    releaseType = "Patch"
  elif parsedVer[1] > 0:
    releaseType = "Minor"
  else:
    releaseType = "Major"
  print("Generating {0} release notes".format(releaseType.lower()))

  if releaseType == "Patch":
    # Determine previous tag and version
    cmd = ['git', 'describe', '--abbrev=0', '--tags', tag + '~1']
    proc = subprocess.Popen(" ".join(cmd), stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
    previousTag = proc.communicate()[0].decode("utf-8").strip()
    if (len(previousTag) == 0):
      sys.exit("Could not find previous tag for " + tag)

    previousVer = previousTag.split("/")[1]

    # Get SHAs for both tags
    previousSHA = getSHAFromTag(previousTag)
    currentSHA = getSHAFromTag(tag)

    # Get all commit SHAs between tags
    cmd = ['git', 'rev-list', '--ancestry-path', previousSHA + '..' + currentSHA]
    proc = subprocess.Popen(" ".join(cmd), stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
    # Remove first commit from this list as it will always be a version bump commit
    commits = proc.communicate()[0].decode("utf-8").split()[1:]

    # Write commit messages to release notes
    f.write("## Changes\n\n")
    for commit in commits[::-1]:
      f.write("- {0}\n".format(getCommitMessage(commit)))
    f.write("\n")
    f.write("**Full changelog:** [{0}...{1}](https://github.com/iTwin/itwinjs-core/compare/{2}...{3})\n".format(previousVer, currentVer, previousTag, tag))

  else:
    # If major/minor release, link to the changelog in ./docs/changehistory
    f.write("For the full list of changes see the [detailed release notes.](./docs/changehistory/{0}.md)\n".format(currentVer))

  f.close()

  print("Publishing GitHub release...")
  cmd = ['gh', 'release', 'create', tag, '-F', './' + fileName, '-t', '"v{0}"'.format(currentVer)]
  proc = subprocess.Popen(" ".join(cmd), stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  proc.wait()

# Validate arguments
if len(sys.argv) != 2:
  sys.exit("Invalid number of arguments to script provided.\nExpected: 1\nReceived: {0}".format(len(sys.argv) - 1))

releaseTag = sys.argv[1]
print("Creating release for " + releaseTag)
createRelease(releaseTag)
