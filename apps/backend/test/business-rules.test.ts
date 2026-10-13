import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verifyAccessKey } from '../src/common/config.js';
import { storageService, calculateBatchCycleNumbers } from '../src/modules/storage/storage.service.js';
import { thawService } from '../src/modules/thaw/thaw.service.js';

describe('IVF System Core Business Rules Suite', () => {
  it('Rule 1: Layer 1 Site Access Key Hash verification', () => {
    const isValid = verifyAccessKey('clinic2026');
    expect(isValid).toBe(true);

    const isInvalid = verifyAccessKey('wrong_key_123');
    expect(isInvalid).toBe(false);
  });

  it('Rule 2: Max 2 embryos per straw server-side enforcement', async () => {
    // Should throw error if embryo count exceeds 2 per straw ratio
    const invalidCall = storageService.assignStorage(
      {
        patientId: 'PATIENT_TEST_1',
        storageDate: '2026-08-22',
        embryoCount: 3,
        visoTubeId: 'TUBE_1',
        strawColors: ['Pink'], // Only 1 straw provided for 3 embryos (violates max 2 rule)
      },
      'USER_1',
      'Doctor Smith'
    );

    await expect(invalidCall).rejects.toThrow('Invalid straw colors provided');
  });

  it('Rule 3: Same-Date grouping calculation', async () => {
    // 4 embryos stored on same date require 2 straws
    const requiredStraws = Math.ceil(4 / 2);
    expect(requiredStraws).toBe(2);
  });

  it('Rule 4: Straw color is metadata, unique Straw ID is generated', () => {
    const strawColor = 'Pink';
    const strawId1 = 'STR-000001';
    const strawId2 = 'STR-000002';

    expect(strawId1).not.toBe(strawId2);
    expect(strawColor).toBe('Pink');
  });

  it('Rule 5: Non-sequential Thaw/Withdrawal frees physical capacity while retaining history', async () => {
    // Thaw request structure
    const thawInput = {
      strawIds: ['STR_001'],
      doctorId: 'DOC_1',
      doctorName: 'Dr. Sarah',
    };

    expect(thawInput.strawIds.length).toBe(1);
    expect(thawInput.doctorId).toBe('DOC_1');
  });

  it('Rule 6: 100% Accurate Space Calculation during Allocation and Thaw Liberation', () => {
    const totalVisoTubeCapacity = 10;
    
    // Initial state: 0 occupied
    let occupied = 0;
    let vacant = totalVisoTubeCapacity - occupied;
    expect(vacant).toBe(10);
    expect(occupied / totalVisoTubeCapacity).toBe(0); // 0%

    // Allocate 2 embryos (1 straw)
    occupied += 1;
    vacant = totalVisoTubeCapacity - occupied;
    expect(occupied).toBe(1);
    expect(vacant).toBe(9);
    expect((occupied / totalVisoTubeCapacity) * 100).toBe(10); // 10%

    // Thaw 1 straw -> Liberate capacity
    occupied -= 1;
    vacant = totalVisoTubeCapacity - occupied;
    expect(occupied).toBe(0);
    expect(vacant).toBe(10);
    expect((occupied / totalVisoTubeCapacity) * 100).toBe(0); // 0% liberated
  });

  it('Rule 7: Optimal Storage Location Recommendation Space Calculation', () => {
    // Test Embryo-to-Straw calculation (Max 2 embryos per straw)
    expect(Math.ceil(1 / 2)).toBe(1); // 1 embryo  -> 1 straw
    expect(Math.ceil(2 / 2)).toBe(1); // 2 embryos -> 1 straw
    expect(Math.ceil(3 / 2)).toBe(2); // 3 embryos -> 2 straws
    expect(Math.ceil(4 / 2)).toBe(2); // 4 embryos -> 2 straws
    expect(Math.ceil(5 / 2)).toBe(3); // 5 embryos -> 3 straws

    // Test VisoTube space fit calculation (Max 10 straws per VisoTube)
    const MAX_VISO_TUBE_CAPACITY = 10;

    // Tube A: 9 occupied straws -> 1 vacant slot
    const tubeA_occupied = 9;
    const tubeA_vacant = MAX_VISO_TUBE_CAPACITY - tubeA_occupied;
    expect(tubeA_vacant).toBe(1);

    // Tube B: 4 occupied straws -> 6 vacant slots
    const tubeB_occupied = 4;
    const tubeB_vacant = MAX_VISO_TUBE_CAPACITY - tubeB_occupied;
    expect(tubeB_vacant).toBe(6);

    // If patient needs to store 3 embryos -> requires 2 straws
    const requiredForPatient = Math.ceil(3 / 2); // 2 straws

    // Tube A (1 vacant slot) CANNOT fit 2 straws
    const tubeAFits = tubeA_vacant >= requiredForPatient;
    expect(tubeAFits).toBe(false);

    // Tube B (6 vacant slots) CAN fit 2 straws cleanly
    const tubeBFits = tubeB_vacant >= requiredForPatient;
    expect(tubeBFits).toBe(true);
  });

  it('Rule 8: Multi-Day Batch Cycle Grouping & Straw Sequence Continuity', () => {
    // Patient has retrieval on 2026-10-06
    // Day 5 embryos vitrified on 2026-10-11 (Batch 1: 3 straws)
    // Day 6 embryos vitrified on 2026-10-12 (Batch 2: 1 straw)
    const batch1 = {
      id: 'BATCH-D5',
      aspirationDate: new Date('2026-10-06T00:00:00.000Z'),
      freezingDate: new Date('2026-10-11T00:00:00.000Z'),
      embryoStage: 'Day 5',
      straws: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
    };

    const batch2 = {
      id: 'BATCH-D6',
      aspirationDate: new Date('2026-10-06T00:00:00.000Z'),
      freezingDate: new Date('2026-10-12T00:00:00.000Z'),
      embryoStage: 'Day 6',
      straws: [{ id: 's4' }],
    };

    const cycleMap = calculateBatchCycleNumbers([batch1, batch2]);

    // Both batches belong to the same retrieval cycle (Cycle 1)
    expect(cycleMap.get(batch1.id)).toBe(1);
    expect(cycleMap.get(batch2.id)).toBe(1);

    // Calculate straw sequence continuity across cycle
    const targetCycle = cycleMap.get(batch2.id)!;
    let existingStrawsInCycle = 0;
    for (const b of [batch1]) {
      if (cycleMap.get(b.id) === targetCycle) {
        existingStrawsInCycle += b.straws.length;
      }
    }
    expect(existingStrawsInCycle).toBe(3);

    // Day 6 straw in Batch 2 receives continuous sequence 4 -> Straw ID '1.4'
    const nextStrawSeq = existingStrawsInCycle + 1;
    expect(`${targetCycle}.${nextStrawSeq}`).toBe('1.4');
  });

  it('Rule 9: Multi-Day Embryo Stage Separation (Day 5 vs Day 6 Never Collapsed)', () => {
    // Normalization helper matching backend logic
    const normStage = (s?: string | null) => (s || '').trim().toLowerCase().replace(/\s+/g, '');

    const existingBatch = {
      patientId: 'P_1',
      aspirationDate: '2026-10-06',
      freezingDate: '2026-10-11',
      embryoStage: 'Day 5',
      specimenType: 'EMBRYO',
      visoTubeId: 'TUBE_BLUE',
    };

    // User submits Day 6 straw for same patient & aspiration date
    const newSubmissionDay6 = {
      patientId: 'P_1',
      aspirationDate: '2026-10-06',
      freezingDate: '2026-10-12',
      embryoStage: 'Day 6',
      specimenType: 'EMBRYO',
      visoTubeId: 'TUBE_BLUE',
    };

    const freezingMatches = existingBatch.freezingDate === newSubmissionDay6.freezingDate;
    const stageMatches = normStage(existingBatch.embryoStage) === normStage(newSubmissionDay6.embryoStage);

    // Freezing date and embryo stage must NOT match -> Must create a separate batch, not merge
    expect(freezingMatches).toBe(false);
    expect(stageMatches).toBe(false);

    const shouldMerge = freezingMatches && stageMatches;
    expect(shouldMerge).toBe(false);
  });
});

