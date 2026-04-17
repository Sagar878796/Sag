export default {
  async fetch(request) {

    const url = "http://datahub11.com/get.php?username=910039307&password=782745303&type=m3u_plus&output=ts";

    const res = await fetch(url);
    const text = await res.text();

    return new Response(text, {
      headers: {
        "Content-Type": "application/x-mpegURL",
        "Cache-Control": "public, max-age=300"
      }
    });
  }
};
