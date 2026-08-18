# ADR-009: EventBridge Cleanup 
**Decision**: Use EventBridge to trigger cleanup Lambda. 
**Reason**: Serverless scheduled job; cheaper than running a cron on EC2. 
