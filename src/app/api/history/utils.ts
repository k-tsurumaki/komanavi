import { auth } from '@/lib/auth';

export function toIsoString(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const dateValue = (value as { toDate: () => Date }).toDate();
    return dateValue.toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}

export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export function compact<T extends Record<string, unknown>>(data: T): T {
  const next = { ...data } as Record<string, unknown>;
  Object.keys(next).forEach((key) => {
    if (next[key] === undefined) {
      delete next[key];
    }
  });
  return next as T;
}
