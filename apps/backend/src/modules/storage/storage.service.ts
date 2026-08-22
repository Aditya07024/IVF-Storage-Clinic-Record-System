export function parseLocationCode(code: string) {
  if (!code) return { raw: '', formatted: '', can: '', canister: '', level: '', goblet: '', tube: '' };

  const match = code.match(/CAN-?(\d+)-CANISTER(\d+)-L(\d+)-G(\d+)-V(\d+)/i);
  if (!match) return { raw: code, formatted: code, can: '', canister: '', level: '', goblet: '', tube: '' };

  const canNum = match[1].padStart(2, '0');
  const canisterNum = match[2].padStart(2, '0');
  const levelNum = parseInt(match[3], 10);
  const levelName = levelNum === 1 ? 'Level 1 (Bottom)' : levelNum === 2 ? 'Level 2 (Top)' : `Level ${levelNum}`;
  const gobletNum = match[4].padStart(2, '0');
  const tubeNum = match[5].padStart(2, '0');

  const formatted = `Chamber ${canNum} • Canister ${canisterNum} • ${levelName} • Goblet ${gobletNum} • Viso Tube ${tubeNum}`;

  return {
    raw: code,
    can: `Chamber ${canNum}`,
    canister: `Canister ${canisterNum}`,
    level: levelName,
    goblet: `Goblet ${gobletNum}`,
    tube: `Viso Tube ${tubeNum}`,
    formatted,
  };
}

export const CLINIC_CAN_NUMBERS = [1, 2, 3, 4, 5, 8, 10, 14];

export class StorageService {
  // Initialize storage hierarchy if empty (Cans 1, 2, 3, 4, 5, 8, 10, 14 x 10 Canisters x 2 Levels x 1 Goblet x 11 Viso Tubes)
  async seedHierarchyIfNeeded() {
    const existingCans = await prisma.can.count();
    
    // Check if current Cans match non-sequential CLINIC_CAN_NUMBERS
    const cans = await prisma.can.findMany({ select: { code: true } });
    const currentCanCodes = cans.map(c => c.code);
    const expectedCodes = CLINIC_CAN_NUMBERS.map(c => `CAN-${c.toString().padStart(2, '0')}`);
    
    const isMatching = expectedCodes.every(code => currentCanCodes.includes(code)) && currentCanCodes.length === expectedCodes.length;

    if (existingCans > 0 && isMatching) return;

    // If existing Cans differ, clean up and re-seed with exact non-sequential clinic Cans
    if (existingCans > 0 && !isMatching) {
      console.log('[Storage] Syncing Cans to non-sequential clinic layout (1, 2, 3, 4, 5, 8, 10, 14)...');
      await prisma.straw.deleteMany({});
      await prisma.storageBatch.deleteMany({});
      await prisma.visoTube.deleteMany({});
      await prisma.goblet.deleteMany({});
      await prisma.level.deleteMany({});
      await prisma.canister.deleteMany({});
      await prisma.can.deleteMany({});
    }

    console.log('[Storage] Seeding Cans (1, 2, 3, 4, 5, 8, 10, 14) hierarchy...');

    for (const c of CLINIC_CAN_NUMBERS) {
      const canCode = `CAN-${c.toString().padStart(2, '0')}`;
      const can = await prisma.can.create({
        data: {
          code: canCode,
          name: `Chamber Can ${c.toString().padStart(2, '0')}`,
        },
      });

      for (let cn = 1; cn <= 10; cn++) {
        const canister = await prisma.canister.create({
          data: {
            canId: can.id,
            canisterNumber: cn,
          },
        });

        for (let l = 1; l <= 2; l++) {
          const level = await prisma.level.create({
            data: {
              canisterId: canister.id,
              levelNumber: l,
            },
          });

          const goblet = await prisma.goblet.create({
            data: {
              levelId: level.id,
              gobletNumber: 1,
            },
          });

          for (let v = 1; v <= 11; v++) {
            const locCode = `CAN${c.toString().padStart(2, '0')}-CANISTER${cn.toString().padStart(2, '0')}-L${l}-G01-V${v.toString().padStart(2, '0')}`;
            await prisma.visoTube.create({
              data: {
                gobletId: goblet.id,
                tubeNumber: v,
                locationCode: locCode,
              },
            });
          }
        }
      }
    }
    console.log('[Storage] Storage hierarchy seeding completed for non-sequential Cans.');
  }

