import React, { useState } from 'react';
import { Settings as SettingsType } from '../types';
import { Mail, Save, Calendar, Globe, Server, ShieldCheck } from 'lucide-react';

interface SettingsFormProps {
  initialSettings: SettingsType;
  onSave: (settings: SettingsType) => Promise<void>;
}

export const SettingsForm: React.FC<SettingsFormProps> = ({ initialSettings, onSave }) => {
  const [formData, setFormData] = useState<SettingsType>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<'success' | 'error' | null>(null);
  const [smtpTestMessage, setSmtpTestMessage] = useState<string | null>(null);

  const handleTestSmtp = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submit
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    setSmtpTestMessage(null);

    try {
      const response = await fetch('/api/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: formData.smtpHost,
          smtpPort: formData.smtpPort,
          smtpUser: formData.smtpUser,
          smtpPass: formData.smtpPass
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSmtpTestResult('success');
        setSmtpTestMessage(data.message || 'SMTP Connection established successfully!');
      } else {
        setSmtpTestResult('error');
        setSmtpTestMessage(data.error || 'Failed to authenticate with SMTP server.');
      }
    } catch (err: any) {
      setSmtpTestResult('error');
      setSmtpTestMessage(err.message || String(err));
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSave(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* Target Recipient & Automation State */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:border-indigo-100 transition-all">
        <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
          <Mail className="w-4 h-4 text-indigo-600" />
          Digest Dispatch & Schedule
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Recipient Target Email</label>
            <input
              type="email"
              name="targetEmail"
              required
              value={formData.targetEmail}
              onChange={handleChange}
              placeholder="e.g. your-email@domain.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Top trending repositories processed via Gemini will be sent here daily.
            </p>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="space-y-0.5">
              <span className="block text-xs font-semibold text-slate-700">Daily Automated Digests</span>
              <span className="block text-[11px] text-slate-400">Dispatch summaries automatically on the set schedule</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="notifyEnabled"
                checked={formData.notifyEnabled}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {formData.notifyEnabled && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Schedule Hour (UTC)</label>
                <select
                  name="scheduleHour"
                  value={formData.scheduleHour}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h}>
                      {h.toString().padStart(2, '0')}:00 ({h === 12 ? '12 PM' : h === 0 ? '12 AM' : h > 12 ? `${h - 12} PM` : `${h} AM`})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Schedule Minute (UTC)</label>
                <select
                  name="scheduleMinute"
                  value={formData.scheduleMinute}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                    <option key={m} value={m}>
                      {m.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GitHub Repository Filter Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:border-indigo-100 transition-all">
        <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-600" />
          GitHub Filter Criteria
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Coding Language</label>
            <select
              name="githubLanguage"
              value={formData.githubLanguage}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="all">All Languages</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Minimum Repository Stars</label>
            <input
              type="number"
              name="minStars"
              min="0"
              value={formData.minStars}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Repository Sorting Index</label>
            <select
              name="githubSort"
              value={formData.githubSort}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="stars">Standard Stars Index</option>
              <option value="updated">Recently Updated Index</option>
            </select>
          </div>
        </div>
      </div>

      {/* SMTP Option Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:border-indigo-100 transition-all">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-600" />
            SMTP Outbound Relay (Optional)
          </h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="useSmtp"
              checked={formData.useSmtp}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {formData.useSmtp ? (
          <div className="space-y-4 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">SMTP Host Address</label>
                <input
                  type="text"
                  name="smtpHost"
                  required={formData.useSmtp}
                  value={formData.smtpHost}
                  onChange={handleChange}
                  placeholder="smtp.gmail.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">SMTP Port</label>
                <input
                  type="number"
                  name="smtpPort"
                  required={formData.useSmtp}
                  value={formData.smtpPort}
                  onChange={handleChange}
                  placeholder="587"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">SMTP Username</label>
                <input
                  type="text"
                  name="smtpUser"
                  required={formData.useSmtp}
                  value={formData.smtpUser}
                  onChange={handleChange}
                  placeholder="user@gmail.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">SMTP Password / App Password</label>
                <input
                  type="password"
                  name="smtpPass"
                  required={formData.useSmtp}
                  value={formData.smtpPass}
                  onChange={handleChange}
                  placeholder="••••••••••••••••"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Sender Email (From Header)</label>
              <input
                type="email"
                name="smtpFrom"
                required={formData.useSmtp}
                value={formData.smtpFrom}
                onChange={handleChange}
                placeholder="gitpulse-trends@yourdomain.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500 max-w-[70%]">
                  Verify your SMTP host, port, username, and password before saving. 
                  {formData.smtpHost?.includes('gmail.com') && (
                    <strong className="text-amber-600 block mt-0.5 font-medium">
                      Note: Gmail requires a 16-character Google App Password (not your primary password).
                    </strong>
                  )}
                </span>
                <button
                  type="button"
                  disabled={isTestingSmtp}
                  onClick={handleTestSmtp}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50 transition-all flex items-center gap-1.5 self-start cursor-pointer"
                >
                  {isTestingSmtp ? (
                    <>
                      <span className="inline-block w-3 h-3 hover:translate-x-0 border-2 border-indigo-700 border-t-transparent rounded-full animate-spin"></span>
                      Testing Connection...
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </button>
              </div>

              {smtpTestResult === 'success' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <span>✓ Connection Verified Successfully!</span>
                  </p>
                  <p className="text-emerald-600 font-normal">
                    {smtpTestMessage}
                  </p>
                </div>
              )}

              {smtpTestResult === 'error' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium space-y-1.5">
                  <p className="font-semibold">⚠️ Verification Failed:</p>
                  <div className="bg-white p-2 rounded border border-rose-100 text-slate-700 font-mono text-[11px] overflow-x-auto max-h-24">
                    {smtpTestMessage}
                  </div>
                  <div className="text-slate-600 font-normal mt-1 leading-relaxed text-[11px]">
                    <span className="font-semibold block mb-0.5 text-rose-700">How to fix this:</span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Ensure 2-Step Verification is enabled in your Google Account.</li>
                      <li>Generate a temporary <strong className="text-slate-800">16-character App Password</strong> under <strong className="text-slate-800">Google Account Profile &gt; Security &gt; App Passwords</strong>.</li>
                      <li>The SMTP Username must match the Google Account that generated the App Password.</li>
                      <li>Double-check there are no spaces or typos in the password.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3.5 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center gap-2 text-slate-500 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>Simulated Delivery Enabled: Email alerts are processed and written directly to the <strong>Logs/Digest Inbox</strong> history feed for instant viewing. No SMTP configs are required.</span>
          </div>
        )}
      </div>

      {/* Save Trigger Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {saveSuccess && (
          <span className="text-xs font-semibold text-green-600 animate-pulse">
            ✓ Settings Saved Successfully!
          </span>
        )}
        
        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving Settings..." : "Save Settings"}
        </button>
      </div>
    </form>
  );
};
