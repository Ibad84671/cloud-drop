#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${STACK_NAME:-clouddrop-dev}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
REGION="${AWS_REGION:-us-east-1}"

if [[ -z "${ARCHIVER_LAYER_ARN:-}" ]]; then
  echo "ERROR: ARCHIVER_LAYER_ARN must be set because CloudDrop supports multi-file ZIP transfers."
  exit 1
fi

PARAMETERS=("Environment=${ENVIRONMENT}" "ArchiverLayerArn=${ARCHIVER_LAYER_ARN}")
if [[ -n "${SES_SOURCE_EMAIL:-}" ]]; then PARAMETERS+=("SesSourceEmail=${SES_SOURCE_EMAIL}"); fi

aws cloudformation deploy --region "${REGION}" --template-file infrastructure/cfn/main.yaml --stack-name "${STACK_NAME}" --parameter-overrides "${PARAMETERS[@]}" --capabilities CAPABILITY_IAM

# Keep the deployed API contract aligned with the frontend limit. The current
# template defaults to 20; this post-deploy guard makes the live Lambda accept
# the documented 100-file limit until that hard-coded template value is removed.
BATCH_CREATE_FUNCTION=$(aws cloudformation describe-stack-resource --region "${REGION}" --stack-name "${STACK_NAME}" --logical-resource-id BatchCreateFunction --query StackResourceDetail.PhysicalResourceId --output text)
aws lambda update-function-configuration --region "${REGION}" --function-name "$BATCH_CREATE_FUNCTION" --environment "Variables={TABLE_NAME=$(aws lambda get-function-configuration --region "${REGION}" --function-name "$BATCH_CREATE_FUNCTION" --query 'Environment.Variables.TABLE_NAME' --output text),UPLOADS_BUCKET=$(aws lambda get-function-configuration --region "${REGION}" --function-name "$BATCH_CREATE_FUNCTION" --query 'Environment.Variables.UPLOADS_BUCKET' --output text),MAX_FILES=100,MAX_TOTAL_SIZE=2147483648,MAX_FILE_SIZE=2147483648,ALLOWED_ORIGIN=$(aws lambda get-function-configuration --region "${REGION}" --function-name "$BATCH_CREATE_FUNCTION" --query 'Environment.Variables.ALLOWED_ORIGIN' --output text)}" >/dev/null

API_URL=$(aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayURL`].OutputValue' --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" --query 'Stacks[0].Outputs[?OutputKey==`CognitoClientId`].OutputValue' --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" --query 'Stacks[0].Outputs[?OutputKey==`CognitoUserPoolId`].OutputValue' --output text)
COGNITO_DOMAIN=$(aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" --query 'Stacks[0].Outputs[?OutputKey==`CognitoDomain`].OutputValue' --output text)
EMAIL_ENABLED=$(aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" --query 'Stacks[0].Outputs[?OutputKey==`EmailSharingEnabled`].OutputValue' --output text)
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' --output text)

for value in "$API_URL" "$CLIENT_ID" "$USER_POOL_ID" "$COGNITO_DOMAIN" "$CLOUDFRONT_URL"; do
  test -n "$value" && test "$value" != "None"
done

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET="clouddrop-frontend-${ENVIRONMENT}-${ACCOUNT_ID}"
cat > frontend/js/config.js <<EOF
window.CloudDropConfig = {
  API_BASE: "${API_URL}",
  COGNITO_DOMAIN: "${COGNITO_DOMAIN}",
  COGNITO_CLIENT_ID: "${CLIENT_ID}",
  TRANSFER_DAYS: 7,
  FRONTEND_BASE_URL: "${CLOUDFRONT_URL}"
};
window.CLOUDDROP_CONFIG = {
  apiBase: window.CloudDropConfig.API_BASE,
  region: "${REGION}",
  cognitoClientId: window.CloudDropConfig.COGNITO_CLIENT_ID,
  cognitoUserPoolId: "${USER_POOL_ID}",
  cognitoDomain: window.CloudDropConfig.COGNITO_DOMAIN,
  transferDays: window.CloudDropConfig.TRANSFER_DAYS,
  frontendBaseUrl: window.CloudDropConfig.FRONTEND_BASE_URL,
  emailEnabled: ${EMAIL_ENABLED}
};
EOF

aws s3 sync frontend/ "s3://${BUCKET}" --delete

DIST_ID=$(aws cloudformation describe-stack-resource --region "${REGION}" --stack-name "${STACK_NAME}" --logical-resource-id CloudFrontDistribution --query StackResourceDetail.PhysicalResourceId --output text)
test -n "$DIST_ID" && test "$DIST_ID" != "None"
aws cloudfront create-invalidation --region "${REGION}" --distribution-id "${DIST_ID}" --paths '/*'

echo "Deployment complete."
echo "Frontend: ${CLOUDFRONT_URL}"
echo "API: ${API_URL}"
echo "Email sharing: ${EMAIL_ENABLED}"
