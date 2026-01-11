import { create } from 'zustand';
import type { AnalyzeResult, AnalyzeStatus, ChecklistItem } from '@/lib/types/intermediate';

interface AnalyzeState {
  // 入力URL
  url: string;
  setUrl: (url: string) => void;

  // 解析状態
  status: AnalyzeStatus;
  setStatus: (status: AnalyzeStatus) => void;

  // 解析結果
  result: AnalyzeResult | null;
  setResult: (result: AnalyzeResult | null) => void;

  // エラーメッセージ
  error: string | null;
  setError: (error: string | null) => void;

  // チェックリスト状態
  checkedItems: Record<string, boolean>;
  toggleCheckedItem: (id: string) => void;
  resetCheckedItems: (items: ChecklistItem[]) => void;

  // 解析実行
  analyze: (url: string) => Promise<void>;

  // リセット
  reset: () => void;
}

const initialState = {
  url: '',
  status: 'idle' as AnalyzeStatus,
  result: null,
  error: null,
  checkedItems: {},
};

export const useAnalyzeStore = create<AnalyzeState>((set, get) => ({
  ...initialState,

  setUrl: (url) => set({ url }),
  setStatus: (status) => set({ status }),
  setResult: (result) => set({ result }),
  setError: (error) => set({ error }),

  toggleCheckedItem: (id) =>
    set((state) => ({
      checkedItems: {
        ...state.checkedItems,
        [id]: !state.checkedItems[id],
      },
    })),

  resetCheckedItems: (items) =>
    set({
      checkedItems: items.reduce(
        (acc, item) => {
          acc[item.id] = item.completed;
          return acc;
        },
        {} as Record<string, boolean>
      ),
    }),

  analyze: async (url) => {
    const { setStatus, setResult, setError, resetCheckedItems } = get();

    setStatus('loading');
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '解析に失敗しました');
      }

      const data: AnalyzeResult = await response.json();

      if (data.status === 'error') {
        throw new Error(data.error || '解析に失敗しました');
      }

      setResult(data);
      resetCheckedItems(data.checklist);
      setStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '予期しないエラーが発生しました';
      setError(message);
      setStatus('error');
    }
  },

  reset: () => set(initialState),
}));
