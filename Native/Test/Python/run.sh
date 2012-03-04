#!/bin/sh

. ../helpers.sh

BUILD_OS=$(uname -s)
BUILD_ARCH=$(uname -m)
BUILD_TYPE=Debug

if [ "${BUILD_OS#MINGW}" != "$BUILD_OS" ]; then
  BUILD_OS=Windows
  BUILD_ARCH=x86
fi
if [ "$BUILD_OS" = "Darwin" ]; then
  BUILD_REAL_ARCH=$BUILD_ARCH
  BUILD_ARCH=universal
fi

if [ "$BUILD_OS" = "Darwin" ]; then
  EXTS_DIR="../../dist/$BUILD_OS/$BUILD_ARCH/$BUILD_TYPE/FabricEngine/Library/Fabric/Exts"
elif [ "$BUILD_OS" = "Windows" ]; then
  EXTS_DIR="../../dist/$BUILD_OS/$BUILD_ARCH/$BUILD_TYPE/FabricEngine/Exts"
else
  EXTS_DIR="../../dist/$BUILD_OS/$BUILD_ARCH/$BUILD_TYPE/Exts"
fi

if [ -n "$FABRIC_TEST_WITH_VALGRIND" ]; then
  VALGRIND_CMD="valgrind --suppressions=../valgrind.suppressions.$BUILD_OS --leak-check=full -q"
else
  VALGRIND_CMD=
fi

REPLACE=0
if [ "$1" = "-r" ]; then
  REPLACE=1
  shift
fi

if [ "$BUILD_OS" = "Windows" ]; then
  OUTPUT_FILTER="dos2unix --d2u"
else
  OUTPUT_FILTER=cat
fi

ERROR=0
for f in "$@"; do
  TMPFILE=$(tmpfilename)

  # -u unbuffered IO so print() and FABRIC_LOG() line up
  CMD="python -u $f"
  
  PYTHONPATH="$PYTHONPATH" $VALGRIND_CMD $CMD 2>&1 \
    | grep -v '^\[FABRIC\] Fabric Engine version' \
    | grep -v '^\[FABRIC\] This build of Fabric' \
    | grep -v '^\[FABRIC\] .*Extension registered' \
    | grep -v '^\[FABRIC\] .*Searching extension directory' \
    | grep -v '^\[FABRIC\] .*unable to open extension directory' \
    | $OUTPUT_FILTER >$TMPFILE

  if [ "$REPLACE" -eq 1 ]; then
    mv $TMPFILE ${f%.py}.out
    echo "REPL $(basename $f)"
  else
    EXPFILE=${f%.py}.$BUILD_OS.$BUILD_ARCH.out
    [ -f "$EXPFILE" ] || EXPFILE=${f%.py}.out
    if ! cmp $TMPFILE $EXPFILE; then
      echo "FAIL $(basename $f)"
      echo "Expected output:"
      if [ -f $EXPFILE ]; then
        cat $EXPFILE
      else
        echo "(missing $EXPFILE)"
      fi
      echo "Actual output ($TMPFILE):"
      cat $TMPFILE
      echo "To debug:"
      echo PYTHONPATH="$PYTHONPATH" "gdb --args" $CMD
      ERROR=1
      break
    else
      echo "PASS $(basename $f)";
      rm $TMPFILE
    fi
  fi
done
if [ -d TMP ]; then
	rm -r TMP
fi
if [ "$ERROR" -eq 1 ]; then
	exit 1
fi