#!/bin/bash
echo "Deploying CloudFormation stack..."
aws cloudformation deploy \
  --template-file infrastructure/cfn/main.yaml \
  --stack-name clouddrop-dev \
  --parameter-overrides Environment=dev \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
echo "Syncing frontend to S3..."
aws s3 sync frontend/ s3://clouddrop-frontend-dev-$(aws sts get-caller-identity --query Account --output text)/ --delete
echo "Invalidating CloudFront cache..."
DIST_ID=$(aws cloudformation describe-stack-resource --stack-name clouddrop-dev --logical-resource-id CloudFrontDistribution --query StackResourceDetail.PhysicalResourceId --output text)
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
