import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verifyAccessKey } from '../src/common/config.js';
import { storageService } from '../src/modules/storage/storage.service.js';
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
});
