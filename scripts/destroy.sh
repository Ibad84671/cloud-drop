#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${STACK_NAME:-clouddrop-dev}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
FRONTEND_BUCKET="clouddrop-frontend-${ENVIRONMENT}-${ACCOUNT_ID}"
UPLOADS_BUCKET="clouddrop-uploads-${ENVIRONMENT}-${ACCOUNT_ID}"

for bucket in "$FRONTEND_BUCKET" "$UPLOADS_BUCKET"; do
  if aws s3api head-bucket --bucket "$bucket" --region "$REGION" >/dev/null 2>&1; then
    aws s3 rm "s3://${bucket}" --recursive --region "$REGION"
  fi
done

aws cloudformation delete-stack --region "$REGION" --stack-name "$STACK_NAME"
aws cloudformation wait stack-delete-complete --region "$REGION" --stack-name "$STACK_NAME"
echo "CloudDrop stack and managed S3 buckets deleted."
