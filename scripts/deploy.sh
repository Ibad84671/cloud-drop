#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${STACK_NAME:-clouddrop-dev}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
REGION="${AWS_REGION:-us-east-1}"

PARAMETERS=("Environment=${ENVIRONMENT}")
if [[ -n "${ARCHIVER_LAYER_ARN:-}" ]]; then PARAMETERS+=("ArchiverLayerArn=${ARCHIVER_LAYER_ARN}"); else echo "WARNING: ARCHIVER_LAYER_ARN is not set; multi-file ZIP finalization will not be available."; fi
if [[ -n "${SES_SOURCE_EMAIL:-}" ]]; then PARAMETERS+=("SesSourceEmail=${SES_SOURCE_EMAIL}"); fi
if [[ -n "${FRONTEND_ORIGIN:-}" ]]; then PARAMETERS+=("FrontendOrigin=${FRONTEND_ORIGIN}"); fi

aws cloudformation deploy --region "${REGION}" --template-file infrastructure/cfn/main.yaml --stack-name "${STACK_NAME}" --parameter-overrides "${PARAMETERS[@]}" --capabilities CAPABILITY_IAM

API_URL=$(aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayURL`].OutputValue' --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" --query 'Stacks[0].Outputs[?OutputKey==`CognitoClientId`].OutputValue' --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" --query 'Stacks[0].Outputs[?OutputKey==`CognitoUserPoolId`].OutputValue' --output text)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET="clouddrop-frontend-${ENVIRONMENT}-${ACCOUNT_ID}"
COGNITO_DOMAIN="clouddrop-${ACCOUNT_ID}-${ENVIRONMENT}.auth.${REGION}.amazoncognito.com"
printf 'window.CLOUDDROP_CONFIG = { apiBase: "%s", region: "%s", cognitoClientId: "%s", cognitoUserPoolId: "%s", cognitoDomain: "%s" };\n' "${API_URL}" "${REGION}" "${CLIENT_ID}" "${USER_POOL_ID}" "${COGNITO_DOMAIN}" > frontend/js/config.js
aws s3 sync frontend/ "s3://${BUCKET}" --delete

DIST_ID=$(aws cloudformation describe-stack-resource --region "${REGION}" --stack-name "${STACK_NAME}" --logical-resource-id CloudFrontDistribution --query StackResourceDetail.PhysicalResourceId --output text)
aws cloudfront create-invalidation --region "${REGION}" --distribution-id "${DIST_ID}" --paths '/*'

echo "Deployment complete."
echo "Frontend bucket: ${BUCKET}"
echo "API: ${API_URL}"
