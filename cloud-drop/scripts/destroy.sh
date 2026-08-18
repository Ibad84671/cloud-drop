#!/bin/bash
echo "Destroying CloudDrop stack..."
aws cloudformation delete-stack --stack-name clouddrop-dev
echo "Stack deletion initiated. Check AWS Console for progress."
