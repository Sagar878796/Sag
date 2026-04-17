export default {
  async fetch(request, env, ctx) {

    const CACHE_KEY = "m3u_ultra";

    // ⚡ KV instant response
    let cached = await env.KV.get(CACHE_KEY);
    if (cached) {
      ctx.waitUntil(updateM3U(env));
      return new Response(cached, {
        headers: {
          "Content-Type": "application/x-mpegURL",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    const fresh = await updateM3U(env);
    return new Response(fresh);
  }
};

async function updateM3U(env) {

  const host = env.HOST;
  const mac = env.MAC;
  const serial = env.SERIAL;
  const device1 = env.DEVICE1;
  const device2 = env.DEVICE2;

  let headers = {
    "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C)",
    "X-User-Agent": "Model: MAG254",
    "Referer": host + "c/",
    "Cookie": `mac=${mac}`,
    "X-Serial-Number": serial,
    "X-Device-Id": device1,
    "X-Device-Id2": device2
  };

  try {

    // 🔑 Token
    const tokenRes = await fetch(`${host}portal.php?type=stb&action=handshake&JsHttpRequest=1-xml`, { headers });
    const token = (await tokenRes.json()).js.token;

    headers["Authorization"] = `Bearer ${token}`;

    // 📺 Channels
    const chRes = await fetch(`${host}portal.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`, { headers });
    let channels = (await chRes.json()).js.data;

    // 🇮🇳 Filter + limit
    channels = channels
      .filter(ch => ch.name.match(/star|zee|sony|sports|news/i))
      .slice(0, 100);

    let m3u = `#EXTM3U url-tvg="https://epgshare01.online/epgshare01/epg_ripper_IN1.xml.gz"\n`;

    // ⚡ parallel fetch
    const promises = channels.map(async (ch) => {
      try {
        const res = await fetch(`${host}portal.php?type=itv&action=create_link&cmd=${ch.cmd}&JsHttpRequest=1-xml`, { headers });
        const data = await res.json();

        return `#EXTINF:-1 tvg-name="${ch.name}",${ch.name}\n${data.js.cmd}`;
      } catch {
        return "";
      }
    });

    m3u += (await Promise.all(promises)).join("\n");

    // 💾 KV cache
    await env.KV.put(CACHE_KEY, m3u, { expirationTtl: 300 });

    return m3u;

  } catch (err) {
    return "#EXTM3U\n#EXTINF:-1,Error\nhttp://error";
  }
}
