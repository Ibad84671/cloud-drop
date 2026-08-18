#!/bin/bash
# Packages each Lambda function into a zip for deployment
for func in backend/functions/*/; do
  if [ -d "$func" ]; then
    echo "Packaging $func..."
    (cd "$func" && zip -r function.zip .)
  fi
done
