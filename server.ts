import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const isServerlessEnvironment = !!(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.NOW_REGION
);

const CONFIG_FILE = isServerlessEnvironment
  ? path.join("/tmp", ".saved_monday_config.json")
  : path.join(process.cwd(), ".saved_monday_config.json");

// SECURITY: API keys are now loaded from environment variables only
// DO NOT hardcode secrets in source code
const ALLOWED_ORIGINS = [
  // Production
  'https://typetheta-monday-dashboard.netlify.app',
  process.env.NETLIFY_URL,
  process.env.FRONTEND_URL,
  // Development
  'http://localhost:5173',  // Vite dev server
  'http://localhost:3000'   // Local dev
].filter(Boolean);

// SECURITY: Config stored only in environment variables (no disk writes)
// This prevents accidental credential exposure in source control

function getSavedConfig() {
  // Return environment variables only - no file-based storage
  const envConfig = {
    apiKey: process.env.MONDAY_API_KEY,
    boardId: process.env.MONDAY_BOARD_ID,
    isFixed: true,
    updatedAt: new Date().toISOString()
  };
  return envConfig;
}

function resolveApiKey(rawKey?: any): string {
  const saved = getSavedConfig();
  if (
    !rawKey ||
    typeof rawKey !== "string" ||
    !rawKey.trim() ||
    rawKey === "null" ||
    rawKey === "undefined" ||
    rawKey.includes("•") ||
    rawKey.includes("\u2022") ||
    /[^\x00-\x7F]/.test(rawKey)
  ) {
    return saved?.apiKey || process.env.MONDAY_API_KEY || "";
  }
  return rawKey.trim();
}

function resolveBoardId(rawBoardId?: any): string {
  const saved = getSavedConfig();
  if (
    !rawBoardId ||
    typeof rawBoardId !== "string" ||
    !rawBoardId.trim() ||
    rawBoardId === "null" ||
    rawBoardId === "undefined"
  ) {
    return saved?.boardId || process.env.MONDAY_BOARD_ID || "";
  }
  return rawBoardId.trim();
}

function saveConfigToFile(apiKey: string, boardId: string, isFixed: boolean = true) {
  // SECURITY: Disabled disk-based config storage
  // Use environment variables instead via deployment platform (Render, Netlify, etc)
  console.warn("[SECURITY] Config persistence disabled. Please set MONDAY_API_KEY and MONDAY_BOARD_ID as environment variables.");
  return false;
}

export const app = express();
const PORT = 3000;

app.disable("x-powered-by");

// Serverless URL Normalization Middleware
app.use((req, res, next) => {
  const forwardedUri = (req.headers["x-forwarded-uri"] || req.headers["x-original-url"]) as string;

  if (forwardedUri && typeof forwardedUri === "string" && !forwardedUri.includes("index.ts") && !forwardedUri.includes("index.js")) {
    req.url = forwardedUri;
  } else if (req.url && (req.url.startsWith("/api/index.ts") || req.url.startsWith("/api/index.js") || req.url.startsWith("/api/index"))) {
    req.url = req.url.replace(/^\/api\/index(\.ts|\.js)?/, "/api");
    if (!req.url || req.url === "/api/index.ts" || req.url === "/api/index") {
      req.url = "/api";
    }
  }
  next();
});

