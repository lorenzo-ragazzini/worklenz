import React from 'react';
import { Select } from '@/shared/antd-imports';

type TimeFilterProps = {
  view: 'day' | 'week' | 'month';
  onViewChange: (view: 'day' | 'week' | 'month') => void;
};

export const TimeFilter = ({ view, onViewChange }: TimeFilterProps) => {
  const timeFilterItems = [
    {
      value: 'day',
      label: 'Day',
    },
    {
      value: 'week',
      label: 'Week',
    },
    {
      value: 'month',
      label: 'Month',
    },
  ];

  return (
    <Select
      value={view}
      onChange={onViewChange}
      style={{ width: 120 }}
      options={timeFilterItems}
    />
  );
};
