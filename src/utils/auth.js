export async function fetchAccessToken() {
  try {
    const response = await fetch("http://localhost:3002/refresh-token");
    if (!response.ok) throw new Error("Failed to fetch token");
    const data = await response.json();
    return data.access_token;  // new access token
  } catch (error) {
    console.error("Error fetching access token:", error);
    return null;
  }
}
