import type { AnalyzeStatus } from '@/lib/types/intermediate';

export type FlowStepStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped' | 'error';

export type FlowStepId =
  | 'analyze_url'
  | 'review_summary'
  | 'input_intent'
  | 'generate_answer'
  | 'review_checklist'
  | 'deep_dive'
  | 'manga_review';

export interface MangaFlowState {
  status: FlowStepStatus;
  progress?: number;
  errorCode?: string;
  updatedAt: number;
}

export interface FlowStageContext {
  analyzeStatus: AnalyzeStatus;
  isHistoryResolving: boolean;
  hasIntermediate: boolean;
  hasIntentInput: boolean;
  hasIntentStepVisited?: boolean;
  hasIntentGenerationError: boolean;
  isIntentGenerating: boolean;
  guidanceUnlocked: boolean;
  hasChecklistAvailable: boolean;
  hasChecklistReviewed: boolean;
  hasDeepDiveMessages: boolean;
  canStartAnalyzeFromUrl?: boolean;
  manga?: MangaFlowState;
}

export interface FlowStepView {
  id: FlowStepId;
  label: string;
  status: FlowStepStatus;
  lane: 'required' | 'optional';
  optional?: boolean;
  available?: boolean;
  helperText?: string;
}

export interface FlowNextAction {
  stepId: FlowStepId;
  label: string;
}

export interface FlowStageModel {
  statusText: string;
  currentStepId: FlowStepId;
  currentStepLabel: string;
  requiredSteps: FlowStepView[];
  optionalSteps: FlowStepView[];
  nextAction?: FlowNextAction;
}

const REQUIRED_STEPS: Array<Pick<FlowStepView, 'id' | 'label'>> = [
  { id: 'analyze_url', label: 'URLを解析' },
  { id: 'review_summary', label: '要点を確認' },
  { id: 'input_intent', label: '意図を入力' },
  { id: 'generate_answer', label: 'あなた向け回答を作成' },
  { id: 'review_checklist', label: 'チェックリストを確認' },
  { id: 'manga_review', label: '漫画で確認' },
];

const OPTIONAL_STEPS: Array<Pick<FlowStepView, 'id' | 'label'>> = [
  { id: 'deep_dive', label: '深掘りする（任意）' },
];

function createRequiredStep(id: FlowStepId, label: string): FlowStepView {
  return {
    id,
    label,
    status: 'not_started',
    lane: 'required',
    optional: false,
    available: true,
  };
}

function createOptionalStep(id: FlowStepId, label: string): FlowStepView {
  return {
    id,
    label,
    status: 'not_started',
    lane: 'optional',
    optional: true,
    available: true,
  };
}

function normalizeMangaState(
  manga: MangaFlowState | undefined,
  available: boolean
): Pick<FlowStepView, 'status' | 'available' | 'helperText'> {
  if (!available) {
    return {
      status: 'not_started',
      available: false,
      helperText: '回答生成後に利用できます',
    };
  }

  if (!manga) {
    return {
      status: 'not_started',
      available: true,
    };
  }

  if (manga.status === 'in_progress' && typeof manga.progress === 'number') {
    return {
      status: 'in_progress',
      available: true,
      helperText: `生成中 ${Math.max(0, Math.min(100, manga.progress))}%`,
    };
  }

  if (manga.status === 'error') {
    return {
      status: 'error',
      available: true,
      helperText: '生成に失敗しました',
    };
  }

  if (manga.status === 'completed') {
    return {
      status: 'completed',
      available: true,
      helperText: '生成結果を確認できます',
    };
  }

  if (manga.status === 'skipped') {
    return {
      status: 'skipped',
      available: true,
      helperText: '後で再開できます',
    };
  }

  return {
    status: 'not_started',
    available: true,
  };
}

function findStepById(steps: FlowStepView[], stepId: FlowStepId): FlowStepView {
  const found = steps.find((step) => step.id === stepId);
  if (!found) {
    throw new Error(`Unknown step id: ${stepId}`);
  }
  return found;
}

