export type SpecimenType = 'EMBRYO' | 'OOCYTE' | 'SPERM';
export type CycleClassificationType = 'SELF' | 'DONOR_RECIPIENT';

export interface DetectedSpecimenAndCycle {
  specimenType: SpecimenType;
  cycleType: CycleClassificationType;
}

/**
 * Detects Specimen Type Frozen ('EMBRYO' | 'OOCYTE' | 'SPERM') and
 * Cycle Classification ('SELF' | 'DONOR_RECIPIENT') strictly from raw OCR text
 * and/or extracted structured fields.
 */
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
    // Check raw text for donor / D-R indicators
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
    // Check raw text keywords
    const hasSpermRegex = /\b(?:sperm|semen|spermatozoa|tesa|pesa|ejaculate|semen\s*freezing|sperm\s*freezing|semen\s*cryopreservation)\b/i;
    const hasOocyteExplicit = /\b(?:oocyte\s*freezing|egg\s*freezing|oocyte\s*vitrification|egg\s*vitrification|vitrification\s*of\s*oocytes?|vitrification\s*of\s*eggs?|social\s*egg|onco\s*fertility|supernumerary\s*donor\s*egg)\b/i;
    const hasOocyteWords = /\b(?:oocyte|oocytes|unfertilized)\b/i;
    const hasOocyteStages = /\b(?:mii|m-ii|m-i|\bgv\b|germinal\s*vesicle)\b/i;
    const hasEmbryoRegex = /\b(?:embryo|embryos|blastocyst|blastocysts|morula|cleavage|day\s*[2-6]|2pn|d3|d5|d6|inner\s*cell\s*mass|trophectoderm)\b/i;

    // Check Sperm
    if (hasSpermRegex.test(text) && !hasEmbryoRegex.test(text) && !hasOocyteExplicit.test(text) && !hasOocyteWords.test(text)) {
      specimenType = 'SPERM';
    } else if (
      // Egg / Oocyte detected
      hasOocyteExplicit.test(text) ||
      ((hasOocyteWords.test(text) || hasOocyteStages.test(text) || fields.oocyteStage || (fields.vitrificationIndication && /egg|oocyte/i.test(fields.vitrificationIndication))) &&
        !(
          // If embryos / blastocysts are explicitly mentioned and it's a donor egg recipient cycle, the specimen frozen is embryos!
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
