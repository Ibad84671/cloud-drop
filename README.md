# ☁️ CloudDrop

> **Fast, Simple, Secure File Sharing — Powered by AWS Serverless**

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![AWS](https://img.shields.io/badge/AWS-Serverless-orange)](https://aws.amazon.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Deployed](https://img.shields.io/badge/Deployed-CloudFront-important)](https://d4smvqjjk25nu.cloudfront.net)

CloudDrop is a professional serverless file-sharing platform inspired by services like WeTransfer & TransferNow. Upload files directly to S3, generate secure shareable links, and manage transfers — **no account required for basic sharing**.

🔗 **Live Demo:** [https://d4smvqjjk25nu.cloudfront.net](https://d4smvqjjk25nu.cloudfront.net)

---

## ✨ Features

- 📤 **Guest Uploads** — Share files without creating an account.
- 🔗 **Secure Share Links** — One‑click copy & share (valid for 7 days).
- 👤 **Optional Authentication** — Sign up with Cognito to manage transfers.
- 📊 **Dashboard** — View, manage, and delete your uploads.
- 🗑️ **Auto Cleanup** — Files expire automatically (S3 Lifecycle + DynamoDB TTL).
- 🚀 **Serverless Architecture** — Highly scalable, pay‑per‑use, near‑zero cost.
- 🔒 **Secure by Design** — Presigned URLs, private S3 buckets, IAM least privilege.

---

## 🏗️ Architecture

![CloudDrop Architecture Diagram](https://via.placeholder.com/800x400?text=Architecture+Diagram+Placeholder)

> *Add your custom architecture diagram here. You can generate one using Draw.io or Excalidraw.*

### System Flow

```mermaid
sequenceDiagram
    participant User
    participant CloudFront as CloudFront (CDN)
    participant S3Frontend as S3 (Frontend)
    participant APIGW as API Gateway
    participant Lambda as Lambda Functions
    participant S3Uploads as S3 (Uploads)
    participant DynamoDB as DynamoDB
    participant Cognito as Cognito (Auth)

    User->>CloudFront: 1. Request / (Upload Page)
    CloudFront->>S3Frontend: Fetch index.html
    S3Frontend-->>CloudFront: index.html
    CloudFront-->>User: Serve Page

    User->>APIGW: 2. POST /transfer (File Metadata)
    APIGW->>Lambda: Invoke create-transfer
    Lambda->>DynamoDB: Store Metadata (transferId, owner, expiry)
    Lambda->>S3Uploads: Generate Presigned Upload URL
    Lambda-->>APIGW: Return Presigned URL
    APIGW-->>User: Respond with Upload URL

    User->>S3Uploads: 3. PUT File (Direct Upload via Presigned URL)
    S3Uploads-->>User: 200 OK (File Stored)

    User->>APIGW: 4. POST /transfer/{id}/complete
    APIGW->>Lambda: Invoke complete-upload
    Lambda->>DynamoDB: Update Status to 'ready'
    Lambda-->>APIGW: Success
    APIGW-->>User: Share Link Generated

    Note over User,Cognito: Recipient Side
    Recipient->>CloudFront: 5. GET /t/{transferId}
    CloudFront->>S3Frontend: Fetch t.html (via Function Rewrite)
    S3Frontend-->>CloudFront: Download Page
    CloudFront-->>Recipient: Serve t.html

    Recipient->>APIGW: 6. GET /transfer/{id}
    APIGW->>Lambda: Invoke get-transfer
    Lambda->>DynamoDB: Fetch Metadata
    Lambda->>S3Uploads: Generate Presigned Download URL
    Lambda-->>APIGW: Return Download URL
    APIGW-->>Recipient: JSON with Download URL

    Recipient->>S3Uploads: 7. GET File (Direct Download)
    S3Uploads-->>Recipient: File Downloaded
🛠️ Tech Stack
Layer	Technology
Frontend	HTML5, CSS3, Vanilla JavaScript
CDN & Routing	Amazon CloudFront + CloudFront Functions
Compute	AWS Lambda (Node.js 18)
API	Amazon API Gateway (REST)
Storage	Amazon S3 (Private Buckets)
Database	Amazon DynamoDB (On‑Demand)
Authentication	Amazon Cognito (User Pool)
Cleanup	DynamoDB TTL + EventBridge Scheduler
Infrastructure	AWS CloudFormation (IaC)
CI/CD	GitHub Actions
💰 Cost Breakdown
CloudDrop is designed for AWS Free Tier and portfolio usage.

Service	Expected Monthly Cost
S3 (Frontend + Uploads)	~$0.05 (Free Tier covers 5GB)
CloudFront	~$0.00 (Free Tier: 1TB transfer)
Lambda	~$0.00 (Free Tier: 1M requests)
API Gateway	~$0.00 (Free Tier: 1M requests)
DynamoDB	~$0.05 (Pay-per-request)
Cognito	~$0.00 (Free Tier: 50K MAU)
EventBridge	~$0.00 (Free Tier)
Total	~$0.10 – $1.00/month
No NAT Gateway, no ALB, no EC2, no RDS — truly serverless.

🚀 Quick Deploy (From Scratch)
Prerequisites
AWS CLI configured (aws configure)

Node.js & NPM installed

Git installed

Steps
Clone the Repository

bash
git clone https://github.com/your-username/cloud-drop.git
cd cloud-drop
Deploy the Infrastructure

bash
aws cloudformation deploy \
  --template-file infrastructure/cfn/main.yaml \
  --stack-name clouddrop-dev \
  --parameter-overrides Environment=dev \
  --capabilities CAPABILITY_IAM
Sync Frontend & Invalidate CloudFront

bash
aws s3 sync frontend/ s3://clouddrop-frontend-dev-$(aws sts get-caller-identity --query Account --output text) --delete
aws cloudfront create-invalidation --distribution-id $(aws cloudformation describe-stack-resource --stack-name clouddrop-dev --logical-resource-id CloudFrontDistribution --query StackResourceDetail.PhysicalResourceId --output text) --paths "/*"
Get the CloudFront URL

bash
aws cloudformation describe-stacks --stack-name clouddrop-dev --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" --output text
Open the URL in your browser! 🎉

🔐 Security Architecture
Private S3 Buckets — Block Public Access enabled.

CloudFront OAI — Frontend bucket accessible only via CloudFront.

Presigned URLs — Short-lived, direct S3 upload/download (no Lambda data pass-through).

IAM Least Privilege — Lambda roles with minimal required permissions.

Cognito Authorizer — Protects authenticated routes (/user/transfers, DELETE /transfer/{id}).

Input Validation — File size, type, and name sanitization.

📁 Project Structure
text
cloud-drop/
├── frontend/                 # Static website assets
│   ├── index.html            # Upload page
│   ├── login.html            # Cognito redirect
│   ├── dashboard.html        # User dashboard
│   ├── t.html                # Download page
│   └── css/
│       └── style.css
├── backend/
│   └── functions/            # Lambda source code (reference)
│       ├── create-transfer/
│       ├── get-transfer/
│       ├── complete-upload/
│       ├── delete-transfer/
│       └── list-transfers/
├── infrastructure/
│   └── cfn/
│       └── main.yaml         # CloudFormation template
├── docs/
│   ├── adr/                  # Architecture Decision Records
│   ├── architecture/         # Detailed design docs
│   └── cost/                 # Cost analysis
├── scripts/                  # Deployment utilities
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD Pipeline
├── README.md
├── LICENSE
├── SECURITY.md
└── CONTRIBUTING.md
🤝 Contributing
Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

📄 License
Distributed under the MIT License. See LICENSE for more information.

📧 Contact
Project Link: https://github.com/your-username/cloud-drop

🌟 Acknowledgements
AWS for the incredible free tier.

TransferNow & WeTransfer for UX inspiration.