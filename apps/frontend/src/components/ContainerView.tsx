import React, { useEffect, useState } from 'react';
import {
  Layers,
  Database,
  ShieldAlert,
  Grid,
  Hexagon as HexIcon,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { apiRequest } from '../api/client';

export type OverviewMode = 'honeycomb' | 'matrix';

export const ContainerView: React.FC = () => {
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [selectedCanCode, setSelectedCanCode] = useState<string>('CAN-01');
  const [selectedCanisterNum, setSelectedCanisterNum] = useState<number>(1);
  const [selectedLevelNum, setSelectedLevelNum] = useState<number>(1);
  const [selectedTube, setSelectedTube] = useState<any | null>(null);
  
  // Overview Modes: honeycomb | matrix
  const [viewMode, setViewMode] = useState<OverviewMode>('honeycomb');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const CLINIC_CANS = [1, 2, 3, 4, 5, 8, 10, 14];

  useEffect(() => {
    fetchHierarchy();
  }, [selectedCanCode]);

  const fetchHierarchy = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/storage/hierarchy?canCode=${selectedCanCode}`);
      if (res.success) {
        setHierarchy(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch storage hierarchy.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="flex flex-col items-center gap-3 text-emerald-600">
          <div className="w-8 h-8 border-3 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading Green & White Storage Geometry...</span>
        </div>
      </div>
    );
  }

  const currentCan = hierarchy?.cans?.[0];
  const currentCanister = currentCan?.canisters?.find((c: any) => c.canisterNumber === selectedCanisterNum);
  const currentLevel = currentCanister?.levels?.find((l: any) => l.levelNumber === selectedLevelNum);
  const currentGoblet = currentLevel?.goblets?.[0];
  const visoTubes = currentGoblet?.visoTubes || [];

  // Helper to determine space-fill status color & boundary stroke color in Light Mode
  const getSpaceFillColor = (occupied: number, max: number = 10) => {
    if (occupied === 0) {
      return {
        fill: 'fill-emerald-100/90',
        stroke: 'stroke-emerald-500',
        bg: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
        dot: 'bg-emerald-500',
        text: 'text-emerald-950',
        label: 'EMPTY',
      };
    } else if (occupied >= max) {
      return {
        fill: 'fill-rose-100/90',
        stroke: 'stroke-rose-500',
        bg: 'bg-rose-100 text-rose-900 border-rose-300 font-bold',
        dot: 'bg-rose-600',
        text: 'text-rose-950',
        label: 'FULL',
      };
    } else {
      return {
        fill: 'fill-amber-100/90',
        stroke: 'stroke-amber-500',
        bg: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
        dot: 'bg-amber-500',
        text: 'text-amber-950',
        label: 'PARTIAL',
      };
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header & Overview Mode Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Layers className="w-7 h-7 text-emerald-600 animate-pulse" />
            <span>Full Container Storage Overview Explorer</span>
          </h1>
          <p className="text-sm text-slate-600 mt-1 font-medium">
            Interactive Cryo Storage Overview: <strong className="text-emerald-700">Honeycomb Space Fill</strong> & <strong className="text-emerald-700">Clinic Capacity Matrix</strong>
          </p>
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

      {/* SPACE FILL LEGEND BAR */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900 uppercase tracking-wider">
          <span>Capacity Color Legend:</span>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-emerald-300">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm" />
            <span className="text-slate-900 font-bold">GREEN = Empty (0% Occupied)</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-amber-300">
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-sm" />
            <span className="text-slate-900 font-bold">YELLOW = Partially Occupied</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-rose-300">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-600 shadow-sm" />
            <span className="text-slate-900 font-bold">RED = Full (100% Capacity)</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: HONEYCOMB VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'honeycomb' && (
        <div className="space-y-8">
          {/* Chamber Cans Space-Fill Honeycomb */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Chambers Overview (Color-Coded Capacity Heatmap):</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">Click any Hexagon to select Chamber</span>
            </div>

            <div className="flex flex-col items-center gap-3 py-4 overflow-x-auto">
              {/* Row 1: Cans 1, 2, 3, 4 */}
              <div className="flex items-center justify-center gap-3">
                {[1, 2, 3, 4].map((num) => {
                  const code = `CAN-${num.toString().padStart(2, '0')}`;
                  const isSelected = selectedCanCode === code;
                  
                  let occupiedInCan = 0;
                  if (currentCan && selectedCanCode === code) {
                    currentCan.canisters?.forEach((cn: any) => {
                      cn.levels?.forEach((l: any) => {
                        l.goblets?.forEach((g: any) => {
                          g.visoTubes?.forEach((v: any) => {
                            occupiedInCan += v.straws?.filter((s: any) => s.status === 'OCCUPIED').length || 0;
                          });
                        });
                      });
                    });
                  }
                  const colorInfo = getSpaceFillColor(occupiedInCan, 220);

                  return (
                    <button
                      key={code}
                      onClick={() => {
                        setSelectedCanCode(code);
                        setSelectedTube(null);
                      }}
                      className="group relative focus:outline-none transition-transform hover:scale-105"
                    >
                      <svg width="95" height="105" viewBox="0 0 100 115" className="filter drop-shadow-sm">
                        <polygon
                          points="50,2 95,28 95,87 50,113 5,87 5,28"
                          className={`transition-all duration-300 ${
                            isSelected
                              ? 'stroke-emerald-600 stroke-[4.5] fill-emerald-200/70'
                              : `${colorInfo.fill} ${colorInfo.stroke} stroke-[2.5]`
                          }`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none">
                        <span className="font-mono text-xs font-black text-slate-900">
                          {code}
                        </span>
                        <span className={`text-[10px] font-extrabold mt-0.5 px-2 py-0.5 rounded-full border shadow-2xs ${colorInfo.bg}`}>
                          {colorInfo.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Row 2: Cans 5, 8, 10, 14 (Staggered Offset) */}
              <div className="flex items-center justify-center gap-3 -mt-4 pl-10">
                {[5, 8, 10, 14].map((num) => {
                  const code = `CAN-${num.toString().padStart(2, '0')}`;
                  const isSelected = selectedCanCode === code;
                  
                  let occupiedInCan = 0;
                  if (currentCan && selectedCanCode === code) {
                    currentCan.canisters?.forEach((cn: any) => {
                      cn.levels?.forEach((l: any) => {
                        l.goblets?.forEach((g: any) => {
                          g.visoTubes?.forEach((v: any) => {
                            occupiedInCan += v.straws?.filter((s: any) => s.status === 'OCCUPIED').length || 0;
                          });
                        });
                      });
                    });
                  }
                  const colorInfo = getSpaceFillColor(occupiedInCan, 220);

                  return (
                    <button
                      key={code}
                      onClick={() => {
                        setSelectedCanCode(code);
                        setSelectedTube(null);
                      }}
                      className="group relative focus:outline-none transition-transform hover:scale-105"
                    >
                      <svg width="95" height="105" viewBox="0 0 100 115" className="filter drop-shadow-sm">
                        <polygon
                          points="50,2 95,28 95,87 50,113 5,87 5,28"
                          className={`transition-all duration-300 ${
                            isSelected
                              ? 'stroke-emerald-600 stroke-[4.5] fill-emerald-200/70'
                              : `${colorInfo.fill} ${colorInfo.stroke} stroke-[2.5]`
                          }`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none">
                        <span className="font-mono text-xs font-black text-slate-900">
                          {code}
                        </span>
                        <span className={`text-[10px] font-extrabold mt-0.5 px-2 py-0.5 rounded-full border shadow-2xs ${colorInfo.bg}`}>
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
                    return (
                      <button
                        key={num}
                        onClick={() => {
                          setSelectedCanisterNum(num);
                          setSelectedTube(null);
                        }}
                        className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                          isSelected
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-400 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        C{num}
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
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Goblet 01 — Viso Tubes Space Fill</span>
                  </h2>
                  <div className="text-xs text-slate-600 font-mono mt-0.5 font-semibold">
                    Chamber {selectedCanCode.replace('CAN-', '')} • Canister {selectedCanisterNum.toString().padStart(2, '0')} • Level {selectedLevelNum}
                  </div>
                </div>
                <span className="text-xs px-3 py-1 bg-slate-100 text-emerald-800 font-bold rounded-full font-mono border border-slate-200">
                  11 Viso Tubes
                </span>
              </div>

              {/* RADIAL PIZZA SLICE GOBLET (10 PIZZA WEDGE SECTORS + 1 CENTER CORE TUBE) */}
              <div className="py-6 flex flex-col items-center justify-center space-y-4">
                <div className="text-xs text-slate-600 font-bold uppercase tracking-wider">
                  Physical Circular Cone Goblet Layout (Color-Coded Boundaries):
                </div>

                <div className="relative flex items-center justify-center">
                  <svg width="370" height="370" viewBox="0 0 360 360" className="filter drop-shadow-lg">
                    {/* Outer Circular Goblet Rim */}
                    <circle cx="180" cy="180" r="168" className="fill-slate-100/90 stroke-slate-300 stroke-[4]" />
                    <circle cx="180" cy="180" r="162" className="fill-white stroke-emerald-500/20 stroke-2 stroke-dashed" />

                    {/* 10 Outer Radial Pizza Slices / Wedges (V01 to V10) */}
                    {visoTubes.slice(0, 10).map((tube: any, idx: number) => {
                      const startAngle = idx * 36 - 90 + 1.5;
                      const endAngle = (idx + 1) * 36 - 90 - 1.5;
                      const midAngleRad = (((startAngle + endAngle) / 2) * Math.PI) / 180;

                      // SVG Pizza Slice Path (Outer Radius 156, Inner Radius 48)
                      const pathData = (() => {
                        const rad1 = (startAngle * Math.PI) / 180;
                        const rad2 = (endAngle * Math.PI) / 180;
                        const xo1 = 180 + 156 * Math.cos(rad1);
                        const yo1 = 180 + 156 * Math.sin(rad1);
                        const xo2 = 180 + 156 * Math.cos(rad2);
                        const yo2 = 180 + 156 * Math.sin(rad2);
                        const xi2 = 180 + 48 * Math.cos(rad2);
                        const yi2 = 180 + 48 * Math.sin(rad2);
                        const xi1 = 180 + 48 * Math.cos(rad1);
                        const yi1 = 180 + 48 * Math.sin(rad1);
                        return `M ${xo1} ${yo1} A 156 156 0 0 1 ${xo2} ${yo2} L ${xi2} ${yi2} A 48 48 0 0 0 ${xi1} ${yi1} Z`;
                      })();

                      // Text label position at mid-radius 102
                      const tx = 180 + 102 * Math.cos(midAngleRad);
                      const ty = 180 + 102 * Math.sin(midAngleRad);

                      const occupiedCount = tube.straws?.filter((s: any) => s.status === 'OCCUPIED').length || 0;
                      const colorInfo = getSpaceFillColor(occupiedCount, 10);
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
                                ? 'stroke-emerald-600 stroke-[4.5] fill-emerald-200/90 shadow-md'
                                : `${colorInfo.fill} ${colorInfo.stroke} stroke-[2.5] hover:scale-[1.02]`
                            }`}
                          />
                          <text
                            x={tx}
                            y={ty - 4}
                            textAnchor="middle"
                            className="font-mono text-xs font-black fill-slate-900 pointer-events-none select-none"
                          >
                            V{tube.tubeNumber.toString().padStart(2, '0')}
                          </text>
                          <text
                            x={tx}
                            y={ty + 10}
                            textAnchor="middle"
                            className="font-mono text-[9px] font-extrabold fill-slate-700 pointer-events-none select-none"
                          >
                            {occupiedCount}/10
                          </text>
                        </g>
                      );
                    })}

                    {/* Center Core Viso Tube (V11) */}
                    {visoTubes.slice(10, 11).map((tube: any) => {
                      const occupiedCount = tube.straws?.filter((s: any) => s.status === 'OCCUPIED').length || 0;
                      const colorInfo = getSpaceFillColor(occupiedCount, 10);
                      const isSelected = selectedTube?.id === tube.id;

                      return (
                        <g
                          key={tube.id}
                          onClick={() => setSelectedTube(tube)}
                          className="cursor-pointer group"
                        >
                          <circle
                            cx="180"
                            cy="180"
                            r="42"
                            className={`transition-all duration-300 ${
                              isSelected
                                ? 'stroke-emerald-600 stroke-[4.5] fill-emerald-200/90 shadow-md'
                                : `${colorInfo.fill} ${colorInfo.stroke} stroke-[2.5] hover:scale-105`
                            }`}
                          />
                          <text
                            x="180"
                            y="175"
                            textAnchor="middle"
                            className="font-mono text-xs font-black fill-slate-900 pointer-events-none select-none"
                          >
                            V11 (Core)
                          </text>
                          <text
                            x="180"
                            y="190"
                            textAnchor="middle"
                            className="font-mono text-[9px] font-extrabold fill-slate-700 pointer-events-none select-none"
                          >
                            {occupiedCount}/10
                          </text>
                        </g>
                      );
                    })}
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
                        Chamber {canNum}
                      </span>
                    </div>

                    {/* Canister Mini Capacity Bars */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">10 Canisters Capacity:</div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {Array.from({ length: 10 }).map((_, idx) => {
                          const cn = idx + 1;
                          return (
                            <div
                              key={cn}
                              className="bg-slate-100 p-2 rounded-xl border border-slate-200 text-center space-y-1 hover:bg-emerald-100 transition-colors"
                            >
                              <div className="text-[10px] font-mono font-bold text-slate-800">C{cn}</div>
                              <div className="w-full bg-emerald-500 h-1.5 rounded-full" />
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

      {/* Selected Tube Inspection Modal */}
      {selectedTube && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs font-mono font-bold text-emerald-700">{selectedTube.locationCode}</div>
                <div className="text-sm font-bold text-slate-900">Viso Tube #{selectedTube.tubeNumber} Contents Inspector</div>
              </div>
              <button
                onClick={() => setSelectedTube(null)}
                className="text-xs text-slate-600 font-bold hover:text-slate-900 px-3 py-1.5 bg-slate-100 rounded-xl"
              >
                Close
              </button>
            </div>

            {selectedTube.straws?.length === 0 ? (
              <div className="text-xs text-emerald-800 py-3 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>This Viso Tube is 100% EMPTY (All 10 straw slots available for allocation).</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Stored Straws:</div>
                {selectedTube.straws?.map((straw: any) => (
                  <div key={straw.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2 font-mono font-bold text-emerald-800">
                        <span>Straw ID: {straw.strawId}</span>
                        <span className="px-2 py-0.5 bg-white text-slate-800 rounded text-[10px] font-bold border border-slate-200">
                          Color: {straw.color}
                        </span>
                      </div>
                      <div className="text-slate-700 font-medium mt-1">
                        Patient: <strong className="text-slate-900 font-bold">{straw.batch?.patient?.fullName || 'N/A'}</strong> (ID: {straw.batch?.patient?.patientId})
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${straw.status === 'OCCUPIED' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      {straw.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
