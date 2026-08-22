import { prisma } from '../../common/prisma.js';

export class DashboardService {
  async getDashboardMetrics() {
    const [cans, totalPatients, pendingOcrCount, recentLogs] = await Promise.all([
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
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, staffId: true } },
        },
      }),
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

      const maxStrawCapacity = canTubes * 10;
      const utilization = maxStrawCapacity > 0 ? Math.round((canOccupiedStraws / maxStrawCapacity) * 100) : 0;

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

    const globalMaxStrawCapacity = globalTotalVisoTubes * 10;
    const globalUtilization = globalMaxStrawCapacity > 0 ? Math.round((globalOccupiedStraws / globalMaxStrawCapacity) * 100) : 0;

    return {
      summary: {
        totalCans: cans.length,
        totalPatients,
        totalVisoTubes: globalTotalVisoTubes,
        maxStrawCapacity: globalMaxStrawCapacity,
        occupiedStraws: globalOccupiedStraws,
        availableStraws: globalMaxStrawCapacity - globalOccupiedStraws,
        globalUtilizationPercentage: `${globalUtilization}%`,
        pendingOcrCount,
      },
      canStats,
      recentActivity: recentLogs,
    };
  }
}

export const dashboardService = new DashboardService();
