# ☁️ CloudDrop

> **Fast, Simple, Secure File Sharing — Powered by AWS**

CloudDrop is a serverless file-sharing platform built for the AWS Free Tier. Upload files directly to S3 via presigned URLs, share links securely, and optionally manage transfers with Cognito authentication.

## Architecture
- **Frontend**: S3 + CloudFront (CDN, HTTPS, OAI)
- **Backend**: Lambda + API Gateway (REST)
- **Storage**: S3 (Private) + DynamoDB (Metadata)
- **Auth**: Cognito (Optional)
- **Cleanup**: EventBridge + DynamoDB TTL + S3 Lifecycle

## Quick Deploy
```bash
aws cloudformation deploy --template-file infrastructure/cfn/main.yaml --stack-name clouddrop-dev --capabilities CAPABILITY_IAM
aws s3 sync frontend/ s3://clouddrop-frontend-dev-$(aws sts get-caller-identity --query Account --output text)
Cost
~$0.10 - $0.50/month (portfolio usage). See Cost Model.

Documentation
Architecture Overview

Architecture Decision Records

Security Model

License
MIT