// Global Security & CORS Headers Middleware
app.use((req, res, next) => {
  // SECURITY: Updated CSP to remove unsafe-inline and unsafe-eval
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://apis.google.com https://*.googleapis.com https://*.gstatic.com https://www.gstatic.com https://*.firebaseio.com https://*.firebaseapp.com; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https: https://cdn1.monday.com https://files.monday.com https://task-manager-pro.monday.com https://api.qrserver.com https://lh3.googleusercontent.com; connect-src 'self' https://api.monday.com https://*.firebaseio.com https://*.firebaseapp.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://*.firebaseio.com; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com; frame-ancestors 'self' https://*.google.com https://*.ai.studio https://*.run.app;"
  );
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  
  // SECURITY: Whitelist CORS origins instead of accepting all
  const origin = req.headers.origin as string;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Body Parsing Middleware (safely handles pre-parsed Vercel serverless bodies and standard Express)
app.use((req, res, next) => {
  if (req.body !== undefined && req.body !== null && typeof req.body === "object") {
    return next();
  }
  if (typeof req.body === "string" && req.body.trim().startsWith("{")) {
    try {
      req.body = JSON.parse(req.body);
      return next();
    } catch (e) {
      // ignore
    }
  }
  express.json({ limit: "10mb" })(req, res, next);
});

let aiInstance: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Router for API endpoints
const router = express.Router();

// GET /monday/config
router.get("/monday/config", (req, res) => {
  try {
    const saved = getSavedConfig();
    const envKey = process.env.MONDAY_API_KEY;
    const envBoard = process.env.MONDAY_BOARD_ID;
    
    const hasPermanentConfig = !!(envKey && envBoard) || !!(saved?.apiKey && saved?.boardId && saved?.isFixed);
    const boardId = envBoard || saved?.boardId || "";
    const isFixed = saved?.isFixed || false;

    res.json({
      hasPermanentConfig,
      boardId,
      isFixed,
      apiKey: saved?.apiKey ? "••••••••" + saved.apiKey.slice(-4) : (envKey ? "••••••••" + envKey.slice(-4) : "")
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load config", details: err.message });
  }
});

// POST /monday/save-config
router.post("/monday/save-config", (req, res) => {
  try {
    const body = req.body || {};
    const { apiKey, boardId, isFixed = true } = body;
    if (!apiKey || !boardId) {
      return res.status(400).json({ error: "API Key and Board ID are required to save fixed configuration." });
    }
    const success = saveConfigToFile(apiKey, boardId, isFixed);
    if (success) {
      res.json({ success: true, message: "Credentials permanently saved to server storage." });
    } else {
      res.status(500).json({ error: "Failed to persist credentials to server disk." });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save config", details: err.message });
  }
});

// POST /monday/clear-config
router.post("/monday/clear-config", (req, res) => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
    res.json({ success: true, message: "Server-saved credentials cleared." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to clear saved credentials.", details: err.message });
  }
});

// POST /monday/fetch
router.post("/monday/fetch", async (req, res) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const body = req.body || {};
    const apiKey = resolveApiKey(body.apiKey);
    const boardId = resolveBoardId(body.boardId);

    if (!apiKey) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: "API Key is required. Please set MONDAY_API_KEY on the server or provide it in the UI." });
    }
    if (!boardId) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: "Board ID is required. Please set MONDAY_BOARD_ID on the server or provide it in the UI." });
    }

    const query = `
      query ($boardIds: [ID!]) {
        boards(ids: $boardIds) {
          id
          name
          columns {
            id
            title
            type
          }
          items_page(limit: 50) {
            items {
              id
              name
              group {
                id
                title
              }
              column_values {
                id
                text
                value
              }
              updates(limit: 3) {
                id
                body
                created_at
                creator {
                  id
                  name
                  photo_thumb
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey,
        "API-Version": "2024-01"
      },
      body: JSON.stringify({
        query,
        variables: {
          boardIds: [boardId]
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch (err) {
      return res.status(response.status || 500).json({
        error: `Monday.com API returned non-JSON response (Status ${response.status})`,
        details: responseText.slice(0, 200)
      });
    }

    if (!response.ok) {
      let errorMessage = `Monday.com API responded with status ${response.status}`;
      if (response.status === 401) {
        errorMessage = "Monday.com API responded with status 401. The provided Monday API key is invalid or expired. Please update your API Key in Connection Settings or switch to Interactive Demo Mode.";
      }
      return res.status(response.status).json({
        error: errorMessage,
        details: result?.error_message || result?.errors || responseText.slice(0, 200)
      });
    }

    if (result.errors) {
      const errorDetails = Array.isArray(result.errors) 
        ? result.errors.map((e: any) => e.message || JSON.stringify(e)).join("; ") 
        : JSON.stringify(result.errors);
      const isAuthError = errorDetails.toLowerCase().includes("not authenticated") || 
                          errorDetails.toLowerCase().includes("invalid token") || 
                          errorDetails.toLowerCase().includes("unauthorized");

      return res.status(isAuthError ? 401 : 400).json({
        error: isAuthError 
          ? "Monday.com API responded with status 401. The provided Monday API key is invalid or expired." 
          : "Monday.com GraphQL Errors",
        details: result.errors
      });
    }

    const board = result.data?.boards?.[0];
    if (!board) {
      return res.status(404).json({ error: "Board not found. Please check your Board ID." });
    }

    res.json({ board });
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("Error fetching Monday data:", error);
    const isTimeout = error.name === "AbortError";
    res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? "Monday.com API request timed out" : "Internal Server Error",
      details: error.message
    });
  }
});

// POST /monday/comment
router.post("/monday/comment", async (req, res) => {
  try {
    const body = req.body || {};
    const apiKey = resolveApiKey(body.apiKey);
    const itemId = body.itemId;
    const commentText = body.commentText;

    if (!apiKey) {
      return res.status(400).json({ error: "API Key is required. Please set MONDAY_API_KEY on the server or provide it in the UI." });
    }
    if (!itemId) {
      return res.status(400).json({ error: "Item ID is required" });
    }
    if (!commentText) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const query = `
      mutation ($itemId: ID!, $body: String!) {
        create_update (item_id: $itemId, body: $body) {
          id
        }
      }
    `;

    const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey,
        "API-Version": "2024-01"
      },
      body: JSON.stringify({
        query,
        variables: {
          itemId: itemId,
          body: commentText
        }
      })
    });

    const responseText = await response.text();
    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch (err) {
      return res.status(response.status || 500).json({
        error: `Monday.com API returned non-JSON response (Status ${response.status})`,
        details: responseText.slice(0, 200)
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Monday.com API responded with status ${response.status}`,
        details: result?.error_message || result?.errors || responseText.slice(0, 200)
      });
    }

    if (result.errors) {
      return res.status(400).json({
        error: "Monday.com GraphQL Errors",
        details: result.errors
      });
    }

    res.json({ success: true, update: result.data?.create_update });
  } catch (error: any) {
    console.error("Error creating Monday comment:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// POST /gemini/draft
router.post("/gemini/draft", async (req, res) => {
  try {
    const body = req.body || {};
    const { sender, subject, projectName, projectStatus } = body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: "Gemini API key is not configured in the workspace settings. Please set GEMINI_API_KEY."
      });
    }

    const prompt = `You are an expert Project Manager replying to a client stakeholder email.
Project Name: ${projectName}
Current Status: ${projectStatus}
Email From: ${sender}
Email Subject: ${subject}

Draft a professional, polite, reassuring, and solution-oriented response to this email. 
Acknowledge the email, indicate that we are actively addressing their points, and provide a clear, supportive next step. Keep the draft extremely concise (under 75 words) so it is punchy and directly usable as a reply. Start with standard business greeting and sign off as "Project Desk Team". No brackets or placeholders.`;

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(400).json({ error: "Gemini API key is not configured." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ draft: response.text?.trim() });
  } catch (error: any) {
    console.error("Gemini draft generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate draft" });
  }
});

