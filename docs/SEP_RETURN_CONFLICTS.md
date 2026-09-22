# SEP: stale return protection

Before replacing a passport with a reported return, the interface compares its opened snapshot with the current journal entry. A changed or deleted entry rejects the write. The error leaves the return form and entered text available for copying; the user must reload the page and reopen the current map before retrying. Unrelated passports remain in the journal.

This is an optimistic stale-snapshot check, not a cross-tab lock: localStorage does not provide an atomic compare-and-swap. It catches changes already visible when saving, not every possible simultaneous-write race. Existing schemas, Q semantics and imported records remain unchanged. No migration is needed.

Regression coverage includes changed/deleted entries, exact byte preservation on conflict, current-revision updates, unrelated passports and wrong expected IDs.
