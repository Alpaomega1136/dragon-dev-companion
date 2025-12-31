import React, { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "./api.js";

const DEFAULT_SETTINGS = {
  backendUrl: "http://127.0.0.1:5123",
  focusMinutes: 25,
  breakMinutes: 5,
  spotifyClientId: "",
  spotifyDockVisible: true
};

const TABS = ["Pomodoro", "Tasks", "README", "VS Code", "GitHub", "Spotify", "Settings", "Git"];

const SPOTIFY_TYPES = new Set(["track", "album", "playlist", "artist", "episode", "show"]);
const SPOTIFY_TALL_TYPES = new Set(["album", "playlist", "show", "artist"]);
const DEFAULT_SPOTIFY = { input: "", embedUrl: "", openUrl: "", type: "", label: "" };
const DEFAULT_SPOTIFY_LIBRARY = [];
const SPOTIFY_FILTERS = ["all", "music", "podcasts"];
const SPOTIFY_PODCAST_TYPES = new Set(["show", "episode"]);
const SPOTIFY_GRADIENTS = [
  ["#1db954", "#0b1f16"],
  ["#1f8ae0", "#0b1d38"],
  ["#6a5cff", "#1a103d"],
  ["#ff8a3d", "#3a170b"],
  ["#f24c7c", "#3a0e1f"],
  ["#2fb1ff", "#0b1a2f"],
  ["#7bdf6b", "#12301a"],
  ["#ffc857", "#3a2a0d"]
];
const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative"
];
const SPOTIFY_TOKEN_BUFFER_MS = 60 * 1000;
const SPOTIFY_PKCE_KEY = "ddc_spotify_pkce";
const SPOTIFY_AUTH_KEY = "ddc_spotify_auth";
const SPOTIFY_TRACKS_KEY = "ddc_spotify_tracks";
const POMODORO_TASKS_KEY = "ddc_pomodoro_tasks";

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

function loadSpotifyState() {
  try {
    const raw = localStorage.getItem("ddc_spotify");
    if (!raw) {
      return DEFAULT_SPOTIFY;
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SPOTIFY, ...parsed };
  } catch {
    return DEFAULT_SPOTIFY;
  }
}

function saveSpotifyState(state) {
  localStorage.setItem("ddc_spotify", JSON.stringify(state));
}

