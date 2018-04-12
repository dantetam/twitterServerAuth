import string
import sys
import io
import re


combos = [first + second for second in string.ascii_lowercase for first in string.ascii_lowercase]

def organizeLatentVec(fname, outputDir):
    with io.open(fname, encoding="latin-1") as openFile:
        for line in openFile:
            spaceCharIndex = 0
            for charIndex in range(0, len(line)):
                if line[charIndex] == " ":
                    spaceCharIndex = charIndex
            word = line[:spaceCharIndex].lower()
            if re.match('^[\w-]+$', word) is None:
                for combo in combos:
                    if word.startswith(combo):
                        with io.open(outputDir + combo + ".txt", 'a', encoding="latin-1") as outputFile:
                            outputFile.write(line)
                        break

print 'Number of arguments:', len(sys.argv), 'arguments.'
print 'Argument List:', str(sys.argv)

if len(sys.argv) != 3:
    print "Usage: python organizeLatentVec.py vecFileName outputDir"
else:
    fname = sys.argv[1]
    outputDir = sys.argv[2]
    organizeLatentVec(fname, outputDir)
