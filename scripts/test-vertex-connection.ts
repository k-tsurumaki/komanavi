/**
 * Vertex AI 接続確認スクリプト
 * 実行: npx tsx scripts/test-vertex-connection.ts
 */

import { VertexAI } from '@google-cloud/vertexai';

const PROJECT_ID = 'zenn-ai-agent-hackathon-vol4';
const LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash';

async function testConnection() {
  console.log('Vertex AI 接続テスト開始...');
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Location: ${LOCATION}`);
  console.log(`Model: ${MODEL}`);
  console.log('---');

  try {
    const vertexAI = new VertexAI({
      project: PROJECT_ID,
      location: LOCATION,
    });

    const generativeModel = vertexAI.getGenerativeModel({
      model: MODEL,
    });

    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: 'こんにちは' }],
        },
      ],
    });

    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

    console.log('✅ 接続成功!');
    console.log(`レスポンス: ${text}`);
  } catch (error) {
    console.error('❌ 接続失敗');
    console.error(error);
    process.exit(1);
  }
}

testConnection();
