import React, { useEffect, useState } from 'react';
import {
  Layers,
  Database,
  ShieldAlert,
  Grid,
  Hexagon as HexIcon,
  CheckCircle2,
  ChevronRight,
  Info,
  User,
  Calendar,
  Tag,
  Dna,
  FileText,
  X,
  ThermometerSnowflake,
} from 'lucide-react';
import { apiRequest } from '../api/client';

export function parseLocationCode(code: string) {
  if (!code) return { can: '01', canister: '01', level: '1', goblet: '01', tube: '01', formatted: 'Unknown' };
  const match = code.match(/^CAN-?(\d+)-CANISTER(\d+)-L(\d+)-G(\d+)-V(\d+)$/i);
  if (!match) return { can: '01', canister: '01', level: '1', goblet: '01', tube: '01', formatted: code };
  return {
    can: match[1],
    canister: match[2],
    level: match[3],
    goblet: match[4],
    tube: match[5],
    formatted: `Can ${match[1]} • Canister ${match[2]} • Level ${match[3]} (${match[3] === '1' ? 'Bottom' : 'Top'}) • Viso Tube ${match[5]}`,
  };
}

export type OverviewMode = 'honeycomb' | 'matrix';

// Exact Physical Viso Tube Color Definitions (11 Tubes per Goblet with strict boundary stroke colors)
export const VISO_TUBE_COLOR_MAP: Record<number, { name: string; stroke: string; bg: string; dotHex: string }> = {
  1: { name: 'Pink', stroke: 'stroke-pink-500', bg: 'bg-pink-100 text-pink-900 border-pink-400', dotHex: '#ec4899' },
  2: { name: 'Grey', stroke: 'stroke-slate-600', bg: 'bg-slate-200 text-slate-900 border-slate-400', dotHex: '#6b7280' },
  3: { name: 'Red', stroke: 'stroke-rose-600', bg: 'bg-rose-100 text-rose-900 border-rose-400', dotHex: '#ef4444' },
  4: { name: 'Black', stroke: 'stroke-slate-950', bg: 'bg-slate-900 text-white border-slate-700', dotHex: '#0f172a' },
  5: { name: 'Green', stroke: 'stroke-emerald-600', bg: 'bg-emerald-100 text-emerald-900 border-emerald-400', dotHex: '#10b981' },
  6: { name: 'Rust', stroke: 'stroke-amber-800', bg: 'bg-amber-100 text-amber-950 border-amber-500', dotHex: '#c2410c' },
  7: { name: 'Blue', stroke: 'stroke-blue-600', bg: 'bg-blue-100 text-blue-900 border-blue-400', dotHex: '#3b82f6' },
  8: { name: 'Purple', stroke: 'stroke-purple-600', bg: 'bg-purple-100 text-purple-900 border-purple-400', dotHex: '#a855f7' },
  9: { name: 'Yellow', stroke: 'stroke-yellow-500', bg: 'bg-yellow-100 text-yellow-900 border-yellow-400', dotHex: '#eab308' },
  10: { name: 'Orange', stroke: 'stroke-orange-500', bg: 'bg-orange-100 text-orange-900 border-orange-400', dotHex: '#f97316' },
  11: { name: 'Skyblue', stroke: 'stroke-sky-500', bg: 'bg-sky-100 text-sky-900 border-sky-400', dotHex: '#0ea5e9' },
};

interface ContainerViewProps {
  initialCanCode?: string;
}

