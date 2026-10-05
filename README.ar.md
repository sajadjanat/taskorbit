<p align="center"><a href="README.md">English</a> · <a href="README.fa.md">فارسی</a> · <strong>العربية</strong> · <a href="README.zh-CN.md">简体中文</a></p>

<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/taskorbit-wordmark-v5-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="assets/brand/taskorbit-wordmark-v5-light.png" />
    <img src="assets/brand/taskorbit-wordmark-v5-light.png" alt="TaskOrbit — transparent sunlit Mercury wordmark" width="680" />
  </picture>
  <h1>TaskOrbit</h1>
  <p><strong>المشاريع والسبرنتات وعمل الفريق في مدار واضح.</strong></p>
  <p>إدارة مشاريع خفيفة وذاتية الاستضافة باستخدام React وshadcn/ui وTauri.</p>
  <p>
    <a href="https://github.com/sajadjanat/taskorbit/actions/workflows/verify.yml"><img src="https://github.com/sajadjanat/taskorbit/actions/workflows/verify.yml/badge.svg" alt="Web and server checks" /></a>
    <a href="https://github.com/sajadjanat/taskorbit/releases"><img src="https://img.shields.io/badge/version-0.1.4-b88645" alt="Version 0.1.4" /></a>
    <img src="https://img.shields.io/badge/Tauri-2-24c8db?logo=tauri&amp;logoColor=white" alt="Tauri 2" />
    <img src="https://img.shields.io/badge/UI-shadcn%2Fui-18181b?logo=shadcnui&amp;logoColor=white" alt="shadcn/ui" />
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-b88645" alt="MIT license" /></a>
  </p>
  <p><a href="#download">التنزيل</a> · <a href="#features">الميزات</a> · <a href="#quick-start">البدء السريع</a> · <a href="#updates">التحديثات</a> · <a href="docs/OPERATIONS.md">Docker</a></p>
</div>

![TaskOrbit Kanban workspace with the Mercury dark theme](docs/images/taskorbit-board-dark.png)

*صور فعلية للتطبيق ببيانات تجريبية وحسابات وهمية، دون بيانات شخصية. واجهة التطبيق تدعم حالياً الفارسية والإنجليزية.*

## لماذا TaskOrbit؟

اعرف العمل المخطط، والمسؤول عن الخطوة التالية، وما أصبح جاهزاً للتسليم. يجمع TaskOrbit المشاريع والسبرنتات والمهام في واجهة مدمجة على خادم تتحكم فيه. ابدأ بحاوية واحدة وSQLite، واتصل من الويب أو سطح المكتب أو Android أو PWA على iPhone.

إدارة خفيفة للمشاريع والسبرنتات ومهام الفريق على خادمك الخاص. TaskOrbit تطبيق مستقل بترخيص MIT لإدارة مشاريع الفرق. الإصدار الحالي تجريبي؛ توضح الأقسام التالية الميزات المتاحة والعمل المتبقي.

<a id="features"></a>

## الميزات

| الميزات | ما تقدمه |
| --- | --- |
| **المشاريع والمساحات** | مساحات عمل ومشاريع متعددة، مع معرفات وألوان وأرشفة. |
| **السبرنتات** | سبرنتات بأهداف وتواريخ وحالات مخطط/نشط/مكتمل ومؤشر تقدم. |
| **عروض العمل** | لوحة Kanban بالسحب والإفلات، قائمة قابلة للبحث وخط زمني حسب موعد الاستحقاق. |
| **تفاصيل المهام** | وصف المهمة وأولويتها والمسؤول عنها والسبرنت والوحدة والتقدير والموعد والوسوم. |
| **علاقات المهام** | مهام فرعية وعلاقات واعتماديات مانعة، مع منع الدورات. |
| **التعاون** | تعليقات وسجل نشاط ومرفقات؛ 10 ميغابايت للملف و20 ملفاً للمهمة. |
| **معرفة المشروع** | وحدات ومستندات نصية للمشروع ومرشحات مشتركة محفوظة. |
| **إدارة الفريق** | مدير عام، إنشاء المستخدمين وتعطيلهم وإعادة تعيين كلمات المرور، وأدوار مدير/عضو/مشاهد لمساحة العمل. |
| **اللغة والمظهر** | واجهة بالفارسية والإنجليزية، اتجاه RTL/LTR وخطوط محلية ومظهر فاتح/داكن بألوان عطارد الرمادية والذهبية. |
| **الويب وPWA** | تطبيق ويب وPWA لأجهزة iPhone/iPad، مع شاشة انقطاع الاتصال. التعديل يحتاج اتصالاً. |
| **العملاء الأصليون** | عملاء Tauri لأنظمة Windows وmacOS وLinux وAndroid مع عنوان خادم ذاتي الاستضافة قابل للتحديد. |
| **خادم خفيف** | حاوية خادم واحدة ووحدة تخزين SQLite دائمة، دون Redis أو طابور رسائل أو خدمة قاعدة بيانات منفصلة. |
| **تحديث التطبيق والخادم** | تحديث سطح مكتب موقّع، فحص APK، إعادة تحميل الويب/PWA، وترقية خادم اختيارية بنقرة واحدة مع نسخ احتياطي واستعادة. |

