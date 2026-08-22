# Assumptions & Business Confirmations

## Documented Assumptions
1. **DE Date**: "DE Date" is assumed to represent *Donor Egg / Donor Embryo Date* or *Diagnostic Evaluation Date*. Stored as an indexed timestamp field (`deDate`) with staff note capability.
2. **Physical Hierarchy Counts**: Seeded with 9 Cans $\times$ 10 Canisters $\times$ 2 Levels $\times$ 1 Goblet $\times$ 11 Viso Tubes (1,980 total Viso Tubes). Hierarchy parameters remain configurable.
3. **Thaw Status**: Thawing a straw sets its physical status to `VACANT` (freeing physical capacity for reuse), while keeping immutable historical thaw records.
4. **Straw Color Uniqueness**: Confirmed that straw color is NOT a unique key. System generates unique IDs (`STR-000001`).
5. **Image Compression**: Images exceeding 2MB are compressed via `sharp` targeting $\le 2\text{ MB}$ without losing text readability. Images under 500KB are preserved in original resolution.
