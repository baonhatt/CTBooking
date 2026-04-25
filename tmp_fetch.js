const checkHeaders = async () => {
  try {
    const res = await fetch('https://cinesphere.com.vn/posts/cinesphere-bung-no-tai-ngay-tieng-trung-quoc-te-2026-2?nocache=' + Date.now());
    console.log("Status:", res.status);
    console.log("X-Function-Executed:", res.headers.get('x-function-executed'));
    const text = await res.text();
    const titleMatch = text.match(/<title>(.*?)<\/title>/);
    console.log("Title: ", titleMatch ? titleMatch[1] : null);
  } catch (e) {
    console.error(e);
  }
}
checkHeaders();