export const ContainerView: React.FC<ContainerViewProps> = ({ initialCanCode }) => {
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [selectedCanCode, setSelectedCanCode] = useState<string>(initialCanCode || 'CAN-01');
  const [selectedCanisterNum, setSelectedCanisterNum] = useState<number>(1);
  const [selectedLevelNum, setSelectedLevelNum] = useState<number>(1);
  const [selectedTube, setSelectedTube] = useState<any | null>(null);
  
  // Overview Modes: honeycomb | matrix
  const [viewMode, setViewMode] = useState<OverviewMode>('honeycomb');

  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [canOccupancyMap, setCanOccupancyMap] = useState<Record<string, number>>({});
  const [canisterOccupancyMap, setCanisterOccupancyMap] = useState<Record<string, number>>({});

  const CLINIC_CANS = [1, 2, 3, 4, 5, 8, 10, 14];

  useEffect(() => {
    fetchGlobalOccupancy();
  }, []);

  useEffect(() => {
    fetchHierarchy();
  }, [selectedCanCode]);

  const fetchGlobalOccupancy = async () => {
    try {
      const res = await apiRequest('/api/storage/hierarchy?canCode=all');
      if (res.success && res.cans) {
        const occMap: Record<string, number> = {};
        const cnOccMap: Record<string, number> = {};

        res.cans.forEach((can: any) => {
          let canCount = 0;
          can.canisters?.forEach((cn: any) => {
            let cnCount = 0;
            cn.levels?.forEach((l: any) => {
              l.goblets?.forEach((g: any) => {
                g.visoTubes?.forEach((v: any) => {
                  const occStraws = v.straws?.filter((s: any) => s.status === 'OCCUPIED').length || 0;
                  cnCount += occStraws;
                });
              });
            });
            canCount += cnCount;
            cnOccMap[`${can.code}-C${cn.canisterNumber}`] = cnCount;
          });
          occMap[can.code] = canCount;
        });
        setCanOccupancyMap(occMap);
        setCanisterOccupancyMap(cnOccMap);
      }
    } catch (err: any) {
      console.error('Failed to fetch global occupancy map:', err);
    }
  };

  const fetchHierarchy = async () => {
    if (!hierarchy) {
      setInitialLoading(true);
    } else {
      setIsRefetching(true);
    }
    setError(null);
    try {
      const res = await apiRequest(`/api/storage/hierarchy?canCode=${selectedCanCode}`);
      if (res.success) {
        setHierarchy(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch storage hierarchy.');
    } finally {
      setInitialLoading(false);
      setIsRefetching(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="flex flex-col items-center gap-3 text-emerald-600">
          <div className="w-8 h-8 border-3 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading Storage Layout...</span>
        </div>
      </div>
    );
  }

  const currentCan = hierarchy?.cans?.[0];
  const currentCanister = currentCan?.canisters?.find((c: any) => c.canisterNumber === selectedCanisterNum);
  const currentLevel = currentCanister?.levels?.find((l: any) => l.levelNumber === selectedLevelNum);
  const currentGoblet = currentLevel?.goblets?.[0];
  const visoTubes = currentGoblet?.visoTubes || [];

  // Helper to determine space-fill background color according to space left (Green = Empty, Yellow = Partial, Red = Full)
  const getSpaceFillColor = (occupied: number, max: number = 10) => {
    const rawPercentage = max > 0 ? (occupied / max) * 100 : 0;
    const formattedLabel = rawPercentage > 0 && rawPercentage < 1
      ? `${rawPercentage.toFixed(2)}%`
      : `${Math.round(rawPercentage)}%`;

    if (occupied === 0) {
      return {
        fill: 'fill-emerald-100/90',
        stroke: 'stroke-emerald-500',
        bg: 'bg-emerald-100 text-emerald-950 border-emerald-300 font-mono font-bold',
        dot: 'bg-emerald-500',
        label: '0%',
      };
    } else if (occupied >= max) {
      return {
        fill: 'fill-rose-500/90',
        stroke: 'stroke-rose-700',
        bg: 'bg-rose-600 text-white border-rose-700 font-mono font-bold',
        dot: 'bg-rose-600',
        label: '100%',
      };
    } else {
      return {
        fill: 'fill-amber-300/95',
        stroke: 'stroke-amber-600',
        bg: 'bg-amber-400 text-amber-950 border-amber-500 font-mono font-black shadow-xs',
        dot: 'bg-amber-500',
        label: formattedLabel,
      };
    }
  };

  return (
    <div className="p-3 sm:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-8 bg-slate-50 min-h-screen w-full box-border overflow-x-hidden">
      {/* Header & Overview Mode Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Layers className="w-7 h-7 text-emerald-600 animate-pulse" />
            <span>Full Container Storage Overview Explorer</span>
          </h1>
          {/* <p className="text-sm text-slate-600 mt-1 font-medium">
            Background Fill: <strong className="text-emerald-700">Space Left (Green=Empty, Yellow=Partial, Red=Full)</strong> • Boundaries: <strong className="text-slate-900">Physical Viso Tube Colors</strong>
          </p> */}
        </div>

        {/* 2 View Modes Switcher */}
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setViewMode('honeycomb')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'honeycomb'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HexIcon className="w-4 h-4" />
            <span>Honeycomb View</span>
          </button>

          <button
            onClick={() => setViewMode('matrix')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'matrix'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Clinic Capacity Matrix</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* SPACE LEFT CAPACITY & PHYSICAL BOUNDARY COLOR LEGEND BAR */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        {/* Capacity Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 font-bold text-slate-900 uppercase tracking-wider">
            <span>Background Fill (Space Left):</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-xl border border-emerald-300">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
              <span className="text-slate-900 font-bold">GREEN = Empty (0% Occupied)</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-xl border border-amber-300">
              <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
              <span className="text-slate-900 font-bold">YELLOW = Partially Occupied</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-xl border border-rose-300">
              <span className="w-3 h-3 rounded-full bg-rose-600 shadow-sm" />
              <span className="text-slate-900 font-bold">RED = Full (100% Capacity)</span>
            </div>
          </div>
        </div>

        {/* Physical Viso Tube Boundary Colors Legend */}
        {/* <div className="space-y-2">
          <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-600" />
            <span>Boundary Borders (11 Physical Viso Tube Colors):</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-11 gap-2">
            {Object.entries(VISO_TUBE_COLOR_MAP).map(([numStr, color]) => {
              const num = parseInt(numStr, 10);
              return (
                <div
                  key={num}
                  className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border text-center justify-center shadow-2xs"
                  style={{ borderColor: color.dotHex }}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-xs border border-black/10"
                    style={{ backgroundColor: color.dotHex }}
                  />
                  <span className="text-[10px] font-extrabold text-slate-900">
                    V{num.toString().padStart(2, '0')}: {color.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div> */}
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: HONEYCOMB VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'honeycomb' && (
        <div className="space-y-8">
          {/* Cans Space-Fill Honeycomb */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Cans Overview (Capacity Heatmap):</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">Click any Hexagon to select Can</span>
            </div>

            <div className="flex flex-col items-center gap-2 sm:gap-4 py-2 sm:py-4">
              {/* Row 1: Cans 1, 2, 3, 4 */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-4 max-w-full">
                {[1, 2, 3, 4].map((num) => {
                  const code = `CAN-${num.toString().padStart(2, '0')}`;
                  const isSelected = selectedCanCode === code;
                  const occupiedInCan = canOccupancyMap[code] || 0;
                  const colorInfo = getSpaceFillColor(occupiedInCan, 2200);

                  return (
                    <button
                      key={code}
                      onClick={() => {
                        setSelectedCanCode(code);
                        setSelectedTube(null);
                      }}
                      className="group relative focus:outline-none transition-transform hover:scale-105 flex flex-col items-center"
                    >
                      <svg viewBox="0 0 100 115" className="w-18 h-20 sm:w-26 sm:h-28 filter drop-shadow-sm">
                        <polygon
                          points="50,2 95,28 95,87 50,113 5,87 5,28"
                          className={`transition-all duration-300 ${colorInfo.fill} ${
                            isSelected
                              ? 'stroke-slate-900 stroke-[5.5]'
                              : `${colorInfo.stroke} stroke-[2.5]`
                          }`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1 pointer-events-none">
                        <span className="font-mono text-xs sm:text-sm font-black text-slate-950">
                          {code}
                        </span>
                        <span className={`text-[9.5px] sm:text-xs font-black mt-0.5 px-2 sm:px-2.5 py-0.5 rounded-full border shadow-2xs ${colorInfo.bg}`}>
                          {colorInfo.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Row 2: Cans 5, 8, 10, 14 */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-4 max-w-full -mt-2 sm:-mt-4">
                {[5, 8, 10, 14].map((num) => {
                  const code = `CAN-${num.toString().padStart(2, '0')}`;
                  const isSelected = selectedCanCode === code;
                  const occupiedInCan = canOccupancyMap[code] || 0;
                  const colorInfo = getSpaceFillColor(occupiedInCan, 2200);

                  return (
                    <button
                      key={code}
                      onClick={() => {
                        setSelectedCanCode(code);
                        setSelectedTube(null);
                      }}
                      className="group relative focus:outline-none transition-transform hover:scale-105 flex flex-col items-center"
                    >
                      <svg viewBox="0 0 100 115" className="w-18 h-20 sm:w-26 sm:h-28 filter drop-shadow-sm">
                        <polygon
                          points="50,2 95,28 95,87 50,113 5,87 5,28"
                          className={`transition-all duration-300 ${colorInfo.fill} ${
                            isSelected
                              ? 'stroke-slate-900 stroke-[5.5]'
                              : `${colorInfo.stroke} stroke-[2.5]`
                          }`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1 pointer-events-none">
                        <span className="font-mono text-xs sm:text-sm font-black text-slate-950">
                          {code}
                        </span>
                        <span className={`text-[9.5px] sm:text-xs font-black mt-0.5 px-2 sm:px-2.5 py-0.5 rounded-full border shadow-2xs ${colorInfo.bg}`}>
                          {colorInfo.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Grid Selector & Viso Tubes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Canisters in {selectedCanCode}</span>
                  <span className="text-emerald-700 font-extrabold">10 Canisters</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }).map((_, idx) => {
                    const num = idx + 1;
                    const isSelected = selectedCanisterNum === num;
                    const cnOccupied = canisterOccupancyMap[`${selectedCanCode}-C${num}`] || 0;
                    const cnMax = 220; // 220 straws per canister (22 Viso Tubes x 10 straws)

                    let bgStyle = 'bg-emerald-100 border-emerald-300 text-emerald-950 font-bold';
                    if (cnOccupied >= cnMax) {
                      bgStyle = 'bg-rose-500 border-rose-700 text-white font-black shadow-xs';
                    } else if (cnOccupied > 0) {
                      bgStyle = 'bg-amber-300 border-amber-500 text-amber-950 font-black shadow-xs';
                    }

                    return (
                      <button
                        key={num}
                        onClick={() => {
                          setSelectedCanisterNum(num);
                          setSelectedTube(null);
                        }}
                        className={`py-2.5 rounded-xl text-xs font-mono font-bold transition-all border flex flex-col items-center justify-center gap-0.5 ${bgStyle} ${
                          isSelected ? 'ring-2 ring-slate-900 ring-offset-1 shadow-md scale-105' : 'hover:scale-102'
                        }`}
                        title={`Canister ${num}: ${cnOccupied}/${cnMax} occupied`}
                      >
                        <span>C{num.toString().padStart(2, '0')}</span>
                        <span className="text-[9px] font-extrabold opacity-90">
                          {cnOccupied > 0 ? (cnOccupied >= cnMax ? 'FULL' : `${cnOccupied}`) : '0'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select Level in Canister {selectedCanisterNum}:
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2].map((lvl) => {
                    const isSelected = selectedLevelNum === lvl;
                    return (
                      <button
                        key={lvl}
                        onClick={() => {
                          setSelectedLevelNum(lvl);
                          setSelectedTube(null);
                        }}
                        className={`py-3 px-4 rounded-xl text-xs font-bold transition-all border text-center ${
                          isSelected
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-500 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Level {lvl} {lvl === 1 ? '(Bottom)' : '(Top)'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Viso Tubes Cluster */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="space-y-4 border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>Level {selectedLevelNum} — 11 Viso Tubes</span>
                    </h2>
                    <div className="text-xs text-slate-600 font-mono mt-0.5 font-semibold">
                      Can {selectedCanCode.replace('CAN-', '')} • Canister {selectedCanisterNum.toString().padStart(2, '0')} • Level {selectedLevelNum}
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1 bg-slate-100 text-emerald-800 font-bold rounded-full font-mono border border-slate-200">
                    11 Viso Tubes
                  </span>
                </div>

                {/* Boundary Borders (11 Physical Viso Tube Colors) Legend */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Boundary Borders (11 Physical Viso Tube Colors):</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-11 gap-1.5">
                    {Object.entries(VISO_TUBE_COLOR_MAP).map(([numStr, color]) => {
                      const num = parseInt(numStr, 10);
                      return (
                        <div
                          key={num}
                          className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border text-center justify-center shadow-2xs"
                          style={{ borderColor: color.dotHex }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs border border-black/10"
                            style={{ backgroundColor: color.dotHex }}
                          />
                          <span className="text-[10px] font-extrabold text-slate-900">
                            V{num.toString().padStart(2, '0')}: {color.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* RADIAL PIZZA SLICE GOBLET (FILL = SPACE LEFT, STROKE = PHYSICAL COLOR) */}
              <div className="py-6 flex flex-col items-center justify-center space-y-4">
                {/* <div className="text-xs text-slate-600 font-bold uppercase tracking-wider">
                  Fill = Space Left (Green/Yellow/Red) • Borders = Physical Colors (Pink, Grey, Red, Black, Green, Rust, Blue, Purple, Yellow, Orange, Skyblue):
                </div> */}

                <div className="relative flex items-center justify-center">
                  <svg width="370" height="370" viewBox="0 0 360 360" className="filter drop-shadow-lg">
                    {/* Outer Circular Goblet Rim */}
                    <circle cx="180" cy="180" r="168" className="fill-slate-100/90 stroke-slate-300 stroke-[4]" />
                    <circle cx="180" cy="180" r="162" className="fill-white stroke-emerald-500/20 stroke-2 stroke-dashed" />

                    {/* 11 Radial Pizza Slices / Wedges (V01 to V11) */}
                    {visoTubes.slice(0, 11).map((tube: any, idx: number) => {
                      const tubeNum = tube.tubeNumber;
                      const tubeColor = VISO_TUBE_COLOR_MAP[tubeNum] || VISO_TUBE_COLOR_MAP[1];

                      // 11 Equal Angular Slices (360 / 11 = 32.72727 degrees per slice)
                      const sliceAngle = 360 / 11;
                      const startAngle = idx * sliceAngle - 90 + 1.2;
                      const endAngle = (idx + 1) * sliceAngle - 90 - 1.2;
                      const midAngleRad = (((startAngle + endAngle) / 2) * Math.PI) / 180;

                      // SVG Pizza Slice Path (Outer Radius 156, Inner Empty Hole Radius 40)
                      const pathData = (() => {
                        const rad1 = (startAngle * Math.PI) / 180;
                        const rad2 = (endAngle * Math.PI) / 180;
                        const xo1 = 180 + 156 * Math.cos(rad1);
                        const yo1 = 180 + 156 * Math.sin(rad1);
                        const xo2 = 180 + 156 * Math.cos(rad2);
                        const yo2 = 180 + 156 * Math.sin(rad2);
                        const xi2 = 180 + 40 * Math.cos(rad2);
                        const yi2 = 180 + 40 * Math.sin(rad2);
                        const xi1 = 180 + 40 * Math.cos(rad1);
                        const yi1 = 180 + 40 * Math.sin(rad1);
                        return `M ${xo1} ${yo1} A 156 156 0 0 1 ${xo2} ${yo2} L ${xi2} ${yi2} A 40 40 0 0 0 ${xi1} ${yi1} Z`;
                      })();

                      // Text label position at mid-radius 98
                      const tx = 180 + 98 * Math.cos(midAngleRad);
                      const ty = 180 + 98 * Math.sin(midAngleRad);

                      const occupiedCount = tube.straws?.filter((s: any) => s.status === 'OCCUPIED').length || 0;
                      const capacityColor = getSpaceFillColor(occupiedCount, 10);
                      const isSelected = selectedTube?.id === tube.id;

                      return (
                        <g
                          key={tube.id}
                          onClick={() => setSelectedTube(tube)}
                          className="cursor-pointer group"
                        >
                          <path
                            d={pathData}
                            className={`transition-all duration-300 ${
                              isSelected
                                ? 'stroke-slate-900 stroke-[5] fill-emerald-200/90 shadow-md'
                                : `${capacityColor.fill} ${tubeColor.stroke} stroke-[3.5] hover:scale-[1.02]`
                            }`}
                          />
                          <text
                            x={tx}
                            y={ty - 6}
                            textAnchor="middle"
                            className="font-mono text-xs font-black fill-slate-900 pointer-events-none select-none"
                          >
                            V{tube.tubeNumber.toString().padStart(2, '0')}
                          </text>
                          <text
                            x={tx}
                            y={ty + 5}
                            textAnchor="middle"
                            className="font-mono text-[9px] font-extrabold fill-slate-800 pointer-events-none select-none"
                          >
                            {tubeColor.name}
                          </text>
                          <text
                            x={tx}
                            y={ty + 16}
                            textAnchor="middle"
                            className="font-mono text-[9px] font-extrabold fill-slate-700 pointer-events-none select-none"
                          >
                            {occupiedCount}/10
                          </text>
                        </g>
                      );
                    })}

                    {/* Center Empty Hole in Middle of Goblet Wheel */}
                    <circle
                      cx="180"
                      cy="180"
                      r="36"
                      className="fill-slate-100/95 stroke-slate-300 stroke-2 stroke-dashed pointer-events-none"
                    />
                    <text
                      x="180"
                      y="180"
                      textAnchor="middle"
                      className="font-mono text-[8px] font-black fill-slate-500 pointer-events-none select-none uppercase tracking-wider"
                    >
                      GOBLET
                    </text>
                    
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: CLINIC CAPACITY HEATMAP MATRIX VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'matrix' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Grid className="w-5 h-5 text-emerald-600" />
                  <span>Global Clinic Storage Capacity Matrix Grid</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Side-by-side capacity breakdown for all 8 physical Cans across all 10 Canisters
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {CLINIC_CANS.map((canNum) => {
                const canCode = `CAN-${canNum.toString().padStart(2, '0')}`;
                const isSelected = selectedCanCode === canCode;

                return (
                  <div
                    key={canCode}
                    onClick={() => {
                      setSelectedCanCode(canCode);
                      setViewMode('honeycomb');
                    }}
                    className={`p-5 rounded-3xl border transition-all cursor-pointer space-y-4 ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/30 shadow-md'
                        : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Database className="w-4 h-4 text-emerald-600" />
                        <span>{canCode}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                        Can {canNum}
                      </span>
                    </div>

                    {/* Canister Mini Capacity Bars */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">10 Canisters Capacity:</div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {Array.from({ length: 10 }).map((_, idx) => {
                          const cn = idx + 1;
                          const cnOccupied = canisterOccupancyMap[`${canCode}-C${cn}`] || 0;
                          const cnMax = 220; // 220 straws per canister (22 Viso Tubes x 10 straws)

                          let bgStyle = 'bg-emerald-100 border-emerald-300 text-emerald-950 font-bold';
                          if (cnOccupied >= cnMax) {
                            bgStyle = 'bg-rose-500 border-rose-700 text-white font-black shadow-xs';
                          } else if (cnOccupied > 0) {
                            bgStyle = 'bg-amber-300 border-amber-500 text-amber-950 font-black shadow-xs';
                          }

                          return (
                            <div
                              key={cn}
                              className={`p-1.5 rounded-xl border text-center space-y-0.5 transition-all ${bgStyle}`}
                              title={`${canCode} Canister ${cn}: ${cnOccupied}/${cnMax} occupied`}
                            >
                              <div className="text-[10px] font-mono font-bold">C{cn}</div>
                              <div className="text-[9px] font-mono font-black">
                                {cnOccupied > 0 ? (cnOccupied >= cnMax ? 'FULL' : `${cnOccupied}`) : '0'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="text-[11px] font-bold text-emerald-700 flex items-center justify-between pt-1">
                      <span>Click to view detailed layout</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Selected Tube Comprehensive Patient & Straw Inspector Modal */}
      {selectedTube && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white p-7 rounded-3xl border border-slate-200 space-y-6 shadow-2xl my-8">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded-full border border-emerald-300">
                    {selectedTube.locationCode}
                  </span>
                  <span className={`text-xs px-3 py-0.5 rounded-full font-mono font-bold border ${VISO_TUBE_COLOR_MAP[selectedTube.tubeNumber]?.bg || ''}`}>
                    Color: {VISO_TUBE_COLOR_MAP[selectedTube.tubeNumber]?.name}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Viso Tube #{selectedTube.tubeNumber} Specimen & Patient Inspector</span>
                </h2>
                <div className="text-xs text-slate-600 font-medium">
                  {parseLocationCode(selectedTube.locationCode).formatted}
                </div>
              </div>

              <button
                onClick={() => setSelectedTube(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {selectedTube.straws?.filter((s: any) => s.status === 'OCCUPIED').length === 0 ? (
              /* EMPTY VISO TUBE CARD */
              <div className="p-6 bg-emerald-50/70 border border-emerald-200 rounded-3xl space-y-3 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-300">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  This Viso Tube ({VISO_TUBE_COLOR_MAP[selectedTube.tubeNumber]?.name}) is 100% EMPTY
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  All <strong>10 straw slots</strong> are vacant and available for immediate patient specimen allocation.
                </p>
              </div>
            ) : (
              /* OCCUPIED VISO TUBE PATIENT & STRAW DETAILS LIST */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>Stored Patient Specimens ({selectedTube.straws.filter((s: any) => s.status === 'OCCUPIED').length} Straws Present):</span>
                  </div>
                  <span className="text-xs text-emerald-700 font-extrabold font-mono">
                    {10 - selectedTube.straws.filter((s: any) => s.status === 'OCCUPIED').length} Slots Vacant
                  </span>
                </div>

                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {selectedTube.straws
                    .filter((straw: any) => straw.status === 'OCCUPIED')
                    .map((straw: any, idx: number) => {
                      const patient = straw.batch?.patient;
                      const embryos = straw.embryos || [];
                      const storageDate = straw.batch?.storageDate
                        ? new Date(straw.batch.storageDate).toISOString().split('T')[0]
                        : 'N/A';

                      return (
                        <div
                          key={straw.id}
                          className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:border-emerald-300 transition-all"
                        >
                          {/* Straw & Patient Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm border border-emerald-300">
                                #{idx + 1}
                              </div>
                              <div>
                                <div className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                  <span>{patient?.fullName || 'Anonymous Patient'}</span>
                                  <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 font-mono rounded-md font-bold border border-slate-200">
                                    ID: {patient?.patientId || 'N/A'}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-4 mt-0.5">
                                  {patient?.dob && <span>DOB: {patient.dob}</span>}
                                  {patient?.phone && <span>Phone: {patient.phone}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold font-mono rounded-full">
                                Straw ID: {straw.strawId}
                              </span>

                              {straw.status === 'OCCUPIED' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!confirm(`Are you sure you want to thaw Straw ${straw.strawId}? This will liberate physical capacity.`)) return;
                                    try {
                                      const res = await apiRequest('/api/thaw', {
                                        method: 'POST',
                                        body: JSON.stringify({
                                          strawIds: [straw.id],
                                          doctorNotes: 'Thawed directly from Viso Tube Inspector modal',
                                        }),
                                      });
                                      if (res.success) {
                                        alert(res.message || 'Straw thawed successfully!');
                                        setSelectedTube(null);
                                        fetchHierarchy();
                                      }
                                    } catch (err: any) {
                                      alert('Thaw failed: ' + err.message);
                                    }
                                  }}
                                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full shadow-xs flex items-center gap-1 transition-all"
                                >
                                  <ThermometerSnowflake className="w-3.5 h-3.5" />
                                  <span>Thaw Straw</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Specimen Details Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 space-y-1">
                              <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Dna className="w-3 h-3 text-emerald-600" />
                                <span>Embryos Stored</span>
                              </div>
                              <div className="font-bold text-slate-900">
                                {embryos.length || straw.batch?.totalEmbryos || 1} Embryo(s)
                              </div>
                            </div>

                            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 space-y-1">
                              <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Tag className="w-3 h-3 text-emerald-600" />
                                <span>Straw Color</span>
                              </div>
                              <div className="font-bold text-slate-900">
                                {straw.color || 'Pink'}
                              </div>
                            </div>

                            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 space-y-1">
                              <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-emerald-600" />
                                <span>Storage Date</span>
                              </div>
                              <div className="font-bold text-slate-900 font-mono">
                                {storageDate}
                              </div>
                            </div>

                            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 space-y-1">
                              <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <FileText className="w-3 h-3 text-emerald-600" />
                                <span>Batch Code</span>
                              </div>
                              <div className="font-bold text-slate-900 font-mono">
                                {straw.batch?.batchId || 'BATCH-2026-01'}
                              </div>
                            </div>
                          </div>

                          {/* Notes if available */}
                          {straw.batch?.notes && (
                            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium">
                              <strong>Clinical Notes:</strong> {straw.batch.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-slate-200 pt-4">
              <button
                onClick={() => setSelectedTube(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
