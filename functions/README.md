# Firebase Cloud Functions (Stubs)

This directory includes reference Cloud Functions that keep Firestore aggregates in sync with attendance updates.

## Overview

| Function | Trigger | Purpose |
| --- | --- | --- |
| `onAttendanceWrite` | Firestore (`users/{userId}/attendance/{workDate}`) | Normalises the written attendance document, derives total/overtime minutes, and updates the user monthly summary document. |
| `nightlySummaryRebuild` | Cloud Scheduler (`0 3 * * *`) | Rebuilds the monthly aggregates for all employees once per night as a safety net. |

Both functions expect the Firestore layout described in the project specification:

```
users/{userId}
  └─ attendance/{YYYY-MM-DD}
  └─ monthlySummary/{YYYY-MM}
```

## Local Testing

1. Install dependencies:
   ```bash
   cd functions
   npm install
   ```
2. Start the Firebase emulators (in a separate terminal):
   ```bash
   firebase emulators:start --only firestore,functions
   ```
3. Write test documents (via emulator UI or scripts) and verify that aggregates update as expected.

## Deployment

Deploy the Functions with:

```bash
firebase deploy --only functions
```

Make sure your Firebase project has the following before deployment:

- Cloud Scheduler enabled (required for `nightlySummaryRebuild`).
- Service account with permission to read/write the Firestore collections used above.

These stubs focus on business logic and omit advanced concerns such as batching for >500 employees, retries, or structured logging. Adjust them to fit production requirements.
