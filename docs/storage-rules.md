# Storage Hierarchy & Business Rules

## Physical Storage Hierarchy
$$\text{Can / Chamber} \longrightarrow \text{Canister} \longrightarrow \text{Level (L1/L2)} \longrightarrow \text{Goblet} \longrightarrow \text{Viso Tube} \longrightarrow \text{Straw} \longrightarrow \text{Embryo}$$

## Key Business Rules Matrix
1. **Straw Capacity Enforced Server-Side**:
   - Maximum **2 embryos per straw**. Enforced at database and service layers.
2. **Straw Identification vs. Color**:
   - Straw color (e.g. Pink, Blue, White, Yellow, Green) is physical visual metadata.
   - Multiple straws of the same color can exist in the same Viso Tube.
   - System generates a unique `strawId`: `STR-XXXXXX`.
3. **Same-Date Storage Grouping**:
   - Embryos stored on the **same date** for a patient are grouped into the same `StorageBatch` and placed in the same Viso Tube if capacity permits.
4. **Different-Date Batch Isolation**:
   - Embryos stored on **different dates** belong to separate `StorageBatches` and are never combined automatically.
5. **Find Empty Storage Recommendation Engine**:
   - Priority 1: Same Viso Tube with available slots (if same-date batch exists).
   - Priority 2: Other available Viso Tube in same Goblet.
   - Priority 3: Global available Viso Tube in clinic.
   - Requires staff confirmation before physical assignment.
6. **Doctor-Directed Thaw Freedom**:
   - Doctor can select any straw for thawing regardless of straw ID, position, or storage date.
   - Thawing updates physical straw status to `VACANT` (freeing physical capacity for reuse), while keeping immutable historical thaw audit logs.
7. **Storage Movement History**:
   - Moving straws between physical locations logs old location, new location, date/time, staff member, and reason.
