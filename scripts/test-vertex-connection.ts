/**
 * Vertex AI 接続確認スクリプト
 * 実行: npx tsx scripts/test-vertex-connection.ts
 */

import { GoogleGenAI } from '@google/genai';

const PROJECT_ID = 'zenn-ai-agent-hackathon-vol4';
const LOCATION = 'global';
const MODEL = 'gemini-3-flash-preview';

async function testConnection() {
  console.log('Vertex AI 接続テスト開始...');
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Location: ${LOCATION}`);
  console.log(`Model: ${MODEL}`);
  console.log('---');

  try {
    const ai = new GoogleGenAI({
      vertexai: true,
      project: PROJECT_ID,
      location: LOCATION,
      apiVersion: 'v1',
    });

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: 'こんにちは' }],
        },
      ],
    });

    const text = result.text;

    console.log('✅ 接続成功!');
    console.log(`レスポンス: ${text}`);
  } catch (error) {
    console.error('❌ 接続失敗');
    console.error(error);
    process.exit(1);
  }
}

testConnection();
