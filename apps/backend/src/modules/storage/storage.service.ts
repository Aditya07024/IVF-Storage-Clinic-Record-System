import { prisma, withDbRetry } from '../../common/prisma.js';

function parseFlexibleDate(d?: Date | string | null): Date | null {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  const str = String(d).trim();
  if (!str || str === 'N/A' || str === 'null' || str === 'undefined') return null;

  const isoMatch = str.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const parsed = new Date(Date.UTC(year, month, day, 12, 0, 0));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\.\-\s](\d{1,2})[\/\.\-\s](\d{2,4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    let year = parseInt(ddmmyyyyMatch[3], 10);
    if (year < 100) {
      year = year >= 50 ? 1900 + year : 2000 + year;
    }
    const parsed = new Date(Date.UTC(year, month, day, 12, 0, 0));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateBatchCycleNumbers(batches: any[]): Map<string, number> {
  const map = new Map<string, number>();
  if (!batches || batches.length === 0) return map;

  const sorted = [...batches].sort((a, b) => {
    const timeA = new Date(a.aspirationDate || a.freezingDate || a.storageDate || a.createdAt || 0).getTime();
    const timeB = new Date(b.aspirationDate || b.freezingDate || b.storageDate || b.createdAt || 0).getTime();
    return timeA - timeB;
  });

  let currentCycleNum = 0;
  let lastRetrievalDateKey = '';

  for (const b of sorted) {
    const rawDate = b.aspirationDate ? b.aspirationDate.toISOString().split('T')[0] : (b.freezingDate ? b.freezingDate.toISOString().split('T')[0] : '');
    const dateKey = rawDate || 'unknown';

    if (!lastRetrievalDateKey || dateKey !== lastRetrievalDateKey) {
      currentCycleNum++;
      lastRetrievalDateKey = dateKey;
    }

    map.set(b.id, currentCycleNum);
  }

  return map;
}

export function parseLocationCode(code: string) {
  if (!code) return { raw: '', formatted: '', can: '', canister: '', level: '', tube: '', tubeColor: '' };

  const match = code.match(/CAN-?(\d+)-CANISTER(\d+)-L(\d+)-G(\d+)-V(\d+)/i);
  if (!match) return { raw: code, formatted: code, can: '', canister: '', level: '', tube: '', tubeColor: '' };

  const canNum = match[1].padStart(2, '0');
  const canisterNum = match[2].padStart(2, '0');
  const levelNum = parseInt(match[3], 10);
  const levelName = levelNum === 1 ? 'Level 1 (Bottom)' : levelNum === 2 ? 'Level 2 (Top)' : `Level ${levelNum}`;
  const tubeNumInt = parseInt(match[5], 10);
  const tubeNumPadded = match[5].padStart(2, '0');

  const VISO_TUBE_COLOR_NAMES: Record<number, string> = {
    1: 'Pink',
    2: 'Grey',
    3: 'Red',
    4: 'Black',
    5: 'Green',
    6: 'Rust',
    7: 'Blue',
    8: 'Purple',
    9: 'Yellow',
    10: 'Orange',
    11: 'Skyblue',
  };

  const tubeColor = VISO_TUBE_COLOR_NAMES[tubeNumInt] || 'Standard';
  const tubeFormatted = `Viso Tube - ${tubeColor}`;
  const formatted = `Can ${canNum} • Canister ${canisterNum} • ${levelName} • ${tubeFormatted}`;

  return {
    raw: code,
    can: `Can ${canNum}`,
    canister: `Canister ${canisterNum}`,
    level: levelName,
    tube: tubeFormatted,
    tubeColor,
    formatted,
  };
}

export function parseLocationSortKeys(code: string) {
  if (!code) return { levelNum: 999, canNum: 999, canisterNum: 999, tubeNum: 999 };
  const match = code.match(/CAN-?(\d+)-CANISTER(\d+)-L(\d+)-G(\d+)-V(\d+)/i);
  if (!match) return { levelNum: 999, canNum: 999, canisterNum: 999, tubeNum: 999 };

  return {
    canNum: parseInt(match[1], 10),
    canisterNum: parseInt(match[2], 10),
    levelNum: parseInt(match[3], 10),
    tubeNum: parseInt(match[5], 10),
  };
}

export const CLINIC_CAN_NUMBERS = [1, 2, 3, 4, 5, 8, 10, 11, 14];

export interface StrawItemInput {
  color: string;
  embryoCount: number;
  grade?: string;
  comments?: string;
  isPgt?: boolean;
  freezingDate?: string;
  aspirationDate?: string;
  embryoStage?: string;
  strawCustomId?: string;
  [key: string]: any;
}

export interface AssignStorageInput {
  patientId: string;
  storageDate?: string;
  aspirationDate?: string;
  freezingDate?: string;
  embryoStage?: string;
  embryoCount?: number;
  visoTubeId: string;
  strawColors?: string[];
  straws?: StrawItemInput[];
  notes?: string;
  specimenType?: string;
  cycleType?: string;
  donorName?: string;
  donorRegNo?: string;
  donorAge?: string;
  donorPhone?: string;
  vitrificationIndication?: string;
  oocyteStage?: string;
}

export class StorageService {
  // Initialize storage hierarchy if empty (Cans 1, 2, 3, 4, 5, 8, 10, 11, 14 x 10 Canisters x 2 Levels x 1 Goblet x 11 Viso Tubes)
  async seedHierarchyIfNeeded() {
    return withDbRetry(async () => {
      for (const canNum of CLINIC_CAN_NUMBERS) {
        const canCode = `CAN-${canNum.toString().padStart(2, '0')}`;
        const canName = `Can ${canNum.toString().padStart(2, '0')}`;

        let can = await prisma.can.findUnique({
          where: { code: canCode },
        });

        if (!can) {
          console.log(`[Storage] Creating missing Clinic ${canName}...`);
          can = await prisma.can.create({
            data: { code: canCode, name: canName },
          });

          // 10 Canisters per Can
          const canistersData = Array.from({ length: 10 }, (_, i) => ({
            canId: can!.id,
            canisterNumber: i + 1,
          }));
          await prisma.canister.createMany({ data: canistersData });
          const createdCanisters = await prisma.canister.findMany({ where: { canId: can.id } });

          for (const canister of createdCanisters) {
            // 2 Levels per Canister
            for (let l = 1; l <= 2; l++) {
              const level = await prisma.level.create({
                data: { canisterId: canister.id, levelNumber: l },
              });

              // 1 Goblet per Level
              const goblet = await prisma.goblet.create({
                data: { levelId: level.id, gobletNumber: 1 },
              });

              // 11 Viso Tubes per Goblet
              const visoTubesData = Array.from({ length: 11 }, (_, v) => {
                const tubeNum = v + 1;
                const tubeCode = `CAN-${canNum.toString().padStart(2, '0')}-CANISTER${canister.canisterNumber.toString().padStart(2, '0')}-L${l}-G1-V${tubeNum.toString().padStart(2, '0')}`;
                return {
                  gobletId: goblet.id,
                  tubeNumber: tubeNum,
                  locationCode: tubeCode,
                };
              });

              await prisma.visoTube.createMany({ data: visoTubesData });
            }
          }
        }
      }

      console.log('[Storage] Hierarchy successfully initialized!');
    });
  }

  // Get full storage visual map with occupancy statistics
  async getStorageMap() {
    const cans = await prisma.can.findMany({
      orderBy: { code: 'asc' },
      include: {
        canisters: {
          orderBy: { canisterNumber: 'asc' },
          include: {
            levels: {
              orderBy: { levelNumber: 'asc' },
              include: {
                goblets: {
                  include: {
                    visoTubes: {
                      orderBy: { tubeNumber: 'asc' },
                      include: {
                        straws: {
                          where: { status: 'OCCUPIED' },
                          include: {
                            batch: {
                              include: {
                                patient: {
                                  select: { id: true, patientId: true, fullName: true },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return cans;
  }

  // Calculate smart recommendation algorithm for next optimal vacant straw slot
  async getStorageRecommendation(requiredStrawsCount: number, patientId: string) {
    const requiredStraws = requiredStrawsCount;
    const embryoCount = requiredStraws * 2;

    const visoTubes = await prisma.visoTube.findMany({
      include: {
        straws: { where: { status: 'OCCUPIED' } },
      },
    });

    // Custom Allocation Strategy: Level 1 of ALL Canisters & ALL Cans fills FIRST, then Level 2!
    visoTubes.sort((a, b) => {
      const kA = parseLocationSortKeys(a.locationCode);
      const kB = parseLocationSortKeys(b.locationCode);

      if (kA.levelNum !== kB.levelNum) return kA.levelNum - kB.levelNum; // Level 1 (Bottom) before Level 2 (Top)
      if (kA.canNum !== kB.canNum) return kA.canNum - kB.canNum; // Can 1, 2, 3...
      if (kA.canisterNum !== kB.canisterNum) return kA.canisterNum - kB.canisterNum; // Canister 1..10
      return kA.tubeNum - kB.tubeNum; // Tube 1..11
    });

    let primaryRecommendation = null;
    let previousPatientLocation = null;
    const fallbackRecommendations: any[] = [];

    // Prioritize patient's PREVIOUS stored straw / batch location if patient has existing active storage
    if (patientId && patientId !== 'NEW_PATIENT') {
      const patientRecord = await prisma.patient.findFirst({
        where: {
          OR: [
            { id: patientId },
            { patientId: patientId },
          ],
        },
      });

      const targetDbId = patientRecord?.id || patientId;
      const targetRegId = patientRecord?.patientId || patientId;

      // 1) Search active Straws belonging to patient
      const activeStraws = await prisma.straw.findMany({
        where: {
          status: 'OCCUPIED',
          batch: {
            OR: [
              { patientId: targetDbId },
              { patientId: targetRegId },
              { patient: { id: targetDbId } },
              { patient: { patientId: targetRegId } },
            ],
          },
        },
        include: {
          visoTube: {
            include: {
              straws: { where: { status: 'OCCUPIED' } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const s of activeStraws) {
        if (s.visoTube) {
          const tube = s.visoTube;
          const occupiedCount = tube.straws.length;
          const available = 14 - occupiedCount;
          if (available >= requiredStraws) {
            const parsed = parseLocationCode(tube.locationCode);
            const recItem = {
              visoTubeId: tube.id,
              locationCode: tube.locationCode,
              formattedLocation: parsed.formatted,
              breakdown: parsed,
              availableSlots: available,
              matchType: 'SAME_PATIENT_PREVIOUS_LOCATION',
              explanation: `Recommended: Automatically chosen patient's previous stored straw location in ${parsed.formatted} (${available} vacant slots remaining).`,
            };
            previousPatientLocation = recItem;
            primaryRecommendation = recItem;
            break;
          }
        }
      }

      // 2) Fallback to StorageBatch search if no active straw match found
      if (!previousPatientLocation) {
        const patientBatches = await prisma.storageBatch.findMany({
          where: {
            OR: [
              { patientId: targetDbId },
              { patientId: targetRegId },
              { patient: { id: targetDbId } },
              { patient: { patientId: targetRegId } },
            ],
          },
          include: { visoTube: true, straws: true },
          orderBy: { storageDate: 'desc' },
        });

        for (const batch of patientBatches) {
          if (batch.visoTubeId) {
            const tube = visoTubes.find((t) => t.id === batch.visoTubeId);
            if (tube) {
              const occupiedCount = tube.straws.length;
              const available = 14 - occupiedCount;
              if (available >= requiredStraws) {
                const parsed = parseLocationCode(tube.locationCode);
                const recItem = {
                  visoTubeId: tube.id,
                  locationCode: tube.locationCode,
                  formattedLocation: parsed.formatted,
                  breakdown: parsed,
                  availableSlots: available,
                  matchType: 'SAME_PATIENT_PREVIOUS_LOCATION',
                  explanation: `Recommended: Automatically chosen patient's previous stored straw location in ${parsed.formatted} (${available} vacant slots remaining).`,
                };
                previousPatientLocation = recItem;
                primaryRecommendation = recItem;
                break;
              }
            }
          }
        }
      }
    }

    // Populate remaining candidates & fallbacks
    for (const tube of visoTubes) {
      const occupiedCount = tube.straws.length;
      const available = 14 - occupiedCount;
      if (available >= requiredStraws) {
        const parsed = parseLocationCode(tube.locationCode);
        const item = {
          visoTubeId: tube.id,
          locationCode: tube.locationCode,
          formattedLocation: parsed.formatted,
          breakdown: parsed,
          availableSlots: available,
          matchType: 'AVAILABLE_VISO_TUBE',
          explanation: `${parsed.formatted} (${available} vacant straw slots available).`,
        };

        if (!primaryRecommendation) {
          primaryRecommendation = item;
        } else if (tube.id !== primaryRecommendation?.visoTubeId) {
          fallbackRecommendations.push(item);
        }
      }
    }

    return {
      requiredStraws,
      embryoCount,
      maxEmbryosPerStraw: 2,
      primaryRecommendation,
      previousPatientLocation,
      alternativeLocations: fallbackRecommendations.slice(0, 5),
    };
  }

  async findAvailableStorage(patientId: string, storageDateInput: any, embryoCount: number) {
    const strawsCount = Math.ceil((embryoCount || 1) / 2);
    return this.getStorageRecommendation(strawsCount, patientId);
  }

  // Generate Straw ID: STR-000001 (Numeric Max Safe)
  private async generateNextStrawId(txClient?: any): Promise<string> {
    const db = txClient || prisma;
    const straws = await db.straw.findMany({
      select: { strawId: true },
    });

    let maxNum = 0;
    for (const s of straws) {
      const match = s.strawId?.match(/STR-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }

    const nextNum = Math.max(maxNum + 1, straws.length + 1);
    let candidate = `STR-${nextNum.toString().padStart(6, '0')}`;

    let attempts = 0;
    while (await db.straw.findFirst({ where: { strawId: candidate } })) {
      attempts++;
      candidate = `STR-${(nextNum + attempts).toString().padStart(6, '0')}`;
      if (attempts > 50) break;
    }
    return candidate;
  }

  // Generate Batch ID: BATCH-2026-000001 (Numeric Max Safe)
  private async generateNextBatchId(txClient?: any): Promise<string> {
    const db = txClient || prisma;
    const year = new Date().getFullYear();
    const prefix = `BATCH-${year}-`;
    const batches = await db.storageBatch.findMany({
      select: { batchId: true },
    });

    let maxNum = 0;
    for (const b of batches) {
      const match = b.batchId?.match(/BATCH-\d{4}-(\d+)/) || b.batchId?.match(/BATCH-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }

    const nextNum = Math.max(maxNum + 1, batches.length + 1);
    let candidate = `${prefix}${nextNum.toString().padStart(6, '0')}`;

    let attempts = 0;
    while (await db.storageBatch.findUnique({ where: { batchId: candidate } })) {
      attempts++;
      candidate = `${prefix}${(nextNum + attempts).toString().padStart(6, '0')}`;
      if (attempts > 50) break;
    }
    return candidate;
  }

  // Assign Storage with PostgreSQL Row Transaction & Lock
  async assignStorage(input: AssignStorageInput, staffUserId: string, staffName: string) {
    let strawItems: StrawItemInput[] = [];

    if (input.straws && input.straws.length > 0) {
      strawItems = input.straws;
    } else if (input.embryoCount && input.strawColors) {
      const count = Math.ceil(input.embryoCount / 2);
      if (input.strawColors.length < count) {
        throw new Error(`Invalid straw colors provided: insufficient straw colors for ${input.embryoCount} embryos (requires ${count} straws).`);
      }
      let rem = input.embryoCount;
      for (let i = 0; i < count; i++) {
        const c = Math.min(2, rem);
        rem -= c;
        strawItems.push({
          color: input.strawColors[i],
          embryoCount: c,
        });
      }
    } else {
      throw new Error('No straw details provided for storage allocation.');
    }

    const requiredStraws = strawItems.length;
    const totalEmbryos = strawItems.reduce((acc, item) => acc + (item.embryoCount || 1), 0);

    // Pre-calculate Batch & Straw IDs to minimize transaction roundtrips and connection locks
    const batchIdCode = await this.generateNextBatchId();
    const baseStrawId = await this.generateNextStrawId();
    const baseStrawNum = parseInt(baseStrawId.split('-').pop() || '1', 10);

    return prisma.$transaction(async (tx) => {
      // Check Viso Tube existence
      const visoTube = await tx.visoTube.findUnique({
        where: { id: input.visoTubeId },
        include: { straws: { where: { status: 'OCCUPIED' } } },
      });

      if (!visoTube) {
        throw new Error('Selected storage Viso Tube not found.');
      }

      // Check current capacity
      const currentOccupied = visoTube.straws.length;
      if (currentOccupied + requiredStraws > 14) {
        throw new Error(`Location ${visoTube.locationCode} does not have enough vacant straw capacity.`);
      }

      const freezingDateObj = parseFlexibleDate(input.freezingDate) || parseFlexibleDate(input.storageDate) || new Date();
      const aspirationDateObj = parseFlexibleDate(input.aspirationDate);

      // Pre-check Batch ID uniqueness using read-only findUnique to prevent P2002/25P02 transaction aborts
      let finalBatchId = batchIdCode;
      let batchAttemptCounter = 0;
      while (await tx.storageBatch.findUnique({ where: { batchId: finalBatchId } })) {
        batchAttemptCounter++;
        const baseNum = parseInt(finalBatchId.split('-').pop() || '0', 10);
        const nextNum = (isNaN(baseNum) ? 1 : baseNum) + 1;
        finalBatchId = `BATCH-${freezingDateObj.getFullYear()}-${nextNum.toString().padStart(6, '0')}`;
        if (batchAttemptCounter > 50) {
          finalBatchId = `BATCH-${freezingDateObj.getFullYear()}-${Date.now().toString().slice(-6)}`;
          break;
        }
      }

      let batch: any = null;

      if (input.patientId) {
        let candidateBatches: any[] = [];
        if (aspirationDateObj) {
          const startOfDay = new Date(aspirationDateObj);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(aspirationDateObj);
          endOfDay.setHours(23, 59, 59, 999);

          candidateBatches = await tx.storageBatch.findMany({
            where: {
              patientId: input.patientId,
              aspirationDate: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          });
        } else if (freezingDateObj) {
          const startOfDay = new Date(freezingDateObj);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(freezingDateObj);
          endOfDay.setHours(23, 59, 59, 999);

          candidateBatches = await tx.storageBatch.findMany({
            where: {
              patientId: input.patientId,
              aspirationDate: null,
              storageDate: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          });
        }

        const normStage = (s?: string | null) => (s || '').trim().toLowerCase().replace(/\s+/g, '');
        const targetStageNorm = normStage(input.embryoStage || input.oocyteStage);
        const targetFreezingDay = freezingDateObj ? freezingDateObj.toISOString().split('T')[0] : '';
        const targetSpecimenType = (input.specimenType || 'EMBRYO').toUpperCase();

        for (const candidate of candidateBatches) {
          const candFreezingDay = candidate.freezingDate
            ? candidate.freezingDate.toISOString().split('T')[0]
            : (candidate.storageDate ? candidate.storageDate.toISOString().split('T')[0] : '');
          const candStageNorm = normStage(candidate.embryoStage || candidate.oocyteStage);
          const candSpecimenType = (candidate.specimenType || 'EMBRYO').toUpperCase();

          const freezingMatches = targetFreezingDay ? candFreezingDay === targetFreezingDay : true;
          const stageMatches = targetStageNorm ? candStageNorm === targetStageNorm : true;
          const specimenMatches = candSpecimenType === targetSpecimenType;
          const tubeMatches = !input.visoTubeId || candidate.visoTubeId === input.visoTubeId;

          if (freezingMatches && stageMatches && specimenMatches && tubeMatches) {
            batch = candidate;
            break;
          }
        }
      }

      if (batch) {
        batch = await tx.storageBatch.update({
          where: { id: batch.id },
          data: {
            totalStraws: batch.totalStraws + requiredStraws,
            totalEmbryos: batch.totalEmbryos + totalEmbryos,
            notes: input.notes ? (batch.notes ? `${batch.notes}\n${input.notes}` : input.notes) : batch.notes,
          },
        });
      } else {
        batch = await tx.storageBatch.create({
          data: {
            batchId: finalBatchId,
            patientId: input.patientId,
            storageDate: freezingDateObj,
            freezingDate: freezingDateObj,
            aspirationDate: aspirationDateObj,
            embryoStage: input.embryoStage || null,
            specimenType: input.specimenType || 'EMBRYO',
            cycleType: input.cycleType || 'SELF',
            donorName: input.donorName || null,
            donorRegNo: input.donorRegNo || null,
            donorAge: input.donorAge || null,
            donorPhone: input.donorPhone || null,
            vitrificationIndication: input.vitrificationIndication || null,
            oocyteStage: input.oocyteStage || null,
            totalStraws: requiredStraws,
            totalEmbryos: totalEmbryos,
            visoTubeId: input.visoTubeId,
            notes: input.notes || null,
          },
        });
      }

      // Update patient's aspirationDate & freezingDate on record allocation
      await tx.patient.update({
        where: { id: input.patientId },
        data: {
          aspirationDate: aspirationDateObj || undefined,
          freezingDate: freezingDateObj,
        },
      });

      // Determine cycle number for the batch and count existing straws in this cycle
      const allPatientBatches = await tx.storageBatch.findMany({
        where: { patientId: input.patientId },
        include: { straws: true },
        orderBy: [
          { aspirationDate: 'asc' },
          { storageDate: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      const batchCycleMap = calculateBatchCycleNumbers(allPatientBatches);
      let targetCycleNum = (batch && batchCycleMap.has(batch.id))
        ? batchCycleMap.get(batch.id)!
        : 1;

      if (batch && !batchCycleMap.has(batch.id)) {
        const rawDate = batch.aspirationDate ? batch.aspirationDate.toISOString().split('T')[0] : (batch.freezingDate ? batch.freezingDate.toISOString().split('T')[0] : '');
        const dateKey = rawDate || 'unknown';
        let matchCycle: number | null = null;
        for (const b of allPatientBatches) {
          const bRawDate = b.aspirationDate ? b.aspirationDate.toISOString().split('T')[0] : (b.freezingDate ? b.freezingDate.toISOString().split('T')[0] : '');
          const bDateKey = bRawDate || 'unknown';
          if (bDateKey === dateKey && b.id !== batch.id) {
            matchCycle = batchCycleMap.get(b.id) || null;
            break;
          }
        }
        if (matchCycle !== null) {
          targetCycleNum = matchCycle;
        } else {
          let maxCycle = 0;
          for (const c of batchCycleMap.values()) {
            if (c > maxCycle) maxCycle = c;
          }
          targetCycleNum = maxCycle + 1;
        }
      }

      // Count existing straws across all batches in this same cycle
      let existingStrawsInThisCycle = 0;
      for (const b of allPatientBatches) {
        const cNum = batchCycleMap.get(b.id);
        if (cNum === targetCycleNum) {
          existingStrawsInThisCycle += (b.straws ? b.straws.length : 0);
        }
      }

      const createdStraws: any[] = [];
      let totalEmbryosSoFar = 0;
      for (let i = 0; i < requiredStraws; i++) {
        const item = strawItems[i];
        const embryosInThisStraw = item.embryoCount || 1;
        const color = item.color || 'Pink';
        const seqNum = existingStrawsInThisCycle + i + 1;

        const customId = (item as any).strawCustomId?.trim();
        let strawIdCode: string;
        if (customId && !/^#?\d+$/.test(customId) && !/^\d+\.\d+$/.test(customId)) {
          strawIdCode = customId;
        } else {
          strawIdCode = `${targetCycleNum}.${seqNum}`;
        }

        const straw = await tx.straw.create({
          data: {
            strawId: strawIdCode,
            batchId: batch.id,
            visoTubeId: input.visoTubeId,
            color,
            embryoCount: embryosInThisStraw,
            grade: item.grade ? item.grade.trim() : null,
            comments: item.comments ? item.comments.trim() : null,
            isPgt: item.isPgt ?? false,
            maxCapacity: 3,
            status: 'OCCUPIED',
            freezingDate: item.freezingDate ? (parseFlexibleDate(item.freezingDate) || freezingDateObj) : freezingDateObj,
          },
        });

        // Create Embryo entities inside straw
        for (let e = 1; e <= embryosInThisStraw; e++) {
          totalEmbryosSoFar++;
          const eGradeKey = `grade${e}`;
          const eCommentKey = `comment${e}`;
          const eFragKey = `frag${e}`;
          const eGrade = ((item as any)[eGradeKey] || item.grade || '').toString();
          let eComment = ((item as any)[eCommentKey] || (e === 1 ? item.comments : '') || '').toString().trim();
          const eFrag = ((item as any)[eFragKey] || (e === 1 ? (item as any).fragmentation : '') || '').toString().trim();

          eComment = eComment.replace(/\[Fragmentation:\s*[^\]]+\]\s*/gi, '').trim();
          if (eFrag && eFrag !== 'No') {
            eComment = `[Fragmentation: ${eFrag}] ${eComment}`.trim();
          }

          await tx.embryo.create({
            data: {
              strawId: straw.id,
              embryoNumber: totalEmbryosSoFar,
              grade: eGrade.trim(),
              notes: eComment.trim() || null,
              status: 'FROZEN',
            },
          });
        }

        createdStraws.push(straw);
      }

      // Record Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          userName: staffName,
          action: 'STORAGE_ASSIGNED',
          entityName: 'StorageBatch',
          entityId: batch.id,
          newData: JSON.stringify({
            patientId: input.patientId,
            batchId: batch.batchId,
            locationCode: visoTube.locationCode,
            embryoCount: input.embryoCount,
            strawCount: requiredStraws,
          }),
        },
      });

      return {
        batch,
        straws: createdStraws,
        locationCode: visoTube.locationCode,
      };
    }, { timeout: 25000, maxWait: 10000 });
  }

  // Get Container Hierarchy Visualization Data
  async getHierarchyOverview(canCode?: string) {
    const cans = await prisma.can.findMany({
      where: canCode && canCode !== 'all' ? { code: canCode } : {},
      orderBy: { code: 'asc' },
      include: {
        canisters: {
          orderBy: { canisterNumber: 'asc' },
          include: {
            levels: {
              orderBy: { levelNumber: 'asc' },
              include: {
                goblets: {
                  include: {
                    visoTubes: {
                      orderBy: { tubeNumber: 'asc' },
                      include: {
                        straws: {
                          include: {
                            batch: {
                              include: { patient: true },
                            },
                            embryos: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Calculate Capacity Metrics
    let totalVisoTubes = 0;
    let occupiedStrawsCount = 0;
    let vacantStrawsCount = 0;

    cans.forEach(can => {
      can.canisters.forEach(cn => {
        cn.levels.forEach(l => {
          l.goblets.forEach(g => {
            g.visoTubes.forEach(v => {
              totalVisoTubes += 1;
              const occ = v.straws.filter(s => s.status === 'OCCUPIED').length;
              occupiedStrawsCount += occ;
              vacantStrawsCount += (14 - occ);
            });
          });
        });
      });
    });

    const totalCapacityStraws = totalVisoTubes * 14;
    const utilizationPercentage = totalCapacityStraws > 0 ? ((occupiedStrawsCount / totalCapacityStraws) * 100).toFixed(1) : '0';

    return {
      metrics: {
        totalCans: cans.length,
        totalVisoTubes,
        totalCapacityStraws,
        occupiedStrawsCount,
        vacantStrawsCount,
        utilizationPercentage: `${utilizationPercentage}%`,
      },
      cans,
    };
  }

  // Storage Movement between physical locations
  async moveStraw(strawId: string, targetVisoTubeId: string, staffUserId: string, staffName: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const straw = await tx.straw.findUnique({
        where: { id: strawId },
        include: { visoTube: true, batch: true },
      });

      if (!straw) {
        throw new Error('Straw not found.');
      }

      const targetTube = await tx.visoTube.findUnique({
        where: { id: targetVisoTubeId },
        include: { straws: { where: { status: 'OCCUPIED' } } },
      });

      if (!targetTube) {
        throw new Error('Target Viso Tube location not found.');
      }

      if (targetTube.straws.length >= 14) {
        throw new Error(`Target location ${targetTube.locationCode} is full.`);
      }

      const oldLocationCode = straw.visoTube.locationCode;

      // Update straw location
      const updatedStraw = await tx.straw.update({
        where: { id: strawId },
        data: { visoTubeId: targetVisoTubeId },
      });

      // Log Storage Movement History
      await tx.storageMovement.create({
        data: {
          strawId: straw.id,
          patientId: straw.batch.patientId,
          oldLocationCode,
          newLocationCode: targetTube.locationCode,
          staffId: staffUserId,
          staffName,
          reason,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          userName: staffName,
          action: 'STORAGE_MOVED',
          entityName: 'Straw',
          entityId: straw.id,
          oldData: JSON.stringify({ location: oldLocationCode }),
          newData: JSON.stringify({ location: targetTube.locationCode, reason }),
        },
      });

      return updatedStraw;
    }, { timeout: 25000, maxWait: 10000 });
  }

  // Update Freezed Straw Details (Straw ID, Tag Color, Grade, Embryo Count, PGT, Comments)
  async updateStrawDetails(
    strawId: string,
    data: {
      strawCustomId?: string;
      color?: string;
      grade?: string;
      embryoGrades?: string[];
      embryoComments?: string[];
      embryoCount?: number;
      isPgt?: boolean;
      comments?: string;
    },
    staffUserId: string,
    staffName: string
  ) {
    return prisma.$transaction(async (tx) => {
      const straw = await tx.straw.findUnique({
        where: { id: strawId },
        include: { batch: true, embryos: true },
      });

      if (!straw) {
        throw new Error('Straw not found.');
      }

      const updatePayload: any = {};
      if (data.strawCustomId !== undefined) {
        let newCustomId = data.strawCustomId.trim();

        // Calculate cycle number for this straw's batch
        const allBatches = await tx.storageBatch.findMany({
          where: { patientId: straw.batch.patientId },
          orderBy: [
            { aspirationDate: 'asc' },
            { storageDate: 'asc' },
            { createdAt: 'asc' },
          ],
        });
        const batchCycleMap = calculateBatchCycleNumbers(allBatches);
        const cycleNum = batchCycleMap.get(straw.batchId) || 1;

        // If user entered a generic number like "#2", "2", "C2-S2", or "2.2", format as {cycleNum}.{num}
        const numericMatch = newCustomId.match(/^#?(\d+)$/);
        const cycleMatch = newCustomId.match(/^C(\d+)[-_]?(?:S|#)?(\d+)$/i);
        const dotMatch = newCustomId.match(/^(\d+)\.(\d+)$/);

        if (numericMatch) {
          const num = parseInt(numericMatch[1], 10);
          newCustomId = `${cycleNum}.${num}`;
        } else if (cycleMatch) {
          const s = cycleMatch[2];
          newCustomId = `${cycleNum}.${s}`;
        } else if (dotMatch) {
          const s = dotMatch[2];
          newCustomId = `${cycleNum}.${s}`;
        }

        if (newCustomId !== straw.strawId) {
          const existing = await tx.straw.findFirst({
            where: {
              strawId: newCustomId,
              batch: { patientId: straw.batch.patientId },
              id: { not: straw.id },
            },
          });
          if (existing) {
            const displayLabel = numericMatch ? `#${numericMatch[1]}` : newCustomId;
            throw new Error(`Straw ID "${displayLabel}" is already assigned to another straw for this patient in Cycle #${cycleNum}. Please enter a unique Straw ID.`);
          }
        }
        updatePayload.strawId = newCustomId;
      }
      if (data.color !== undefined) updatePayload.color = data.color.trim();
      if (data.grade !== undefined) updatePayload.grade = data.grade.trim();
      if (data.embryoCount !== undefined && !isNaN(Number(data.embryoCount))) {
        updatePayload.embryoCount = Number(data.embryoCount);
      }
      if (data.isPgt !== undefined) updatePayload.isPgt = Boolean(data.isPgt);
      if (data.comments !== undefined) updatePayload.comments = data.comments.trim();

      const updatedStraw = await tx.straw.update({
        where: { id: strawId },
        data: updatePayload,
      });

      // Update or recreate Embryo records if embryoGrades or embryoComments are passed or embryoCount changed
      const targetCount = updatePayload.embryoCount !== undefined ? updatePayload.embryoCount : straw.embryoCount;
      if (data.embryoGrades || data.embryoComments || updatePayload.embryoCount !== undefined) {
        await tx.embryo.deleteMany({ where: { strawId: straw.id } });
        for (let i = 0; i < targetCount; i++) {
          const g = (data.embryoGrades?.[i] || data.grade || straw.grade || '').trim();
          const n = (data.embryoComments?.[i] || '').trim();
          await tx.embryo.create({
            data: {
              strawId: straw.id,
              embryoNumber: i + 1,
              grade: g,
              notes: n || null,
              status: 'FROZEN',
            },
          });
        }
      }

      // Audit Log for Straw Modification
      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          userName: staffName,
          action: 'STRAW_UPDATED',
          entityName: 'Straw',
          entityId: straw.id,
          oldData: JSON.stringify({ strawId: straw.strawId, color: straw.color, grade: straw.grade, embryoCount: straw.embryoCount, isPgt: straw.isPgt, comments: straw.comments }),
          newData: JSON.stringify(updatePayload),
        },
      });

      return updatedStraw;
    }, { timeout: 20000, maxWait: 10000 });
  }

  async updateBatchDetails(
    batchId: string,
    data: {
      aspirationDate?: string;
      freezingDate?: string;
      embryoStage?: string;
      specimenType?: string;
      cycleType?: string;
      donorName?: string;
      donorRegNo?: string;
      donorAge?: string;
      donorPhone?: string;
      vitrificationIndication?: string;
      oocyteStage?: string;
      notes?: string;
    },
    staffUserId: string,
    staffName: string
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.storageBatch.findUnique({
        where: { id: batchId },
        include: { straws: true },
      });

      if (!existing) {
        throw new Error('Storage batch cycle record not found.');
      }

      const updatePayload: any = {};
      if (data.aspirationDate !== undefined) {
        updatePayload.aspirationDate = data.aspirationDate ? parseFlexibleDate(data.aspirationDate) : null;
      }
      if (data.freezingDate !== undefined) {
        updatePayload.freezingDate = data.freezingDate ? parseFlexibleDate(data.freezingDate) : null;
      }
      if (data.embryoStage !== undefined) updatePayload.embryoStage = data.embryoStage ? data.embryoStage.trim() : null;
      if (data.specimenType !== undefined) updatePayload.specimenType = data.specimenType ? data.specimenType.trim() : 'EMBRYO';
      if (data.cycleType !== undefined) updatePayload.cycleType = data.cycleType ? data.cycleType.trim() : 'SELF';
      if (data.donorName !== undefined) updatePayload.donorName = data.donorName ? data.donorName.trim() : null;
      if (data.donorRegNo !== undefined) updatePayload.donorRegNo = data.donorRegNo ? data.donorRegNo.trim() : null;
      if (data.donorAge !== undefined) updatePayload.donorAge = data.donorAge ? data.donorAge.trim() : null;
      if (data.donorPhone !== undefined) updatePayload.donorPhone = data.donorPhone ? data.donorPhone.trim() : null;
      if (data.vitrificationIndication !== undefined) updatePayload.vitrificationIndication = data.vitrificationIndication ? data.vitrificationIndication.trim() : null;
      if (data.oocyteStage !== undefined) updatePayload.oocyteStage = data.oocyteStage ? data.oocyteStage.trim() : null;
      if (data.notes !== undefined) updatePayload.notes = data.notes ? data.notes.trim() : null;

      const updatedBatch = await tx.storageBatch.update({
        where: { id: batchId },
        data: updatePayload,
      });

      // Sync updated vitrificationIndication to patient record
      if (data.vitrificationIndication !== undefined && existing.patientId) {
        await tx.patient.update({
          where: { id: existing.patientId },
          data: { vitrificationIndication: updatePayload.vitrificationIndication },
        });
      }

      // If freezingDate was updated on batch, sync freezingDate to straws if straws don't have explicit freezingDate
      if (data.freezingDate && existing.straws.length > 0) {
        const parsedFreezing = parseFlexibleDate(data.freezingDate);
        if (parsedFreezing) {
          await tx.straw.updateMany({
            where: { batchId: existing.id },
            data: { freezingDate: parsedFreezing },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          userName: staffName,
          action: 'STORAGE_BATCH_UPDATED',
          entityName: 'StorageBatch',
          entityId: batchId,
          oldData: JSON.stringify({
            aspirationDate: existing.aspirationDate,
            freezingDate: existing.freezingDate,
            embryoStage: existing.embryoStage,
            specimenType: existing.specimenType,
            notes: existing.notes,
          }),
          newData: JSON.stringify(updatePayload),
        },
      });

      return updatedBatch;
    }, { timeout: 20000, maxWait: 10000 });
  }
}

export const storageService = new StorageService();
