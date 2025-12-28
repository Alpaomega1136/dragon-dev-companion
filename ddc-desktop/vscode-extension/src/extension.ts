import * as vscode from "vscode";
import * as http from "http";
import * as https from "https";
import * as path from "path";

type EventType = "active" | "inactive" | "typing";

let heartbeatTimer: NodeJS.Timeout | undefined;
let typingTimer: NodeJS.Timeout | undefined;
let pendingTypingDetails: string | undefined;

function getConfig() {
  const cfg = vscode.workspace.getConfiguration("ddcDesktop");
  return {
    backendUrl: cfg.get<string>("backendUrl", "http://127.0.0.1:5123"),
    typingDebounceMs: cfg.get<number>("typingDebounceMs", 10000),
    activeHeartbeatSeconds: cfg.get<number>("activeHeartbeatSeconds", 60)
  };
}

function postEvent(eventType: EventType, details?: string) {
  const { backendUrl } = getConfig();
  const url = new URL("/vscode/event", backendUrl);
  const payload = JSON.stringify({ event_type: eventType, details });
  const lib = url.protocol === "https:" ? https : http;

  const req = lib.request(
    {
      method: "POST",
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    },
    () => {
      // ignore response
    }
  );
  req.on("error", () => {
    // ignore errors to keep extension quiet
  });
  req.write(payload);
  req.end();
}

function handleWindowFocus(focused: boolean) {
  postEvent(focused ? "active" : "inactive");
}

function handleTyping(doc: vscode.TextDocument) {
  const { typingDebounceMs } = getConfig();
  const fileName = path.basename(doc.fileName);
  pendingTypingDetails = fileName ? `file:${fileName}` : undefined;
  if (typingTimer) {
    clearTimeout(typingTimer);
  }
  typingTimer = setTimeout(() => {
    postEvent("typing", pendingTypingDetails);
    typingTimer = undefined;
  }, Math.max(typingDebounceMs, 1000));
}

export function activate(context: vscode.ExtensionContext) {
  handleWindowFocus(vscode.window.state.focused);

  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => {
      handleWindowFocus(state.focused);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (!vscode.window.state.focused) {
        return;
      }
      handleTyping(event.document);
    })
  );

  const startHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    const { activeHeartbeatSeconds } = getConfig();
    heartbeatTimer = setInterval(() => {
      if (vscode.window.state.focused) {
        postEvent("active");
      }
    }, Math.max(activeHeartbeatSeconds, 10) * 1000);
  };

  startHeartbeat();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("ddcDesktop")) {
        startHeartbeat();
      }
    })
  );
}

export function deactivate() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  if (typingTimer) {
    clearTimeout(typingTimer);
  }
  postEvent("inactive");
}
