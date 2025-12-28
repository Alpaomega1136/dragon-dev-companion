export async function apiRequest(baseUrl, path, method = "GET", body = null) {
  try {
    const options = { method };
    if (body) {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}${path}`, options);
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      return { ok: false, message: data.detail || data.message || `HTTP ${res.status}` };
    }
    return data.ok === false ? data : { ok: true, data: data.data ?? data };
  } catch (err) {
    return { ok: false, message: `Tidak bisa menghubungi backend: ${err}` };
  }
}

export function apiGet(baseUrl, path) {
  return apiRequest(baseUrl, path, "GET");
}

export function apiPost(baseUrl, path, body) {
  return apiRequest(baseUrl, path, "POST", body);
}

export function apiPut(baseUrl, path, body) {
  return apiRequest(baseUrl, path, "PUT", body);
}

export function apiDelete(baseUrl, path) {
  return apiRequest(baseUrl, path, "DELETE");
}
