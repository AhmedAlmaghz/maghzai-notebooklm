# 📓 بحّاثة — MaghzAI NotebookLM

<div align="center">

**منصة ذكية متكاملة لتنظيم مصادرك، والدردشة مع مستنداتك، وإنشاء المواد التعليمية**
مستوحاة من Google NotebookLM ومصممة خصيصاً للمحتوى العربي

[![Live Demo](https://img.shields.io/badge/عرض_مباشر-maghzai--notebooklm.vercel.app-blue?style=for-the-badge)](https://maghzai-notebooklm.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini-AI-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev)

</div>

---

## 📋 جدول المحتويات

- [نظرة عامة](#-نظرة-عامة)
- [المميزات الرئيسية](#-المميزات-الرئيسية)
- [التقنيات المستخدمة](#-التقنيات-المستخدمة)
- [هيكل المشروع](#-هيكل-المشروع)
- [التثبيت والتشغيل](#-التثبيت-والتشغيل)
- [متغيرات البيئة](#-متغيرات-البيئة)
- [قاعدة البيانات](#-قاعدة-البيانات)
- [واجهة برمجة التطبيقات (API)](#-واجهة-برمجة-التطبيقات-api)
- [التصميم والواجهة](#-التصميم-والواجهة)
- [المساهمة](#-المساهمة)
- [الترخيص](#-الترخيص)

---

## 🎯 نظرة عامة

**بحّاثة** هو تطبيق ويب احترافي يحاكي تجربة Google NotebookLM مع تركيز خاص على المحتوى العربي والتعليمي. يتيح للمستخدمين إنشاء "دفاتر بحثية" رقمية، وإضافة مصادر متعددة الأنواع إليها (نصوص، روابط، ملفات PDF، فيديوهات يوتيوب، وبحث عميق في الويب)، ثم التفاعل مع هذه المصادر عبر محادثة ذكية مدعومة بالذكاء الاصطناعي، وإنشاء مواد تعليمية متنوعة مثل الملخصات والخرائط الذهنية والبطاقات التعليمية والعروض التقديمية.

### لماذا بحّاثة؟

- 🌐 **دعم كامل للعربية** — واجهة عربية RTL وتحسينات خاصة للمحتوى العربي
- 🤖 **ذكاء اصطناعي تعليمي** — إجابات شاملة مع استشهادات واقتراحات متابعة
- 📚 **مصادر متعددة** — نص، روابط، PDF، يوتيوب، وبحث عميق في الويب
- 🎨 **استوديو تعليمي** — 7 أنواع من المواد التعليمية القابلة للتوليد
- 🔍 **بحث ذكي** — بحث نصي كامل باستخدام PostgreSQL بدون الحاجة لـ APIs خارجية
- 🎙️ **نظرة صوتية** — مشغل صوتي تفاعلي للملخصات الصوتية
- 🌓 **وضعين فاتح وداكن** — تجربة استخدام مريحة في كل الأوقات
- 📱 **تصميم متجاوب** — يعمل بسلاسة على الجوال والكمبيوتر

---

## ✨ المميزات الرئيسية

### 📖 إدارة الدفاتر البحثية
- إنشاء وتحرير وحذف دفاتر بحثية متعددة
- توليد عنوان ووصف ورمز تعبيري تلقائياً للمصادر
- واجهة شبكية لعرض جميع الدفاتر مع عدد المصادر

### 📎 إدارة المصادر
يدعم التطبيق **5 طرق** لإضافة المصادر:

| النوع | الوصف |
|-------|-------|
| **نص** | لصق نص مباشر كمرجع |
| **رابط** | استخراج المحتوى من صفحات الويب والمقالات |
| **يوتيوب** | استخراج النص التلقائي (Transcript) من فيديوهات يوتيوب مع بيانات الفيديو |
| **ملف** | رفع ملفات PDF و TXT و MD (حتى 20 ميجابايت) |
| **بحث عميق** | بحث في الإنترنت وجمع معلومات شاملة عن أي موضوع (سريع/عميق) |

### 💬 المحادثة التعليمية الذكية
- إجابات تعليمية شاملة مدعومة بـ **Google Gemini AI**
- **استشهادات مرجعية** — كل إجابة مرتبطة بالمصادر مع إمكانية النقر لعرضها
- **اقتراحات أسئلة المتابعة** — 4 أنواع (توسيع، ارتباط، أمثلة، تعمق)
- **توسيع من الإنترنت** — دعم الإجابة بمعلومات إضافية من الويب
- **أسئلة مقترحة** — توليد أسئلة تلقائياً من المصادر
- **نسخ وحفظ** الإجابات كملاحظات
- **وضع احتياطي** — تحليل نصي محلي عند عدم توفر مفتاح Gemini

### 🎨 استوديو التعلم
يولد التطبيق **7 أنواع** من المواد التعليمية من المصادر:

| الأداة | الأيقونة | الوصف |
|--------|----------|-------|
| **ملخص شامل** | 📄 | ملخص تعليمي منظم بعناوين فرعية ونقاط |
| **أسئلة شائعة** | ❓ | 8-12 سؤال مع إجابات مفصلة متدرجة |
| **دليل دراسي** | 🎓 | أهداف تعلم، مفاهيم، مصطلحات، نقاط مراجعة |
| **جدول زمني** | ⏰ | تسلسل منطقي/زمني للأحداث والنقاط |
| **خريطة ذهنية** | 🗺️ | تصور بصري للمفاهيم باستخدام Mermaid |
| **بطاقات تعليمية** | 🎴 | 10-15 بطاقة للمراجعة والحفظ |
| **عرض تقديمي** | 📊 | 8-12 شريحة احترافية مع ملاحظات للمحاضر |

### 🌓 ميزات إضافية
- **الوضع الداكن/الفاتح** مع حفظ التفضيل
- **تصميم متجاوب** بالكامل (جوال/كمبيوتر)
- **واجهة عربية RTL** أصيلة
- **لوحات قابلة للطي** لتخصيص مساحة العمل
- **عرض المصادر** مع المحتوى الكامل
- **تحرير الملاحظات** يدوياً

---

## 🛠️ التقنيات المستخدمة

### الواجهة الأمامية (Frontend)
| التقنية | الإصدار | الاستخدام |
|---------|---------|-----------|
| [Next.js](https://nextjs.org) | 16.2.6 | إطار العمل الأساسي (App Router) |
| [React](https://react.dev) | 19.2.6 | مكتبة الواجهة |
| [TypeScript](https://www.typescriptlang.org) | 5.9.3 | كتابة آمنة |
| [Tailwind CSS](https://tailwindcss.com) | 4.1.17 | التنسيق |
| [Lucide React](https://lucide.dev) | 1.28.0 | الأيقونات |
| [React Markdown](https://github.com/remarkjs/react-markdown) | 10.1.0 | عرض Markdown |
| [KaTeX](https://katex.org) | 0.18.1 | عرض المعادلات الرياضية |
| [Mermaid](https://mermaid.js.org) | 11.16.0 | عرض الخرائط الذهنية |

### الخادم وقاعدة البيانات (Backend)
| التقنية | الإصدار | الاستخدام |
|---------|---------|-----------|
| [Drizzle ORM](https://orm.drizzle.team) | 0.45.2 | ORM لـ PostgreSQL |
| [PostgreSQL](https://www.postgresql.org) | 16+ | قاعدة البيانات |
| [pg](https://node-postgres.com) | 8.20.0 | تعريف PostgreSQL |

### الذكاء الاصطناعي ومعالجة المحتوى
| التقنية | الاستخدام |
|---------|-----------|
| [Google Gemini AI](https://ai.google.dev) | توليد الإجابات والمواد التعليمية |
| [Cheerio](https://cheerio.js.org) | استخراج المحتوى من صفحات الويب |
| [pdf-parse](https://github.com/pdf-parse/pdf-parse) | استخراج النص من ملفات PDF |
| [yt-caption-kit](https://www.npmjs.com/package/yt-caption-kit) | استخراج ترجمات يوتيوب |
| [remark-gfm](https://github.com/remarkjs/remark-gfm) | دعم GitHub Flavored Markdown |
| [rehype-katex](https://github.com/remarkjs/remark-math) | دعم المعادلات الرياضية |

### أدوات التطوير
| الأداة | الاستخدام |
|--------|-----------|
| [ESLint](https://eslint.org) | فحص الكود |
| [Drizzle Kit](https://orm.drizzle.team) | ترحيلات قاعدة البيانات |
| [PostCSS](https://postcss.org) | معالجة CSS |

---

## 📁 هيكل المشروع

```
build-notebooklm-style-application/
├── src/
│   ├── app/                          # صفحات وواجهات Next.js (App Router)
│   │   ├── layout.tsx                # التخطيط الرئيسي (RTL، الثيم)
│   │   ├── page.tsx                  # الصفحة الرئيسية (شبكة الدفاتر)
│   │   ├── globals.css               # الأنماط العامة
│   │   ├── notebook/                 # صفحة الدفتر البحثي
│   │   └── api/                      # واجهة برمجة التطبيقات
│   │       ├── health/               # فحص الصحة
│   │       └── notebooks/            # نقاط نهاية الدفاتر
│   │           ├── route.ts          # إنشاء/عرض الدفاتر
│   │           └── [id]/             # عمليات دفتر محدد
│   │               ├── route.ts      # عرض/تحرير/حذف
│   │               ├── chat/         # المحادثة والتوسعة
│   │               ├── notes/        # الملاحظات
│   │               ├── sources/      # المصادر والرفع
│   │               ├── studio/       # توليد المواد التعليمية
│   │               └── suggestions/  # الاقتراحات
│   │
│   ├── components/                   # مكونات React
│   │   ├── notebook-workspace.tsx    # مساحة عمل الدفتر (3 لوحات)
│   │   ├── notebooks-grid.tsx        # شبكة عرض الدفاتر
│   │   ├── sources-panel.tsx         # لوحة المصادر
│   │   ├── add-source-dialog.tsx     # نافذة إضافة مصدر
│   │   ├── chat-panel.tsx            # لوحة المحادثة
│   │   ├── studio-panel.tsx          # لوحة الاستوديو
│   │   ├── source-viewer.tsx         # عارض المصدر
│   │   ├── note-viewer.tsx           # عارض الملاحظات
│   │   ├── markdown.tsx              # عارض Markdown
│   │   ├── mindmap-viewer.tsx        # عارض الخرائط الذهنية
│   │   ├── flashcards-viewer.tsx     # عارض البطاقات التعليمية
│   │   ├── presentation-viewer.tsx   # عارض العروض التقديمية
│   │   ├── audio-overview-player.tsx # مشغل النظرة الصوتية
│   │   ├── theme-provider.tsx        # مزود الثيم
│   │   └── theme-toggle.tsx          # زر تبديل الثيم
│   │
│   ├── db/                           # طبقة قاعدة البيانات
│   │   ├── index.ts                  # اتصال Drizzle
│   │   └── schema.ts                 # مخطط الجداول
│   │
│   └── lib/                          # المنطق والأدوات
│       ├── ai.ts                     # تكامل Gemini AI
│       ├── search.ts                 # البحث النصي الكامل
│       ├── sources.ts                # معالجة المصادر
│       ├── youtube.ts                # استخراج نص يوتيوب
│       ├── types.ts                  # أنواع TypeScript
│       └── text/                     # أدوات معالجة النص
│           ├── chunk.ts              # تقسيم النص لأجزاء
│           ├── extract.ts            # استخراج وتنظيف النص
│           └── summarize.ts          # التلخيص الاستنتاجي
│
├── drizzle.config.json               # إعداد Drizzle Kit
├── .env.example                      # نموذج متغيرات البيئة
├── next.config.ts                    # إعداد Next.js
├── tsconfig.json                     # إعداد TypeScript
├── eslint.config.mjs                 # إعداد ESLint
├── postcss.config.mjs                # إعداد PostCSS
└── package.json                      # التبعيات والسكريبتات
```

---

## 🚀 التثبيت والتشغيل

### المتطلبات الأساسية

- [Node.js](https://nodejs.org) **18.0+** (يُفضّل 20+)
- [PostgreSQL](https://www.postgresql.org) **14+**
- [npm](https://www.npmjs.com) أو [pnpm](https://pnpm.io)
- مفتاح [Google Gemini API](https://aistudio.google.com/apikey) (اختياري لكن موصى به)

### خطوات التثبيت

**1. استنساخ المستودع**

```bash
git clone https://github.com/AhmedAlmaghz/MaghzAI-NotebookLM.git
cd MaghzAI-NotebookLM
```

**2. تثبيت التبعيات**

```bash
npm install
# أو
pnpm install
```

**3. إعداد متغيرات البيئة**

```bash
cp .env.example .env
```

ثم حرّر ملف `.env` وأدخل القيم المناسبة (راجع قسم [متغيرات البيئة](#-متغيرات-البيئة)).

**4. إعداد قاعدة البيانات**

```bash
# إنشاء قاعدة البيانات
createdb nblm_app_db

# تشغيل الترحيلات
npx drizzle-kit push
```

**5. تشغيل التطبيق**

```bash
# وضع التطوير
npm run dev

# بناء للإنتاج
npm run build

# تشغيل الإنتاج
npm run start
```

ثم افتح المتصفح على: [http://localhost:3000](http://localhost:3000)

### سكريبتات npm المتاحة

| الأمر | الوصف |
|-------|-------|
| `npm run dev` | تشغيل خادم التطوير |
| `npm run build` | بناء التطبيق للإنتاج |
| `npm run start` | تشغيل نسخة الإنتاج |
| `npm run lint` | فحص الكود بـ ESLint |
| `npm run typecheck` | فحص أنواع TypeScript |

---

## 🔐 متغيرات البيئة

أنشئ ملف `.env` في جذر المشروع بناءً على `.env.example`:

```env
# اتصال قاعدة البيانات (مطلوب)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/nblm_app_db

# مفتاح Google Gemini API (اختياري — يفعّل ميزات الذكاء الاصطناعي)
# احصل على مفتاحك المجاني من: https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# نموذج Gemini المستخدم (اختياري — افتراضي: gemini-2.5-flash-lite)
# النماذج المتاحة في الباقة المجانية:
#   - gemini-2.5-flash-lite (موصى به — سريع واقتصادي)
#   - gemini-2.5-flash
#   - gemini-2.5-pro
GEMINI_MODEL=gemini-2.5-flash-lite
```

> **ملاحظة:** التطبيق يعمل بدون `GEMINI_API_KEY` في وضع احتياطي يستخدم التحليل النصي المحلي، لكن ميزات الذكاء الاصطناعي ستكون محدودة.

---

## 🗄️ قاعدة البيانات

يستخدم التطبيق **PostgreSQL** مع **Drizzle ORM**. المخطط يحتوي على 5 جداول رئيسية:

### مخطط الجداول

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  notebooks  │────<│   sources    │────<│ source_chunks  │
│             │     │              │     │                │
│ • id        │     │ • id         │     │ • id           │
│ • title     │     │ • notebookId │     │ • sourceId     │
│ • emoji     │     │ • title      │     │ • notebookId   │
│ • description│    │ • type       │     │ • chunkIndex   │
│ • createdAt │     │ • content    │     │ • content      │
│ • updatedAt │     │ • sourceUrl  │     │ • createdAt    │
└──────┬──────┘     │ • status     │     └────────────────┘
       │            │ • charCount  │
       │            └──────────────┘
       │
       ├────<┌──────────────┐
       │     │   messages   │
       │     │              │
       │     │ • id         │
       │     │ • notebookId │
       │     │ • role       │
       │     │ • content    │
       │     │ • citations  │
       │     │ • createdAt  │
       │     └──────────────┘
       │
       └────<┌──────────────┐
             │    notes     │
             │              │
             │ • id         │
             │ • notebookId │
             │ • title      │
             │ • content    │
             │ • kind       │
             │ • createdAt  │
             │ • updatedAt  │
             └──────────────┘
```

### البحث النصي الكامل

يستخدم التطبيق **البحث النصي الكامل الأصلي في PostgreSQL** (`to_tsvector` و `to_tsquery`) للبحث في أجزاء المصادر، مما يلغي الحاجة لـ APIs خارجية للتضمين (Embeddings):

- تقسيم المصادر إلى أجزاء (Chunks) عند الإضافة
- استخدام `ts_rank_cd` لترتيب النتائج حسب الصلة
- دعم البحث في مصادر محددة أو جميع المصادر
- آلية احتياطية عند عدم العثور على نتائج

---

## 🔌 واجهة برمجة التطبيقات (API)

### نقاط النهاية المتاحة

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| `GET` | `/api/health` | فحص صحة التطبيق |
| `GET` | `/api/notebooks` | عرض جميع الدفاتر |
| `POST` | `/api/notebooks` | إنشاء دفتر جديد |
| `GET` | `/api/notebooks/[id]` | عرض دفتر محدد |
| `PATCH` | `/api/notebooks/[id]` | تحرير دفتر |
| `DELETE` | `/api/notebooks/[id]` | حذف دفتر |
| `GET` | `/api/notebooks/[id]/sources` | عرض مصادر الدفتر |
| `POST` | `/api/notebooks/[id]/sources` | إضافة مصدر (text/url/youtube) |
| `POST` | `/api/notebooks/[id]/sources/upload` | رفع ملف |
| `POST` | `/api/notebooks/[id]/sources/web-search` | بحث عميق في الويب |
| `GET` | `/api/notebooks/[id]/sources/[sourceId]` | عرض مصدر محدد |
| `DELETE` | `/api/notebooks/[id]/sources/[sourceId]` | حذف مصدر |
| `POST` | `/api/notebooks/[id]/chat` | إرسال سؤال للمحادثة |
| `POST` | `/api/notebooks/[id]/chat/expand` | توسيع إجابة من الويب |
| `GET` | `/api/notebooks/[id]/notes` | عرض الملاحظات |
| `POST` | `/api/notebooks/[id]/notes` | إضافة ملاحظة |
| `DELETE` | `/api/notebooks/[id]/notes/[noteId]` | حذف ملاحظة |
| `POST` | `/api/notebooks/[id]/studio` | توليد مادة تعليمية |
| `GET` | `/api/notebooks/[id]/suggestions` | اقتراحات أسئلة |

### مثال على الاستخدام

```bash
# إنشاء دفتر جديد
curl -X POST http://localhost:3000/api/notebooks \
  -H "Content-Type: application/json" \
  -d '{"title": "دفتر الذكاء الاصطناعي"}'

# إضافة مصدر نصي
curl -X POST http://localhost:3000/api/notebooks/{id}/sources \
  -H "Content-Type: application/json" \
  -d '{"kind": "text", "title": "مقدمة", "content": "الذكاء الاصطناعي هو..."}'

# إرسال سؤال للمحادثة
curl -X POST http://localhost:3000/api/notebooks/{id}/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "ما هو الذكاء الاصطناعي؟"}'
```

---

## 🎨 التصميم والواجهة

### تخطيط مساحة العمل

يتبنى التطبيق تخطيطاً ثلاثي اللوحات (Three-Panel Layout) مستوحى من NotebookLM:

```
┌─────────────────────────────────────────────────────────────┐
│                      الهيدر (العنوان)                        │
├──────────┬────────────────────────────┬─────────────────────┤
│          │                            │                     │
│  المصادر  │       المحادثة             │     الاستوديو       │
│          │                            │                     │
│  • قائمة │  • الرسائل                 │  • أدوات أساسية     │
│  • إضافة │  • الاستشهادات             │  • أدوات متقدمة     │
│  • تحديد │  • اقتراحات المتابعة       │  • الملاحظات        │
│          │  • إدخال السؤال            │                     │
│          │                            │                     │
└──────────┴────────────────────────────┴─────────────────────┘
```

- **لوحة المصادر** (يسار): إدارة وتحديد المصادر
- **لوحة المحادثة** (وسط): التفاعل مع الذكاء الاصطناعي
- **لوحة الاستوديو** (يمين): توليد وإدارة المواد التعليمية

### التجاوب مع الجوال

على الشاشات الصغيرة، يتحول التطبيق إلى تبويبات (Tabs) للتبديل بين اللوحات الثلاث.

### الثيمات

- **الوضع الفاتح** — خلفية فاتحة مع لمسات بنفسجية
- **الوضع الداكن** — خلفية داكنة مريحة للعين
- حفظ التفضيل في `localStorage` مع دعم تفضيل النظام

---

## 🤝 المساهمة

المساهمات مرحب بها! اتبع الخطوات التالية:

1. **Fork** المستودع
2. أنشئ فرعاً للميزة الجديدة: `git checkout -b feature/amazing-feature`
3. التزم بالتغييرات: `git commit -m 'إضافة ميزة رائعة'`
4. ادفع الفرع: `git push origin feature/amazing-feature`
5. افتح **Pull Request**

### معايير الكود

- استخدم **TypeScript** بصرامة
- اتبع قواعد **ESLint**
- حافظ على التنسيق المتسق (2 مسافة للمسافة البادئة)
- اكتب تعليقات بالعربية للمنطق المعقد
- اختبر التغييرات قبل الإرسال: `npm run lint && npm run typecheck`

---

## 📝 الترخيص

هذا المشروع مرخص تحت **MIT License** — راجع ملف [LICENSE](LICENSE) للتفاصيل.

---

## 👨‍💻 المؤلف

<div align="center">

**Ahmed Almaghz** — مطور ومصمم التطبيق

[![GitHub](https://img.shields.io/badge/GitHub-AhmedAlmaghz-181717?style=flat-square&logo=github)](https://github.com/AhmedAlmaghz)
[![Repository](https://img.shields.io/badge/المستودع-MaghzAI--NotebookLM-blue?style=flat-square)](https://github.com/AhmedAlmaghz/MaghzAI-NotebookLM)
[![Live](https://img.shields.io/badge/الموقع_المباشر-Vercel-black?style=flat-square&logo=vercel)](https://maghzai-notebooklm.vercel.app)

</div>

---

<div align="center">

**صُنع بـ ❤️ للمحتوى العربي والتعليم الذكي**

</div>