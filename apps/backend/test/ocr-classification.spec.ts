import { describe, it, expect } from 'vitest';

export type SpecimenType = 'EMBRYO' | 'OOCYTE' | 'SPERM';
export type CycleClassificationType = 'SELF' | 'DONOR_RECIPIENT';

export interface DetectedSpecimenAndCycle {
  specimenType: SpecimenType;
  cycleType: CycleClassificationType;
}

export function detectSpecimenAndCycleFromRawText(
  rawText?: string,
  structuredFields?: any
): DetectedSpecimenAndCycle {
  const text = (rawText || '').toLowerCase();
  const fields = structuredFields || {};

  // ----------------------------------------------------
  // 1. CYCLE CLASSIFICATION DETECTION
  // ----------------------------------------------------
  let cycleType: CycleClassificationType = 'SELF';

  const explicitCycle = String(fields.cycleType || '').toUpperCase();
  if (explicitCycle === 'DONOR_RECIPIENT' || explicitCycle === 'DONOR') {
    cycleType = 'DONOR_RECIPIENT';
  } else if (fields.donorName || fields.donorRegNo) {
    cycleType = 'DONOR_RECIPIENT';
  } else {
    const hasDonorRegex = /\b(?:donor|d-r\b|d\/r\b|donor\s*egg|donor\s*oocyte|donor\s*recipient|donor\s*cycle|donor\s*name|donor\s*reg|donor\s*#|d\.r\.?\s*cycle|supernumerary\s*donor)\b/i;
    if (hasDonorRegex.test(text)) {
      cycleType = 'DONOR_RECIPIENT';
    }
  }

  // ----------------------------------------------------
  // 2. SPECIMEN TYPE FROZEN DETECTION
  // ----------------------------------------------------
  let specimenType: SpecimenType = 'EMBRYO';

  const explicitSpecimen = String(fields.specimenType || '').toUpperCase();
  if (explicitSpecimen === 'SPERM') {
    specimenType = 'SPERM';
  } else if (explicitSpecimen === 'OOCYTE' || explicitSpecimen === 'EGG') {
    specimenType = 'OOCYTE';
  } else if (explicitSpecimen === 'EMBRYO') {
    specimenType = 'EMBRYO';
  } else {
    const hasSpermRegex = /\b(?:sperm|semen|spermatozoa|tesa|pesa|ejaculate|semen\s*freezing|sperm\s*freezing|semen\s*cryopreservation)\b/i;
    const hasOocyteExplicit = /\b(?:oocyte\s*freezing|egg\s*freezing|oocyte\s*vitrification|egg\s*vitrification|vitrification\s*of\s*oocytes?|vitrification\s*of\s*eggs?|social\s*egg|onco\s*fertility|supernumerary\s*donor\s*egg)\b/i;
    const hasOocyteWords = /\b(?:oocyte|oocytes|unfertilized)\b/i;
    const hasOocyteStages = /\b(?:mii|m-ii|m-i|\bgv\b|germinal\s*vesicle)\b/i;
    const hasEmbryoRegex = /\b(?:embryo|embryos|blastocyst|blastocysts|morula|cleavage|day\s*[2-6]|2pn|d3|d5|d6|inner\s*cell\s*mass|trophectoderm)\b/i;

    if (hasSpermRegex.test(text) && !hasEmbryoRegex.test(text) && !hasOocyteExplicit.test(text) && !hasOocyteWords.test(text)) {
      specimenType = 'SPERM';
    } else if (
      hasOocyteExplicit.test(text) ||
      ((hasOocyteWords.test(text) || hasOocyteStages.test(text) || fields.oocyteStage || (fields.vitrificationIndication && /egg|oocyte/i.test(fields.vitrificationIndication))) &&
        !(
          hasEmbryoRegex.test(text) &&
          !hasOocyteExplicit.test(text) &&
          (text.includes('recipient') || text.includes('blastocyst') || text.includes('morula') || /\bday\s*[2-6]\b/i.test(text))
        )
      )
    ) {
      specimenType = 'OOCYTE';
    } else if (hasEmbryoRegex.test(text)) {
      specimenType = 'EMBRYO';
    } else if (hasSpermRegex.test(text)) {
      specimenType = 'SPERM';
    } else if (/\beggs?\b/i.test(text) && !hasEmbryoRegex.test(text)) {
      specimenType = 'OOCYTE';
    } else {
      specimenType = 'EMBRYO';
    }
  }

  return { specimenType, cycleType };
}

describe('Specimen Type Frozen & Cycle Classification Detection Test Suite', () => {
  it('detects Egg (Oocyte) and Self Cycle for standard egg freezing reports', () => {
    const rawText = `
      IVF CLINIC & CRYOBANK
      EGG FREEZING REPORT
      Patient: Priya Sharma, UHID: IVF-10294
      Aspiration Date: 12/10/2026
      Freezing Date: 12/10/2026
      Total Oocytes Retrieved: 14
      Oocytes Frozen: 10 (MII: 8, MI: 2)
      Tank: CAN-02, Canister: C03
    `;
    const result = detectSpecimenAndCycleFromRawText(rawText);
    expect(result.specimenType).toBe('OOCYTE');
    expect(result.cycleType).toBe('SELF');
  });

  it('detects Egg (Oocyte) and Self Cycle for social egg vitrification with MII stage', () => {
    const rawText = `
      VITRIFICATION OF OOCYTES
      Patient: Ananya Verma
      Indication: Social Egg Freezing
      Stage: MII
      Straw 1: 3 MII Pink
      Can No: 01 Canister: 05
    `;
    const result = detectSpecimenAndCycleFromRawText(rawText);
    expect(result.specimenType).toBe('OOCYTE');
    expect(result.cycleType).toBe('SELF');
  });

  it('detects Sperm and Self Cycle for semen cryopreservation', () => {
    const rawText = `
      SEMEN CRYOPRESERVATION REPORT
      Patient Name: Rahul Kapoor
      Sperm count: 28 million/ml, Motility: 55%
      Method: TESA Freezing
      Straws: 2 White
      Can No: CAN-03, Canister: C01
    `;
    const result = detectSpecimenAndCycleFromRawText(rawText);
    expect(result.specimenType).toBe('SPERM');
    expect(result.cycleType).toBe('SELF');
  });

  it('detects Embryo and Self Cycle for blastocyst freezing report', () => {
    const rawText = `
      EMBRYO VITRIFICATION RECORD
      Patient Name: Sunita Roy, Partner: Amit Roy
      Day 5 Blastocyst Freezing
      Embryos: 2 (Grade: 4AA, 4AB)
      Straw ID: 1 Pink
      Can: 04, Canister: 02
    `;
    const result = detectSpecimenAndCycleFromRawText(rawText);
    expect(result.specimenType).toBe('EMBRYO');
    expect(result.cycleType).toBe('SELF');
  });

  it('detects D-R Cycle (Donor Eggs) and Embryo when donor egg recipient has embryos', () => {
    const rawText = `
      EMBRYO FREEZING REPORT (DONOR EGG RECIPIENT)
      Recipient: Meera Sen (Reg No: IVF-9921)
      Donor Name: Pooja Sharma, Donor Reg No: D-882
      Day 5 Blastocyst: 3 embryos frozen in 2 straws
      Can: 01 Canister: 04
    `;
    const result = detectSpecimenAndCycleFromRawText(rawText);
    expect(result.specimenType).toBe('EMBRYO');
    expect(result.cycleType).toBe('DONOR_RECIPIENT');
  });

  it('detects D-R Cycle and Egg (Oocyte) for supernumerary donor egg freezing', () => {
    const rawText = `
      SUPERNUMERARY DONOR EGG FREEZING
      Donor Name: Sneha Patel, Donor Reg No: D-104
      Eggs Frozen: 8 MII
      Can No: 2, Canister: 1
    `;
    const result = detectSpecimenAndCycleFromRawText(rawText);
    expect(result.specimenType).toBe('OOCYTE');
    expect(result.cycleType).toBe('DONOR_RECIPIENT');
  });

  it('respects structuredFields overrides if provided', () => {
    const result = detectSpecimenAndCycleFromRawText('Some text', {
      specimenType: 'SPERM',
      cycleType: 'DONOR_RECIPIENT',
    });
    expect(result.specimenType).toBe('SPERM');
    expect(result.cycleType).toBe('DONOR_RECIPIENT');
  });

  it('defaults to Embryo and Self Cycle if raw text is ambiguous', () => {
    const result = detectSpecimenAndCycleFromRawText('Patient Report 12/10/2026');
    expect(result.specimenType).toBe('EMBRYO');
    expect(result.cycleType).toBe('SELF');
  });
});