// POST /gemini/summary
router.post("/gemini/summary", async (req, res) => {
  try {
    const body = req.body || {};
    const { project } = body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: "Gemini API key is not configured in the workspace settings. Please set GEMINI_API_KEY."
      });
    }

    if (!project) {
      return res.status(400).json({ error: "Project details are required" });
    }

    const prompt = `Perform an intelligent, realistic project health analysis and generate a concise executive summary and actionable steps for:
Project Name: ${project.name}
Status: ${project.status}
Lead Manager: ${project.manager?.name || "Unassigned"}
Client Due Date: ${project.dueDate || "N/A"}
Internal Target Date: ${project.internalDueDate || "N/A"}
Overdue Status: Client Overdue = ${!!project.isOverdue}, Internal Overdue = ${!!project.isInternalOverdue}

Recent Board Updates:
${(project.updates || []).map((u: any) => `- [${u.created_at}] ${u.creator?.name}: ${u.body}`).join("\n")}

Unresponded Client Emails:
${(project.emails || []).filter((e: any) => !e.isResponded).map((e: any) => `- From: ${e.sender}, Subject: ${e.subject}, Received: ${e.receivedAt}`).join("\n")}

Format your response as clean Markdown with:
1. **Executive Status Summary** (2-3 concise sentences detailing status and bottlenecks)
2. **Key Risk Factors** (2-3 bullet points on critical deadlines, SLA breaches, or communication gaps)
3. **Immediate Action Plan** (2-3 highly actionable bullet points prioritizing next steps for the PM)

Keep it highly professional, scannable, objective, and do not use flowery or dramatic language. Keep the total response brief.`;

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(400).json({ error: "Gemini API key is not configured." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ summary: response.text?.trim() });
  } catch (error: any) {
    console.error("Gemini summary generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate summary" });
  }
});