function loadSpotifyLibrary() {
  try {
    const raw = localStorage.getItem("ddc_spotify_library");
    if (!raw) {
      return DEFAULT_SPOTIFY_LIBRARY;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_SPOTIFY_LIBRARY;
  } catch {
    return DEFAULT_SPOTIFY_LIBRARY;
  }
}

function saveSpotifyLibrary(library) {
  localStorage.setItem("ddc_spotify_library", JSON.stringify(library));
}

function loadSpotifyAuth() {
  try {
    const raw = localStorage.getItem(SPOTIFY_AUTH_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSpotifyAuth(auth) {
  if (!auth) {
    localStorage.removeItem(SPOTIFY_AUTH_KEY);
    return;
  }
  localStorage.setItem(SPOTIFY_AUTH_KEY, JSON.stringify(auth));
}

function loadSpotifyTracks() {
  try {
    const raw = localStorage.getItem(SPOTIFY_TRACKS_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveSpotifyTracks(data) {
  localStorage.setItem(SPOTIFY_TRACKS_KEY, JSON.stringify(data));
}

function loadPomodoroTasks() {
  try {
    const raw = localStorage.getItem(POMODORO_TASKS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePomodoroTasks(tasks) {
  localStorage.setItem(POMODORO_TASKS_KEY, JSON.stringify(tasks));
}

function base64UrlEncode(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateCodeVerifier() {
  const bytes = new Uint8Array(64);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

function randomState() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function normalizeArtists(artists) {
  if (!Array.isArray(artists)) {
    return "";
  }
  return artists.map((artist) => artist.name).filter(Boolean).join(", ");
}

function shuffleArray(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildSpotifyUrls(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const colonMatch = trimmed.match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)$/);
  if (colonMatch) {
    const type = colonMatch[1];
    const id = colonMatch[2];
    return {
      type,
      embedUrl: `https://open.spotify.com/embed/${type}/${id}`,
      openUrl: `https://open.spotify.com/${type}/${id}`
    };
  }

  const shortMatch = trimmed.match(/^(track|album|playlist|artist|episode|show)[/:]([A-Za-z0-9]+)$/);
  if (shortMatch) {
    const type = shortMatch[1];
    const id = shortMatch[2];
    return {
      type,
      embedUrl: `https://open.spotify.com/embed/${type}/${id}`,
      openUrl: `https://open.spotify.com/${type}/${id}`
    };
  }

  let urlValue = trimmed;
  if (!/^https?:\/\//i.test(urlValue)) {
    urlValue = `https://${urlValue}`;
  }
  try {
    const url = new URL(urlValue);
    if (!url.hostname.includes("spotify.com")) {
      return null;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (!parts.length) {
      return null;
    }
    let type = parts[0];
    let id = parts[1];
    if (type === "embed") {
      type = parts[1];
      id = parts[2];
    }
    if (!type || !id || !SPOTIFY_TYPES.has(type)) {
      return null;
    }
    return {
      type,
      embedUrl: `https://open.spotify.com/embed/${type}/${id}`,
      openUrl: `https://open.spotify.com/${type}/${id}`
    };
  } catch {
    return null;
  }
}

function spotifyPlayerHeight(type, expanded) {
  if (!expanded) {
    return 80;
  }
  if (type && SPOTIFY_TALL_TYPES.has(type)) {
    return 380;
  }
  return 152;
}

function withSpotifyParams(embedUrl) {
  try {
    const url = new URL(embedUrl);
    if (!url.searchParams.has("theme")) {
      url.searchParams.set("theme", "0");
    }
    if (!url.searchParams.has("utm_source")) {
      url.searchParams.set("utm_source", "ddc");
    }
    return url.toString();
  } catch {
    return embedUrl;
  }
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function pickSpotifyGradient(value) {
  const seed = Math.abs(hashString(value));
  const palette = SPOTIFY_GRADIENTS[seed % SPOTIFY_GRADIENTS.length];
  return `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`;
}

function initialsFromLabel(label) {
  if (!label) {
    return "SP";
  }
  const parts = label.split(" ").filter(Boolean);
  if (!parts.length) {
    return label.slice(0, 2).toUpperCase();
  }
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

function formatSpotifyLabel(type, openUrl) {
  const prefix = type ? type[0].toUpperCase() + type.slice(1) : "Spotify";
  if (!openUrl) {
    return prefix;
  }
  const id = openUrl.split("/").filter(Boolean).pop() || "";
  if (!id) {
    return prefix;
  }
  return `${prefix} ${id.slice(0, 6)}`;
}

export default function App() {
  const [tab, setTab] = useState("Pomodoro");
  const [settings, setSettings] = useState(loadSettings());
  const [health, setHealth] = useState("checking");
  const [spotifyState, setSpotifyState] = useState(loadSpotifyState());
  const [spotifyLibrary, setSpotifyLibrary] = useState(loadSpotifyLibrary());
  const [spotifyAuth, setSpotifyAuth] = useState(loadSpotifyAuth());
  const [spotifyProfile, setSpotifyProfile] = useState(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [spotifyTracks, setSpotifyTracks] = useState(loadSpotifyTracks());
  const [spotifyQueue, setSpotifyQueue] = useState(null);
  const [spotifySyncing, setSpotifySyncing] = useState(false);
  const [spotifyExpanded, setSpotifyExpanded] = useState(false);
  const [spotifyMessage, setSpotifyMessage] = useState("");
  const baseUrl = settings.backendUrl;
  const dockVisible = settings.spotifyDockVisible !== false;

  const updateSettings = (changes) => {
    const next = { ...settings, ...changes };
    setSettings(next);
    saveSettings(next);
  };

  useEffect(() => {
    apiGet(baseUrl, "/health").then((res) => {
      setHealth(res.ok ? "ok" : "error");
    });
  }, [baseUrl]);

  useEffect(() => {
    saveSpotifyState(spotifyState);
  }, [spotifyState]);

  useEffect(() => {
    saveSpotifyLibrary(spotifyLibrary);
  }, [spotifyLibrary]);

  useEffect(() => {
    saveSpotifyAuth(spotifyAuth);
  }, [spotifyAuth]);

  useEffect(() => {
    saveSpotifyTracks(spotifyTracks);
  }, [spotifyTracks]);

  useEffect(() => {
    setSpotifyExpanded(tab === "Spotify");
  }, [tab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    if (!code && !error) {
      return;
    }
    const raw = sessionStorage.getItem(SPOTIFY_PKCE_KEY);
    const pkce = raw ? JSON.parse(raw) : null;
    sessionStorage.removeItem(SPOTIFY_PKCE_KEY);
    const redirectUri = pkce?.redirectUri || `${window.location.origin}/`;
    if (error) {
      setSpotifyMessage(`Spotify login failed: ${error}`);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!pkce || pkce.state !== state) {
      setSpotifyMessage("Spotify login state mismatch. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    const clientId = settings.spotifyClientId?.trim() || pkce.clientId;
    if (!clientId) {
      setSpotifyMessage("Spotify Client ID is missing.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    apiPost(baseUrl, "/spotify/token", {
      client_id: clientId,
      code,
      code_verifier: pkce.verifier,
      redirect_uri: redirectUri
    }).then((res) => {
      if (!res.ok) {
        setSpotifyMessage(res.message || "Failed to exchange Spotify token.");
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }
      const data = res.data || {};
      const expiresIn = Number(data.expires_in || 0);
      const expiresAt = Date.now() + Math.max(expiresIn * 1000 - SPOTIFY_TOKEN_BUFFER_MS, 0);
      setSpotifyAuth({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type,
        scope: data.scope,
        expires_at: expiresAt
      });
      setSpotifyMessage("Spotify connected.");
      window.history.replaceState({}, "", window.location.pathname);
    });
  }, [baseUrl, settings.spotifyClientId]);

  const ensureSpotifyToken = async () => {
    if (!spotifyAuth?.access_token) {
      return null;
    }
    if (spotifyAuth.expires_at && Date.now() < spotifyAuth.expires_at) {
      return spotifyAuth.access_token;
    }
    if (!spotifyAuth.refresh_token) {
      return spotifyAuth.access_token;
    }
    const clientId = settings.spotifyClientId?.trim();
    if (!clientId) {
      return spotifyAuth.access_token;
    }
    const refresh = await apiPost(baseUrl, "/spotify/refresh", {
      client_id: clientId,
      refresh_token: spotifyAuth.refresh_token
    });
    if (!refresh.ok) {
      setSpotifyMessage(refresh.message || "Spotify refresh failed. Please reconnect.");
      return null;
    }
    const data = refresh.data || {};
    const expiresIn = Number(data.expires_in || 0);
    const expiresAt = Date.now() + Math.max(expiresIn * 1000 - SPOTIFY_TOKEN_BUFFER_MS, 0);
    const nextAuth = {
      ...spotifyAuth,
      access_token: data.access_token,
      token_type: data.token_type || spotifyAuth.token_type,
      scope: data.scope || spotifyAuth.scope,
      expires_at: expiresAt,
      refresh_token: data.refresh_token || spotifyAuth.refresh_token
    };
    setSpotifyAuth(nextAuth);
    return nextAuth.access_token;
  };

  const spotifyFetch = async (url) => {
    const token = await ensureSpotifyToken();
    if (!token) {
      return { error: "Spotify is not connected." };
    }
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.status === 401 && spotifyAuth?.refresh_token) {
      const refreshed = await ensureSpotifyToken();
      if (refreshed) {
        const retry = await fetch(url, {
          headers: { Authorization: `Bearer ${refreshed}` }
        });
        if (!retry.ok) {
          return { error: "Spotify request failed." };
        }
        return retry.json();
      }
    }
    if (!response.ok) {
      return { error: "Spotify request failed." };
    }
    return response.json();
  };

  const connectSpotify = async () => {
    const clientId = settings.spotifyClientId?.trim();
    if (!clientId) {
      setSpotifyMessage("Set your Spotify Client ID in Settings first.");
      return;
    }
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = randomState();
    const redirectUri = `${window.location.origin}/`;
    sessionStorage.setItem(
      SPOTIFY_PKCE_KEY,
      JSON.stringify({ verifier, state, redirectUri, clientId })
    );
    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", SPOTIFY_SCOPES.join(" "));
    window.location.href = authUrl.toString();
  };

  const disconnectSpotify = () => {
    setSpotifyAuth(null);
    setSpotifyProfile(null);
    setSpotifyPlaylists([]);
    setSpotifyQueue(null);
    setSpotifyMessage("Spotify disconnected.");
  };

  const loadSpotifyProfile = async () => {
    const data = await spotifyFetch("https://api.spotify.com/v1/me");
    if (data.error) {
      setSpotifyMessage(data.error);
      return;
    }
    setSpotifyProfile(data);
  };

  const loadSpotifyPlaylists = async () => {
    setSpotifySyncing(true);
    const items = [];
    let nextUrl = "https://api.spotify.com/v1/me/playlists?limit=50";
    while (nextUrl) {
      const data = await spotifyFetch(nextUrl);
      if (data.error) {
        setSpotifyMessage(data.error);
        break;
      }
      if (Array.isArray(data.items)) {
        items.push(
          ...data.items.map((item) => ({
            id: item.id,
            name: item.name,
            image: item.images?.[0]?.url || "",
            tracks_total: item.tracks?.total ?? 0,
            owner: item.owner?.display_name || item.owner?.id || ""
          }))
        );
      }
      nextUrl = data.next;
    }
    setSpotifyPlaylists(items);
    if (items.length) {
      setSpotifyMessage(`Loaded ${items.length} playlists.`);
    }
    setSpotifySyncing(false);
  };

  const loadPlaylistTracks = async (playlistId) => {
    const cached = spotifyTracks[playlistId];
    if (cached?.tracks?.length) {
      return cached.tracks;
    }
    setSpotifySyncing(true);
    const tracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,artists(name))),next`;
    while (nextUrl) {
      const data = await spotifyFetch(nextUrl);
      if (data.error) {
        setSpotifyMessage(data.error);
        break;
      }
      if (Array.isArray(data.items)) {
        data.items.forEach((entry) => {
          const track = entry.track;
          if (track?.id) {
            tracks.push({
              id: track.id,
              name: track.name,
              artists: normalizeArtists(track.artists)
            });
          }
        });
      }
      nextUrl = data.next;
    }
    if (tracks.length) {
      setSpotifyTracks((prev) => ({
        ...prev,
        [playlistId]: { tracks }
      }));
      setSpotifyMessage(`Synced ${tracks.length} tracks.`);
    }
    setSpotifySyncing(false);
    return tracks;
  };

  const playTrack = (track, label) => {
    if (!track?.id) {
      return;
    }
    const baseLabel = `${track.name || "Track"}${track.artists ? ` - ${track.artists}` : ""}`;
    const trackLabel = label ? `${baseLabel} | ${label}` : baseLabel;
    setSpotifyState((prev) => ({
      ...prev,
      embedUrl: `https://open.spotify.com/embed/track/${track.id}`,
      openUrl: `https://open.spotify.com/track/${track.id}`,
      type: "track",
      label: trackLabel
    }));
    setSpotifyExpanded(true);
  };

  const shufflePlaylist = async (playlist) => {
    const tracks = await loadPlaylistTracks(playlist.id);
    if (!tracks.length) {
      setSpotifyMessage("No tracks found for this playlist.");
      return;
    }
    const order = shuffleArray(tracks);
    setSpotifyQueue({
      playlistId: playlist.id,
      label: playlist.name,
      tracks: order,
      index: 0
    });
    playTrack(order[0], playlist.name);
  };

  const playPlaylist = (playlist) => {
    setSpotifyState((prev) => ({
      ...prev,
      embedUrl: `https://open.spotify.com/embed/playlist/${playlist.id}`,
      openUrl: `https://open.spotify.com/playlist/${playlist.id}`,
      type: "playlist",
      label: playlist.name
    }));
    setSpotifyExpanded(true);
    setSpotifyQueue(null);
  };

  const nextQueueTrack = () => {
    if (!spotifyQueue?.tracks?.length) {
      return;
    }
    const nextIndex = (spotifyQueue.index + 1) % spotifyQueue.tracks.length;
    const track = spotifyQueue.tracks[nextIndex];
    setSpotifyQueue((prev) => ({ ...prev, index: nextIndex }));
    playTrack(track, spotifyQueue.label);
  };

  const applySpotify = () => {
    const result = buildSpotifyUrls(spotifyState.input);
    if (!result) {
      setSpotifyMessage("Please enter a valid Spotify link or URI.");
      return;
    }
    const match = spotifyLibrary.find((item) => item.embedUrl === result.embedUrl);
    setSpotifyState((prev) => ({
      ...prev,
      embedUrl: result.embedUrl,
      openUrl: result.openUrl,
      type: result.type,
      label: match?.label || formatSpotifyLabel(result.type, result.openUrl)
    }));
    setSpotifyMessage("Player loaded.");
    setSpotifyExpanded(true);
    setSpotifyQueue(null);
  };

  const addSpotifyItem = (label, input) => {
    const result = buildSpotifyUrls(input);
    if (!result) {
      setSpotifyMessage("Please enter a valid Spotify link or URI.");
      return false;
    }
    if (spotifyLibrary.some((item) => item.embedUrl === result.embedUrl)) {
      setSpotifyMessage("This item is already in your library.");
      return false;
    }
    const safeLabel = label.trim() || formatSpotifyLabel(result.type, result.openUrl);
    const newItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: safeLabel,
      input: input.trim(),
      embedUrl: result.embedUrl,
      openUrl: result.openUrl,
      type: result.type
    };
    setSpotifyLibrary((prev) => [...prev, newItem]);
    setSpotifyMessage("Saved to your library.");
    return true;
  };

  const removeSpotifyItem = (id) => {
    setSpotifyLibrary((prev) => prev.filter((item) => item.id !== id));
    if (spotifyState.embedUrl && spotifyLibrary.find((item) => item.id === id)?.embedUrl === spotifyState.embedUrl) {
      setSpotifyState((prev) => ({ ...prev, label: "" }));
    }
  };

  const selectSpotifyItem = (item) => {
    setSpotifyState((prev) => ({
      ...prev,
      input: item.input,
      embedUrl: item.embedUrl,
      openUrl: item.openUrl,
      type: item.type,
      label: item.label
    }));
    setSpotifyMessage("Player loaded.");
    setSpotifyExpanded(true);
    setSpotifyQueue(null);
  };

  const shuffleSpotify = () => {
    if (!spotifyLibrary.length) {
      setSpotifyMessage("Add items to your library first.");
      return;
    }
    const pick = spotifyLibrary[Math.floor(Math.random() * spotifyLibrary.length)];
    selectSpotifyItem(pick);
  };

  useEffect(() => {
    if (spotifyAuth?.access_token) {
      loadSpotifyProfile();
      loadSpotifyPlaylists();
    }
  }, [spotifyAuth?.access_token]);

  return (
    <div className="app">
      <header className="top-bar">
        <div className="brand">
          <img className="dragon-mark" src="/dragon.svg" alt="Dragon emblem" />
          <div>
            <h1>Dragon Dev Companion Web</h1>
            <div className="tagline">Offline-first command center for focused builds.</div>
            <div className="muted">Pomodoro | Tasks | README | VS Code | GitHub | Spotify</div>
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

      {tab === "Pomodoro" && <PomodoroPanel settings={settings} />}
      {tab === "Tasks" && <TasksPanel baseUrl={baseUrl} />}
      {tab === "README" && <ReadmePanel baseUrl={baseUrl} />}
      {tab === "VS Code" && <VscodePanel baseUrl={baseUrl} />}
      {tab === "GitHub" && <GitHubPanel baseUrl={baseUrl} />}
      {tab === "Spotify" && (
        <SpotifyPanel
          clientId={settings.spotifyClientId}
          connected={Boolean(spotifyAuth?.access_token)}
          profile={spotifyProfile}
          playlists={spotifyPlaylists}
          syncing={spotifySyncing}
          input={spotifyState.input}
          onInputChange={(value) => {
            setSpotifyState((prev) => ({ ...prev, input: value }));
            setSpotifyMessage("");
          }}
          onApply={applySpotify}
          message={spotifyMessage}
          openUrl={spotifyState.openUrl}
          hasPlayer={Boolean(spotifyState.embedUrl)}
          currentLabel={spotifyState.label}
          currentType={spotifyState.type}
          library={spotifyLibrary}
          onAddItem={addSpotifyItem}
          onRemoveItem={removeSpotifyItem}
          onSelectItem={selectSpotifyItem}
          onShuffle={shuffleSpotify}
          onConnect={connectSpotify}
          onDisconnect={disconnectSpotify}
          onSyncPlaylists={loadSpotifyPlaylists}
          onPlayPlaylist={playPlaylist}
          onShufflePlaylist={shufflePlaylist}
          queue={spotifyQueue}
          onNextTrack={nextQueueTrack}
          dockVisible={dockVisible}
          onToggleDock={(visible) => updateSettings({ spotifyDockVisible: visible })}
        />
      )}
      {tab === "Settings" && (
        <SettingsPanel
          settings={settings}
          onSave={updateSettings}
        />
      )}
      {tab === "Git" && <GitPanel baseUrl={baseUrl} />}

      <SpotifyDock
        embedUrl={spotifyState.embedUrl}
        openUrl={spotifyState.openUrl}
        type={spotifyState.type}
        label={spotifyState.label}
        expanded={spotifyExpanded}
        hidden={!dockVisible}
        onToggle={() => setSpotifyExpanded((prev) => !prev)}
        onNext={nextQueueTrack}
        hasQueue={Boolean(spotifyQueue?.tracks?.length)}
        onHide={() => updateSettings({ spotifyDockVisible: false })}
      />
    </div>
  );
}

function PomodoroPanel({ settings }) {
  const [focusMinutes, setFocusMinutes] = useState(settings.focusMinutes);
  const [breakMinutes, setBreakMinutes] = useState(settings.breakMinutes);
  const [mode, setMode] = useState("focus");
  const [timeLeft, setTimeLeft] = useState(settings.focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [stopPrompt, setStopPrompt] = useState(false);
  const [repeatCycle, setRepeatCycle] = useState(true);
  const [tasks, setTasks] = useState(() => loadPomodoroTasks());
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    setFocusMinutes(settings.focusMinutes);
    setBreakMinutes(settings.breakMinutes);
  }, [settings.focusMinutes, settings.breakMinutes]);

  useEffect(() => {
    savePomodoroTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    if (isRunning) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || timeLeft > 0) {
      return;
    }
    if (repeatCycle) {
      const nextMode = mode === "focus" ? "break" : "focus";
      setMode(nextMode);
      setTimeLeft((nextMode === "focus" ? focusMinutes : breakMinutes) * 60);
      setIsRunning(true);
    } else {
      setIsRunning(false);
      setStopPrompt(false);
    }
  }, [timeLeft, isRunning, repeatCycle, mode, focusMinutes, breakMinutes]);

  useEffect(() => {
    if (!isRunning && !stopPrompt) {
      const base = mode === "focus" ? focusMinutes : breakMinutes;
      setTimeLeft(base * 60);
    }
  }, [focusMinutes, breakMinutes, mode, isRunning, stopPrompt]);

  const clampMinutes = (value, minValue) => Math.max(minValue, Math.round(value));
  const adjustFocus = (delta) => {
    setFocusMinutes((prev) => clampMinutes(prev + delta, 5));
  };
  const adjustBreak = (delta) => {
    setBreakMinutes((prev) => clampMinutes(prev + delta, 5));
  };

  const controlsHidden = isRunning || stopPrompt;
  const startFocus = () => {
    setMode("focus");
    setTimeLeft(focusMinutes * 60);
    setIsRunning(true);
    setStopPrompt(false);
  };
  const stopSession = () => {
    setIsRunning(false);
    setStopPrompt(true);
  };
  const continueSession = () => {
    setStopPrompt(false);
    setIsRunning(true);
  };
  const endSession = () => {
    setIsRunning(false);
    setStopPrompt(false);
    setMode("focus");
    setTimeLeft(focusMinutes * 60);
  };

  const totalSeconds = (mode === "focus" ? focusMinutes : breakMinutes) * 60;
  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - Math.min(1, Math.max(0, progress)));
  const ringColor = mode === "focus" ? "#4da3ff" : "#38d98b";

  const addTask = (event) => {
    event.preventDefault();
    const value = newTask.trim();
    if (!value) {
      return;
    }
    setTasks((prev) => [{ id: Date.now(), text: value, completed: false }, ...prev]);
    setNewTask("");
  };

  const toggleTask = (taskId) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const removeTask = (taskId) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  return (
    <div className="pomodoro-layout">
      <div className="pomodoro-main card">
        <div className="pomodoro-hero">
          <div className="pomodoro-ring-wrap">
            <svg className="pomodoro-ring-svg" viewBox="0 0 260 260">
              <circle cx="130" cy="130" r={radius} className="pomodoro-ring-track" />
              <circle
                cx="130"
                cy="130"
                r={radius}
                className="pomodoro-ring-progress"
                stroke={ringColor}
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
              />
            </svg>
            <div className="pomodoro-center">
              <div className="pomodoro-mode">{mode === "focus" ? "Focus" : "Break"}</div>
              <div className="pomodoro-time">{formatTimer(timeLeft)}</div>
            </div>
          </div>

          <div className="pomodoro-side">
            <div className={`pomodoro-break-badge ${mode === "break" ? "active" : ""}`}>
              <div className="pomodoro-break-time">{formatTimer(breakMinutes * 60)}</div>
              <div className="pomodoro-break-label">Break</div>
            </div>
            {!controlsHidden ? (
              <div className="pomodoro-break-actions">
                <button onClick={() => adjustBreak(-1)}>-1:00</button>
                <button onClick={() => adjustBreak(1)}>+1:00</button>
              </div>
            ) : null}
            {!controlsHidden ? (
              <label className="pomodoro-repeat">
                <input
                  type="checkbox"
                  checked={repeatCycle}
                  onChange={(event) => setRepeatCycle(event.target.checked)}
                />
                <span>Repeat</span>
              </label>
            ) : null}
          </div>
        </div>

        {!controlsHidden ? (
          <div className="pomodoro-focus-actions">
            <button onClick={() => adjustFocus(-5)}>-5:00</button>
            <button onClick={() => adjustFocus(5)}>+5:00</button>
          </div>
        ) : null}

        <div className="pomodoro-main-actions">
          {stopPrompt ? (
            <>
              <button className="primary" onClick={continueSession}>Continue</button>
              <button className="ghost" onClick={endSession}>End</button>
            </>
          ) : isRunning ? (
            <button className="danger" onClick={stopSession}>Stop</button>
          ) : (
            <button className="primary" onClick={startFocus}>Start</button>
          )}
        </div>
      </div>

      <aside className="pomodoro-sidebar">
        <div className="pomodoro-sidebar-header">
          <div>
            <div className="pomodoro-sidebar-title">Task List</div>
            <div className="pomodoro-sidebar-subtitle">Local tasks for this session.</div>
          </div>
        </div>
        <form className="pomodoro-task-form" onSubmit={addTask}>
          <input
            type="text"
            placeholder="Add a task..."
            value={newTask}
            onChange={(event) => setNewTask(event.target.value)}
          />
          <button type="submit" className="primary">Add</button>
        </form>
        <div className="pomodoro-task-list">
          {tasks.length ? (
            tasks.map((task) => (
              <div className={`pomodoro-task ${task.completed ? "completed" : ""}`} key={task.id}>
                <button type="button" className="pomodoro-task-toggle" onClick={() => toggleTask(task.id)}>
                  {task.completed ? "Done" : "Todo"}
                </button>
                <div className="pomodoro-task-text">{task.text}</div>
                <button type="button" className="pomodoro-task-remove" onClick={() => removeTask(task.id)}>
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className="muted">No tasks yet. Add one to stay focused.</div>
          )}
        </div>
      </aside>
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
          <label>Spotify Client ID</label>
          <input
            value={form.spotifyClientId || ""}
            onChange={(e) => setForm({ ...form, spotifyClientId: e.target.value })}
            placeholder="Paste your Spotify Client ID"
          />
        </div>
        <div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={form.spotifyDockVisible !== false}
              onChange={(e) => setForm({ ...form, spotifyDockVisible: e.target.checked })}
            />
            <span>Show Spotify player bar</span>
          </label>
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

function SpotifyPanel({
  clientId,
  connected,
  profile,
  playlists,
  syncing,
  input,
  onInputChange,
  onApply,
  message,
  openUrl,
  hasPlayer,
  currentLabel,
  currentType,
  library,
  onAddItem,
  onRemoveItem,
  onSelectItem,
  onShuffle,
  onConnect,
  onDisconnect,
  onSyncPlaylists,
  onPlayPlaylist,
  onShufflePlaylist,
  queue,
  onNextTrack,
  dockVisible,
  onToggleDock
}) {
  const [label, setLabel] = useState("");
  const [filter, setFilter] = useState("all");
  const items = Array.isArray(library) ? library : [];
  const playlistItems = Array.isArray(playlists) ? playlists : [];
  const filtered = items.filter((item) => {
    if (filter === "all") {
      return true;
    }
    if (filter === "music") {
      return !SPOTIFY_PODCAST_TYPES.has(item.type);
    }
    if (filter === "podcasts") {
      return SPOTIFY_PODCAST_TYPES.has(item.type);
    }
    return true;
  });
  const nowLabel = currentLabel || (hasPlayer ? "Current selection" : "No track loaded");
  const nowType = currentType ? currentType[0].toUpperCase() + currentType.slice(1) : "Spotify";
  const nowGradient = pickSpotifyGradient(nowLabel);
  const profileName = profile?.display_name || "Not connected";
  const profileImage = profile?.images?.[0]?.url || "";
  const profileId = profile?.id || "";
  const isSyncing = Boolean(syncing);
  const hasQueue = Boolean(queue?.tracks?.length);
  const messageTone = message && /fail|error|missing|invalid/i.test(message) ? "error" : "muted";

  const addToLibrary = () => {
    if (!input.trim()) {
      return;
    }
    const added = onAddItem(label, input);
    if (added) {
      setLabel("");
    }
  };

  return (
    <div className="grid">
      <div className="card spotify-card">
        <div className="activity-header">
          <div>
            <h3 className="section-title section-title-lg">Spotify Lounge</h3>
            <div className="muted">Paste a Spotify link or URI to load the player.</div>
          </div>
          {hasPlayer ? <div className="pill">Ready</div> : <div className="pill">Idle</div>}
        </div>
        <div className="spotify-account">
          {profileImage ? (
            <img className="spotify-avatar" src={profileImage} alt="Spotify avatar" />
          ) : (
            <div className="spotify-avatar placeholder">{initialsFromLabel(profileName)}</div>
          )}
          <div className="spotify-account-info">
            <div className="spotify-account-name">{profileName}</div>
            <div className="muted">
              {connected ? `Connected as ${profileId || "Spotify user"}` : "Connect your Spotify account to load playlists."}
            </div>
          </div>
          <div className="spotify-account-actions">
            {connected ? (
              <>
                <button className="primary" onClick={onSyncPlaylists} disabled={isSyncing}>
                  {isSyncing ? "Syncing..." : "Sync Playlists"}
                </button>
                <button className="ghost" onClick={onDisconnect}>Disconnect</button>
              </>
            ) : (
              <button className="primary" onClick={onConnect}>
                Connect Spotify
              </button>
            )}
          </div>
        </div>
        {!clientId ? (
          <div className="spotify-hint">
            Add your Spotify Client ID in Settings before connecting.
          </div>
        ) : null}
        {message ? <div className={messageTone}>{message}</div> : null}
        <div className="spotify-form">
          <label>Spotify link or URI</label>
          <input
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="https://open.spotify.com/track/ID or spotify:track:ID"
          />
          <label>Label (optional)</label>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="My coding playlist"
          />
          <div className="actions">
            <button className="primary" onClick={onApply}>Load Player</button>
            <button onClick={addToLibrary}>Save to Library</button>
            <button className="ghost" onClick={onShuffle}>Shuffle</button>
          </div>
          {openUrl ? (
            <a className="spotify-link" href={openUrl} target="_blank" rel="noreferrer">
              {openUrl}
            </a>
          ) : (
            <div className="muted">No Spotify link loaded.</div>
          )}
          <div className="muted">
            Playback depends on your Spotify login and account type.
          </div>
        </div>
      </div>

      <div className="spotify-layout">
        <div className="spotify-stack">
          <div className="card soft spotify-playlists">
            <div className="activity-header">
              <div>
                <h3 className="section-title section-title-lg">My Playlists</h3>
                <div className="muted">Sync playlists from your Spotify account.</div>
              </div>
            </div>
            <div className="spotify-playlist-grid">
              {playlistItems.length ? (
                playlistItems.map((item) => (
                  <div className="spotify-playlist-card" key={item.id}>
                    {item.image ? (
                      <img className="spotify-playlist-cover" src={item.image} alt={item.name} />
                    ) : (
                      <div
                        className="spotify-playlist-cover placeholder"
                        style={{ background: pickSpotifyGradient(item.name || "spotify") }}
                      >
                        <span>{initialsFromLabel(item.name)}</span>
                      </div>
                    )}
                    <div className="spotify-playlist-meta">
                      <div className="spotify-playlist-title">{item.name}</div>
                      <div className="spotify-playlist-subtitle">
                        {item.tracks_total} tracks - {item.owner || "unknown"}
                      </div>
                    </div>
                    <div className="spotify-playlist-actions">
                      <button className="primary" onClick={() => onPlayPlaylist(item)}>Play</button>
                      <button className="ghost" onClick={() => onShufflePlaylist(item)}>Shuffle</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="muted">
                  {connected ? "No playlists loaded. Click Sync Playlists above." : "Connect Spotify to see playlists."}
                </div>
              )}
            </div>
          </div>

          <div className="card soft spotify-library">
            <div className="activity-header">
              <div>
                <h3 className="section-title section-title-lg">Quick Picks</h3>
                <div className="muted">Your saved playlists and links.</div>
              </div>
              <div className="spotify-filters">
                {SPOTIFY_FILTERS.map((item) => (
                  <button
                    key={item}
                    className={`chip ${filter === item ? "active" : ""}`}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="spotify-scroll">
              {filtered.length ? (
                <div className="spotify-scroll-row">
                  {filtered.map((item) => (
                    <div className="spotify-tile" key={item.id}>
                      <div
                        className="spotify-tile-cover"
                        style={{ background: pickSpotifyGradient(item.label || item.openUrl || "spotify") }}
                      >
                        <span>{initialsFromLabel(item.label || item.type)}</span>
                      </div>
                      <div className="spotify-tile-meta">
                        <div className="spotify-tile-title">{item.label}</div>
                        <div className="spotify-tile-subtitle">{item.type}</div>
                      </div>
                      <div className="spotify-tile-actions">
                        <button className="primary" onClick={() => onSelectItem(item)}>Play</button>
                        <button className="ghost" onClick={() => onRemoveItem(item.id)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted">No items yet. Save a playlist to get started.</div>
              )}
            </div>
          </div>
        </div>

        <div className="card soft spotify-now">
          <div className="spotify-now-cover" style={{ background: nowGradient }}>
            <span>{initialsFromLabel(nowLabel)}</span>
          </div>
          <div className="spotify-now-title">{nowLabel}</div>
          <div className="spotify-now-type">{nowType}</div>
          {hasQueue ? (
            <div className="spotify-queue">
              <div className="muted">Queue: {queue?.tracks?.length || 0} tracks</div>
              <button className="primary" onClick={onNextTrack}>Next track</button>
            </div>
          ) : (
            <div className="muted">Shuffle a playlist to start a queue.</div>
          )}
          <div className="spotify-dock-toggle">
            <div className="muted">Player bar</div>
            <button className="ghost" onClick={() => onToggleDock(!dockVisible)}>
              {dockVisible ? "Hide player bar" : "Show player bar"}
            </button>
          </div>
          <div className="muted">Player controls stay pinned at the bottom across tabs.</div>
        </div>
      </div>
    </div>
  );
}

function SpotifyDock({ embedUrl, openUrl, type, label, expanded, hidden, onToggle, onNext, hasQueue, onHide }) {
  if (!embedUrl) {
    return null;
  }
  const height = spotifyPlayerHeight(type, expanded);
  return (
    <div className={`spotify-dock ${expanded ? "expanded" : "collapsed"} ${hidden ? "hidden" : ""}`}>
      <div className="spotify-dock-bar">
        <div className="spotify-dock-title">{label || "Spotify Player"}</div>
        <div className="spotify-dock-actions">
          {openUrl ? (
            <a className="spotify-open" href={openUrl} target="_blank" rel="noreferrer">
              Open
            </a>
          ) : null}
          {hasQueue ? (
            <button className="ghost" onClick={onNext}>Next</button>
          ) : null}
          <button className="ghost" onClick={onToggle}>
            {expanded ? "Minimize" : "Expand"}
          </button>
          <button className="ghost" onClick={onHide}>Hide</button>
        </div>
      </div>
      <iframe
        title="Spotify player"
        src={withSpotifyParams(embedUrl)}
        width="100%"
        height={height}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
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

function formatTimer(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = Math.floor(safeSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

