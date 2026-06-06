import { useState, useEffect } from 'react';
import {
  Github,
  Clock,
  Calendar,
  Mail,
  Layers,
  Compass,
  History,
  Settings as SettingsIcon,
  RefreshCw,
  ExternalLink,
  Play,
  Trash2,
  Inbox,
  ArrowRight,
  Sparkles,
  Server
} from 'lucide-react';
import { Settings, Repository, DigestLog } from './types';
import { SettingsForm } from './components/SettingsForm';
import { MarkdownView } from './components/MarkdownView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'trending' | 'history' | 'settings'>('trending');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [logs, setLogs] = useState<DigestLog[]>([]);
  const [trendingRepos, setTrendingRepos] = useState<Repository[]>([]);
  const [selectedLog, setSelectedLog] = useState<DigestLog | null>(null);
  const [utcTime, setUtcTime] = useState<string>('');
  
  // States for loading/actions
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [triggeringJob, setTriggeringJob] = useState(false);
  const [triggerSuccess, setTriggerSuccess] = useState<string | null>(null);

  // Poll for time updates (UTC Clock)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setUtcTime(now.toUTCString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial configs and logs
  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      if (data.settings) {
        setSettings(data.settings);
      }
      if (data.logs) {
        setLogs(data.logs);
        if (data.logs.length > 0) {
          setSelectedLog(data.logs[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching backend configuration data:', err);
    }
  };

  // Fetch live search repository info
  const fetchTrendingLive = async () => {
    setTrendingLoading(true);
    try {
      const response = await fetch('/api/trending-now');
      const data = await response.json();
      if (data.repositories) {
        setTrendingRepos(data.repositories);
      }
    } catch (err) {
      console.error('Error getting live GitHub indices:', err);
    } finally {
      setTrendingLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchTrendingLive();
  }, []);

  const handleSaveSettings = async (updated: Settings) => {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
        // Refresh live listings since options may have changed
        fetchTrendingLive();
      }
    } catch (err) {
      console.error('Failed to post updated options:', err);
    }
  };

  const handleManualTrigger = async () => {
    setTriggeringJob(true);
    setTriggerSuccess(null);
    try {
      const response = await fetch('/api/trigger', { method: 'POST' });
      const data = await response.json();
      if (data.success && data.log) {
        // Prepend list and select the newest outcome
        const updatedLogs = [data.log, ...logs];
        setLogs(updatedLogs);
        setSelectedLog(data.log);
        setTriggerSuccess('Success! Compiled digest has been written to the Inbox.');
        // Shift tab to logs viewer to show off compilation
        setActiveTab('history');
        setTimeout(() => setTriggerSuccess(null), 5000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTriggeringJob(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear your digest history logs? This is irreversible.')) {
      return;
    }
    try {
      const response = await fetch('/api/logs', { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setLogs([]);
        setSelectedLog(null);
      }
    } catch (err) {
      console.error('Error erasing database history logs:', err);
    }
  };

  // Helper calculating next ETA scheduled check
  const getNextScheduledRun = () => {
    if (!settings || !settings.notifyEnabled) return 'Disabled';
    const now = new Date();
    const nextRun = new Date();
    nextRun.setUTCHours(settings.scheduleHour, settings.scheduleMinute, 0, 0);
    
    if (nextRun.getTime() <= now.getTime()) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }
    
    // Simple ETA countdown
    const diff = nextRun.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `In ${hours}h ${mins}m (Today at ${settings.scheduleHour.toString().padStart(2, '0')}:${settings.scheduleMinute.toString().padStart(2, '0')} UTC)`;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-900 flex flex-col">
      
      {/* Header Navigation from Professional Polish Theme */}
      <nav className="h-16 bg-white border-b border-slate-200 px-6 lg:px-12 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">G</div>
          <span className="text-xl font-bold tracking-tight text-slate-800">
            GitPulse <span className="text-indigo-600">Scheduler</span>
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-semibold">System Active</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-indigo-500 font-bold" />
            <span>UTC: <strong>{utcTime ? utcTime.substring(17, 25) : '...'}</strong></span>
          </div>
        </div>
      </nav>

      {/* Primary Header Segment with custom description */}
      <header className="bg-white border-b border-slate-150 py-5 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-indigo-600">
                <Github className="w-5 h-5" />
              </span>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 uppercase">
                GitHub Intelligence & Automation Summary Control
              </h1>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed font-medium">
              Daily automated scheduler to crawl trending open-source projects, compile summaries with Gemini AI capabilities, and broadcast clean newsletters securely.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchTrendingLive}
              disabled={trendingLoading}
              className="p-2.5 text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 hover:border-indigo-100 font-medium rounded-lg shadow-sm flex items-center justify-center transition-all cursor-pointer"
              title="Refresh Search Indicators"
            >
              <RefreshCw className={`w-4 h-4 ${trendingLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleManualTrigger}
              disabled={triggeringJob}
              className="px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white border border-transparent font-medium text-sm rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {triggeringJob ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Digest...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Force Run Now
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Layout */}
      <main className="max-w-7xl mx-auto px-6 lg:px-12 py-8 flex-1 w-full">
        
        {/* Active Schedule status Summary Box */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-start gap-4 hover:border-indigo-100 transition-all">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hourly Scheduler State</span>
              <span className="block text-sm font-bold text-slate-800">
                {settings?.notifyEnabled 
                  ? `Daily at ${settings.scheduleHour.toString().padStart(2, '0')}:${settings.scheduleMinute.toString().padStart(2, '0')} UTC` 
                  : 'Disabled'}
              </span>
              <span className="text-[11px] text-slate-500 block font-medium">
                Next run: <span className="text-indigo-600 font-semibold">{getNextScheduledRun()}</span>
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-start gap-4 hover:border-indigo-100 transition-all">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Target Recipient</span>
              <span className="block text-sm font-bold text-slate-800 truncate max-w-[210px]" title={settings?.targetEmail}>
                {settings?.targetEmail || "zaki@farmatrust.com"}
              </span>
              <span className="text-[11px] text-slate-500 block font-medium">
                Type: {settings?.useSmtp ? '✓ Real SMTP active' : '✉ Simulated (Logs view)'}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-start gap-4 hover:border-indigo-100 transition-all">
            <div className="p-3 bg-indigo-50 text-indigo-500 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active GitHub Filters</span>
              <span className="block text-sm font-bold text-slate-800">
                {settings?.githubLanguage === 'all' ? 'All Languages font-bold' : settings?.githubLanguage.toUpperCase()}
              </span>
              <span className="text-[11px] text-slate-500 block font-medium">
                Sorting: <span className="text-indigo-600 font-semibold">{settings?.githubSort === 'stars' ? 'Top Stars' : 'Recently Updated'}</span> (min {settings?.minStars.toLocaleString()}★)
              </span>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6 max-w-md border border-slate-200">
          <button
            onClick={() => setActiveTab('trending')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all ${
              activeTab === 'trending' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Live Search Indices
          </button>
          
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all ${
              activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Digest Inbox ({logs.length})
          </button>
          
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all ${
              activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            Automation Settings
          </button>
        </div>

        {/* Success Trigger Notification Banner */}
        {triggerSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-850 rounded-xl flex items-center gap-3 text-xs font-semibold shadow-sm animate-pulse">
            <span className="p-1 px-1.5 bg-emerald-500 text-white rounded font-bold">✓ Success</span>
            <span>{triggerSuccess}</span>
          </div>
        )}

        {/* TAB 1: LIVE SEARCH REPOS */}
        {activeTab === 'trending' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">GitHub Live Crawl View</h2>
                <p className="text-xs text-slate-500">Live search results for active matching filters configured in settings</p>
              </div>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-right font-mono">
                Showing top 10 matches
              </span>
            </div>

            {trendingLoading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center shadow-sm space-y-4">
                <span className="block text-4xl animate-spin text-center w-full max-w-[40px] mx-auto text-indigo-600">
                  <RefreshCw className="w-10 h-10" />
                </span>
                <p className="text-sm text-slate-500 font-medium">Scanning open-source repos on GitHub live search...</p>
              </div>
            ) : trendingRepos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm text-slate-500 space-y-2">
                <p className="font-bold text-slate-700 text-sm">No repositories matched your filters.</p>
                <p className="text-xs">Adjust minimum star counts or language selections in configurations and try again.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {trendingRepos.map((repo) => (
                  <div 
                    key={repo.id} 
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-indigo-200 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Upper Info Row */}
                      <div className="flex items-center justify-between gap-2.5">
                        <span className="text-[10px] font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-wide">
                          {repo.language}
                        </span>
                        <span className="text-xs text-slate-400 font-mono font-medium">
                          ★ {repo.stars.toLocaleString()}
                        </span>
                      </div>

                      {/* Name & Desc */}
                      <div className="space-y-1">
                        <a 
                          href={repo.htmlUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="block text-sm font-bold text-slate-950 hover:text-indigo-600 truncate flex items-center gap-1.5"
                        >
                          {repo.owner}/{repo.name} 
                          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                        </a>
                        <p className="text-xs text-slate-500 line-clamp-2 md:line-clamp-3 leading-relaxed font-mono">
                          {repo.description}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3.5 mt-4 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span>Forks: <strong>{repo.forks.toLocaleString()}</strong></span>
                      <span className="font-sans text-[10px]">Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HISTORY LOGS */}
        {activeTab === 'history' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Log Feed List Panel */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  <Inbox className="w-4 h-4 text-indigo-600" />
                  Digest Inbox ({logs.length})
                </h2>
                
                {logs.length > 0 && (
                  <button
                    onClick={handleClearLogs}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer animate-pulse"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Logs
                  </button>
                )}
              </div>

              {logs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs shadow-sm space-y-1">
                  <p className="font-bold text-slate-700">Inbox is empty</p>
                  <p>Manually run the digest or wait for automated cron schedules to fire digests.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <button
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-2 cursor-pointer ${
                        selectedLog?.id === log.id
                          ? 'bg-slate-900 border-indigo-600 text-white shadow-md shadow-indigo-100'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                          selectedLog?.id === log.id
                            ? 'bg-indigo-850 text-slate-100'
                            : log.success 
                              ? 'bg-emerald-50 text-emerald-850 border border-emerald-100'
                              : 'bg-rose-50 text-rose-850 border border-rose-100'
                        }`}>
                          {log.success ? 'Success ✓' : 'Failed ⚠'}
                        </span>
                        <span className={`text-[10px] font-mono ${selectedLog?.id === log.id ? 'text-indigo-350' : 'text-slate-400'}`}>
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div>
                        <span className={`block text-xs font-bold truncate ${selectedLog?.id === log.id ? 'text-white' : 'text-slate-900'}`}>
                          Digest for {log.recipient}
                        </span>
                        <span className={`block text-[11px] font-medium ${selectedLog?.id === log.id ? 'text-indigo-200 font-light' : 'text-slate-500'}`}>
                          {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>

                      <div className={`text-[11px] font-mono mt-1 ${selectedLog?.id === log.id ? 'text-indigo-300' : 'text-slate-400'}`}>
                        {log.repositories.length} repos • {log.deliveryMethod === 'smtp' ? 'SMTP' : 'In-App Simulated'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Digest Detail View Screen */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              {selectedLog ? (
                <div>
                  <div className="bg-slate-950 text-white p-6 border-b border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">
                          Digest Metadata Report
                        </span>
                        <h3 className="text-sm font-bold truncate">{selectedLog.emailSubject}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-slate-400 block">Logged Timestamp</span>
                        <span className="text-xs font-mono text-slate-200">{new Date(selectedLog.timestamp).toUTCString()}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-900 text-xs font-medium text-slate-400">
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase font-bold">Target Recipient:</span>
                        <span className="text-white block font-semibold truncate">{selectedLog.recipient}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase font-bold">Delivery Protocol:</span>
                        <span className="text-white block font-semibold">
                          {selectedLog.deliveryMethod === 'smtp' ? '✓ Outbound SMTP Relay' : '✉ Simulated Storage'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase font-bold">Crawl Output Size:</span>
                        <span className="text-white block font-semibold">{selectedLog.repositories.length} repos parsed</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase font-bold">Active Status:</span>
                        <span className={`block font-bold uppercase ${selectedLog.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {selectedLog.success ? 'HEALTHY PASS' : 'CRASHED'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
                    {selectedLog.errorMessage && (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-mono">
                        <strong className="block mb-1 font-bold text-rose-900">Automation Exception occurred:</strong>
                        {selectedLog.errorMessage}
                      </div>
                    )}

                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Compiled newsletter body output preview:</h4>
                      
                      {selectedLog.repositories.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No repositories recorded in this digest log.</p>
                      ) : (
                        <div className="space-y-5">
                          {selectedLog.repositories.map((repo, idx) => (
                            <div key={idx} className="p-5 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-100 transition-all">
                              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
                                <h5 className="text-sm font-bold text-indigo-700">
                                  <a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1.5">
                                    {repo.owner}/{repo.name}
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </h5>
                                <span className="text-[10px] font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                  {repo.language}
                                </span>
                              </div>
                              <p className="text-xs font-mono font-medium text-slate-500 mb-3 italic">
                                "{repo.description}"
                              </p>

                              <div className="p-4 bg-white border border-slate-200 border-l-4 border-l-indigo-600 rounded-r-lg space-y-1.5 shadow-sm">
                                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 fill-current" />
                                  Gemini AI Summary
                                </span>
                                <MarkdownView content={repo.aiSummary || 'AI compilation missing.'} />
                              </div>

                              <div className="flex items-center gap-3 text-[11px] text-slate-400 font-semibold mt-3.5">
                                <span>★ {repo.stars.toLocaleString()} stars</span>
                                <span>•</span>
                                <span>⑂ {repo.forks.toLocaleString()} forks</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-16 text-center text-slate-500 space-y-2">
                  <p className="text-sm font-bold text-slate-700">No output logs selected</p>
                  <p className="text-xs">Configure parameters or click `Force Run Now` above to assemble automated records.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SETTINGS CONFIG */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-4xl">
            <div>
              <h2 className="text-base font-bold text-slate-800">GitPulse System Configurations</h2>
              <p className="text-xs text-slate-500">Configure search parameters, SMTP relay accounts, and automatic timer routines</p>
            </div>

            {settings ? (
              <SettingsForm initialSettings={settings} onSave={handleSaveSettings} />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center animate-pulse text-xs text-slate-400">
                Loading configuration data...
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer Status Bar from Professional Polish Theme */}
      <footer className="h-10 bg-white border-t border-slate-200 px-6 lg:px-12 flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <div className="flex gap-4">
          <span>Version 2.4.1</span>
          <span>Connected to GitHub API v3</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-indigo-600">Automatic updates enabled</span>
          <div className="w-1 h-1 rounded-full bg-slate-300"></div>
          <span>Cloud Sync: Synchronized</span>
        </div>
      </footer>
    </div>
  );
}
