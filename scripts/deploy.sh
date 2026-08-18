#!/bin/bash
aws cloudformation deploy --template-file infrastructure/cfn/main.yaml --stack-name clouddrop-dev --parameter-overrides Environment=dev --capabilities CAPABILITY_IAM
aws s3 sync frontend/ s3://clouddrop-frontend-dev-$(aws sts get-caller-identity --query Account --output text) --delete
DIST_ID=$(aws cloudformation describe-stack-resource --stack-name clouddrop-dev --logical-resource-id CloudFrontDistribution --query StackResourceDetail.PhysicalResourceId --output text)
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
