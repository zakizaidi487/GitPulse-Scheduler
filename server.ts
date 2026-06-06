import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Path to JSON persistence database
const DB_PATH = path.join(__dirname, 'db_mock.json');

// Interface representation
interface Settings {
  targetEmail: string;
  notifyEnabled: boolean;
  scheduleHour: number;
  scheduleMinute: number;
  githubLanguage: string;
  githubSort: 'stars' | 'updated';
  minStars: number;
  useSmtp: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}

interface Repository {
  id: string;
  name: string;
  owner: string;
  description: string;
  stars: number;
  forks: number;
  language: string;
  htmlUrl: string;
  updatedAt: string;
  aiSummary?: string;
}

interface DigestLog {
  id: string;
  timestamp: string;
  success: boolean;
  recipient: string;
  deliveryMethod: 'simulated' | 'smtp';
  repositories: Repository[];
  emailSubject: string;
  emailBodyHtml: string;
  errorMessage?: string;
}

// Initial default configuration settings
const DEFAULT_SETTINGS: Settings = {
  targetEmail: 'zaki@farmatrust.com',
  notifyEnabled: true,
  scheduleHour: 8,
  scheduleMinute: 0,
  githubLanguage: 'all',
  githubSort: 'stars',
  minStars: 100,
  useSmtp: true,
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  smtpUser: 'engr.zaki.zaidi@gmail.com',
  smtpPass: '',
  smtpFrom: 'engr.zaki.zaidi@gmail.com'
};

// Database reader and writer helpers
function readDb(): { settings: Settings; logs: DigestLog[] } {
  try {
    let result: { settings: Settings; logs: DigestLog[] };
    if (!fs.existsSync(DB_PATH)) {
      // Create initial settings from defaults
      const initialSettings = { ...DEFAULT_SETTINGS };

      // Overlay environment variables with auto-healing mapping for first-time boot
      if (process.env.TARGET_EMAIL) initialSettings.targetEmail = process.env.TARGET_EMAIL;

      let parsedUseSmtp = false;
      let fallbackPass: string | null = null;

      if (process.env.USE_SMTP) {
        const val = process.env.USE_SMTP.trim();
        if (val === 'true') {
          parsedUseSmtp = true;
        } else if (val.includes(' ') && val.length >= 15) {
          // Misplaced Google App Password like "xxxx xxxx xxxx xxxx" mapped to USE_SMTP in environment
          parsedUseSmtp = true;
          fallbackPass = val;
        }
      }

      initialSettings.useSmtp = parsedUseSmtp;

      if (process.env.SMTP_HOST) initialSettings.smtpHost = process.env.SMTP_HOST;
      if (process.env.SMTP_PORT) initialSettings.smtpPort = parseInt(process.env.SMTP_PORT) || 587;
      if (process.env.SMTP_USER) initialSettings.smtpUser = process.env.SMTP_USER;

      if (fallbackPass) {
        initialSettings.smtpPass = fallbackPass;
      } else if (process.env.SMTP_PASS) {
        initialSettings.smtpPass = process.env.SMTP_PASS;
      }

      if (process.env.SMTP_FROM) initialSettings.smtpFrom = process.env.SMTP_FROM;

      result = { settings: initialSettings, logs: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(result, null, 2), 'utf-8');
    } else {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      result = JSON.parse(data);
    }

    return result;
  } catch (err) {
    console.error('Error reading mock DB. Returning defaults.', err);
    return { settings: DEFAULT_SETTINGS, logs: [] };
  }
}

function writeDb(settings: Settings, logs: DigestLog[]) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify({ settings, logs }, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing to mock DB', err);
  }
}

let { settings, logs } = readDb();

// Active cron schedules
let activeCronJob: any = null;

// Initialize Gemini Client
let geminiClient: GoogleGenAI | null = null;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

if (GEMINI_KEY) {
  try {
    geminiClient = new GoogleGenAI({ apiKey: GEMINI_KEY });
    console.log('Gemini client initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Gemini Client', err);
  }
} else {
  console.warn('Warning: GEMINI_API_KEY environment variable is not defined. AI summarization is suspended.');
}