export function deriveFlowStageModel(context: FlowStageContext): FlowStageModel {
  const requiredSteps = REQUIRED_STEPS.map((step) => createRequiredStep(step.id, step.label));
  const optionalSteps = OPTIONAL_STEPS.map((step) => createOptionalStep(step.id, step.label));

  const analyzeStep = findStepById(requiredSteps, 'analyze_url');
  const reviewStep = findStepById(requiredSteps, 'review_summary');
  const intentStep = findStepById(requiredSteps, 'input_intent');
  const answerStep = findStepById(requiredSteps, 'generate_answer');
  const checklistStep = findStepById(requiredSteps, 'review_checklist');
  const mangaStep = findStepById(requiredSteps, 'manga_review');
  const deepDiveStep = findStepById(optionalSteps, 'deep_dive');

  if (!context.hasIntermediate) {
    deepDiveStep.status = 'not_started';
    deepDiveStep.available = false;
    deepDiveStep.helperText = '要点表示後に利用できます';
  } else {
    // 要件: 意図入力ステップ以上へ進んだら「深掘りする（任意）」は完了扱いにする
    deepDiveStep.status = 'completed';
    deepDiveStep.available = true;
    deepDiveStep.helperText = context.hasDeepDiveMessages
      ? '深掘りの履歴があります'
      : '意図入力へ進んだため完了扱い';
  }

  const normalizedManga = normalizeMangaState(
    context.manga,
    Boolean(context.guidanceUnlocked && context.hasIntermediate)
  );
  mangaStep.status = normalizedManga.status;
  mangaStep.available = normalizedManga.available;
  mangaStep.helperText = normalizedManga.helperText;
  const isIntentStepCompleted = Boolean(context.hasIntentInput || context.hasIntentStepVisited);

  let currentStepId: FlowStepId = 'analyze_url';
  let statusText = 'URLを入力して解析を開始できます';
  let nextAction: FlowNextAction | undefined = {
    stepId: 'analyze_url',
    label: context.canStartAnalyzeFromUrl ? 'このURLを解析する' : 'URLを入力する',
  };

  if (context.isHistoryResolving) {
    analyzeStep.status = 'in_progress';
    currentStepId = 'analyze_url';
    statusText = '履歴を復元しています';
    nextAction = undefined;
  } else if (context.analyzeStatus === 'loading') {
    analyzeStep.status = 'in_progress';
    currentStepId = 'analyze_url';
    statusText = 'ページを解析しています';
    nextAction = undefined;
  } else if (context.analyzeStatus === 'error') {
    analyzeStep.status = 'error';
    currentStepId = 'analyze_url';
    statusText = 'URL解析で停止しました';
    nextAction = { stepId: 'analyze_url', label: 'URLを見直して再解析' };
  } else if (!context.hasIntermediate) {
    currentStepId = 'analyze_url';
    statusText = '解析を開始する準備ができています';
    nextAction = {
      stepId: 'analyze_url',
      label: context.canStartAnalyzeFromUrl ? 'このURLを解析する' : 'URLを入力する',
    };
  } else {
    analyzeStep.status = 'completed';
    reviewStep.status = 'completed';

    if (context.isIntentGenerating) {
      intentStep.status = isIntentStepCompleted ? 'completed' : 'in_progress';
      answerStep.status = 'in_progress';
      currentStepId = 'generate_answer';
      statusText = 'あなた向け回答を作成しています';
      nextAction = undefined;
    } else if (context.hasIntentGenerationError) {
      intentStep.status = isIntentStepCompleted ? 'completed' : 'in_progress';
      answerStep.status = 'error';
      currentStepId = 'generate_answer';
      statusText = '回答生成で停止しました';
      nextAction = context.hasIntentInput
        ? { stepId: 'generate_answer', label: 'もう一度回答を生成' }
        : { stepId: 'input_intent', label: '意図を入力して再試行' };
    } else if (context.guidanceUnlocked) {
      intentStep.status = 'completed';
      answerStep.status = 'completed';
      checklistStep.status = context.hasChecklistAvailable
        ? context.hasChecklistReviewed
          ? 'completed'
          : 'in_progress'
        : 'completed';
      const checklistPending = context.hasChecklistAvailable && !context.hasChecklistReviewed;

      if (checklistPending) {
        currentStepId = 'review_checklist';
        statusText = 'チェックリストで行動に移せます';
        nextAction = { stepId: 'review_checklist', label: 'チェックリストを見る' };
      } else if (mangaStep.status === 'completed') {
        currentStepId = 'manga_review';
        statusText = '必須タスクを完了しました';
        nextAction = undefined;
      } else if (mangaStep.status === 'in_progress') {
        currentStepId = 'manga_review';
        statusText = '漫画を生成しています';
        nextAction = undefined;
      } else if (mangaStep.status === 'error') {
        currentStepId = 'manga_review';
        statusText = '漫画生成で停止しました';
        nextAction = { stepId: 'manga_review', label: '漫画生成を再試行' };
      } else {
        currentStepId = 'manga_review';
        statusText = '漫画で確認して理解を定着させましょう';
        nextAction = { stepId: 'manga_review', label: '漫画で確認する' };
      }
    } else {
      intentStep.status = isIntentStepCompleted ? 'completed' : 'in_progress';
      currentStepId = 'input_intent';
      statusText = '実現したいことを一文で入力してください';
      nextAction = { stepId: 'input_intent', label: '意図入力へ移動' };
    }
  }

  return {
    statusText,
    currentStepId,
    currentStepLabel: findStepById([...requiredSteps, ...optionalSteps], currentStepId).label,
    requiredSteps,
    optionalSteps,
    nextAction,
  };
}
