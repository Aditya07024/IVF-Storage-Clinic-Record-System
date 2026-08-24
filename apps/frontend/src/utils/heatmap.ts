export interface HeatmapColorStep {
  pctLabel: string;
  name: string;
  hex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  strokeClass: string;
}

/**
 * 8-Step Extended Heatmap Scale:
 * • 0% (Empty): White (#FFFFFF)
 * • 15% (Very Low): Pale Yellow (#FFF9C4)
 * • 30% (Low): Soft Yellow-Gold (#FFF176)
 * • 45% (Below Mid): Pale Orange (#FFE082)
 * • 60% (Above Mid): Light Orange (#FFB74D)
 * • 75% (High): Vibrant Orange (#FF9800)
 * • 90% (Very High): Red-Orange (#FF5722)
 * • 100% (Full): Deep Red (#D32F2F)
 */
export const HEATMAP_8_STEPS: HeatmapColorStep[] = [
  { pctLabel: '0%', name: 'Empty', hex: '#FFFFFF', bgClass: 'bg-white text-slate-800 border-slate-300 font-mono font-bold', textClass: 'text-slate-800', borderClass: 'border-slate-300', strokeClass: 'stroke-slate-400' },
  { pctLabel: '15%', name: 'Very Low', hex: '#FFF9C4', bgClass: 'bg-[#FFF9C4] text-slate-900 border-yellow-400 font-mono font-bold', textClass: 'text-slate-900', borderClass: 'border-yellow-400', strokeClass: 'stroke-yellow-500' },
  { pctLabel: '30%', name: 'Low', hex: '#FFF176', bgClass: 'bg-[#FFF176] text-amber-950 border-amber-400 font-mono font-bold', textClass: 'text-amber-950', borderClass: 'border-amber-400', strokeClass: 'stroke-amber-500' },
  { pctLabel: '45%', name: 'Below Mid', hex: '#FFE082', bgClass: 'bg-[#FFE082] text-amber-950 border-amber-500 font-mono font-bold', textClass: 'text-amber-950', borderClass: 'border-amber-500', strokeClass: 'stroke-amber-600' },
  { pctLabel: '60%', name: 'Above Mid', hex: '#FFB74D', bgClass: 'bg-[#FFB74D] text-slate-950 border-orange-500 font-mono font-bold', textClass: 'text-slate-950', borderClass: 'border-orange-500', strokeClass: 'stroke-orange-600' },
  { pctLabel: '75%', name: 'High', hex: '#FF9800', bgClass: 'bg-[#FF9800] text-white border-orange-700 font-mono font-bold', textClass: 'text-white', borderClass: 'border-orange-700', strokeClass: 'stroke-orange-700' },
  { pctLabel: '90%', name: 'Very High', hex: '#FF5722', bgClass: 'bg-[#FF5722] text-white border-orange-800 font-mono font-bold', textClass: 'text-white', borderClass: 'border-orange-800', strokeClass: 'stroke-orange-800' },
  { pctLabel: '100%', name: 'Full', hex: '#D32F2F', bgClass: 'bg-[#D32F2F] text-white border-red-900 font-mono font-bold', textClass: 'text-white', borderClass: 'border-red-900', strokeClass: 'stroke-red-900' },
];

export function get8StepHeatmapColor(percentage: number): HeatmapColorStep {
  if (percentage <= 0) return HEATMAP_8_STEPS[0];
  if (percentage <= 15) return HEATMAP_8_STEPS[1];
  if (percentage <= 30) return HEATMAP_8_STEPS[2];
  if (percentage <= 45) return HEATMAP_8_STEPS[3];
  if (percentage <= 60) return HEATMAP_8_STEPS[4];
  if (percentage <= 75) return HEATMAP_8_STEPS[5];
  if (percentage <= 90) return HEATMAP_8_STEPS[6];
  return HEATMAP_8_STEPS[7];
}
