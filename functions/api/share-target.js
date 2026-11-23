// POST /share-target — fallback for the Android share sheet when the app's service worker isn't active yet.
// Text is passed to the app in the address; files need the installed app (service worker) or the file picker.
export async function onRequestPost({ request }) {
  const origin = new URL(request.url).origin;
  let text = "";
  try {
    const form = await request.formData();
    text = ["title", "text", "url"].map((k) => form.get(k)).filter((v) => typeof v === "string" && v).join("\n");
    const file = form.get("file");
    if (!text && file && typeof file.text === "function" && !/\.zip$/i.test(file.name || "")) text = await file.text();
  } catch { /* ignore */ }
  const q = text ? `shared_text=${encodeURIComponent(text.slice(-6000))}` : "shared=missing";
  return Response.redirect(`${origin}/app.html?${q}`, 303);
}
