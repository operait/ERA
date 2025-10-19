---
description: Run automated tests for ERA clarification protocol
---

Run the automated Jest tests for the clarification protocol to ensure no regressions.

Please run the following command:

```bash
npm test -- src/templates/__tests__/clarification-protocol.test.ts
```

After running the tests, provide a summary of:
1. Number of tests passed/failed
2. Which tests failed (if any)
3. Recommendation: Should we deploy or fix issues first?

Expected: All 13 tests should pass ✓