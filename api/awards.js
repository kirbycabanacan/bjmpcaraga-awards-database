
export default async function handler(req, res) {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7a_GVR4J6QFG6s9OcrOCzfJzXT-ytStO9A7WiJkZcaMNbziucbsUiwDnjrCjkFhXSSqGjP_KuPHsk/pub?gid=0&single=true&output=csv";

  try {
    const response = await fetch(CSV_URL);

    if (!response.ok) {
      return res.status(502).json({
        error: "Unable to retrieve Google Sheets data.",
        status: response.status
      });
    }

    const csv = await response.text();

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );

    return res.status(200).send(csv);

  } catch (error) {
    console.error("Google Sheets error:", error);

    return res.status(500).json({
      error: "Database connection failed."
    });
  }
}
