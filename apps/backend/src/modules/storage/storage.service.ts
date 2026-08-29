import { prisma, withDbRetry } from '../../common/prisma.js';

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
  const tubeFormatted = `Viso Tube ${tubeNumPadded} (${tubeColor})`;
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

    // Check if patient already has a batch created on the SAME DATE
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sameDateBatch = await prisma.storageBatch.findFirst({
      where: {
        patientId,
        storageDate: { gte: todayStart },
      },
      include: {
        visoTube: true,
      },
    });

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
    const fallbackRecommendations = [];

    // If existing same-day batch exists and VisoTube has capacity, prioritize same VisoTube
    if (sameDateBatch) {
      const sameTube = visoTubes.find((t) => t.id === sameDateBatch.visoTubeId);
      if (sameTube) {
        const available = 10 - sameTube.straws.length;
        if (available >= requiredStraws) {
          const parsed = parseLocationCode(sameTube.locationCode);
          primaryRecommendation = {
            visoTubeId: sameTube.id,
            locationCode: sameTube.locationCode,
            formattedLocation: parsed.formatted,
            breakdown: parsed,
            availableSlots: available,
            matchType: 'SAME_PATIENT_SAME_DATE',
            explanation: `Recommended to group with patient's existing batch on ${sameDateBatch.storageDate.toISOString().split('T')[0]} in ${parsed.formatted}.`,
          };
        }
      }
    }

    for (const tube of visoTubes) {
      const occupiedCount = tube.straws.length;
      const available = 10 - occupiedCount;
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

        if (!primaryRecommendation && tube.id !== sameDateBatch?.visoTubeId) {
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
    while (await db.straw.findUnique({ where: { strawId: candidate } })) {
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
      let rem = input.embryoCount;
      for (let i = 0; i < count; i++) {
        const c = Math.min(2, rem);
        rem -= c;
        strawItems.push({
          color: input.strawColors[i] || 'Pink',
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
      if (currentOccupied + requiredStraws > 10) {
        throw new Error(`Location ${visoTube.locationCode} does not have enough vacant straw capacity.`);
      }

      const freezingDateObj = input.freezingDate ? new Date(input.freezingDate) : (input.storageDate ? new Date(input.storageDate) : new Date());
      const aspirationDateObj = input.aspirationDate ? new Date(input.aspirationDate) : null;

      // Create Storage Batch entity with self-healing P2002 Unique Constraint retry
      let batch: any = null;
      let finalBatchId = batchIdCode;
      let batchAttemptCounter = 0;

      while (!batch && batchAttemptCounter < 25) {
        try {
          batch = await tx.storageBatch.create({
            data: {
              batchId: finalBatchId,
              patientId: input.patientId,
              storageDate: freezingDateObj,
              freezingDate: freezingDateObj,
              aspirationDate: aspirationDateObj,
              embryoStage: input.embryoStage || null,
              totalStraws: requiredStraws,
              totalEmbryos: totalEmbryos,
              visoTubeId: input.visoTubeId,
              notes: input.notes || null,
            },
          });
        } catch (err: any) {
          if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
            batchAttemptCounter++;
            const baseNum = parseInt(finalBatchId.split('-').pop() || '0', 10);
            const nextNum = (isNaN(baseNum) ? 1 : baseNum) + batchAttemptCounter;
            finalBatchId = `BATCH-${freezingDateObj.getFullYear()}-${nextNum.toString().padStart(6, '0')}`;
          } else {
            throw err;
          }
        }
      }

      if (!batch) {
        throw new Error('Failed to create storage batch after retry attempts.');
      }

      // Update patient's aspirationDate & freezingDate on record allocation
      await tx.patient.update({
        where: { id: input.patientId },
        data: {
          aspirationDate: aspirationDateObj || undefined,
          freezingDate: freezingDateObj,
        },
      });

      const createdStraws: any[] = [];
      const existingPatientStrawCount = await tx.straw.count({
        where: { batch: { patientId: input.patientId } },
      });

      for (let i = 0; i < requiredStraws; i++) {
        const item = strawItems[i];
        const embryosInThisStraw = item.embryoCount || 1;
        const color = item.color || 'Pink';
        const seqNum = existingPatientStrawCount + i + 1;

        let straw: any = null;
        let strawIdCode = `#${seqNum}`;
        let strawAttemptCounter = 0;

        while (!straw && strawAttemptCounter < 25) {
          try {
            straw = await tx.straw.create({
              data: {
                strawId: strawAttemptCounter === 0 ? strawIdCode : `#${seqNum} (P-${strawAttemptCounter})`,
                batchId: batch.id,
                visoTubeId: input.visoTubeId,
                color,
                embryoCount: embryosInThisStraw,
                grade: item.grade ? item.grade.trim() : null,
                comments: item.comments ? item.comments.trim() : null,
                isPgt: item.isPgt ?? false,
                maxCapacity: 2,
                status: 'OCCUPIED',
              },
            });
          } catch (err: any) {
            if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
              strawAttemptCounter++;
              strawIdCode = `#${seqNum} (P-${strawAttemptCounter})`;
            } else {
              throw err;
            }
          }
        }

        if (!straw) {
          throw new Error('Failed to create straw entity after retry attempts.');
        }

        // Create Embryo entities inside straw
        for (let e = 1; e <= embryosInThisStraw; e++) {
          await tx.embryo.create({
            data: {
              strawId: straw.id,
              embryoNumber: e,
              grade: item.grade ? item.grade.trim() : '',
              notes: item.comments ? item.comments.trim() : null,
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
              vacantStrawsCount += (10 - occ);
            });
          });
        });
      });
    });

    const totalCapacityStraws = totalVisoTubes * 10;
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

      if (targetTube.straws.length >= 10) {
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
        include: { batch: true },
      });

      if (!straw) {
        throw new Error('Straw not found.');
      }

      const updatePayload: any = {};
      if (data.strawCustomId !== undefined) updatePayload.strawId = data.strawCustomId.trim();
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
}

export const storageService = new StorageService();