// Scrape trend data from GitHub Search API based on filters
async function fetchTrendingRepositories(lang: string, sort: 'stars' | 'updated', minStars: number): Promise<Repository[]> {
  try {
    let query = `stars:>=${minStars}`;
    if (lang && lang !== 'all') {
      query += `+language:${lang}`;
    }

    const sortParam = sort === 'stars' ? 'stars' : 'updated';
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=${sortParam}&order=desc&per_page=10`;

    console.log(`Searching GitHub api with query url: ${url}`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'GitPulse-Scheduler-App'
      }
    });

    if (!res.ok) {
      throw new Error(`GitHub Api yielded ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const items = data.items || [];

    return items.map((item: any) => ({
      id: String(item.id),
      name: item.name,
      owner: item.owner?.login || 'unknown',
      description: item.description || 'No description provided.',
      stars: item.stargazers_count,
      forks: item.forks_count,
      language: item.language || 'Plain Text',
      htmlUrl: item.html_url,
      updatedAt: item.updated_at
    }));
  } catch (err) {
    console.error('Error fetching trending repos:', err);
    throw err;
  }
}

// Compile layout summary using Gemini model in a single batched request
async function generateSummaries(repos: Repository[]): Promise<Repository[]> {
  if (!geminiClient) {
    console.warn('Gemini client unavailable. Skipping AI summary generation.');
    return repos.map(r => ({ ...r, aiSummary: 'AI Summaries are unavailable because GEMINI_API_KEY is not defined.' }));
  }

  if (repos.length === 0) {
    return repos;
  }

  try {
    const model = 'gemini-3.5-flash';
    const batchInput = repos.map(r => ({
      id: r.id,
      name: `${r.owner}/${r.name}`,
      description: r.description,
      language: r.language
    }));

    const prompt = `You are a professional tech scout and software curator.
Analyze the following list of trending GitHub repositories. For each repository, provide an elegant, high-impact description (3-4 sentences max) explaining what the project is, its key functional advantages, and its primary target audience.
Keep your tone sophisticated and engaging. Use clean, professional formatting.

Here is the JSON list of repositories:
${JSON.stringify(batchInput, null, 2)}

You MUST return a JSON array of objects, containing the dynamic summaries mapped by "id".
Each object in the returned array must match this schema:
{
  "id": "string matched exactly from the input",
  "summary": "the high-impact layperson summary paragraph"
}`;

    const response = await geminiClient.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              id: { type: 'STRING' },
              summary: { type: 'STRING' }
            },
            required: ['id', 'summary']
          }
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Empty output returned from Gemini API.');
    }

    const summariesList = JSON.parse(responseText) as Array<{ id: string; summary: string }>;
    const summaryMap = new Map(summariesList.map(item => [item.id, item.summary]));

    return repos.map(repo => ({
      ...repo,
      aiSummary: summaryMap.get(repo.id) || 'Gemini summary could not be matched for this project.'
    }));

  } catch (err: any) {
    console.error('Batch summary generation failed, falling back to descriptions:', err);
    // Graceful fallback for each repository if the batch call fails
    return repos.map(repo => ({
      ...repo,
      aiSummary: repo.description || 'No description provided.'
    }));
  }
}

