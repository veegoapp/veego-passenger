---
name: Workflow config fix
description: The original Start application workflow had a circular self-reference via workflow.run; must use configureWorkflow() to fix
---

The original `.replit` had:
```
[[workflows.workflow]]
name = "Start application"
[[workflows.workflow.tasks]]
task = "workflow.run"
args = "Start application"   # ← points to itself → deadlock / TASK_FAILED
```

**Fix:** Call `configureWorkflow({ name: "Start application", command: "bash scripts/setup.sh", waitForPort: 5000, outputType: "webview" })` via code_execution.

**Why:** The workflow tool reports TASK_FAILED within the timeout window if the port is never opened (circular reference never opens any port) or if Metro takes >30s cold-start on first launch (without waitForPort the check fires too early).

**How to apply:** Always include `waitForPort: 5000` when configuring this app's workflow. Never edit `.replit` directly — Replit blocks direct edits; use `configureWorkflow()`.
