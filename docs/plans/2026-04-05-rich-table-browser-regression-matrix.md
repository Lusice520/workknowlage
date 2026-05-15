# RichTable Browser Regression Matrix

This matrix defines the minimum scenarios that must stay green while the RichTable architecture is being reshaped.

## Contract

- page scroll with active table
- editor scroll with active table
- toolbar visibility and anchor semantics
- add-row and add-col affordances
- rounded corners
- equal-width action
- merged-cell guardrail

## Coverage Notes

- The matrix is intentionally small and user-facing.
- Each scenario should be covered by either a behavior assertion or a rendered regression test.
- If a later refactor makes one of these scenarios impossible to express, the refactor should stop and the contract should be revisited first.
