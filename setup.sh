#!/bin/bash
set -e
echo "🚀 Setting up CloudDrop project structure..."
mkdir -p frontend/css frontend/js frontend/assets backend/functions backend/shared infrastructure/cfn infrastructure/scripts docs/architecture docs/adr docs/deployment docs/operations docs/cost docs/security tests/unit tests/integration tests/e2e scripts .github/workflows

cat > package.json << 'EOF'
{
  "name": "cloud-drop",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "deploy": "./scripts/deploy.sh",
    "destroy": "./scripts/destroy.sh"
  },
  "devDependencies": {
    "@aws-sdk/client-s3": "^3.0.0",
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0",
    "@aws-sdk/client-cognito-identity-provider": "^3.0.0"
  }
}
EOF

cat > .gitignore << 'EOF'
node_modules/
.env
*.zip
.DS_Store
EOF

# Frontend files
cat > frontend/index.html << 'EOF'
<!DOCTYPE html>
<html><head><title>CloudDrop</title></head><body><h1>CloudDrop</h1><p>Coming soon...</p></body></html>
EOF

# Lambda functions (just stubs for now)
mkdir -p backend/functions/create-transfer
cat > backend/functions/create-transfer/index.js << 'EOF'
exports.handler = async (event) => {
  return { statusCode: 200, body: JSON.stringify({ message: "Create transfer" }) };
};
EOF

mkdir -p backend/functions/get-transfer
cat > backend/functions/get-transfer/index.js << 'EOF'
exports.handler = async (event) => {
  return { statusCode: 200, body: JSON.stringify({ message: "Get transfer" }) };
};
EOF

# CloudFormation main template (minimal but deployable)
cat > infrastructure/cfn/main.yaml << 'EOF'
AWSTemplateFormatVersion: '2010-09-09'
Description: 'CloudDrop Infrastructure'
Parameters:
  Environment:
    Type: String
    Default: dev
Resources:
  FrontendBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub 'clouddrop-frontend-${Environment}-${AWS::AccountId}'
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
  UploadsBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub 'clouddrop-uploads-${Environment}-${AWS::AccountId}'
      LifecycleConfiguration:
        Rules:
          - Id: ExpireAfter30Days
            Status: Enabled
            ExpirationInDays: 30
  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        DefaultRootObject: index.html
        Origins:
          - Id: S3Origin
            DomainName: !GetAtt FrontendBucket.RegionalDomainName
            S3OriginConfig:
              OriginAccessIdentity: !Sub 'origin-access-identity/cloudfront/${OAI}'
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6'
          AllowedMethods: [GET, HEAD, OPTIONS]
        ViewerCertificate:
          CloudFrontDefaultCertificate: true
  OAI:
    Type: AWS::CloudFront::CloudFrontOriginAccessIdentity
    Properties:
      CloudFrontOriginAccessIdentityConfig:
        Comment: !Sub 'OAI for ${Environment}'
Outputs:
  CloudFrontURL:
    Description: 'CloudDrop URL'
    Value: !GetAtt CloudFrontDistribution.DomainName
EOF

# Deploy script
cat > scripts/deploy.sh << 'EOF'
#!/bin/bash
aws cloudformation deploy --template-file infrastructure/cfn/main.yaml --stack-name clouddrop-dev --parameter-overrides Environment=dev --capabilities CAPABILITY_IAM
aws s3 sync frontend/ s3://clouddrop-frontend-dev-$(aws sts get-caller-identity --query Account --output text) --delete
DIST_ID=$(aws cloudformation describe-stack-resource --stack-name clouddrop-dev --logical-resource-id CloudFrontDistribution --query StackResourceDetail.PhysicalResourceId --output text)
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
EOF
chmod +x scripts/deploy.sh

cat > scripts/destroy.sh << 'EOF'
#!/bin/bash
aws cloudformation delete-stack --stack-name clouddrop-dev
EOF
chmod +x scripts/destroy.sh

# README
cat > README.md << 'EOF'
# CloudDrop
Serverless file sharing on AWS.
EOF

echo "✅ Setup complete. Run 'npm install' then 'npm run deploy'"