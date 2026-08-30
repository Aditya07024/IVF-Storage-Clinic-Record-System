import { prisma, withDbRetry } from '../../common/prisma.js';

export class DashboardService {
  async getDashboardMetrics() {
    return withDbRetry(async () => {
      const [cans, totalPatients, pendingOcrCount] = await Promise.all([
        prisma.can.findMany({
          orderBy: { code: 'asc' },
          include: {
            canisters: {
              include: {
                levels: {
                  include: {
                    goblets: {
                      include: {
                        visoTubes: {
                          include: {
                            straws: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.patient.count(),
        prisma.ocrRecord.count({ where: { status: 'PENDING' } }),
      ]);

    let globalTotalVisoTubes = 0;
    let globalOccupiedStraws = 0;

    const canStats = cans.map(can => {
      let canTubes = 0;
      let canOccupiedStraws = 0;

      can.canisters.forEach(cn => {
        cn.levels.forEach(l => {
          l.goblets.forEach(g => {
            g.visoTubes.forEach(v => {
              canTubes += 1;
              const occ = v.straws.filter(s => s.status === 'OCCUPIED').length;
              canOccupiedStraws += occ;
            });
          });
        });
      });

      const maxStrawCapacity = canTubes * 14;
      const canUtilVal = maxStrawCapacity > 0 ? (canOccupiedStraws / maxStrawCapacity) * 100 : 0;
      const utilization = canUtilVal > 0 && canUtilVal < 1 ? Number(canUtilVal.toFixed(2)) : Math.round(canUtilVal);

      globalTotalVisoTubes += canTubes;
      globalOccupiedStraws += canOccupiedStraws;

      return {
        canId: can.id,
        canCode: can.code,
        canName: can.name,
        totalTubes: canTubes,
        maxCapacityStraws: maxStrawCapacity,
        occupiedStraws: canOccupiedStraws,
        availableStraws: maxStrawCapacity - canOccupiedStraws,
        utilizationPercentage: utilization,
      };
    });

    const globalMaxStrawCapacity = globalTotalVisoTubes * 14;
    const globalUtilVal = globalMaxStrawCapacity > 0 ? (globalOccupiedStraws / globalMaxStrawCapacity) * 100 : 0;
    const globalUtilizationPercentage = globalUtilVal > 0 && globalUtilVal < 1
      ? `${globalUtilVal.toFixed(2)}%`
      : `${Math.round(globalUtilVal)}%`;

      return {
        summary: {
          totalCans: cans.length,
          totalPatients,
          totalVisoTubes: globalTotalVisoTubes,
          maxStrawCapacity: globalMaxStrawCapacity,
          occupiedStraws: globalOccupiedStraws,
          availableStraws: globalMaxStrawCapacity - globalOccupiedStraws,
          globalUtilizationPercentage,
          pendingOcrCount,
        },
        canStats,
        recentActivity: [],
      };
    });
  }
}

export const dashboardService = new DashboardService();
