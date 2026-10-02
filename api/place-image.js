// Vercel 서버 함수: /api/place-image?q=가게이름 동네
// 카카오(Daum) 블로그 검색 결과의 대표 미리보기 이미지를 최대 5장 돌려줘요.
// 블로그 결과가 없으면 이미지 검색으로 대신 찾아요.
// 필요한 것: Vercel > Project > Settings > Environment Variables 에 KAKAO_REST_KEY (카카오 REST API 키)
module.exports = async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 60);
  if (!q) return res.status(400).json({ error: "q 파라미터가 필요해요" });
  const key = process.env.KAKAO_REST_KEY;
  if (!key) return res.status(500).json({ error: "KAKAO_REST_KEY 환경변수가 없어요" });

  const headers = { Authorization: `KakaoAK ${key}` };
  const strip = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").trim();
  const https = (u) => String(u || "").replace(/^http:\/\//, "https://");

  try {
    let results = [];
    const blog = await fetch(`https://dapi.kakao.com/v2/search/blog?query=${encodeURIComponent(q)}&size=15&sort=accuracy`, { headers });
    if (blog.ok) {
      const j = await blog.json();
      results = (j.documents || [])
        .filter((d) => d.thumbnail)
        .map((d) => ({ image: https(d.thumbnail), source: d.url, title: strip(d.title), from: strip(d.blogname) || "블로그" }));
    }
    if (results.length < 3) {
      const img = await fetch(`https://dapi.kakao.com/v2/search/image?query=${encodeURIComponent(q)}&size=10&sort=accuracy`, { headers });
      if (img.ok) {
        const j = await img.json();
        results = results.concat((j.documents || []).map((d) => ({ image: https(d.thumbnail_url), source: d.doc_url, title: "", from: strip(d.display_sitename) || "웹" })));
      }
    }
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({ results: results.slice(0, 5) });
  } catch (e) {
    return res.status(502).json({ error: "카카오 검색에 연결하지 못했어요" });
  }
};
