import * as cheerio from 'cheerio';

export interface ScrapedContent {
  url: string;
  title: string;
  mainContent: string;
  sections: {
    heading: string;
    content: string;
  }[];
  metadata: {
    fetchedAt: string;
    lastModified?: string;
    description?: string;
  };
}

export interface ScrapeError {
  type: 'fetch_error' | 'parse_error' | 'invalid_url';
  message: string;
}

export type ScrapeResult =
  | { success: true; data: ScrapedContent }
  | { success: false; error: ScrapeError };

/**
 * URLからHTMLを取得してパースする
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  // URL検証
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        success: false,
        error: {
          type: 'invalid_url',
          message: 'HTTPまたはHTTPSのURLを指定してください',
        },
      };
    }
  } catch {
    return {
      success: false,
      error: {
        type: 'invalid_url',
        message: '無効なURLです',
      },
    };
  }

  // HTML取得
  let html: string;
  let lastModified: string | undefined;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; KOMANAVI/1.0; +https://komanavi.example.com)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: {
          type: 'fetch_error',
          message: `ページの取得に失敗しました（ステータス: ${response.status}）`,
        },
      };
    }

    html = await response.text();
    lastModified = response.headers.get('last-modified') || undefined;
  } catch (err) {
    return {
      success: false,
      error: {
        type: 'fetch_error',
        message: `ページの取得に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`,
      },
    };
  }

  // HTML解析
  try {
    const $ = cheerio.load(html);

    // 不要な要素を削除
    $('script, style, nav, footer, header, aside, iframe, noscript').remove();
    $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
    $('.nav, .navigation, .menu, .sidebar, .footer, .header, .ad, .advertisement').remove();

    // タイトル取得
    const title =
      $('h1').first().text().trim() ||
      $('title').text().trim() ||
      'タイトル不明';

    // メタデータ取得
    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content');

    // メインコンテンツ取得
    const mainSelectors = [
      'main',
      '[role="main"]',
      '#main',
      '#content',
      '.main-content',
      '.content',
      'article',
      '.article',
    ];

    let mainSelector = 'body';
    for (const selector of mainSelectors) {
      if ($(selector).length > 0) {
        mainSelector = selector;
        break;
      }
    }
    const $main = $(mainSelector)

    // セクション抽出
    const sections: { heading: string; content: string }[] = [];
    const headings = $main.find('h2, h3, h4');

    if (headings.length > 0) {
      headings.each((_, heading) => {
        const $heading = $(heading);
        const headingText = $heading.text().trim();

        // 見出しの次の要素からテキストを収集
        let content = '';
        let $next = $heading.next();

        while ($next.length > 0 && !$next.is('h1, h2, h3, h4')) {
          const text = $next.text().trim();
          if (text) {
            content += text + '\n';
          }
          $next = $next.next();
        }

        if (headingText && content.trim()) {
          sections.push({
            heading: headingText,
            content: content.trim(),
          });
        }
      });
    }

    // メインコンテンツのテキスト取得
    const mainContent = $main
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50000); // 最大50000文字

    return {
      success: true,
      data: {
        url,
        title,
        mainContent,
        sections,
        metadata: {
          fetchedAt: new Date().toISOString(),
          lastModified,
          description,
        },
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        type: 'parse_error',
        message: `HTMLの解析に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`,
      },
    };
  }
}

/**
 * スクレイピング結果をLLM用のプロンプトに変換
 */
export function formatForLLM(content: ScrapedContent): string {
  let prompt = `# ページ情報\n\n`;
  prompt += `- URL: ${content.url}\n`;
  prompt += `- タイトル: ${content.title}\n`;
  prompt += `- 取得日時: ${content.metadata.fetchedAt}\n`;

  if (content.metadata.description) {
    prompt += `- 説明: ${content.metadata.description}\n`;
  }

  prompt += `\n# ページ内容\n\n`;

  if (content.sections.length > 0) {
    content.sections.forEach((section) => {
      prompt += `## ${section.heading}\n\n${section.content}\n\n`;
    });
  } else {
    prompt += content.mainContent;
  }

  return prompt;
}
