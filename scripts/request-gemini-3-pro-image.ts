/**
 * Gemini 3 Pro Image (REST) サンプル
 * 実行: npx tsx scripts/request-gemini-3-pro-image.ts
 * 前提: ADC (gcloud auth application-default login など)
 */

import { GoogleAuth } from 'google-auth-library';
import fs from 'node:fs/promises';
import path from 'node:path';

const MODEL_ID = 'gemini-3-pro-image-preview';
const PROJECT_ID = 'zenn-ai-agent-hackathon-vol4';
const LOCATION = 'global';

const PROMPT =
  'ピーナッツバター&ジャムサンドの作り方を４コマ漫画で説明して下さい';

type InlineData = {
  mimeType: string;
  data: string;
};

type Part =
  | { text: string }
  | {
      inlineData: InlineData;
    };

type GenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Part[];
    };
  }>;
};

async function getAccessToken() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse?.token) {
    throw new Error('アクセストークン取得に失敗しました。');
  }
  return tokenResponse.token;
}

function extensionFromMime(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'bin';
}

async function saveImages(parts: Part[], outputDir: string) {
  let imageIndex = 0;
  for (const part of parts) {
    if ('inlineData' in part) {
      const { data, mimeType } = part.inlineData;
      const ext = extensionFromMime(mimeType);
      const fileName = `gemini-3-pro-image-${String(imageIndex + 1).padStart(2, '0')}.${ext}`;
      const filePath = path.join(outputDir, fileName);
      const buffer = Buffer.from(data, 'base64');
      await fs.writeFile(filePath, buffer);
      console.log(`✅ 画像保存: ${filePath}`);
      imageIndex += 1;
    }
  }

  if (imageIndex === 0) {
    console.log('⚠️ 画像データが見つかりませんでした。');
  }
}

async function main() {
  const host = LOCATION === 'global' ? 'aiplatform.googleapis.com' : `${LOCATION}-aiplatform.googleapis.com`;
  const endpoint = `https://${host}/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:generateContent`;
  const accessToken = await getAccessToken();

  const body = {
    contents: {
      role: 'USER',
      parts: [{ text: PROMPT }],
    },
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: '16:9',
      },
    },
    safetySettings: {
      method: 'PROBABILITY',
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`リクエスト失敗: ${res.status} ${res.statusText}\n${errorText}`);
  }

  const json = (await res.json()) as GenerateContentResponse;
  const parts = json.candidates?.[0]?.content?.parts ?? [];

  const texts = parts
    .filter((part): part is { text: string } => 'text' in part)
    .map((part) => part.text)
    .filter(Boolean);

  if (texts.length > 0) {
    console.log('--- 生成テキスト ---');
    console.log(texts.join('\n'));
  }

  const outputDir = path.resolve('scripts', 'outputs');
  await fs.mkdir(outputDir, { recursive: true });
  await saveImages(parts, outputDir);
}

main().catch((error) => {
  console.error('❌ 実行エラー');
  console.error(error);
  process.exit(1);
});
