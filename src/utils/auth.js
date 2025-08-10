const API_CALL = "https://9e74ab69-e2c5-4922-8744-e12d7bc1e324-00-3orw17jg8x8ec.spock.replit.dev";

export async function fetchAccessToken() {
  try {
    const response = await fetch(API_CALL);
    if (!response.ok) throw new Error("Failed to fetch token");
    const data = await response.json();
    return data.access_token;  // new access token
  } catch (error) {
    console.error("Error fetching access token:", error);
    return null;
  }
}
