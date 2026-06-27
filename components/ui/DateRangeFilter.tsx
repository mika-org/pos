"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, Clock } from 'lucide-react';
import { format, subDays, startOfMonth } from 'date-fns';
import { useTranslation } from '@/stores/languageStore';

export type DatePreset = 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'thisMonth' | 'allTime' | 'customRange';

interface DateRangeFilterProps {
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd
  selectedPreset: DatePreset;
  onChange: (startDate: string, endDate: string, preset: DatePreset) => void;
  showAllTime?: boolean;
}

export function DateRangeFilter({
  startDate,
  endDate,
  selectedPreset,
  onChange,
  showAllTime = true
}: DateRangeFilterProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const presets: { key: DatePreset; labelKey: any }[] = [
    { key: 'today', labelKey: 'today' },
    { key: 'yesterday', labelKey: 'yesterday' },
    { key: 'last7Days', labelKey: 'last7Days' },
    { key: 'last30Days', labelKey: 'last30Days' },
    { key: 'thisMonth', labelKey: 'thisMonth' },
    ...(showAllTime ? [{ key: 'allTime' as DatePreset, labelKey: 'allTime' }] : []),
    { key: 'customRange', labelKey: 'customRange' }
  ];

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetSelect = (preset: DatePreset) => {
    const today = new Date();
    let startStr = '';
    let endStr = '';

    const todayStr = format(today, 'yyyy-MM-dd');

    switch (preset) {
      case 'today':
        startStr = todayStr;
        endStr = todayStr;
        break;
      case 'yesterday':
        const yesterday = subDays(today, 1);
        startStr = format(yesterday, 'yyyy-MM-dd');
        endStr = format(yesterday, 'yyyy-MM-dd');
        break;
      case 'last7Days':
        startStr = format(subDays(today, 6), 'yyyy-MM-dd');
        endStr = todayStr;
        break;
      case 'last30Days':
        startStr = format(subDays(today, 29), 'yyyy-MM-dd');
        endStr = todayStr;
        break;
      case 'thisMonth':
        startStr = format(startOfMonth(today), 'yyyy-MM-dd');
        endStr = todayStr;
        break;
      case 'allTime':
        startStr = '';
        endStr = '';
        break;
      case 'customRange':
        // Keep current dates, just switch to custom
        startStr = startDate || todayStr;
        endStr = endDate || todayStr;
        break;
    }

    onChange(startStr, endStr, preset);
    if (preset !== 'customRange') {
      setIsOpen(false);
    }
  };

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      onChange(value, endDate, 'customRange');
    } else {
      onChange(startDate, value, 'customRange');
    }
  };

  const getPresetLabel = (key: DatePreset) => {
    const matched = presets.find(p => p.key === key);
    return matched ? t(matched.labelKey) : t('filterDate');
  };

  const displayRangeString = () => {
    if (selectedPreset === 'allTime') {
      return t('allTime');
    }
    if (!startDate && !endDate) {
      return t('allTime');
    }
    
    // Parse to ensure dates are valid
    try {
      const startFormatted = startDate 
        ? format(new Date(startDate), 'dd MMM yyyy') 
        : '...';
      const endFormatted = endDate 
        ? format(new Date(endDate), 'dd MMM yyyy') 
        : '...';

      if (startDate === endDate && startDate) {
        return startFormatted;
      }

      return `${startFormatted} - ${endFormatted}`;
    } catch (e) {
      return '';
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      {/* Dropdown Menu Container */}
      <div className="relative font-sans">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl shadow-sm text-sm font-bold text-slate-700 hover:text-slate-800 transition-all flex items-center justify-between gap-2.5 cursor-pointer active:scale-98 select-none"
        >
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-blue-500" />
            <span className="min-w-[100px] text-left">{getPresetLabel(selectedPreset)}</span>
          </div>
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
            {presets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => handlePresetSelect(preset.key)}
                className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                  selectedPreset === preset.key
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <span>{t(preset.labelKey)}</span>
                {selectedPreset === preset.key && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date Range Output Info & Custom Manual Date Inputs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
        {selectedPreset === 'customRange' ? (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 p-1.5 rounded-xl shadow-inner w-full sm:w-auto">
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleCustomDateChange('start', e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent border-0 focus:ring-0 p-1 focus:outline-none cursor-pointer"
              title={t('startDate')}
            />
            <span className="text-slate-400 font-bold">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleCustomDateChange('end', e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent border-0 focus:ring-0 p-1 focus:outline-none cursor-pointer"
              title={t('endDate')}
              min={startDate}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 shadow-inner w-full sm:w-auto select-all">
            <Clock size={13} className="text-slate-400 shrink-0" />
            <span>{displayRangeString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
