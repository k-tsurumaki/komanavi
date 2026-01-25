import { create } from 'zustand';
import type { AnalyzeResult, AnalyzeStatus, ChecklistItem } from '@/lib/types/intermediate';
import { saveHistoryFromResult } from '@/lib/history-api';

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

  // 直近の履歴ID
  lastHistoryId: string | null;
  setLastHistoryId: (historyId: string | null) => void;

  // リセット
  reset: () => void;
}

const initialState = {
  url: '',
  status: 'idle' as AnalyzeStatus,
  result: null,
  error: null,
  checkedItems: {},
  lastHistoryId: null,
};

export const useAnalyzeStore = create<AnalyzeState>((set, get) => ({
  ...initialState,

  setUrl: (url) => set({ url }),
  setStatus: (status) => set({ status }),
  setResult: (result) => set({ result }),
  setError: (error) => set({ error }),
  setLastHistoryId: (historyId) => set({ lastHistoryId: historyId }),

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
    const { setUrl, setStatus, setResult, setError, resetCheckedItems, setLastHistoryId } = get();

    setUrl(url);
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
      const saved = await saveHistoryFromResult({
        url,
        title: data.intermediate?.title || url,
        result: data,
      });
      setLastHistoryId(saved.historyId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('history:updated'));
      }
      setStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '予期しないエラーが発生しました';
      setError(message);
      setStatus('error');
    }
  },

  reset: () => set(initialState),
}));
