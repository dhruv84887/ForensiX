const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  ?? (import.meta.env.DEV ? "http://localhost:5000" : "")
).replace(/\/$/, "");

export async function apiRequest(path, payload) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: payload === undefined ? "GET" : "POST",
      headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      credentials: "include",
    });
  } catch {
    throw new Error("Could not reach the ForensiX API. Run npm run dev from the project folder, then try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The ForensiX demo API returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }

  return data;
}
