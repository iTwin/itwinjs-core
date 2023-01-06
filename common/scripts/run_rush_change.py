import sys, subprocess

srcBranch = sys.argv[1]
targetBranch = srcBranch

# Second param, is the build reason which will be used to determine the target branch.
# If the build reason is a PR, the target branch changes.
buildReason = sys.argv[2]

if buildReason == "PullRequest":
    # Third param, is the target branch of the PR
    targetBranch = sys.argv[3]

print ("Current branch: " + srcBranch)
print ("Target branch: " + targetBranch)

# Verifying with rush change requires the branch that is being merged into to be provided.  More details, https://rushjs.io/pages/commands/rush_change/.
# With release/* being a potential target branch in addition to master, special case those branches.
if "refs/heads/release" in targetBranch:
    branchCmd = ["-b", targetBranch.replace("refs/heads/", "origin/")]
elif "release" in targetBranch or targetBranch == "imodel02":
    # ADOps uses the branch name (i.e. 'release/2.8.0') for GH PR branch names instead of full refs.
    # or for addon validation when there is a change in native side, but not in itwinjs-core. In this case keep target branch as imodel02
    branchCmd = ["-b", "origin/" + targetBranch]
else:
    # Uses default head ("origin/master"), if not defined
    branchCmd = []

command = ["node", "common/scripts/install-run-rush.js", "change", "-v"] + branchCmd
print ("Executing: " + " ".join(command))

proc = subprocess.Popen(command, stdin = subprocess.PIPE, stdout = subprocess.PIPE, stderr = subprocess.PIPE)
out, err = proc.communicate()
if (out):
  print(out)
if (err):
  print(err)
exit(proc.returncode)
