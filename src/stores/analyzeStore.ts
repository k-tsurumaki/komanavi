import { create } from 'zustand';
import type { AnalyzeResult, AnalyzeStatus, ChatMessage } from '@/lib/types/intermediate';
import { saveHistoryFromResult } from '@/lib/history-api';
import { ANALYZE_ERROR_MESSAGE } from '@/lib/error-messages';

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

  // 解析実行
  analyze: (url: string, userIntent?: string) => Promise<void>;

  // 直近の履歴ID
  lastHistoryId: string | null;
  setLastHistoryId: (historyId: string | null) => void;
  activeAnalyzeRequestId: string | null;

  // 深掘りチャット
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;

  // 意図入力
  intent: string;
  setIntent: (intent: string) => void;

  // 深掘り要約
  deepDiveSummary: string;
  setDeepDiveSummary: (summary: string) => void;
  resetDeepDiveState: () => void;

  // リセット
  reset: () => void;
}

const initialState = {
  url: '',
  status: 'idle' as AnalyzeStatus,
  result: null,
  error: null,
  lastHistoryId: null,
  activeAnalyzeRequestId: null,
  messages: [] as ChatMessage[],
  intent: '',
  deepDiveSummary: '',
};

export const useAnalyzeStore = create<AnalyzeState>((set, get) => ({
  ...initialState,

  setUrl: (url) => set({ url }),
  setStatus: (status) => set({ status }),
  setResult: (result) => set({ result }),
  setError: (error) => set({ error }),
  setLastHistoryId: (historyId) => set({ lastHistoryId: historyId }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setIntent: (intent) => set({ intent }),
  setDeepDiveSummary: (summary) => set({ deepDiveSummary: summary }),
  resetDeepDiveState: () =>
    set({
      messages: [],
      intent: '',
      deepDiveSummary: '',
    }),

  analyze: async (url, userIntent) => {
    const { setUrl, setStatus, setResult, setError, setLastHistoryId } = get();
    const requestId = crypto.randomUUID();

    setUrl(url);
    setStatus('loading');
    setError(null);
    setLastHistoryId(null);
    set({ activeAnalyzeRequestId: requestId });

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, userIntent }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || ANALYZE_ERROR_MESSAGE);
      }

      const data: AnalyzeResult = await response.json();

      if (data.status === 'error') {
        throw new Error(data.error || ANALYZE_ERROR_MESSAGE);
      }

      if (get().activeAnalyzeRequestId !== requestId) {
        return;
      }

      setResult(data);
      set({
        messages: [],
        intent: '',
        deepDiveSummary: '',
      });
      setStatus('success');

      void (async () => {
        try {
          const saved = await saveHistoryFromResult({
            url,
            title: data.intermediate?.title || url,
            result: data,
          });
          const currentState = get();
          if (currentState.activeAnalyzeRequestId !== requestId || currentState.result?.id !== data.id) {
            return;
          }
          setLastHistoryId(saved.historyId);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('history:updated'));
            const current = new URL(window.location.href);
            const currentHistoryId = current.searchParams.get('historyId');
            const currentUrl = current.searchParams.get('url');
            if (current.pathname === '/result' && !currentHistoryId) {
              if (currentUrl && currentUrl !== url) {
                return;
              }
              current.searchParams.set('historyId', saved.historyId);
              window.history.replaceState(window.history.state, '', `${current.pathname}?${current.searchParams.toString()}`);
            }
          }
        } catch (saveError) {
          if (get().activeAnalyzeRequestId !== requestId) {
            return;
          }
          console.warn('履歴の保存に失敗しました', saveError);
        }
      })();
    } catch (err) {
      if (get().activeAnalyzeRequestId !== requestId) {
        return;
      }
      const message = err instanceof Error
        ? err.message
        : ANALYZE_ERROR_MESSAGE;
      setError(message);
      setStatus('error');
    }
  },

  reset: () => set(initialState),
}));
