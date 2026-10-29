import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Flame, 
  ArrowRight, 
  Activity, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  CheckCircle2, 
  X 
} from 'lucide-react';
import { NiftyMarketData } from '../types';
import { fetchNiftyMarketData, isMarketDataStale } from '../services/marketService';

interface MarketOpportunityBannerProps {
  onNavigateToMarket: () => void;
}

export const MarketOpportunityBanner: React.FC<MarketOpportunityBannerProps> = ({ onNavigateToMarket }) => {
  const [marketData, setMarketData] = useState<NiftyMarketData | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    fetchNiftyMarketData().then(data => {
      if (data) setMarketData(data);
    }).catch(() => {});
  }, []);

  if (!marketData || isDismissed || isMarketDataStale(marketData)) return null;

  const isDrawdownActive = (marketData.percentDropFromPeak || 0) <= -15.0;
  const isPeActive = (marketData.currentPe || 0) > 0 && (marketData.currentPe || 0) < 20.0;
  const isApproaching = (marketData.percentDropFromPeak || 0) <= -10.0 || ((marketData.currentPe || 0) > 0 && (marketData.currentPe || 0) <= 21.5);

  const pointDrop = Math.abs(marketData.pointDropFromPeak || 0);
  const percentDrop = Math.abs(marketData.percentDropFromPeak || 0);
  const closePrice = marketData.currentClose || 0;
  const peakPrice = marketData.allTimePeak || 26216.05;
  const currentPe = marketData.currentPe || 0;

  // 1. High-Priority Alert: Triggered when Drawdown >= 15% OR PE < 20
  if (isDrawdownActive || isPeActive) {
    return (
      <div className="rounded-2xl border bg-rose-950/30 border-rose-500/50 p-4 sm:p-5 shadow-lg shadow-rose-950/20 text-neutral-100 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wide">
                <span>Tactical Market Opportunity Alert</span>
                <span aria-hidden="true">·</span>
                <span>Active Buy Trigger</span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">
                {isDrawdownActive && isPeActive 
                  ? 'Double Opportunity: Nifty Drawdown &ge; 15% and P/E (TTM) &lt; 20 Triggered'
                  : isDrawdownActive
                  ? `Nifty 50 has closed ${percentDrop.toFixed(2)}% below its all-time peak`
                  : `Nifty P/E Ratio (TTM) has closed at ${currentPe.toFixed(2)} (< 20.0 Deep Value)`}
              </h3>
              <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                Nifty 50 closed at <strong className="text-white font-mono">₹{closePrice.toLocaleString('en-IN')}</strong> ({pointDrop.toLocaleString('en-IN')} pt drop from peak of ₹{peakPrice.toLocaleString('en-IN')}). Nifty P/E (TTM) is at <strong className="text-white font-mono">{currentPe.toFixed(2)}x</strong>. Historic risk-reward heavily favors deploying fresh capital.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              onClick={onNavigateToMarket}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-500 hover:bg-rose-400 text-white shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>View Deployment Plan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Monitoring / Approaching Bar (Quiet, informative, non-intrusive)
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/90 p-3 sm:px-4 text-xs text-neutral-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-2.5">
        <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-neutral-200">Market Radar:</span>
          <span>Nifty 50 at <strong className="text-white font-mono">₹{closePrice.toLocaleString('en-IN')}</strong></span>
          <span className="text-neutral-500">·</span>
          <span>Drawdown: <strong className="text-amber-400 font-mono">-{percentDrop.toFixed(2)}%</strong> (15% buy trigger at ₹{marketData.triggerLevel15Percent.toLocaleString('en-IN')})</span>
          <span className="text-neutral-500">·</span>
          <span>P/E (TTM): <strong className="text-cyan-300 font-mono">{currentPe.toFixed(2)}x</strong> (Value trigger: &lt; 20.00)</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <button
          onClick={onNavigateToMarket}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
        >
          <span>Market Analysis &amp; Alerts</span>
          <ArrowRight className="w-3 h-3" />
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="text-neutral-500 hover:text-neutral-300 p-1"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
