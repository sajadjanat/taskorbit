import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { Locale } from "../lib/i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Copy, KeyRound, Plug, Trash2 } from "lucide-react";
import { version } from "../../package.json";

const copy = {
  en: {
    title: "AI integrations · MCP",
    intro:
      "Connect your agent to this TaskOrbit server. Its access follows your workspace role and the permissions you choose.",
    step1: "1. Create a personal token",
    name: "Token name",
    days: "Expires after (days)",
    write: "Allow editing work data",
    admin: "Allow instance administration",
    scope:
      "Start with read-only access. Administration grants access across the instance; enable it only for a trusted agent.",
    create: "Create token",
    once: "Copy this token now. It is shown only once; TaskOrbit stores only its hash.",
    hide: "I have saved my token",
    step2: "2. Configure your agent",
    client: "Agent / connection method",
    hint: "Replace YOUR_TOKEN with your saved token in the agent’s private configuration. Never commit it to a repository. For environment-based examples, define TASKORBIT_TOKEN in the environment that launches your agent, then fully restart it.",
    stdio:
      "The local bridge needs Node.js 22.18+. Save its JSON in your agent’s MCP configuration. On Windows, select the Windows example.",
    step3: "3. Connect and verify",
    verify:
      "Restart your agent and ask: “Use TaskOrbit to list my workspaces.” Choose a workspace and project before editing. Revoke this token below to disconnect the agent.",
    trouble:
      "401: expired/revoked token. 403: insufficient token permission or workspace role. Missing editing tools: create a token with editing enabled. Cannot connect: check the HTTPS address, certificate and network.",
    tokens: "Your tokens",
    empty: "No personal tokens yet.",
    revoke: "Revoke",
    confirm: "Revoke this token? Its agent will immediately lose access.",
    copied: "Copied",
    copy: "Copy",
    guide: "Full setup guide",
    endpoint: "Remote MCP endpoint",
    expired: "Expired",
    read: "Read",
    writeLabel: "Write",
    adminLabel: "Admin",
  },
  fa: {
    title: "اتصال ایجنت‌ها · MCP",
    intro:
      "ایجنت دلخواه را به این سرور TaskOrbit وصل کنید. دسترسی آن به نقش شما در فضای کاری و مجوزهای توکن محدود می‌شود.",
    step1: "۱. ساخت توکن شخصی",
    name: "نام توکن",
    days: "انقضا پس از (روز)",
    write: "اجازهٔ ویرایش اطلاعات کاری",
    admin: "اجازهٔ مدیریت کل سرور",
    scope:
      "برای شروع فقط دسترسی خواندن بدهید. مدیریت کل به اطلاعات سراسر سرور دسترسی می‌دهد؛ فقط برای ایجنت مورد اعتماد فعال کنید.",
    create: "ساخت توکن",
    once: "توکن را همین حالا کپی کنید؛ فقط یک بار نمایش داده می‌شود و در TaskOrbit فقط هش آن ذخیره می‌شود.",
    hide: "توکن را ذخیره کردم",
    step2: "۲. تنظیم ایجنت",
    client: "ایجنت / روش اتصال",
    hint: "YOUR_TOKEN را در تنظیمات خصوصی ایجنت با توکن خود جایگزین کنید. آن را در گیت ثبت نکنید. در مثال‌های متغیر محیطی، TASKORBIT_TOKEN را در محیط اجرای ایجنت تعریف کنید و ایجنت را کامل ببندید و دوباره باز کنید.",
    stdio:
      "پل محلی به Node.js 22.18 یا بالاتر نیاز دارد. JSON را در تنظیمات MCP ایجنت بگذارید. در ویندوز مثال Windows را انتخاب کنید.",
    step3: "۳. اتصال و بررسی",
    verify:
      "ایجنت را دوباره اجرا کنید و بگویید: «با TaskOrbit فضاهای کاری من را فهرست کن». پیش از ویرایش، فضای کاری و پروژه را انتخاب کنید. با لغو توکن، اتصال ایجنت قطع می‌شود.",
    trouble:
      "۴۰۱: توکن منقضی یا لغو شده. ۴۰۳: مجوز توکن یا نقش فضای کاری کافی نیست. نبود ابزار ویرایش: توکن با مجوز ویرایش بسازید. خطای اتصال: نشانی HTTPS، گواهی و شبکه را بررسی کنید.",
    tokens: "توکن‌های شما",
    empty: "هنوز توکن شخصی ندارید.",
    revoke: "لغو",
    confirm: "توکن لغو شود؟ دسترسی ایجنت بلافاصله قطع می‌شود.",
    copied: "کپی شد",
    copy: "کپی",
    guide: "راهنمای کامل فعال‌سازی",
    endpoint: "نشانی MCP راه دور",
    expired: "منقضی",
    read: "خواندن",
    writeLabel: "نوشتن",
    adminLabel: "ادمین",
  },
  ar: {
    title: "تكامل الوكلاء · MCP",
    intro:
      "صل وكيلك بخادم TaskOrbit هذا. يخضع الوصول لدورك في مساحة العمل وصلاحيات الرمز.",
    step1: "١. إنشاء رمز شخصي",
    name: "اسم الرمز",
    days: "ينتهي بعد (أيام)",
    write: "السماح بتعديل بيانات العمل",
    admin: "السماح بإدارة الخادم",
    scope:
      "ابدأ بالقراءة فقط. تتيح الإدارة الوصول إلى الخادم بالكامل؛ فعّلها فقط لوكيل موثوق.",
    create: "إنشاء رمز",
    once: "انسخ الرمز الآن. يظهر مرة واحدة فقط؛ يخزن TaskOrbit بصمته فقط.",
    hide: "حفظت الرمز",
    step2: "٢. إعداد الوكيل",
    client: "الوكيل / طريقة الاتصال",
    hint: "استبدل YOUR_TOKEN بالرمز في إعدادات الوكيل الخاصة. لا تحفظه في Git. للأمثلة التي تستخدم متغير البيئة، عرّف TASKORBIT_TOKEN في بيئة تشغيل الوكيل ثم أعد تشغيله بالكامل.",
    stdio:
      "يتطلب الجسر المحلي Node.js 22.18+. ضع JSON في إعدادات MCP لوكيلك. اختر مثال Windows على ويندوز.",
    step3: "٣. الاتصال والتحقق",
    verify:
      "أعد تشغيل الوكيل واطلب: «استخدم TaskOrbit لعرض مساحات عملي». اختر مساحة ومشروعًا قبل التعديل. إلغاء الرمز يوقف وصول الوكيل.",
    trouble:
      "401: رمز منتهي أو ملغى. 403: صلاحية الرمز أو دورك غير كافٍ. أدوات التعديل غير موجودة: أنشئ رمزًا يسمح بالتعديل. تعذر الاتصال: تحقق من HTTPS والشهادة والشبكة.",
    tokens: "رموزك",
    empty: "لا توجد رموز شخصية بعد.",
    revoke: "إلغاء",
    confirm: "إلغاء هذا الرمز؟ سيفقد الوكيل الوصول فورًا.",
    copied: "تم النسخ",
    copy: "نسخ",
    guide: "دليل الإعداد الكامل",
    endpoint: "عنوان MCP البعيد",
    expired: "منتهي",
    read: "قراءة",
    writeLabel: "كتابة",
    adminLabel: "إدارة",
  },
  "zh-CN": {
    title: "AI 集成 · MCP",
    intro:
      "将代理连接到此 TaskOrbit 服务器。访问受您的工作区角色和令牌权限限制。",
    step1: "1. 创建个人令牌",
    name: "令牌名称",
    days: "有效天数",
    write: "允许编辑工作数据",
    admin: "允许实例管理",
    scope: "建议从只读权限开始。实例管理可访问整个服务器，仅为可信代理启用。",
    create: "创建令牌",
    once: "现在复制令牌。它仅显示一次；TaskOrbit 只存储其哈希值。",
    hide: "我已保存令牌",
    step2: "2. 配置代理",
    client: "代理 / 连接方式",
    hint: "在代理的私人配置中用您的令牌替换 YOUR_TOKEN。不要提交到 Git。使用环境变量的示例需要在启动代理的环境中定义 TASKORBIT_TOKEN，然后完全重启代理。",
    stdio:
      "本地桥接需要 Node.js 22.18+。将 JSON 放入代理的 MCP 配置。Windows 用户请选择 Windows 示例。",
    step3: "3. 连接并验证",
    verify:
      "重启代理并要求：“使用 TaskOrbit 列出我的工作区”。编辑前先选择工作区和项目。撤销令牌会断开代理的访问。",
    trouble:
      "401：令牌过期或已撤销。403：令牌权限或工作区角色不足。缺少编辑工具：创建允许编辑的令牌。无法连接：检查 HTTPS 地址、证书和网络。",
    tokens: "您的令牌",
    empty: "尚无个人令牌。",
    revoke: "撤销",
    confirm: "撤销此令牌？代理将立即失去访问权限。",
    copied: "已复制",
    copy: "复制",
    guide: "完整设置指南",
    endpoint: "远程 MCP 地址",
    expired: "已过期",
    read: "读取",
    writeLabel: "写入",
    adminLabel: "管理",
  },
};
type Token = {
  id: string;
  name: string;
  scopes: string[];
  expires: number;
  created_at: string;
  last_used_at: string | null;
};
export function McpIntegrations({
  locale,
  admin,
}: {
  locale: Locale;
  admin: boolean;
}) {
  const t = copy[locale];
  const [tokens, setTokens] = useState<Token[]>([]),
    [name, setName] = useState(""),
    [days, setDays] = useState("30"),
    [write, setWrite] = useState(false),
    [manage, setManage] = useState(false),
    [secret, setSecret] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(""),
    [client, setClient] = useState("codex");
  const endpoint = location.origin + "/mcp";
  const asset = `https://github.com/sajadjanat/taskorbit/releases/download/v${version}/taskorbit-mcp-${version}.tgz`;
  const stdio = {
    mcpServers: {
      taskorbit: {
        command: client === "stdio-windows" ? "cmd" : "npx",
        args: [
          ...(client === "stdio-windows" ? ["/c", "npx"] : []),
          "-y",
          `--package=${asset}`,
          "taskorbit-mcp",
        ],
        env: {
          TASKORBIT_SERVER: location.origin,
          TASKORBIT_TOKEN: "YOUR_TOKEN",
        },
      },
    },
  };
  const config =
    client === "codex"
      ? `[mcp_servers.taskorbit]\nurl = "${endpoint}"\nbearer_token_env_var = "TASKORBIT_TOKEN"`
      : client === "cursor"
        ? JSON.stringify(
            {
              mcpServers: {
                taskorbit: {
                  url: endpoint,
                  headers: { Authorization: "Bearer ${env:TASKORBIT_TOKEN}" },
                },
              },
            },
            null,
            2,
          )
        : client === "claude"
          ? JSON.stringify(
              {
                mcpServers: {
                  taskorbit: {
                    type: "http",
                    url: endpoint,
                    headers: { Authorization: "Bearer ${TASKORBIT_TOKEN}" },
                  },
                },
              },
              null,
              2,
            )
          : JSON.stringify(stdio, null, 2);
  const guide = `https://github.com/sajadjanat/taskorbit/blob/main/docs/MCP${locale === "en" ? "" : locale === "zh-CN" ? ".zh-CN" : "." + locale}.md`;
  async function load() {
    setTokens(await api<Token[]>("/me/tokens"));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setError(t.copy + ": select and copy the text manually.");
    }
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSecret("");
    try {
      const result = await api<{ token: string }>("/me/tokens", "POST", {
        name,
        days: Number(days),
        write,
        admin: manage,
      });
      setSecret(result.token);
      setName("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    if (!window.confirm(t.confirm)) return;
    setBusy(true);
    try {
      await api(`/me/tokens/${id}`, "DELETE");
      setSecret("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel mcp-panel">
      <h2>
        <Plug size={20} />
        {t.title}
      </h2>
      <p className="muted">{t.intro}</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <h3>{t.step1}</h3>
      <form onSubmit={create} className="mcp-token-form">
        <div>
          <Label htmlFor="mcp-name">{t.name}</Label>
          <Input
            id="mcp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            placeholder="My agent"
          />
        </div>
        <div>
          <Label htmlFor="mcp-days">{t.days}</Label>
          <Input
            id="mcp-days"
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            required
          />
        </div>
        <label className="mcp-check">
          <input
            type="checkbox"
            checked={write}
            onChange={(e) => setWrite(e.target.checked)}
          />
          {t.write}
        </label>
        {admin && (
          <label className="mcp-check">
            <input
              type="checkbox"
              checked={manage}
              onChange={(e) => setManage(e.target.checked)}
            />
            {t.admin}
          </label>
        )}
        <p className="muted">{t.scope}</p>
        <Button type="submit" disabled={busy}>
          <KeyRound size={16} />
          {t.create}
        </Button>
      </form>
      {secret && (
        <div className="mcp-secret" role="status">
          <p>{t.once}</p>
          <Input
            aria-label="MCP token"
            value={secret}
            readOnly
            autoComplete="off"
            dir="ltr"
          />
          <div className="mcp-actions">
            <Button
              onClick={() => void copyText(secret, "token")}
              variant="outline"
            >
              <Copy size={15} />
              {copied === "token" ? t.copied : t.copy}
            </Button>
            <Button onClick={() => setSecret("")} variant="ghost">
              {t.hide}
            </Button>
          </div>
        </div>
      )}
      <h3>{t.step2}</h3>
      <Label htmlFor="mcp-client">{t.client}</Label>
      <select
        id="mcp-client"
        value={client}
        onChange={(e) => {
          setClient(e.target.value);
          setCopied("");
        }}
      >
        <option value="codex">Codex · ~/.codex/config.toml</option>
        <option value="cursor">Cursor · ~/.cursor/mcp.json</option>
        <option value="claude">Claude Code · ~/.claude.json / .mcp.json</option>
        <option value="stdio">Claude Desktop / stdio · macOS / Linux</option>
        <option value="stdio-windows">Claude Desktop / stdio · Windows</option>
      </select>
      <p className="muted">{client.startsWith("stdio") ? t.stdio : t.hint}</p>
      <div className="mcp-code">
        <pre dir="ltr" tabIndex={0}>
          {config}
        </pre>
        <Button
          onClick={() => void copyText(config, "config")}
          variant="outline"
        >
          <Copy size={15} />
          {copied === "config" ? t.copied : t.copy}
        </Button>
      </div>
      <Label>{t.endpoint}</Label>
      <div className="mcp-endpoint">
        <code dir="ltr">{endpoint}</code>
        <Button
          variant="ghost"
          onClick={() => void copyText(endpoint, "endpoint")}
          aria-label={t.copy + " MCP URL"}
        >
          <Copy size={16} />
        </Button>
      </div>
      <h3>{t.step3}</h3>
      <p>{t.verify}</p>
      <p className="muted">{t.trouble}</p>
      <a href={guide} target="_blank" rel="noreferrer">
        {t.guide} ↗
      </a>
      <h3>{t.tokens}</h3>
      {!tokens.length ? (
        <p className="muted">{t.empty}</p>
      ) : (
        <ul className="mcp-token-list">
          {tokens.map((token) => (
            <li key={token.id}>
              <div>
                <strong>{token.name}</strong>
                <small>
                  {token.scopes
                    .map((s) =>
                      s === "read"
                        ? t.read
                        : s === "write"
                          ? t.writeLabel
                          : t.adminLabel,
                    )
                    .join(" · ")}{" "}
                  · {new Date(token.expires).toLocaleDateString(locale)}
                  {token.expires < Date.now() ? ` · ${t.expired}` : ""}
                </small>
              </div>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void revoke(token.id)}
                aria-label={`${t.revoke} ${token.name}`}
              >
                <Trash2 size={16} />
                {t.revoke}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
