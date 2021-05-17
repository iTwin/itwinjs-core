import os, argparse, shutil, glob

parser = argparse.ArgumentParser()
parser.add_argument(
  "--output", help="Output path where xml reports will be copied")
args = parser.parse_args()
workDir = os.getcwd()

listOfPaths = []

for path in glob.iglob((workDir + "/*/*/.nyc_output"), recursive=True):
  listOfPaths.append(path)

for path in glob.iglob((workDir + "/*/*/lib/**/.nyc_output"), recursive=True):
  listOfPaths.append(path)

for path in glob.iglob((workDir + "/*/*/*/lib/**/.nyc_output"), recursive=True):
  listOfPaths.append(path)

outputDir = os.path.join(args.output, "coverageXMLs")
processInfoDir = os.path.join(args.output, "coverageXMLs/processinfo")
if not os.path.exists(processInfoDir):
  os.makedirs(processInfoDir)

for path in listOfPaths:
  for file in glob.iglob((path + "/**"), recursive=True):
    if os.path.isfile(file):
      if "processinfo" in file:
        shutil.copy(file, processInfoDir)
      else:
        shutil.copy(file, outputDir)
