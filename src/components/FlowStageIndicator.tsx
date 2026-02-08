'use client';

import { Fragment } from 'react';
import type { FlowStageModel, FlowStepId, FlowStepStatus, FlowStepView } from '@/lib/flow-stage';

interface FlowStageIndicatorProps {
  model: FlowStageModel;
  onStepSelect?: (stepId: FlowStepId) => void;
  onNextAction?: (stepId: FlowStepId) => void;
  className?: string;
}

function getStatusLabel(status: FlowStepStatus): string {
  if (status === 'completed') return '完了';
  if (status === 'in_progress') return '進行中';
  if (status === 'error') return '要対応';
  if (status === 'skipped') return 'スキップ';
  return '未開始';
}

function getStatusIcon(status: FlowStepStatus): string {
  if (status === 'completed') return '✓';
  if (status === 'in_progress') return '▶';
  if (status === 'error') return '!';
  if (status === 'skipped') return '↷';
  return '•';
}

function getStatusTone(status: FlowStepStatus): string {
  if (status === 'completed') return 'border-stone-300 bg-stone-100 text-stone-800';
  if (status === 'in_progress') return 'border-slate-400 bg-white text-slate-900';
  if (status === 'error') return 'border-stone-400 bg-stone-100 text-stone-900';
  if (status === 'skipped') return 'border-slate-300 bg-slate-100 text-slate-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getConnectorTone(status: FlowStepStatus): string {
  if (status === 'completed') return 'bg-stone-300';
  if (status === 'error') return 'bg-stone-300';
  return 'bg-slate-200';
}

function StepButton({
  step,
  isCurrent,
  onStepSelect,
  minimal = false,
}: {
  step: FlowStepView;
  isCurrent: boolean;
  onStepSelect?: (stepId: FlowStepId) => void;
  minimal?: boolean;
}) {
  const canNavigate = Boolean(onStepSelect && step.available !== false);
  const statusTone = getStatusTone(step.status);
  const statusLabel = getStatusLabel(step.status);
  const icon = getStatusIcon(step.status);

  return (
    <button
      type="button"
      onClick={() => {
        if (canNavigate && onStepSelect) {
          onStepSelect(step.id);
        }
      }}
      disabled={!canNavigate}
      aria-current={isCurrent ? 'step' : undefined}
      className={`w-full rounded-xl border text-left transition ${statusTone} ${
        minimal ? 'px-2.5 py-2' : 'px-3 py-2'
      } ${
        canNavigate ? 'hover:border-slate-400 hover:bg-white' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`${minimal ? 'text-xs' : 'text-sm'} font-semibold ${isCurrent ? 'text-slate-900' : ''}`}>
            {step.label}
          </p>
          {!minimal && step.helperText && (
            <p className="mt-0.5 text-xs text-slate-600">{step.helperText}</p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold">
          <span aria-hidden="true">{icon}</span>
          {!minimal && statusLabel}
          {minimal && <span className="sr-only">{statusLabel}</span>}
        </span>
      </div>
    </button>
  );
}

export function FlowStageIndicator({
  model,
  onStepSelect,
  onNextAction,
  className,
}: FlowStageIndicatorProps) {
  const requiredCompletedCount = model.requiredSteps.filter((step) => step.status === 'completed').length;
  const requiredTotalCount = model.requiredSteps.length;
  const optionalInProgress = model.optionalSteps.filter((step) => step.status === 'in_progress');

  return (
    <section className={`ui-card rounded-2xl p-4 sm:p-5 ${className ?? ''}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div role="status" aria-live="polite">
          <p className="ui-badge">進行ガイド</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{model.statusText}</p>
          <p className="text-xs text-slate-600">現在: {model.currentStepLabel}</p>
          <p className="mt-1 text-xs font-semibold text-slate-700">
            必須ステップ {requiredCompletedCount}/{requiredTotalCount} 完了
          </p>
          {optionalInProgress.length > 0 && (
            <p className="mt-1 text-xs text-slate-600">
              進行中の任意タスク: {optionalInProgress.map((step) => step.label).join(' / ')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {model.nextAction && onNextAction && (
            <button
              type="button"
              onClick={() => onNextAction(model.nextAction!.stepId)}
              className="ui-btn ui-btn-primary px-3 py-2 text-xs !text-white"
            >
              {model.nextAction.label}
            </button>
          )}
        </div>
      </div>

      <ol className="mt-4 hidden items-start gap-2 md:flex" aria-label="必須ステップ">
        {model.requiredSteps.map((step, index) => (
          <Fragment key={step.id}>
            <li className="min-w-0 flex-1">
              <StepButton
                step={step}
                isCurrent={step.id === model.currentStepId}
                onStepSelect={onStepSelect}
                minimal
              />
            </li>
            {index < model.requiredSteps.length - 1 && (
              <li aria-hidden="true" className={`mt-6 h-px flex-1 ${getConnectorTone(step.status)}`} />
            )}
          </Fragment>
        ))}
      </ol>

      <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:hidden" aria-label="必須ステップ">
        {model.requiredSteps.map((step) => (
          <li key={step.id}>
            <StepButton
              step={step}
              isCurrent={step.id === model.currentStepId}
              onStepSelect={onStepSelect}
              minimal
            />
          </li>
        ))}
      </ol>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="text-xs font-semibold tracking-[0.12em] text-slate-500">任意のサポート</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {model.optionalSteps.map((step) => (
            <li key={step.id}>
              <StepButton step={step} isCurrent={false} onStepSelect={onStepSelect} minimal />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
