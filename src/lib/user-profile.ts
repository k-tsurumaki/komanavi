/**
 * ユーザプロフィール取得・変換ユーティリティ
 * パーソナライズ生成に使用する
 */

import { getAdminFirestore } from '@/lib/firebase-admin';
import type { PersonalizationInput, NormalizedUserProfile } from '@/lib/types/intermediate';

/** Firestore から取得した生のユーザプロフィール */
interface RawUserProfile {
  displayName?: string;
  birthDate?: Date | { toDate: () => Date };
  gender?: string;
  occupation?: string;
  nationality?: string;
  location?: string;
  visualTraits?: string;
  personality?: string;
}

/** デフォルトのユーザ意図（モック） */
// export const DEFAULT_USER_INTENT = 'この制度について知りたい';
export const DEFAULT_USER_INTENT = '自分は歯列矯正で月5万円払っている。何をすべきか知りたい。';

/**
 * Firebase Firestore からユーザプロフィールを取得
 */
export async function getUserProfileFromFirestore(
  userId: string
): Promise<RawUserProfile | null> {
  try {
    const db = getAdminFirestore();
    const docRef = db.collection('users').doc(userId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return null;
    }

    return docSnap.data() as RawUserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * 生年月日から年齢を計算
 */
function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

/**
 * 生のプロフィールを正規化された形式に変換
 */
function normalizeUserProfile(profile: RawUserProfile): NormalizedUserProfile {
  const normalized: NormalizedUserProfile = {};

  // 年齢計算
  if (profile.birthDate) {
    const birthDate =
      typeof profile.birthDate === 'object' && 'toDate' in profile.birthDate
        ? profile.birthDate.toDate()
        : profile.birthDate;
    normalized.age = calculateAge(birthDate);
  }

  // 性別
  if (profile.gender) {
    normalized.gender = profile.gender;
  }

  // 職業
  if (profile.occupation) {
    normalized.occupation = profile.occupation;
  }

  // 国籍（日本国籍かどうか）
  if (profile.nationality) {
    normalized.isJapaneseNational = profile.nationality === '日本';
  }

  // 居住地
  if (profile.location) {
    normalized.location = profile.location;
  }

  return normalized;
}

/**
 * ユーザプロフィールとユーザ意図からパーソナライズ入力を生成
 */
export function toPersonalizationInput(
  profile: RawUserProfile | null,
  userIntent?: string
): PersonalizationInput {
  return {
    userIntent: userIntent || DEFAULT_USER_INTENT,
    userProfile: profile ? normalizeUserProfile(profile) : undefined,
  };
}

/**
 * パーソナライズ入力が有効かどうかを判定
 * プロフィールが設定されているか、デフォルト以外の意図があるかをチェック
 */
export function hasPersonalization(input: PersonalizationInput): boolean {
  const hasProfile =
    input.userProfile &&
    Object.values(input.userProfile).some((v) => v !== undefined);
  const hasCustomIntent = input.userIntent !== DEFAULT_USER_INTENT;

  return hasProfile || hasCustomIntent;
}