// POST /monday/writeback
router.post("/monday/writeback", async (req, res) => {
  try {
    const body = req.body || {};
    const apiKey = resolveApiKey(body.apiKey);
    const boardId = resolveBoardId(body.boardId);
    const itemId = body.itemId;
    const columnId = body.columnId;
    const columnType = body.columnType;
    const newValue = body.newValue;

    if (!apiKey) {
      return res.status(400).json({ error: "API Key is required. Please set MONDAY_API_KEY on the server or provide it in the UI." });
    }
    if (!boardId) {
      return res.status(400).json({ error: "Board ID is required. Please set MONDAY_BOARD_ID on the server or provide it in the UI." });
    }
    if (!itemId || !columnId) {
      return res.status(400).json({ error: "Item ID and Column ID are required" });
    }

    let valueStr = "";
    if (columnType === "status") {
      valueStr = JSON.stringify({ label: newValue });
    } else if (columnType === "date") {
      valueStr = JSON.stringify({ date: newValue });
    } else {
      valueStr = JSON.stringify({ value: newValue });
    }

    const query = `
      mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: String!) {
        change_column_value (board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) {
          id
        }
      }
    `;

    const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey,
        "API-Version": "2024-01"
      },
      body: JSON.stringify({
        query,
        variables: {
          boardId,
          itemId,
          columnId,
          value: valueStr
        }
      })
    });

    const responseText = await response.text();
    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch (err) {
      return res.status(response.status || 500).json({
        error: `Monday.com API returned non-JSON response (Status ${response.status})`,
        details: responseText.slice(0, 200)
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Monday.com API responded with status ${response.status}`,
        details: result?.error_message || result?.errors || responseText.slice(0, 200)
      });
    }

    if (result.errors) {
      return res.status(400).json({
        error: "Monday.com GraphQL Errors",
        details: result.errors
      });
    }

    res.json({ success: true, change: result.data?.change_column_value });
  } catch (error: any) {
    console.error("Error writing back to Monday:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// Mount router under BOTH /api and / so all serverless routing variations match
app.use("/api", router);
app.use("/", router);

// Fallback 404 Handler for Unmatched API Endpoints only
app.use("/api", (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl || req.url}` });
});

// Global Express Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled express server error:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    error: "Internal Server Error",
    details: err?.message || "An unexpected error occurred."
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

const isDirectRun = Boolean(
  process.argv[1] && (
    process.argv[1].endsWith("server.ts") ||
    process.argv[1].endsWith("server.cjs") ||
    process.argv[1].endsWith("server.js")
  )
);

if (isDirectRun && !isServerlessEnvironment && process.env.LISTEN_SERVER !== "false") {
  startServer();
}

export default app;