// Generate the beautiful HTML newsletter body
function createDigestHtml(repos: Repository[], recipient: string, dateStr: string): { subject: string; body: string } {
  const subject = `GitPulse: Custom Daily Trends Digest — ${dateStr}`;
  
  let listHtml = '';
  repos.forEach((repo) => {
    listHtml += `
      <div style="margin-bottom: 24px; padding: 20px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #1e1b4b;">
            <a href="${repo.htmlUrl}" target="_blank" style="color: #4f46e5; text-decoration: none;">${repo.owner}/${repo.name}</a>
          </h3>
          <span style="font-size: 11px; font-weight: 600; padding: 4px 8px; background-color: #eef2ff; color: #4f46e5; border-radius: 6px; text-transform: uppercase;">${repo.language}</span>
        </div>
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b; line-height: 1.5; font-style: italic;">"${repo.description}"</p>
        
        <div style="padding: 12px; background-color: #f8fafc; border-left: 4px solid #6366f1; border-top-right-radius: 6px; border-bottom-right-radius: 6px; margin-bottom: 12px;">
          <strong style="display: block; font-size: 11px; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Gemini AI Summary:</strong>
          <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.6;">${repo.aiSummary || 'AI Summary absent.'}</p>
        </div>

        <div style="font-size: 12px; color: #94a3b8; font-weight: 500;">
          <span>★ <strong>${repo.stars.toLocaleString()}</strong> stars</span>
          <span style="margin: 0 8px;">•</span>
          <span>⑂ <strong>${repo.forks.toLocaleString()}</strong> forks</span>
        </div>
      </div>
    `;
  });

  const body = `
    <!DOCTYPE html>
    <html>
      <body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);">
          <!-- Banner Header -->
          <div style="padding: 32px 24px; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); text-align: center; color: #ffffff;">
            <div style="display: inline-block; padding: 6px 12px; background-color: rgba(255,255,255,0.15); border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;">Automated Summary</div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">GitPulse Newsletter</h1>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #e0e7ff;">Dispatched to ${recipient} on ${dateStr}</p>
          </div>

          <!-- Content section -->
          <div style="padding: 24px; background-color: #fdfdfd;">
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
              Hello,<br><br>
              Here is your GitPulse Daily Trending Digest, curating today's top 10 open-source repositories and analyzing them using <strong>Gemini AI</strong>.
            </p>

            ${listHtml}

            <p style="margin: 20px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
              This digest was compiled and sent automatically by GitPulse Scheduler running on Cloud Run.<br>
              To change your schedule or filter criteria, log in to your active workspace dashboard.
            </p>
          </div>

          <div style="background-color: #f1f5f9; padding: 16px; text-align: center; border-t: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
            &copy; 2026 GitPulse Scheduler • Enabled on Local Node Port 3000
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, body };
}

// Dispatch email via node-mailer SMTP or log simulation
async function sendEmail(target: string, subject: string, htmlContent: string, smtpSettings: Settings): Promise<'smtp' | 'simulated'> {
  const isSmtpConfigured = !!(
    smtpSettings.useSmtp &&
    smtpSettings.smtpHost &&
    smtpSettings.smtpUser &&
    smtpSettings.smtpPass
  );

  console.log(`Email Service Triggered: SMTP_Use=${smtpSettings.useSmtp}, SMTP_Host=${smtpSettings.smtpHost}, SMTP_User=${smtpSettings.smtpUser}, Has_Password=${!!smtpSettings.smtpPass}`);

  if (isSmtpConfigured) {
    console.log(`Attempting real SMTP mail dispatch to ${target} via ${smtpSettings.smtpHost}:${smtpSettings.smtpPort}...`);
    
    const transporter = nodemailer.createTransport({
      host: smtpSettings.smtpHost,
      port: smtpSettings.smtpPort,
      secure: smtpSettings.smtpPort === 465, // True for 465, false for 587/25
      auth: {
        user: smtpSettings.smtpUser,
        pass: smtpSettings.smtpPass
      },
      connectionTimeout: 15000, // 15s timeout
      socketTimeout: 20000,     // 20s socket timeout
      greetingTimeout: 15000,   // 15s greeting timeout
      tls: {
        rejectUnauthorized: false // Handles self-signed certificates or missing intermediate cert chains
      }
    });

    try {
      // Direct verification of SMTP config
      console.log('Verifying SMTP connection credentials...');
      await transporter.verify();
      console.log('SMTP connection established and verified successfully.');

      const mailOptions = {
        from: smtpSettings.smtpFrom || smtpSettings.smtpUser,
        to: target,
        subject: subject,
        html: htmlContent
      };

      console.log(`Sending email message from "${mailOptions.from}" to "${mailOptions.to}"...`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully! MessageId: ${info.messageId}`);
      return 'smtp';
    } catch (err: any) {
      console.error(`CRITICAL: SMTP Transport Failure encountered:`, err);
      throw new Error(`SMTP Dispatch Error: ${err.message || err}`);
    }
  } else {
    console.log(`Email Simulated (Simulated mode). Outbound disabled or credentials incomplete. Target: ${target}`);
    return 'simulated';
  }
}

