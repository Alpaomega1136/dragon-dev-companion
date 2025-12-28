import React, { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "./api.js";

const DEFAULT_SETTINGS = {
  backendUrl: "http://127.0.0.1:5123",
  focusMinutes: 25,
  breakMinutes: 5
};

const TABS = ["Pomodoro", "Tasks", "README", "VS Code", "GitHub", "Settings", "Git"];

function loadSettings() {
  try {
    const raw = localStorage.getItem("ddc_settings");
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  localStorage.setItem("ddc_settings", JSON.stringify(settings));
}

export default function App() {
  const [tab, setTab] = useState("Pomodoro");
  const [settings, setSettings] = useState(loadSettings());
  const [health, setHealth] = useState("checking");
  const baseUrl = settings.backendUrl;

  useEffect(() => {
    apiGet(baseUrl, "/health").then((res) => {
      setHealth(res.ok ? "ok" : "error");
    });
  }, [baseUrl]);

  return (
    <div className="app">
      <header className="top-bar">
        <div className="brand">
          <img className="dragon-mark" src="/dragon.svg" alt="Dragon emblem" />
          <div>
            <h1>Dragon Dev Companion Web</h1>
            <div className="tagline">Offline-first command center for focused builds.</div>
            <div className="muted">Pomodoro | Task roost | README forge</div>
          </div>
        </div>
        <div className="status-card">
          <div className="muted">Backend status</div>
          {health === "ok" ? (
            <div className="badge ok">Online</div>
          ) : health === "checking" ? (
            <div className="badge">Checking...</div>
          ) : (
            <div className="badge offline">Offline</div>
          )}
        </div>
      </header>

      <div className="tabs">
        {TABS.map((item) => (
          <button
            key={item}
            className={`tab ${tab === item ? "active" : ""}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Pomodoro" && <PomodoroPanel baseUrl={baseUrl} settings={settings} />}
      {tab === "Tasks" && <TasksPanel baseUrl={baseUrl} />}
      {tab === "README" && <ReadmePanel baseUrl={baseUrl} />}
      {tab === "VS Code" && <VscodePanel baseUrl={baseUrl} />}
      {tab === "GitHub" && <GitHubPanel baseUrl={baseUrl} />}
      {tab === "Settings" && (
        <SettingsPanel
          settings={settings}
          onSave={(next) => {
            setSettings(next);
            saveSettings(next);
          }}
        />
      )}
      {tab === "Git" && <GitPanel baseUrl={baseUrl} />}
    </div>
  );
}

function PomodoroPanel({ baseUrl, settings }) {
  const [mode, setMode] = useState("focus");
  const [duration, setDuration] = useState(settings.focusMinutes);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDuration(mode === "focus" ? settings.focusMinutes : settings.breakMinutes);
  }, [mode, settings]);

  const refresh = () => {
    apiGet(baseUrl, "/pomodoro/status").then((res) => {
      if (!res.ok) {
        setMessage(res.message || "Gagal mengambil status.");
        return;
      }
      setStatus(res.data);
      setMessage("");
    });
  };

  const action = (path, body) => {
    apiPost(baseUrl, path, body || {}).then((res) => {
      if (!res.ok) {
        setMessage(res.message || "Aksi gagal.");
        return;
      }
      setMessage("OK");
      refresh();
    });
  };

  useEffect(refresh, []);

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3 className="section-title">Kontrol Pomodoro</h3>
        <div className="grid">
          <div>
            <label>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="focus">Focus</option>
              <option value="break">Break</option>
            </select>
          </div>
          <div>
            <label>Durasi (menit)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
          <div className="actions">
            <button className="primary" onClick={() => action("/pomodoro/start", { mode, duration_minutes: duration })}>
              Start
            </button>
            <button onClick={() => action("/pomodoro/pause")}>Pause</button>
            <button onClick={() => action("/pomodoro/resume")}>Resume</button>
            <button onClick={() => action("/pomodoro/stop")}>Stop</button>
            <button onClick={refresh}>Refresh</button>
          </div>
          {message && <div className={message === "OK" ? "muted" : "error"}>{message}</div>}
        </div>
      </div>
      <div className="card soft">
        <h3 className="section-title">Status</h3>
        <div className="status">
          {status ? (
            <>
              <div>Mode: {status.mode || "-"}</div>
              <div>Status: {status.status || "idle"}</div>
              <div>Elapsed: {status.elapsed_minutes?.toFixed(1) || 0} menit</div>
            </>
          ) : (
            <div className="muted">Memuat...</div>
          )}
        </div>
      </div>
    </div>
  );
}

function TasksPanel({ baseUrl }) {
  const [tasks, setTasks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "med",
    status: "todo",
    due_date: ""
  });
  const [message, setMessage] = useState("");

  const refresh = () => {
    apiGet(baseUrl, "/tasks?status=all").then((res) => {
      if (!res.ok) {
        setMessage(res.message || "Gagal memuat tasks.");
        return;
      }
      setTasks(res.data || []);
      setMessage("");
    });
  };

  useEffect(refresh, []);

  const selectTask = (task) => {
    setSelectedId(task.id);
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      due_date: task.due_date || ""
    });
  };

  const createTask = () => {
    apiPost(baseUrl, "/tasks", form).then((res) => {
      if (!res.ok) {
        setMessage(res.message || "Gagal menambah task.");
        return;
      }
      setMessage("Task ditambahkan.");
      refresh();
    });
  };

  const updateTask = () => {
    if (!selectedId) {
      setMessage("Pilih task dulu.");
      return;
    }
    apiPut(baseUrl, `/tasks/${selectedId}`, form).then((res) => {
      if (!res.ok) {
        setMessage(res.message || "Gagal update task.");
        return;
      }
      setMessage("Task diupdate.");
      refresh();
    });
  };

  const toggleTask = () => {
    if (!selectedId) {
      setMessage("Pilih task dulu.");
      return;
    }
    apiPost(baseUrl, `/tasks/${selectedId}/toggle_done`, {}).then((res) => {
      if (!res.ok) {
        setMessage(res.message || "Gagal toggle task.");
        return;
      }
      setMessage("Status task diubah.");
      refresh();
    });
  };

  const deleteTask = () => {
    if (!selectedId) {
      setMessage("Pilih task dulu.");
      return;
    }
    apiDelete(baseUrl, `/tasks/${selectedId}`).then((res) => {
      if (!res.ok) {
        setMessage(res.message || "Gagal delete task.");
        return;
      }
      setMessage("Task dihapus.");
      setSelectedId(null);
      refresh();
    });
  };

  return (
    <div className="split">
      <div className="card">
        <h3 className="section-title">Daftar Task</h3>
        <ul className="list">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={selectedId === task.id ? "active" : ""}
              onClick={() => selectTask(task)}
            >
              <strong>#{task.id}</strong> [{task.status}] {task.title}
              <div className="muted">{task.priority} {task.due_date ? `| ${task.due_date}` : ""}</div>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button onClick={refresh}>Refresh</button>
        </div>
      </div>
      <div className="card soft">
        <h3 className="section-title">Editor Task</h3>
        <div className="grid">
          <div>
            <label>Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label>Description</label>
            <textarea
              rows="3"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label>Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">low</option>
              <option value="med">med</option>
              <option value="high">high</option>
            </select>
          </div>
          <div>
            <label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="todo">todo</option>
              <option value="doing">doing</option>
              <option value="done">done</option>
            </select>
          </div>
          <div>
            <label>Due Date (YYYY-MM-DD)</label>
            <input value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="actions">
            <button className="primary" onClick={createTask}>Add</button>
            <button onClick={updateTask}>Update</button>
            <button onClick={toggleTask}>Done/Undone</button>
            <button className="danger" onClick={deleteTask}>Delete</button>
          </div>
          {message && <div className={message.includes("Gagal") ? "error" : "muted"}>{message}</div>}
        </div>
      </div>
    </div>
  );
}

function ReadmePanel({ baseUrl }) {
  const [profile, setProfile] = useState({ name: "", bio: "", tech: "", links: "" });
  const [project, setProject] = useState({
    title: "",
    description: "",
    features: "",
    usage: "",
    stack: "",
    links: ""
  });
  const [message, setMessage] = useState("");

  const generateProfile = () => {
    apiPost(baseUrl, "/readme/profile", profile).then((res) => {
      setMessage(res.ok ? `Generated: ${res.data.path}` : res.message);
    });
  };

  const generateProject = () => {
    apiPost(baseUrl, "/readme/project", project).then((res) => {
      setMessage(res.ok ? `Generated: ${res.data.path}` : res.message);
    });
  };

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3 className="section-title">Profile README</h3>
        <div className="grid">
          <div>
            <label>Name</label>
            <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </div>
          <div>
            <label>Bio</label>
            <textarea rows="3" value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
          </div>
          <div>
            <label>Tech</label>
            <input value={profile.tech} onChange={(e) => setProfile({ ...profile, tech: e.target.value })} />
          </div>
          <div>
            <label>Links</label>
            <input value={profile.links} onChange={(e) => setProfile({ ...profile, links: e.target.value })} />
          </div>
          <button className="primary" onClick={generateProfile}>Generate Profile</button>
        </div>
      </div>
      <div className="card">
        <h3 className="section-title">Project README</h3>
        <div className="grid">
          <div>
            <label>Title</label>
            <input value={project.title} onChange={(e) => setProject({ ...project, title: e.target.value })} />
          </div>
          <div>
            <label>Description</label>
            <textarea rows="3" value={project.description} onChange={(e) => setProject({ ...project, description: e.target.value })} />
          </div>
          <div>
            <label>Features</label>
            <textarea rows="3" value={project.features} onChange={(e) => setProject({ ...project, features: e.target.value })} />
          </div>
          <div>
            <label>Usage</label>
            <textarea rows="3" value={project.usage} onChange={(e) => setProject({ ...project, usage: e.target.value })} />
          </div>
          <div>
            <label>Stack</label>
            <input value={project.stack} onChange={(e) => setProject({ ...project, stack: e.target.value })} />
          </div>
          <div>
            <label>Links</label>
            <input value={project.links} onChange={(e) => setProject({ ...project, links: e.target.value })} />
          </div>
          <button className="primary" onClick={generateProject}>Generate Project</button>
        </div>
      </div>
      {message && <div className="card">{message}</div>}
    </div>
  );
}

function SettingsPanel({ settings, onSave }) {
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState("");

  useEffect(() => setForm(settings), [settings]);

  const save = () => {
    onSave(form);
    setMessage("Settings tersimpan. Refresh halaman untuk apply penuh.");
  };

  return (
    <div className="card">
      <h3 className="section-title">Settings</h3>
      <div className="grid">
        <div>
          <label>Backend URL</label>
          <input value={form.backendUrl} onChange={(e) => setForm({ ...form, backendUrl: e.target.value })} />
        </div>
        <div>
          <label>Focus Minutes</label>
          <input
            type="number"
            value={form.focusMinutes}
            onChange={(e) => setForm({ ...form, focusMinutes: Number(e.target.value) })}
          />
        </div>
        <div>
          <label>Break Minutes</label>
          <input
            type="number"
            value={form.breakMinutes}
            onChange={(e) => setForm({ ...form, breakMinutes: Number(e.target.value) })}
          />
        </div>
        <button className="primary" onClick={save}>Save</button>
        {message && <div className="muted">{message}</div>}
      </div>
    </div>
  );
}

function GitHubPanel({ baseUrl }) {
  const [summary, setSummary] = useState({
    profile: null,
    repos: [],
    contributions: [],
    available_years: [],
    year: null,
    message: ""
  });
  const [message, setMessage] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [savedGithubUrl, setSavedGithubUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [githubYear, setGithubYear] = useState(new Date().getFullYear());

  const refresh = () => {
    apiGet(baseUrl, `/github/summary?year=${githubYear}`).then((res) => {
      if (!res.ok) {
        setMessage(res.message || "Failed to load GitHub data.");
        return;
      }
      setSummary(res.data || { profile: null, repos: [], contributions: [] });
      const available = res.data?.available_years || [];
      const serverYear = res.data?.year;
      if (serverYear && Number.isInteger(serverYear)) {
        setGithubYear(serverYear);
      } else if (available.length && !available.includes(githubYear)) {
        setGithubYear(available[available.length - 1]);
      }
      setMessage("");
    });
  };

  useEffect(() => {
    const stored = localStorage.getItem("ddc_github_url") || "";
    setGithubUrl(stored);
    setSavedGithubUrl(stored);
  }, []);

  useEffect(refresh, [baseUrl, githubYear]);

  const profile = summary.profile || {};
  const repos = Array.isArray(summary.repos) ? summary.repos : [];
  const contributions = Array.isArray(summary.contributions) ? summary.contributions : [];
  const avatarUrl = profile.avatar_url ? `${baseUrl}${profile.avatar_url}` : "/dragon.svg";
  const contribData = buildContributionGrid(contributions, githubYear);
  const totalContrib = contributions.reduce((acc, item) => acc + (item.count || 0), 0);
  const availableYears = Array.isArray(summary.available_years) && summary.available_years.length
    ? summary.available_years.slice().sort((a, b) => b - a)
    : [githubYear];

  const normalizeGithubUrl = (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    const handle = trimmed.replace(/^@/, "");
    return `https://github.com/${handle}`;
  };

  const syncGithub = () => {
    const value = githubUrl.trim();
    if (!value) {
      window.alert("Please enter a GitHub username or profile URL.");
      return;
    }
    const normalized = normalizeGithubUrl(value);
    localStorage.setItem("ddc_github_url", normalized);
    setSavedGithubUrl(normalized);
    setSyncing(true);
      apiPost(baseUrl, "/github/sync", { profile: value, year: githubYear }).then((res) => {
        setSyncing(false);
        if (!res.ok) {
          window.alert(res.message || "Failed to sync GitHub data.");
          return;
        }
        window.alert("GitHub data synced.");
        refresh();
      });
  };

  return (
    <div className="grid">
      <div className="card github-profile-card">
        <img className="github-avatar" src={avatarUrl} alt="GitHub avatar" />
        <div className="github-profile-info">
          <div className="github-name">{profile.name || "Unknown Developer"}</div>
          {profile.username ? <div className="github-handle">@{profile.username}</div> : null}
          <div className="github-bio">{profile.bio || "No profile bio available."}</div>
          <div className="github-meta">
            <span>Repos: {repos.length}</span>
            <span>Followers: {profile.followers ?? "-"}</span>
            <span>Following: {profile.following ?? "-"}</span>
            {profile.location ? <span>Location: {profile.location}</span> : null}
          </div>
          <div className="github-link-row">
            <label>GitHub profile URL or username</label>
            <div className="github-link-actions">
              <input
                value={githubUrl}
                onChange={(event) => setGithubUrl(event.target.value)}
                placeholder="https://github.com/username"
              />
              <div className="github-link-buttons">
                <button onClick={syncGithub} disabled={syncing}>
                  {syncing ? "Syncing..." : "Sync"}
                </button>
              </div>
            </div>
            {savedGithubUrl ? (
              <a className="github-link" href={savedGithubUrl} target="_blank" rel="noreferrer">
                {savedGithubUrl}
              </a>
            ) : (
              <div className="muted">No link saved.</div>
            )}
          </div>
          {summary.message ? <div className="muted">{summary.message}</div> : null}
          {message ? <div className="error">{message}</div> : null}
        </div>
      </div>

      <div className="card">
        <div className="activity-header">
          <div>
            <h3 className="section-title section-title-lg">GitHub Contributions</h3>
            <div className="muted">Calendar year view (Jan - Dec)</div>
            <div className="muted">Total contributions: {totalContrib}</div>
          </div>
          <div className="year-picker">
            <label>Year</label>
            <select
              value={githubYear}
              onChange={(event) => setGithubYear(Number(event.target.value))}
            >
              {availableYears.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="heatmap-center">
          <div className="heatmap-range">
            <span>january</span>
            <span className="heatmap-range-line" />
            <span>december</span>
          </div>
          <div className="heatmap-frame">
            <div
              className="heatmap-months"
              style={{ gridTemplateColumns: `repeat(${contribData.weeks}, var(--heatmap-cell))` }}
            >
              {contribData.monthLabels.map((label, idx) => (
                <div key={idx}>{label}</div>
              ))}
            </div>
            <div
              className="heatmap-grid"
              style={{
                gridTemplateColumns: `repeat(${contribData.weeks}, var(--heatmap-cell))`,
                gridTemplateRows: "repeat(7, var(--heatmap-cell))"
              }}
            >
              {contribData.cells.map((cell, idx) => (
                <div
                  key={idx}
                  className="heatmap-cell"
                  title={cell.title}
                  style={{ background: cell.color }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="heatmap-legend">
          <span>Less</span>
          {[CONTRIB_EMPTY, ...CONTRIB_COLORS].map((color) => (
            <span key={color} className="legend-swatch" style={{ background: color }} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="card">
        <div className="activity-header">
          <div>
            <h3 className="section-title section-title-lg">Repositories</h3>
            <div className="muted">Snapshot from local data file.</div>
          </div>
        </div>
        <div className="github-repo-list">
          {repos.length ? (
            repos.map((repo, idx) => {
              const stars = repo.stars ?? repo.stargazers_count ?? 0;
              const repoName = repo.name || "Unnamed repo";
              const repoUrl = repo.html_url
                || (profile.username && repo.name
                  ? `https://github.com/${profile.username}/${repo.name}`
                  : "");
              const updatedText = repo.updated_at ? formatRepoUpdated(repo.updated_at) : "";
              return (
                <div className="repo-card" key={`${repo.name || "repo"}-${idx}`}>
                  <div className="repo-title">
                    {repoUrl ? (
                      <a href={repoUrl} target="_blank" rel="noreferrer">
                        {repoName}
                      </a>
                    ) : (
                      repoName
                    )}
                  </div>
                  <div className="repo-desc">{repo.description || "No description."}</div>
                  <div className="repo-meta">
                    {repo.language ? <span className="repo-chip">{repo.language}</span> : null}
                    <span className="repo-chip">Stars: {stars}</span>
                    {updatedText ? <span className="repo-chip">Updated: {updatedText}</span> : null}
                    {repo.private ? <span className="repo-chip">Private</span> : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="muted">No repositories found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function GitPanel({ baseUrl }) {
  const [repoPath, setRepoPath] = useState("");
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");

  const fetchSummary = () => {
    apiPost(baseUrl, "/git/summary", { repo_path: repoPath }).then((res) => {
      if (!res.ok) {
        setMessage(res.message || "Gagal mengambil git summary.");
        setSummary(null);
        return;
      }
      setSummary(res.data);
      setMessage("");
    });
  };

  return (
    <div className="card">
      <h3 className="section-title">Git Summary</h3>
      <div className="grid">
        <div>
          <label>Repo Path</label>
          <input value={repoPath} onChange={(e) => setRepoPath(e.target.value)} placeholder="D:\\repo\\project" />
        </div>
        <div className="actions">
          <button className="primary" onClick={fetchSummary}>Check</button>
        </div>
        {message && <div className="error">{message}</div>}
        {summary && (
          <div className="status">
            <div>OK: {summary.ok ? "yes" : "no"}</div>
            <div>Message: {summary.message}</div>
            <div>Branch: {summary.branch || "-"}</div>
            <div>Last commit: {summary.last_commit || "-"}</div>
            <div>Staged: {summary.staged ?? "-"}</div>
            <div>Unstaged: {summary.unstaged ?? "-"}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function VscodePanel({ baseUrl }) {
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [bucketMinutes, setBucketMinutes] = useState(10);
  const [message, setMessage] = useState("");

  const refreshHeatmap = () => {
    apiGet(baseUrl, `/vscode/heatmap?year=${heatmapYear}`).then((res) => {
      if (!res.ok) {
        setMessage(res.message || "Failed to load heatmap.");
        return;
      }
      const data = res.data || {};
      const items = data.items || [];
      const years = Array.isArray(data.available_years) ? data.available_years : [];
      const sortedYears = years.length ? years.slice().sort((a, b) => b - a) : [];
      const displayYear = Number.isInteger(data.year) ? data.year : heatmapYear;
      if (sortedYears.length && !sortedYears.includes(displayYear)) {
        const fallbackYear = sortedYears[0];
        if (fallbackYear !== heatmapYear) {
          setAvailableYears(sortedYears);
          setHeatmapYear(fallbackYear);
          return;
        }
      }
      setHeatmap(items);
      setAvailableYears(sortedYears);
      setMessage("");
      const defaultDate = defaultHeatmapDate(displayYear);
      setSelectedDate((prev) => {
        if (!items.length) {
          return prev || defaultDate;
        }
        if (!prev || !items.some((item) => item.date === prev)) {
          return defaultDate;
        }
        return prev;
      });
    });
  };

  const refreshTimeline = (dateValue) => {
    if (!dateValue) {
      return;
    }
    apiGet(baseUrl, `/vscode/timeline?date=${dateValue}&bucket_minutes=${bucketMinutes}`).then((res) => {
      if (!res.ok) {
        setMessage(res.message || "Failed to load timeline.");
        return;
      }
      setTimeline(res.data.items || []);
    });
  };

  useEffect(() => {
    refreshHeatmap();
  }, [heatmapYear]);

  useEffect(() => {
    refreshTimeline(selectedDate);
  }, [selectedDate, bucketMinutes]);

  const heatmapData = buildHeatmapGrid(heatmap, heatmapYear);
  const timelineData = buildTimelineGrid(timeline, bucketMinutes);
  const rangeStartLabel = heatmapData.rangeStartLabel || "january";
  const rangeEndLabel = heatmapData.rangeEndLabel || "december";
  const yearOptions = availableYears.length ? availableYears : [heatmapYear];
  const totals = heatmap.reduce(
    (acc, item) => {
      acc.typing += item.typing || 0;
      acc.active += item.active || 0;
      acc.inactive += item.inactive || 0;
      return acc;
    },
    { typing: 0, active: 0, inactive: 0 }
  );
  const totalEvents = totals.typing + totals.active + totals.inactive;
  const typingPercent = totalEvents ? Math.round((totals.typing / totalEvents) * 100) : 0;
  const idlePercent = totalEvents ? Math.round((totals.inactive / totalEvents) * 100) : 0;

  return (
    <div className="grid">
      <div className="card activity-heatmap-card">
        <div className="activity-header">
          <div>
            <h3 className="section-title section-title-xl">VS Code Activity</h3>
            <div className="activity-subtitle">
              Typing {typingPercent}% | Idle {idlePercent}%
            </div>
            <div className="muted">Calendar year view (Jan - Dec)</div>
          </div>
          <div className="year-picker">
            <label>Year</label>
            <select
              value={heatmapYear}
              onChange={(event) => setHeatmapYear(Number(event.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions activity-actions">
          <button className="icon-button" onClick={refreshHeatmap} aria-label="Refresh">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M20 5v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {message && <div className="error">{message}</div>}
        </div>
        <div className="heatmap-center">
          <div className="heatmap-range">
            <span>{rangeStartLabel}</span>
            <span className="heatmap-range-line" />
            <span>{rangeEndLabel}</span>
          </div>
          <div className="heatmap-frame">
            <div
              className="heatmap-months"
              style={{ gridTemplateColumns: `repeat(${heatmapData.weeks}, var(--heatmap-cell))` }}
            >
              {heatmapData.monthLabels.map((label, idx) => (
                <div key={idx}>{label}</div>
              ))}
            </div>
            <div
              className="heatmap-quarters"
              style={{ gridTemplateColumns: `repeat(${heatmapData.weeks}, var(--heatmap-cell))` }}
            >
              {heatmapData.quarterCells.map((label, idx) => (
                <div key={idx} className="heatmap-quarter">
                  {label ? <span className="heatmap-quarter-dot" title={label} /> : null}
                </div>
              ))}
            </div>
            <div
              className="heatmap-grid"
              style={{
                gridTemplateColumns: `repeat(${heatmapData.weeks}, var(--heatmap-cell))`,
                gridTemplateRows: "repeat(7, var(--heatmap-cell))"
              }}
            >
              {heatmapData.cells.map((cell, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`heatmap-cell ${cell.date === selectedDate ? "selected" : ""}`}
                  title={cell.title}
                  style={{ background: cell.color, cursor: cell.date ? "pointer" : "default" }}
                  onClick={() => {
                    if (cell.date) {
                      setSelectedDate(cell.date);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="heatmap-legend">
          <div className="legend-row">
            <span>Typing</span>
            {TYPING_COLORS.map((color) => (
              <span key={color} className="legend-swatch" style={{ background: color }} />
            ))}
          </div>
          <div className="legend-row">
            <span>Active</span>
            {ACTIVE_COLORS.map((color) => (
              <span key={color} className="legend-swatch" style={{ background: color }} />
            ))}
          </div>
          <div className="legend-row">
            <span>Idle</span>
            <span className="legend-swatch" style={{ background: INACTIVE_COLOR }} />
          </div>
        </div>
      </div>
      <div className="card soft activity-timeline-card">
        <div className="activity-header">
          <div>
            <h3 className="section-title section-title-lg">Daily Timeline</h3>
            <div className="muted">Pick a date above to see activity by time range.</div>
          </div>
        </div>
        <div className="grid">
          <div className="timeline-controls">
            <div>
              <label>Selected date</label>
              <input value={selectedDate || ""} readOnly />
            </div>
            <div>
              <label>Bucket (minutes)</label>
              <select value={bucketMinutes} onChange={(e) => setBucketMinutes(Number(e.target.value))}>
                {[5, 10, 15, 30, 60].map((bucket) => (
                  <option key={bucket} value={bucket}>{bucket} min</option>
                ))}
              </select>
            </div>
          </div>
          <div className="timeline-frame">
            <div className="timeline-axis">00:00</div>
            <div
              className="timeline-grid"
              style={{
                gridTemplateColumns: `repeat(${timelineData.buckets}, minmax(0, 1fr))`
              }}
            >
              {timelineData.cells.map((cell, idx) => (
                <div
                  key={idx}
                  className="timeline-cell"
                  title={cell.title}
                  style={{ background: cell.color }}
                />
              ))}
            </div>
            <div className="timeline-axis">24:00</div>
          </div>
          <div className="heatmap-legend">
            <div className="legend-row">
              <span>Typing</span>
              {TYPING_COLORS.map((color) => (
                <span key={color} className="legend-swatch" style={{ background: color }} />
              ))}
            </div>
            <div className="legend-row">
              <span>Active</span>
              {ACTIVE_COLORS.map((color) => (
                <span key={color} className="legend-swatch" style={{ background: color }} />
              ))}
            </div>
            <div className="legend-row">
              <span>Idle</span>
              <span className="legend-swatch" style={{ background: INACTIVE_COLOR }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatStat(stat) {
  return `${stat.total_focus_minutes.toFixed(1)} min / ${stat.total_sessions} sessions`;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRepoUpdated(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function defaultHeatmapDate(year) {
  const now = new Date();
  if (year === now.getFullYear()) {
    return formatDateKey(now);
  }
  return `${year}-12-31`;
}

const INACTIVE_COLOR = "#0f141d";
const ACTIVE_COLORS = ["#12351f", "#1f5b2f", "#2f8740", "#3eb75a"];
const TYPING_COLORS = ["#1b2b45", "#1f4f7a", "#2f7ec2", "#46b2ff"];
const CONTRIB_EMPTY = "#0f141d";
const CONTRIB_COLORS = ["#0e4429", "#006d32", "#26a641", "#39d353"];

function buildContributionGrid(items, year) {
  const map = new Map();
  items.forEach((item) => {
    if (item && item.date) {
      map.set(item.date, item.count || 0);
    }
  });

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  const totalDays = Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
  const weeks = Math.ceil(totalDays / 7);
  const maxCount = Math.max(0, ...items.map((i) => i.count || 0));

  const cells = [];
  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = formatDateKey(date);
    const count = map.get(key) || 0;
    const color = pickContributionColor(count, maxCount);
    cells.push({
      color,
      title: `${key} | contributions: ${count}`
    });
  }

  const monthLabels = Array.from({ length: weeks }, () => "");
  for (let month = 0; month < 12; month += 1) {
    const monthDate = new Date(year, month, 1);
    monthDate.setHours(12, 0, 0, 0);
    const dayIndex = Math.round((monthDate - start) / (24 * 60 * 60 * 1000));
    const weekIndex = Math.floor(dayIndex / 7);
    if (weekIndex >= 0 && weekIndex < weeks) {
      monthLabels[weekIndex] = monthDate.toLocaleString("en-US", { month: "short" }).toLowerCase();
    }
  }

  return { cells, weeks, monthLabels, year };
}

function buildHeatmapGrid(items, year) {
  const map = new Map();
  items.forEach((item) => {
    map.set(item.date, item);
  });

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  const totalDays = Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;

  const startWeekday = 0;
  const totalCells = totalDays;
  const weeks = Math.ceil(totalCells / 7);

  const maxTyping = Math.max(0, ...items.map((i) => i.typing || 0));
  const maxActive = Math.max(0, ...items.map((i) => i.active || 0));

  const cells = [];
  for (let i = 0; i < totalCells; i += 1) {
    const dayIndex = i - startWeekday;
    const date = new Date(start);
    date.setDate(start.getDate() + dayIndex);
    const key = formatDateKey(date);
    const entry = map.get(key) || { active: 0, typing: 0, inactive: 0 };
    const color = pickHeatColor(entry.typing, entry.active, maxTyping, maxActive);
    const title = `${key} | typing: ${entry.typing} | active: ${entry.active} | idle: ${entry.inactive}`;
    cells.push({ color, title, date: key });
  }

  const monthLabels = Array.from({ length: weeks }, () => "");
  for (let month = 0; month < 12; month += 1) {
    const monthDate = new Date(year, month, 1);
    monthDate.setHours(12, 0, 0, 0);
    const dayIndex = Math.round((monthDate - start) / (24 * 60 * 60 * 1000));
    const weekIndex = Math.floor(dayIndex / 7);
    if (weekIndex >= 0 && weekIndex < weeks) {
      monthLabels[weekIndex] = monthDate.toLocaleString("en-US", { month: "short" }).toLowerCase();
    }
  }

  const quarterCells = Array.from({ length: weeks }, () => "");
  const quarterMarkers = [
    { month: 2, label: "mar" },
    { month: 5, label: "jun" },
    { month: 8, label: "sep" },
    { month: 11, label: "dec" }
  ];
  quarterMarkers.forEach((marker) => {
    const markerDate = new Date(year, marker.month, 1);
    markerDate.setHours(12, 0, 0, 0);
    const dayIndex = Math.round((markerDate - start) / (24 * 60 * 60 * 1000));
    const weekIndex = Math.floor(dayIndex / 7);
    if (weekIndex >= 0 && weekIndex < weeks) {
      quarterCells[weekIndex] = marker.label;
    }
  });

  const rangeStartLabel = "january";
  const rangeEndLabel = "december";

  return {
    cells,
    weeks,
    monthLabels,
    quarterCells,
    year,
    rangeStartLabel,
    rangeEndLabel
  };
}

function buildTimelineGrid(items, bucketMinutes) {
  const expectedBuckets = Math.max(1, Math.round((24 * 60) / bucketMinutes));
  const normalized = [];

  for (let i = 0; i < expectedBuckets; i += 1) {
    if (items[i]) {
      normalized.push(items[i]);
      continue;
    }
    const minutes = i * bucketMinutes;
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    normalized.push({
      start_time: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
      typing: 0,
      active: 0,
      inactive: 0
    });
  }

  const maxTyping = Math.max(0, ...normalized.map((item) => item.typing || 0));
  const maxActive = Math.max(0, ...normalized.map((item) => item.active || 0));

  const cells = normalized.map((item, idx) => {
    const typing = item.typing || 0;
    const active = item.active || 0;
    const inactive = item.inactive || 0;
    const minutes = idx * bucketMinutes;
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const startLabel = item.start_time || `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    const color = typing > 0
      ? scaleColor(typing, maxTyping, TYPING_COLORS)
      : active > 0
        ? scaleColor(active, maxActive, ACTIVE_COLORS)
        : INACTIVE_COLOR;
    return {
      color,
      title: `${startLabel} | typing: ${typing} | active: ${active} | idle: ${inactive}`
    };
  });

  return { cells, buckets: expectedBuckets };
}

function pickHeatColor(typing, active, maxTyping, maxActive) {
  if (typing > 0) {
    return scaleColor(typing, maxTyping, TYPING_COLORS);
  }
  if (active > 0) {
    return scaleColor(active, maxActive, ACTIVE_COLORS);
  }
  return INACTIVE_COLOR;
}

function pickContributionColor(count, maxCount) {
  if (count <= 0) {
    return CONTRIB_EMPTY;
  }
  return scaleColor(count, maxCount, CONTRIB_COLORS);
}

function scaleColor(value, max, colors) {
  if (max <= 0) {
    return colors[0];
  }
  const ratio = Math.max(0, Math.min(1, value / max));
  const idx = Math.min(colors.length - 1, Math.floor(ratio * (colors.length - 1)));
  return colors[idx];
}