  // Find Available Storage Recommendation Algorithm
  async findAvailableStorage(patientId: string, storageDateInput: string | Date, embryoCount: number) {
    if (embryoCount <= 0) {
      throw new Error('Embryo count must be greater than zero.');
    }

    const storageDate = new Date(storageDateInput);
    const requiredStraws = Math.ceil(embryoCount / 2); // Max 2 embryos per straw

    // Check if patient already has a StorageBatch on the EXACT same date
    const sameDateBatch = await prisma.storageBatch.findFirst({
      where: {
        patientId,
        storageDate: {
          gte: new Date(storageDate.setHours(0, 0, 0, 0)),
          lte: new Date(storageDate.setHours(23, 59, 59, 999)),
        },
      },
      include: {
        visoTube: {
          include: {
            straws: true,
          },
        },
      },
    });

    let primaryRecommendation = null;
    const fallbackRecommendations: Array<{ visoTubeId: string; locationCode: string; availableSlots: number; matchType: string }> = [];

    // Priority 1: If same-date batch exists, check if its Viso Tube has capacity
    if (sameDateBatch) {
      const existingStrawsCount = sameDateBatch.visoTube.straws.filter(s => s.status === 'OCCUPIED').length;
      // Assume max 10 straws per Viso Tube for reasonable visual capacity
      const availableInSameTube = Math.max(0, 10 - existingStrawsCount);

      if (availableInSameTube >= requiredStraws) {
        const parsed = parseLocationCode(sameDateBatch.visoTube.locationCode);
        primaryRecommendation = {
          visoTubeId: sameDateBatch.visoTube.id,
          locationCode: sameDateBatch.visoTube.locationCode,
          formattedLocation: parsed.formatted,
          breakdown: parsed,
          availableSlots: availableInSameTube,
          matchType: 'SAME_DATE_SAME_TUBE',
          explanation: `Found existing batch for this patient on ${storageDate.toISOString().split('T')[0]}. Grouping into ${parsed.formatted} (${availableInSameTube} vacant straw slots).`,
        };
      }
    }

    // Search all Viso Tubes with occupied straw counts
    const visoTubes = await prisma.visoTube.findMany({
      take: 50,
      include: {
        straws: {
          where: { status: 'OCCUPIED' },
        },
      },
    });

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

  // Generate Straw ID: STR-000001
  private async generateNextStrawId(): Promise<string> {
    const count = await prisma.straw.count();
    return `STR-${(count + 1).toString().padStart(6, '0')}`;
  }

  // Generate Batch ID: BATCH-2026-000001
  private async generateNextBatchId(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.storageBatch.count();
    return `BATCH-${year}-${(count + 1).toString().padStart(6, '0')}`;
  }

  // Assign Storage with PostgreSQL Row Transaction & Lock
  async assignStorage(input: AssignStorageInput, staffUserId: string, staffName: string) {
    const requiredStraws = Math.ceil(input.embryoCount / 2);
    if (input.strawColors.length !== requiredStraws) {
      throw new Error(`Invalid straw colors provided. Expected ${requiredStraws} colors for ${input.embryoCount} embryos.`);
    }

    // Enforce Max 2 embryos per straw backend validation
    if (input.embryoCount > requiredStraws * 2) {
      throw new Error('Rule Violation: A straw can contain a maximum of 2 embryos.');
    }

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

      const storageDate = new Date(input.storageDate);

      // Create Storage Batch entity
      const batchIdCode = await this.generateNextBatchId();
      const batch = await tx.storageBatch.create({
        data: {
          batchId: batchIdCode,
          patientId: input.patientId,
          storageDate,
          totalEmbryos: input.embryoCount,
          visoTubeId: input.visoTubeId,
          notes: input.notes,
        },
      });

      // Distribute embryos into straws (max 2 per straw)
      let remainingEmbryos = input.embryoCount;
      const createdStraws = [];

      for (let i = 0; i < requiredStraws; i++) {
        const embryosInThisStraw = Math.min(2, remainingEmbryos);
        remainingEmbryos -= embryosInThisStraw;

        const strawIdCode = await this.generateNextStrawId();
        const color = input.strawColors[i] || 'Pink';

        const straw = await tx.straw.create({
          data: {
            strawId: strawIdCode,
            batchId: batch.id,
            visoTubeId: input.visoTubeId,
            color,
            maxCapacity: 2,
            status: 'OCCUPIED',
          },
        });

        // Create Embryo entities inside straw
        for (let e = 1; e <= embryosInThisStraw; e++) {
          await tx.embryo.create({
            data: {
              strawId: straw.id,
              embryoNumber: e,
              status: 'FREEZED',
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
    });
  }

  // Get Container Hierarchy Visualization Data
  async getHierarchyOverview(canCode?: string) {
    const cans = await prisma.can.findMany({
      where: canCode ? { code: canCode } : {},
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
    });
  }
}

export const storageService = new StorageService();
