'use client';

import { Fragment } from 'react';
import type { FlowStageModel, FlowStepId, FlowStepStatus, FlowStepView } from '@/lib/flow-stage';

interface FlowStageIndicatorProps {
  model: FlowStageModel;
  onStepSelect?: (stepId: FlowStepId) => void;
  className?: string;
}

const FLOW_STEP_DISPLAY_ORDER: FlowStepId[] = [
  'analyze_url',
  'review_summary',
  'deep_dive',
  'input_intent',
  'generate_answer',
  'review_checklist',
  'manga_review',
];

function getStatusLabel(status: FlowStepStatus): string | null {
  if (status === 'completed') return null;
  if (status === 'in_progress') return null;
  if (status === 'error') return '要対応';
  if (status === 'skipped') return 'スキップ';
  return null;
}

function getStatusTone(status: FlowStepStatus): {
  card: string;
  marker: string;
  status: string;
  connector: string;
} {
  if (status === 'completed') {
    return {
      card: 'border-stone-300 bg-white text-slate-800',
      marker: 'border-stone-500 bg-stone-500 text-white',
      status: 'border-stone-300 bg-stone-100 text-stone-700',
      connector: 'bg-stone-300',
    };
  }

  if (status === 'in_progress') {
    return {
      card: 'border-stone-400 bg-stone-50 text-slate-900',
      marker: 'border-stone-500 bg-stone-500 text-white',
      status: 'border-stone-400 bg-white text-stone-800',
      connector: 'bg-stone-300',
    };
  }

  if (status === 'error') {
    return {
      card: 'border-stone-400 bg-stone-100 text-slate-900',
      marker: 'border-stone-500 bg-stone-500 text-white',
      status: 'border-stone-400 bg-stone-100 text-stone-800',
      connector: 'bg-stone-300',
    };
  }

  if (status === 'skipped') {
    return {
      card: 'border-slate-300 bg-slate-100 text-slate-700',
      marker: 'border-slate-300 bg-slate-200 text-slate-700',
      status: 'border-slate-300 bg-slate-100 text-slate-700',
      connector: 'bg-slate-300',
    };
  }

  return {
    card: 'border-slate-200 bg-slate-50 text-slate-700',
    marker: 'border-slate-300 bg-white text-slate-600',
    status: 'border-slate-300 bg-slate-100 text-slate-700',
    connector: 'bg-slate-200',
  };
}

function getConnectorTone(status: FlowStepStatus): string {
  return getStatusTone(status).connector;
}

function StepButton({
  step,
  isCurrent,
  onStepSelect,
  index,
  compact = false,
}: {
  step: FlowStepView;
  isCurrent: boolean;
  onStepSelect?: (stepId: FlowStepId) => void;
  index: number;
  compact?: boolean;
}) {
  const canNavigate = Boolean(onStepSelect && step.available !== false);
  const statusTone = getStatusTone(step.status);
  const statusLabel = getStatusLabel(step.status);
  const markerLabel = step.status === 'completed' ? '✓' : index + 1;
  const labelTone = step.status === 'completed'
    ? 'text-slate-900'
    : step.status === 'error'
      ? 'text-stone-800'
      : isCurrent
        ? 'text-slate-700'
        : 'text-slate-500';
  const helperTone = step.status === 'completed' ? 'text-slate-500' : 'text-slate-400';

  return (
    <button
      type="button"
      onClick={() => {
        if (canNavigate && onStepSelect) {
          onStepSelect(step.id);
        }
      }}
      aria-disabled={!canNavigate}
      tabIndex={canNavigate ? 0 : -1}
      aria-current={isCurrent ? 'step' : undefined}
      className={`relative w-full rounded-xl border text-left transition ${
        statusTone.card
      } ${
        isCurrent ? 'border-stone-500 shadow-[inset_0_0_0_1px_rgba(115,83,76,0.35)]' : ''
      } ${
        canNavigate ? 'hover:border-stone-400 hover:bg-white' : ''
      } ${
        compact ? 'px-2 py-2' : 'px-3 py-2.5'
      } ${
        canNavigate ? '' : 'cursor-default'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={`flex min-w-0 items-center ${compact ? 'gap-1.5' : 'gap-2.5'}`}>
          <span
            className={`inline-flex shrink-0 items-center justify-center rounded-full border font-semibold ${statusTone.marker} ${
              compact ? 'h-4 w-4 text-[9px]' : 'h-5 w-5 text-[10px]'
            }`}
            aria-hidden="true"
          >
            {markerLabel}
          </span>
          <p className={`font-semibold leading-tight ${labelTone} ${compact ? 'text-[11px]' : 'text-sm'}`}>
            {step.label}
          </p>
        </div>
        {statusLabel && (
          <span
            className={`inline-flex rounded-full border font-medium ${statusTone.status} ${
              compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
            }`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      <div className={`${compact ? 'mt-1' : 'mt-1.5'}`}>
        {!compact && step.helperText && (
          <span className={`truncate text-[11px] ${helperTone}`}>{step.helperText}</span>
        )}
      </div>
    </button>
  );
}

export function FlowStageIndicator({
  model,
  onStepSelect,
  className,
}: FlowStageIndicatorProps) {
  const stepMap = new Map<FlowStepId, FlowStepView>(
    [...model.requiredSteps, ...model.optionalSteps].map((step) => [step.id, step] as const)
  );
  const mergedSteps = FLOW_STEP_DISPLAY_ORDER.flatMap((stepId) => {
    const step = stepMap.get(stepId);
    return step ? [step] : [];
  });
  const mergedCompletedCount = mergedSteps.filter((step) => step.status === 'completed').length;
  const mergedTotalCount = mergedSteps.length;
  const completedPercentage = mergedTotalCount > 0
    ? Math.round((mergedCompletedCount / mergedTotalCount) * 100)
    : 0;
  const optionalInProgress = model.optionalSteps.filter((step) => step.status === 'in_progress');

  return (
    <section className={`ui-card rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${className ?? ''}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div role="status" aria-live="polite" className="max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-600">ステップナビ</p>
          <p className="mt-1.5 text-sm font-semibold leading-relaxed text-slate-900 sm:text-[15px]">
            {model.statusText}
          </p>
          {optionalInProgress.length > 0 && (
            <p className="mt-1.5 text-xs text-slate-600">
              任意タスク: {optionalInProgress.map((step) => step.label).join(' / ')}
            </p>
          )}
        </div>

        <div className="w-full max-w-xs">
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-stone-600 transition-[width] duration-300"
                style={{ width: `${completedPercentage}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-600 tabular-nums">
              {mergedCompletedCount}/{mergedTotalCount}
            </span>
          </div>
        </div>
      </div>

      <ol className="mt-4 hidden items-start gap-1.5 lg:flex" aria-label="進行ステップ">
        {mergedSteps.map((step, index) => (
          <Fragment key={step.id}>
            <li className="min-w-0 flex-1">
              <StepButton
                step={step}
                isCurrent={step.id === model.currentStepId}
                onStepSelect={onStepSelect}
                index={index}
                compact
              />
            </li>
            {index < mergedSteps.length - 1 && (
              <li
                aria-hidden="true"
                className={`mt-6 h-px w-3 shrink-0 rounded-full ${getConnectorTone(step.status)}`}
              />
            )}
          </Fragment>
        ))}
      </ol>

      <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:hidden" aria-label="進行ステップ">
        {mergedSteps.map((step, index) => (
          <li key={step.id}>
            <StepButton
              step={step}
              isCurrent={step.id === model.currentStepId}
              onStepSelect={onStepSelect}
              index={index}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
