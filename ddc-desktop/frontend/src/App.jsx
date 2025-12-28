import React, { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "./api.js";

const DEFAULT_SETTINGS = {
  backendUrl: "http://127.0.0.1:5123",
  focusMinutes: 25,
  breakMinutes: 5
};

const TABS = ["Pomodoro", "Tasks", "Standup", "README", "Stats", "VS Code", "Settings", "Git"];

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
          <div className="muted">Base URL: {baseUrl}</div>
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
      {tab === "Standup" && <StandupPanel baseUrl={baseUrl} />}
      {tab === "README" && <ReadmePanel baseUrl={baseUrl} />}
      {tab === "Stats" && <StatsPanel baseUrl={baseUrl} />}
      {tab === "VS Code" && <VscodePanel baseUrl={baseUrl} />}
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

function StandupPanel({ baseUrl }) {
  const [text, setText] = useState("Memuat...");

  const refresh = () => {
    apiGet(baseUrl, "/standup/today").then((res) => {
      if (!res.ok) {
        setText("Gagal mengambil standup.");
        return;
      }
      const data = res.data;
      setText(
        "Today I did:\n" +
          formatList(data.today_did) +
          "\n\nToday I will do:\n" +
          formatList(data.today_will_do) +
          "\n\nBlockers:\n" +
          formatList(data.blockers)
      );
    });
  };

  useEffect(refresh, []);

  return (
    <div className="card">
      <h3 className="section-title">Standup Hari Ini</h3>
      <div className="actions">
        <button onClick={refresh}>Generate</button>
      </div>
      <textarea rows="12" value={text} readOnly />
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

function StatsPanel({ baseUrl }) {
  const [stats, setStats] = useState({ today: "-", week: "-", all: "-" });

  const fetchStats = async () => {
    const today = await apiGet(baseUrl, "/pomodoro/stats?range=today");
    const week = await apiGet(baseUrl, "/pomodoro/stats?range=week");
    const all = await apiGet(baseUrl, "/pomodoro/stats?range=all");
    setStats({
      today: today.ok ? formatStat(today.data) : "error",
      week: week.ok ? formatStat(week.data) : "error",
      all: all.ok ? formatStat(all.data) : "error"
    });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="card">
      <h3 className="section-title">Focus Stats</h3>
      <div className="grid">
        <div>Today: {stats.today}</div>
        <div>Last 7 days: {stats.week}</div>
        <div>All time: {stats.all}</div>
        <button onClick={fetchStats}>Refresh</button>
      </div>
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
  const heatmapDays = 365;
  const [heatmap, setHeatmap] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [bucketMinutes, setBucketMinutes] = useState(10);
  const [message, setMessage] = useState("");

  const refreshHeatmap = () => {
    apiGet(baseUrl, `/vscode/heatmap?days=${heatmapDays}`).then((res) => {
      if (!res.ok) {
        setMessage(res.message || "Gagal memuat heatmap.");
        return;
      }
      const items = res.data.items || [];
      setHeatmap(items);
      setMessage("");
      setSelectedDate((prev) => {
        if (!items.length) {
          return prev;
        }
        const last = items[items.length - 1].date;
        if (!prev || !items.some((item) => item.date === prev)) {
          return last;
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
        setMessage(res.message || "Gagal memuat timeline.");
        return;
      }
      setTimeline(res.data.items || []);
    });
  };

  useEffect(() => {
    refreshHeatmap();
  }, [heatmapDays]);

  useEffect(() => {
    refreshTimeline(selectedDate);
  }, [selectedDate, bucketMinutes]);

  const heatmapData = buildHeatmapGrid(heatmap, heatmapDays);
  const timelineData = buildTimelineGrid(timeline, bucketMinutes);
  const yearLabel = selectedDate ? selectedDate.slice(0, 4) : String(heatmapData.year || new Date().getFullYear());
  const rangeStartLabel = heatmapData.rangeStartLabel || "januari";
  const rangeEndLabel = heatmapData.rangeEndLabel || "desember";

  return (
    <div className="grid">
      <div className="card activity-heatmap-card">
        <div className="activity-header">
          <div>
            <h3 className="section-title">Activity Heatmap</h3>
            <div className="muted">Satu tahun terakhir</div>
          </div>
          <div className="year-pill">{yearLabel}</div>
        </div>
        <div className="actions">
          <button onClick={refreshHeatmap}>Refresh</button>
          {message && <div className="error">{message}</div>}
        </div>
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
            <h3 className="section-title">Detail Timeline</h3>
            <div className="muted">Klik tanggal di heatmap untuk detail waktu.</div>
          </div>
        </div>
        <div className="grid">
          <div className="timeline-controls">
            <div>
              <label>Tanggal terpilih</label>
              <input value={selectedDate || ""} readOnly />
            </div>
            <div>
              <label>Bucket (menit)</label>
              <select value={bucketMinutes} onChange={(e) => setBucketMinutes(Number(e.target.value))}>
                {[5, 10, 15, 30, 60].map((bucket) => (
                  <option key={bucket} value={bucket}>{bucket} menit</option>
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

function formatList(items) {
  if (!items || items.length === 0) {
    return "-";
  }
  return items.map((item) => `- ${item}`).join("\n");
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

const INACTIVE_COLOR = "#0f141d";
const ACTIVE_COLORS = ["#12351f", "#1f5b2f", "#2f8740", "#3eb75a"];
const TYPING_COLORS = ["#1b2b45", "#1f4f7a", "#2f7ec2", "#46b2ff"];

function buildHeatmapGrid(items, days) {
  const map = new Map();
  items.forEach((item) => {
    map.set(item.date, item);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));

  const startWeekday = (start.getDay() + 6) % 7;
  const totalCells = startWeekday + days;
  const weeks = Math.ceil(totalCells / 7);

  const maxTyping = Math.max(0, ...items.map((i) => i.typing || 0));
  const maxActive = Math.max(0, ...items.map((i) => i.active || 0));

  const cells = [];
  for (let i = 0; i < totalCells; i += 1) {
    if (i < startWeekday) {
      cells.push({ color: "transparent", title: "" });
      continue;
    }
    const dayIndex = i - startWeekday;
    const date = new Date(start);
    date.setDate(start.getDate() + dayIndex);
    const key = formatDateKey(date);
    const entry = map.get(key) || { active: 0, typing: 0, inactive: 0 };
    const color = pickHeatColor(entry.typing, entry.active, maxTyping, maxActive);
    const title = `${key} | typing: ${entry.typing} | active: ${entry.active} | idle: ${entry.inactive}`;
    cells.push({ color, title, date: key });
  }

  const monthLabels = [];
  for (let w = 0; w < weeks; w += 1) {
    const dayOffset = w * 7 - startWeekday;
    const date = new Date(start);
    date.setDate(start.getDate() + Math.max(0, dayOffset));
    monthLabels.push(
      date.getDate() === 1 ? date.toLocaleString("id-ID", { month: "short" }).toLowerCase() : ""
    );
  }

  const rangeStartLabel = start.toLocaleString("id-ID", { month: "long" }).toLowerCase();
  const rangeEndLabel = today.toLocaleString("id-ID", { month: "long" }).toLowerCase();

  return {
    cells,
    weeks,
    monthLabels,
    year: today.getFullYear(),
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

function scaleColor(value, max, colors) {
  if (max <= 0) {
    return colors[0];
  }
  const ratio = Math.max(0, Math.min(1, value / max));
  const idx = Math.min(colors.length - 1, Math.floor(ratio * (colors.length - 1)));
  return colors[idx];
}