// Main scheduler job execution framework
async function triggerDigestJob(): Promise<DigestLog> {
  const currentSettings = readDb().settings;
  const currentLogs = readDb().logs;
  
  const timestamp = new Date().toISOString();
  console.log(`Triggering active Cron-job workflow run at ${timestamp}...`);

  let fetched: Repository[] = [];
  try {
    // 1. Fetch
    fetched = await fetchTrendingRepositories(
      currentSettings.githubLanguage,
      currentSettings.githubSort,
      currentSettings.minStars
    );

    // 2. Generate intelligence summaries
    const processed = await generateSummaries(fetched);

    // 3. Format email
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const { subject, body } = createDigestHtml(processed, currentSettings.targetEmail, todayStr);

    // 4. Send
    const method = await sendEmail(currentSettings.targetEmail, subject, body, currentSettings);

    const logItem: DigestLog = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp,
      success: true,
      recipient: currentSettings.targetEmail,
      deliveryMethod: method,
      repositories: processed,
      emailSubject: subject,
      emailBodyHtml: body
    };

    currentLogs.unshift(logItem);
    // Keep a maximum of 50 logs of history
    writeDb(currentSettings, currentLogs.slice(0, 50));
    console.log(`Job executed successfully. Recorded log ID: ${logItem.id}`);
    
    // update state variables
    settings = currentSettings;
    logs = readDb().logs;

    return logItem;
  } catch (err: any) {
    console.error('Job sequence crashed, logging failure.', err);
    const logItem: DigestLog = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp,
      success: false,
      recipient: currentSettings.targetEmail,
      deliveryMethod: currentSettings.useSmtp ? 'smtp' : 'simulated',
      repositories: fetched,
      emailSubject: `GitPulse Job FAILURE: ${err.message || err}`,
      emailBodyHtml: `<p>A runtime failure occurred while executing the automation engine:</p><pre>${err.stack || err}</pre>`,
      errorMessage: err.message || String(err)
    };

    currentLogs.unshift(logItem);
    writeDb(currentSettings, currentLogs.slice(0, 50));
    
    settings = currentSettings;
    logs = readDb().logs;

    return logItem;
  }
}

// Set or reset the node-cron scheduler dynamic runtime cron
function configureAutomationCron() {
  if (activeCronJob) {
    activeCronJob.stop();
    activeCronJob = null;
    console.log('Stopped prior automated cron check.');
  }

  const { settings: currentSettings } = readDb();
  if (currentSettings.notifyEnabled) {
    const cronExpression = `${currentSettings.scheduleMinute} ${currentSettings.scheduleHour} * * *`;
    console.log(`Scheduling node-cron job interval: "${cronExpression}" (UTC)`);
    
    activeCronJob = cron.schedule(cronExpression, async () => {
      console.log('Automated scheduled cron timer triggered!');
      await triggerDigestJob();
    });
  } else {
    console.log('Automated scheduled cron is disabled in options.');
  }
}

// API Endpoints for frontend controls
app.get('/api/config', (req, res) => {
  const data = readDb();
  res.json(data);
});

app.post('/api/config', (req, res) => {
  try {
    const newSettings = req.body as Settings;
    const current = readDb();
    
    // Write new configuration settings
    writeDb(newSettings, current.logs);
    
    // Update local variables
    settings = newSettings;
    
    // Reboot Cron
    configureAutomationCron();
    
    console.log('Configurations applied successfully and scheduler reset.');
    res.json({ success: true, settings: newSettings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/trigger', async (req, res) => {
  try {
    const log = await triggerDigestJob();
    res.json({ success: true, log });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/trending-now', async (req, res) => {
  try {
    const { settings: currentSettings } = readDb();
    const repos = await fetchTrendingRepositories(
      currentSettings.githubLanguage,
      currentSettings.githubSort,
      currentSettings.minStars
    );
    res.json({ success: true, repositories: repos });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/logs', (req, res) => {
  try {
    const current = readDb();
    writeDb(current.settings, []);
    logs = [];
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/test-smtp', async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPass } = req.body;
    console.log(`Manual user SMTP connection test initiated: Host=${smtpHost}, Port=${smtpPort}, User=${smtpUser}`);

    if (!smtpHost || !smtpUser || !smtpPass) {
      return res.status(400).json({ success: false, error: "SMTP host, username, and password are all required for live connection tests." });
    }

    const testTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort) || 587,
      secure: parseInt(smtpPort) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      connectionTimeout: 10000,
      socketTimeout: 15000,
      greetingTimeout: 10000,
      tls: {
        rejectUnauthorized: false
      }
    });

    await testTransporter.verify();
    console.log("Live SMTP test verified successfully.");
    res.json({ success: true, message: "Connection to SMTP server established and authenticated successfully!" });
  } catch (err: any) {
    console.error("Live SMTP connection test failed:", err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Main bootstrapping to run Vite middleware in development
async function startServer() {
  // Initial automation trigger on application startup
  configureAutomationCron();

  if (process.env.NODE_ENV !== 'production') {
    // Dynamic import to avoid loading Vite package in production builds
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('Successfully mounted Vite hot development middleware on Port 3000.');
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      // Fallback
      app.get('*', (req, res) => {
        res.send('GitPulse Dev Server Active. Front-end is compiling via Vite.');
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GitPulse Active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
