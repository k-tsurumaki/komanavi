import type {
  IntermediateRepresentation,
  AnalyzeResult,
  ChecklistItem,
} from '@/lib/types/intermediate';

// ============================================
// サンプル1: 給付・手当系（児童手当）
// ============================================

export const sampleBenefitData: IntermediateRepresentation = {
  title: '児童手当',
  summary:
    '中学校卒業まで（15歳の誕生日後の最初の3月31日まで）の児童を養育している方に支給される手当です。',
  documentType: 'benefit',
  metadata: {
    source_url: 'https://www.city.example.lg.jp/kosodate/teate/jidou.html',
    page_title: '児童手当について｜○○市',
    fetched_at: new Date().toISOString(),
    cache_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  keyPoints: [
    {
      id: 'kp-001',
      text: '中学校卒業までの児童が対象',
      importance: 'high',
      sourceId: 'src-001',
    },
    {
      id: 'kp-002',
      text: '申請期限は出生日または転入日から15日以内',
      importance: 'high',
      sourceId: 'src-003',
    },
    {
      id: 'kp-003',
      text: '所得制限あり（超過すると減額または対象外）',
      importance: 'medium',
      sourceId: 'src-001',
    },
  ],
  target: {
    conditions: [
      '中学校卒業までの児童を養育している方',
      '日本国内に住所を有する方',
      '児童が日本国内に住所を有すること（留学中の場合を除く）',
    ],
    exceptions: [
      '児童が児童養護施設等に入所している場合は施設の設置者等に支給',
      '所得制限限度額以上の場合は特例給付（月額5,000円）',
      '所得上限限度額以上の場合は支給対象外',
    ],
    eligibility_summary: '中学生以下のお子さんを育てている方が対象です',
  },
  procedure: {
    steps: [
      {
        order: 1,
        action: '申請書を入手する',
        details: '市区町村の窓口またはホームページから「児童手当認定請求書」を入手',
      },
      {
        order: 2,
        action: '必要書類を準備する',
        details: '申請者の健康保険証、振込先口座の通帳、マイナンバーカード等を準備',
      },
      {
        order: 3,
        action: '申請書を記入する',
        details: '申請者情報、児童情報、振込先口座情報を記入',
      },
      {
        order: 4,
        action: '市区町村窓口に提出する',
        details: 'お住まいの市区町村の子ども課等の窓口に提出',
      },
    ],
    required_documents: [
      '児童手当認定請求書',
      '申請者の健康保険証の写し',
      '振込先口座の通帳の写し',
      'マイナンバーカードまたは通知カード',
      '所得証明書（1月1日時点で他市区町村に住所があった場合）',
    ],
    deadline: '出生日または転入日の翌日から15日以内',
    contact: '子ども課・子育て支援課',
    online_available: false,
  },
  benefits: {
    description: '児童1人あたり月額で支給されます。',
    amount:
      '3歳未満：月額15,000円、3歳〜小学校修了前（第1子・第2子）：月額10,000円、3歳〜小学校修了前（第3子以降）：月額15,000円、中学生：月額10,000円',
    frequency: '毎年6月・10月・2月に4ヶ月分をまとめて支給',
  },
  importantDates: [
    {
      id: 'date-001',
      description: '申請期限',
      deadline_type: 'relative',
      relative_to: '出生日または転入日',
      date: '15日以内',
    },
    {
      id: 'date-002',
      description: '現況届の提出期限',
      deadline_type: 'absolute',
      date: '毎年6月中',
    },
  ],
  contact: {
    department: '子ども課・子育て支援課',
    phone: '03-XXXX-XXXX',
    hours: '平日 8:30〜17:15',
  },
  sources: [
    {
      source_id: 'src-001',
      section: '対象者',
      original_text:
        '児童手当は、中学校卒業まで（15歳の誕生日後の最初の3月31日まで）の児童を養育している方に支給されます。',
    },
    {
      source_id: 'src-002',
      section: '支給額',
      original_text:
        '3歳未満：月額15,000円、3歳以上小学校修了前：月額10,000円（第3子以降は15,000円）、中学生：月額10,000円',
    },
    {
      source_id: 'src-003',
      section: '申請期限',
      original_text:
        '児童手当は、原則として、申請した月の翌月分から支給されます。ただし、出生日や転入日が月末に近い場合、申請が翌月になっても15日以内であれば、申請月から支給されます。',
    },
  ],
  personalization: {
    questions: [
      {
        id: 'q1',
        question: 'お子さんの年齢は？',
        type: 'select',
        options: ['0〜2歳', '3〜5歳', '6〜11歳（小学生）', '12〜14歳（中学生）'],
        affects: ['benefits.amount'],
      },
      {
        id: 'q2',
        question: 'お子さんは第何子ですか？',
        type: 'select',
        options: ['第1子', '第2子', '第3子以降'],
        affects: ['benefits.amount'],
      },
      {
        id: 'q3',
        question: '現在、児童手当を受給していますか？',
        type: 'boolean',
        affects: ['procedure.steps'],
      },
    ],
  },
  warnings: ['申請が遅れると、受給開始が遅れる場合があります', '所得制限により減額または対象外となる場合があります'],
  tips: ['マイナンバーカードをお持ちの場合、オンライン申請が可能な自治体もあります'],
};

// ============================================
// サンプル2: 手続き系（転入届）
// ============================================

export const sampleProcedureData: IntermediateRepresentation = {
  title: '転入届',
  summary: '他の市区町村から引っ越してきた場合に届け出る手続きです。転入した日から14日以内に届け出が必要です。',
  documentType: 'procedure',
  metadata: {
    source_url: 'https://www.city.example.lg.jp/kurashi/todoke/tennyu.html',
    page_title: '転入届｜○○市',
    fetched_at: new Date().toISOString(),
  },
  keyPoints: [
    {
      id: 'kp-001',
      text: '転入から14日以内に届け出が必要',
      importance: 'high',
    },
    {
      id: 'kp-002',
      text: '届け出には転出証明書が必要',
      importance: 'high',
    },
  ],
  procedure: {
    steps: [
      {
        order: 1,
        action: '転出証明書を準備する',
        details: '前住所地の市区町村で転出届を行い、転出証明書を受け取る',
        note: 'マイナンバーカードをお持ちの場合は転出届の特例あり',
      },
      {
        order: 2,
        action: '届出書を記入する',
        details: '窓口で転入届を記入、または事前にダウンロードして記入',
      },
      {
        order: 3,
        action: '窓口で届け出る',
        details: '市民課窓口で届け出を行う',
      },
    ],
    required_documents: [
      '転出証明書（マイナンバーカードで転出した場合は不要）',
      '届出人の本人確認書類',
      'マイナンバーカードまたは通知カード',
      '在留カード（外国人の方）',
    ],
    deadline: '転入した日から14日以内',
    location: '市民課窓口',
    fee: '無料',
    online_available: false,
  },
  contact: {
    department: '市民課',
    phone: '03-XXXX-XXXX',
    hours: '平日 8:30〜17:15、第2・4土曜 9:00〜12:00',
  },
  sources: [
    {
      source_id: 'src-001',
      section: '届出期限',
      original_text: '転入をした日から14日以内に届け出てください。届出が遅れた場合は過料が科される場合があります。',
    },
  ],
  warnings: ['届出が遅れると過料（罰金）が科される場合があります'],
  relatedLinks: [
    { title: '転出届について', url: '/kurashi/todoke/tenshutsu.html' },
    { title: '住民票の写しの請求', url: '/kurashi/todoke/juminhyo.html' },
  ],
};

// ============================================
// サンプル3: FAQ形式
// ============================================

export const sampleFaqData: IntermediateRepresentation = {
  title: 'ゴミの出し方FAQ',
  summary: 'ゴミの分別方法や収集日に関するよくある質問をまとめています。',
  documentType: 'faq',
  metadata: {
    source_url: 'https://www.city.example.lg.jp/gomi/faq.html',
    page_title: 'ゴミの出し方FAQ｜○○市',
    fetched_at: new Date().toISOString(),
  },
  keyPoints: [
    {
      id: 'kp-001',
      text: 'プラスチック製品は「燃やすごみ」か「資源」かの分別に注意',
      importance: 'high',
    },
  ],
  faq: [
    {
      id: 'faq-001',
      question: 'ペットボトルのキャップはどうすればいいですか？',
      answer:
        'キャップは外して「プラスチック製容器包装」として出してください。ボトル本体は「ペットボトル」として出してください。',
      category: '分別',
    },
    {
      id: 'faq-002',
      question: '収集日を過ぎてしまったゴミはどうすればいいですか？',
      answer: '次回の収集日まで保管いただくか、クリーンセンターへ直接持ち込むこともできます（有料）。',
      category: '収集',
    },
    {
      id: 'faq-003',
      question: '粗大ごみの申し込み方法は？',
      answer: '粗大ごみ受付センター（電話：03-XXXX-XXXX）にお電話いただくか、インターネットでお申し込みください。',
      category: '粗大ごみ',
    },
  ],
  contact: {
    department: '環境課',
    phone: '03-XXXX-XXXX',
  },
  sources: [],
  relatedLinks: [
    { title: 'ゴミ収集カレンダー', url: '/gomi/calendar.html' },
    { title: '粗大ごみの出し方', url: '/gomi/sodai.html' },
  ],
};

// ============================================
// サンプル4: 情報提供系（お知らせ）
// ============================================

export const sampleInformationData: IntermediateRepresentation = {
  title: '令和6年度 住民税非課税世帯への給付金のお知らせ',
  summary:
    '物価高騰対策として、住民税非課税世帯に対して1世帯あたり7万円を給付します。対象となる世帯には7月上旬に確認書を送付します。',
  documentType: 'information',
  metadata: {
    source_url: 'https://www.city.example.lg.jp/oshirase/kyufukin.html',
    page_title: '住民税非課税世帯への給付金｜○○市',
    fetched_at: new Date().toISOString(),
    last_modified: '2024-06-15',
  },
  keyPoints: [
    {
      id: 'kp-001',
      text: '対象世帯には確認書が届きます',
      importance: 'high',
    },
    {
      id: 'kp-002',
      text: '給付額は1世帯7万円',
      importance: 'high',
    },
    {
      id: 'kp-003',
      text: '申請期限は令和6年10月31日',
      importance: 'high',
    },
  ],
  sections: [
    {
      id: 'sec-001',
      title: '対象となる世帯',
      content:
        '令和6年度の住民税均等割が非課税である世帯が対象です。ただし、住民税が課税されている方の扶養親族等のみで構成される世帯は対象外です。',
    },
    {
      id: 'sec-002',
      title: '申請方法',
      content:
        '対象世帯には7月上旬に確認書を送付します。届いた確認書に必要事項を記入し、同封の返信用封筒でご返送ください。',
    },
  ],
  target: {
    conditions: ['令和6年度住民税均等割非課税世帯'],
    exceptions: ['住民税課税者の扶養親族のみで構成される世帯'],
  },
  benefits: {
    description: '物価高騰対策としての給付金',
    amount: '1世帯あたり7万円',
    frequency: '一回限り',
  },
  importantDates: [
    {
      id: 'date-001',
      description: '確認書発送時期',
      deadline_type: 'absolute',
      date: '令和6年7月上旬',
    },
    {
      id: 'date-002',
      description: '申請期限',
      deadline_type: 'absolute',
      date: '令和6年10月31日',
    },
  ],
  contact: {
    department: '給付金コールセンター',
    phone: '0120-XXX-XXX',
    hours: '平日 9:00〜17:00',
  },
  sources: [],
  warnings: ['申請期限を過ぎると給付を受けられません', 'この給付金を装った詐欺にご注意ください'],
};

// ============================================
// チェックリストサンプル
// ============================================

export const sampleBenefitChecklist: ChecklistItem[] = [
  {
    id: 'check-001',
    text: '児童手当認定請求書を入手する',
    category: '準備',
    sourceId: 'src-001',
    completed: false,
    priority: 'high',
  },
  {
    id: 'check-002',
    text: '健康保険証のコピーを準備する',
    category: '準備',
    completed: false,
    priority: 'medium',
  },
  {
    id: 'check-003',
    text: '振込先口座の通帳のコピーを準備する',
    category: '準備',
    completed: false,
    priority: 'medium',
  },
  {
    id: 'check-004',
    text: 'マイナンバーカードを準備する',
    category: '準備',
    completed: false,
    priority: 'medium',
  },
  {
    id: 'check-005',
    text: '市区町村の窓口に申請書を提出する',
    category: '申請',
    deadline: '出生日または転入日から15日以内',
    sourceId: 'src-003',
    completed: false,
    priority: 'high',
  },
];

// ============================================
// 要約サンプル（Markdown）
// ============================================

export const sampleBenefitSummaryMarkdown = `
## 児童手当とは

お子さんを育てている方がもらえるお金です。
中学校を卒業するまでのお子さんがいる家庭が対象です。

## もらえる金額

お子さんの年齢によって金額が変わります。

| 年齢 | 金額（月額） |
|------|-------------|
| 0〜2歳 | 15,000円 |
| 3歳〜小学生 | 10,000円（第3子以降は15,000円） |
| 中学生 | 10,000円 |

## 申請方法

1. **申請書を手に入れる** - 市役所の窓口かホームページから
2. **必要な書類を準備する** - 保険証、通帳、マイナンバーカード
3. **市役所に提出する** - 子ども課の窓口へ

## 注意点

- **期限があります**：お子さんが生まれたら、または引っ越してきたら **15日以内** に申請してください
- 申請が遅れると、もらえるお金が減ってしまうことがあります
`.trim();

// ============================================
// 解析結果サンプル
// ============================================

/** 給付系サンプル解析結果 */
export const sampleBenefitAnalyzeResult: AnalyzeResult = {
  id: 'sample-benefit-001',
  intermediate: sampleBenefitData,
  generatedSummary: sampleBenefitSummaryMarkdown,
  checklist: sampleBenefitChecklist,
  status: 'success',
};

/** デフォルトサンプル（後方互換性） */
export const sampleIntermediateData = sampleBenefitData;
export const sampleChecklist = sampleBenefitChecklist;
export const sampleSummaryMarkdown = sampleBenefitSummaryMarkdown;
export const sampleAnalyzeResult = sampleBenefitAnalyzeResult;