توثيق README متاح بأربع لغات؛ واجهة التطبيق حالياً بالفارسية والإنجليزية.

<details>
<summary><strong>تقدم المشروع والمظهر الفاتح والواجهة الفارسية</strong></summary>

![TaskOrbit project progress and active sprint](docs/images/taskorbit-overview-dark.png)

![TaskOrbit light theme with stone surfaces and gold accents](docs/images/taskorbit-board-light.png)

![TaskOrbit Persian RTL workspace](docs/images/taskorbit-fa-board.png)

</details>

<a id="download"></a>

## التنزيل

[**TaskOrbit 0.1.4 → GitHub Releases**](https://github.com/sajadjanat/taskorbit/releases/tag/v0.1.4)

| المنصة | الحزمة أو الوصول | طريقة التحديث |
| --- | --- | --- |
| Windows x64 | TaskOrbit_0.1.4_x64-setup.exe | تحديث موقّع داخل التطبيق |
| macOS Apple Silicon | TaskOrbit_0.1.4_aarch64.dmg | تحديث موقّع داخل التطبيق |
| macOS Intel | TaskOrbit_0.1.4_x64.dmg | تحديث موقّع داخل التطبيق |
| Linux x64 | DEB / AppImage | تحديث موقّع داخل التطبيق |
| Android arm64 | taskorbit-android-arm64.apk | APK موقّع؛ التثبيت بموافقة المستخدم |
| Web / iPhone / iPad | المتصفح / الإضافة إلى الشاشة الرئيسية | إعادة التحميل بعد تحديث الخادم |

<a id="quick-start"></a>

## البدء السريع

1. شغّل الخادم باستخدام Docker كما هو موضح أدناه.
2. أنشئ أول مشرف ومساحة عمل؛ لا توجد كلمة مرور افتراضية.
3. أنشئ حسابات المستخدمين من الإدارة وأضف أعضاء الفريق وأدوارهم.
4. أنشئ مشروعاً وسبرنتاً ثم مهاماً بمسؤول وأولوية وموعد.
5. تابع العمل عبر اللوحة أو القائمة أو الخط الزمني.
6. صِل أجهزتك بخادم HTTPS نفسه واختر اللغة والمظهر.

## الاستضافة المحلية: حاوية واحدة

```sh
git clone https://github.com/sajadjanat/taskorbit.git
cd taskorbit
docker compose up -d --build
```

افتح `http://localhost:4310` وأنشئ المدير الأول ومساحة العمل. لا توجد كلمة مرور افتراضية؛ يغلق التسجيل العام بعد إنشاء هذا الحساب. ينشئ المدير حسابات المستخدمين ويضيفهم عبر **Team**. مساحة العمل هي حد الصلاحيات: يمكن لجميع أعضائها رؤية مشاريعها.

لاستخدام الصورة العامة الجاهزة:

```sh
docker compose -f compose.image.yaml up -d
```

الصورة `ghcr.io/sajadjanat/taskorbit:v0.1.4` متاحة لـ Linux amd64 وarm64. تحفظ الحسابات والمرفقات وSQLite في `taskorbit-data`. الأمر `docker compose down -v` يحذف وحدة التخزين والبيانات.

## خادم عام مع HTTPS: حاويتان

وجّه نطاقاً إلى الخادم وافتح المنفذين 80 و443 وأنشئ ملف `.env`:

```dotenv
TASKORBIT_DOMAIN=tasks.example.com
```

```sh
docker compose -f compose.yaml -f compose.https.yaml up -d --build
```

الحاوية الثانية هي Caddy لتوفير شهادات TLS وتمرير الطلبات إلى TaskOrbit. للصورة الجاهزة استبدل `compose.yaml` بـ `compose.image.yaml`. يمكنك استخدام وكيلك العكسي الموجود وحاوية التطبيق فقط، مع `APP_ORIGIN=https://tasks.example.com` و`NODE_ENV=production`. يجب أن يطابق origin عنوان المتصفح. يرتبط التطبيق افتراضياً بعنوان loopback على مضيف Docker. لا تعرض الإعداد الأولي للعامة قبل استعداد المالك لإنشاء المدير.

<a id="updates"></a>

## التحديثات

يمكن للمشرف العام التحقق من الإصدارات في لوحة الإدارة. لتفعيل تحديث الخادم بنقرة واحدة مع نسخة احتياطية واستعادة تلقائية عند الفشل، اسحب الصور ثم شغّل `docker compose -f compose.image.yaml -f compose.updates.yaml up -d`. تضاف حاوية تحديث: حاويتان إجمالاً أو ثلاث مع Caddy. يتضمن سطح المكتب منذ 0.1.3 تحديثات موقعة عبر شاشة الاتصال وقائمة **Updates / Server connection**. يتيح Android تنزيل APK الموقّع ويتطلب موافقة المستخدم للتثبيت. يقدم الويب وPWA على iPhone إعادة التحميل بعد تحديث الخادم. الإصدارات الأقدم تحتاج تثبيت 0.1.4 يدويًا مرة واحدة. راجع [دليل التحديث](docs/UPDATES.md).


## التثبيت على الأجهزة

نزّل الملفات من [الإصدارات](https://github.com/sajadjanat/taskorbit/releases): Windows x64، وmacOS Intel/Apple Silicon، وLinux x64، وAPK لـ Android arm64. تظهر شاشة اتصال عند كل تشغيل. أدخل عنوان HTTPS الجذري لخادمك، مثل `https://tasks.example.com`، ثم سجّل الدخول. يحفظ العميل العنوان؛ شاشة الاتصال لا تحفظ كلمات المرور. أعد تشغيله لتغيير الخادم. يسمح بـ HTTP فقط على localhost للتطوير.

في **iPhone/iPad** افتح الخادم في Safari ثم Share ← **Add to Home Screen**. يستخدم PWA الحسابات والخادم نفسيهما ويتطلب HTTPS. يخزّن Service Worker الأيقونات العامة وشاشة انقطاع الاتصال فقط، ولا يخزّن بيانات العمل الخاصة. لا توجد مزامنة دون اتصال بعد.

حزم Windows/macOS غير موقّعة بشهادة توقيع الكود، ولا تتوفر notarization لـ macOS. يوقّع APK بمفتاح إصدار ثابت للمشروع. لا يتضمن هذا الإصدار نشر التطبيق في App Store أو Play Store. نجاح البناء لا يعني التحقق من التثبيت على أجهزة فعلية.

## التطوير والاختبارات

يلزم Node.js 22.18 أو أحدث:

```sh
npm ci
npm run dev
```

عنوان التطوير `http://localhost:5173`؛ اضبط `APP_ORIGIN=http://localhost:5173` لواجهة API. لتشغيل الخادم المبني:

```sh
npm run build
npm start
```

القيم الافتراضية: `PORT=4310` و`HOST=127.0.0.1` و`DATABASE_PATH=data/taskorbit.sqlite`.

```sh
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

تستخدم الاختبارات قواعد مؤقتة ولا تعدّل `data/`. إذا تعذر تنزيل المتصفح، استخدم Chrome المثبت: `PLAYWRIGHT_CHANNEL=chrome npx playwright test --project=chromium`؛ في PowerShell اضبط أولاً `$env:PLAYWRIGHT_CHANNEL='chrome'`. اختبار WebKit بحجم الهاتف لا يثبت عمل التطبيق على iPhone فعلي.

ثبّت [متطلبات Tauri](https://v2.tauri.app/start/prerequisites/) ثم شغّل `npm run desktop`. للبناء على نظام الهدف استخدم `npm run desktop:build -- --bundles nsis` على Windows، أو `--bundles dmg` على macOS، أو `--bundles deb,appimage` على Linux. يحتاج Android إلى Java 17 وSDK/NDK و`npx tauri android init` ثم `npx tauri android build --apk --target aarch64`.

## النسخ الاحتياطي والتشغيل

تصدير JSON للمدير يشمل بيانات العمل ومعلومات المستخدمين، لكنه يستبعد تجزئات كلمات المرور والجلسات ومحتويات المرفقات؛ ليس نسخة كاملة للاستعادة. للنسخ الكامل أوقف TaskOrbit، وأرشف وحدة `/data` ثم شغّله مجدداً. راجع [دليل التشغيل](docs/OPERATIONS.md). تحتوي SQLite على المرفقات؛ نسخ الملف أثناء الكتابة دون واجهة النسخ الاحتياطي لـ SQLite غير آمن.

حدود Compose هي 512 ميغابايت وCPU واحد؛ ليست قياسات استهلاك فعلي. SQLite WAL مخصص لفريق صغير ونسخة خادم واحدة. لا تشغّل عدة replicas على ملف قاعدة بيانات مشترك أو شبكي.

## الإصدار والنطاق

يشغّل الوسم `v0.1.4` الاختبارات وبناء الحزم الأصلية والصورة متعددة المعماريات ومسودة إصدار. ينشر الإصدار بعد نجاح جميع المنصات. راجع [ملاحظات الإصدار](docs/RELEASE-NOTES.md) و[نتائج التحقق](docs/VERIFICATION.md) و[خارطة الطريق](docs/ROADMAP.md).

التقنيات: React وTypeScript وVite وTailwind ومكونات shadcn/ui الفعلية وExpress وSQLite المدمجة في Node وTauri 2. الخط Vazirmatn بترخيص OFL. تعتمد الهوية على عطارد وإضاءة شمسية دافئة وألوان حجرية/فحمية وذهبية؛ [تفاصيل الهوية](assets/brand/WORDMARK.md).

## الترخيص

MIT؛ تحتفظ المكونات والتبعيات بتراخيصها الأصلية. راجع [إشعارات الجهات الخارجية](THIRD-PARTY-NOTICES.md).
